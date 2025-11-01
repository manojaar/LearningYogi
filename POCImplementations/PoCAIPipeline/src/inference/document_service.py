"""
Fine-tuned Document Understanding Service

This service provides timetable extraction using fine-tuned
document understanding models.
"""

import os
import json
import torch
from pathlib import Path
from typing import Dict, Optional, List
from PIL import Image

from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel


class TimeBlock:
    """Timetable time block"""
    def __init__(self, day: str, name: str, start_time: str, end_time: str, notes: Optional[str] = None):
        self.day = day
        self.name = name
        self.start_time = start_time
        self.end_time = end_time
        self.notes = notes
    
    def dict(self):
        return {
            'day': self.day,
            'name': self.name,
            'startTime': self.start_time,
            'endTime': self.end_time,
            'notes': self.notes
        }


class TimetableData:
    """Extracted timetable data"""
    def __init__(
        self,
        teacher: Optional[str] = None,
        class_name: Optional[str] = None,
        term: Optional[str] = None,
        year: Optional[int] = None,
        timeblocks: Optional[List[TimeBlock]] = None,
        confidence: float = 0.0
    ):
        self.teacher = teacher
        self.class_name = class_name
        self.term = term
        self.year = year
        self.timeblocks = timeblocks or []
        self.confidence = confidence
    
    def dict(self):
        return {
            'teacher': self.teacher,
            'className': self.class_name,
            'term': self.term,
            'year': self.year,
            'timeblocks': [tb.dict() for tb in self.timeblocks],
            'confidence': self.confidence
        }


class FineTunedDocumentService:
    """Fine-tuned document understanding service"""
    
    def __init__(
        self,
        model_path: Optional[str] = None,
        use_feature_store: bool = True,
        device: Optional[str] = None
    ):
        """
        Initialize document service
        
        Args:
            model_path: Path to fine-tuned model
            use_feature_store: Whether to use feature store
            device: Device to run model on
        """
        self.model_path = model_path or os.getenv('DOCUMENT_MODEL_PATH', 'models/document_lora')
        self.use_feature_store = use_feature_store
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        
        self.model = None
        self.tokenizer = None
        self.feature_store_client = None
        
        # Load model if available
        self._load_model()
        
        # Initialize feature store if enabled
        if self.use_feature_store:
            self._init_feature_store()
    
    def _load_model(self):
        """Load fine-tuned document model"""
        model_path = Path(self.model_path)
        
        if not model_path.exists():
            print(f"Model not found at {model_path}")
            return
        
        try:
            print(f"Loading document model from {model_path}")
            self.tokenizer = AutoTokenizer.from_pretrained(str(model_path))
            
            # Load base model
            # Note: Adjust base model name based on your model
            base_model_name = "meta-llama/Llama-3-8B"
            base_model = AutoModelForCausalLM.from_pretrained(
                base_model_name,
                torch_dtype=torch.float16 if self.device == 'cuda' else torch.float32,
                device_map="auto" if self.device == 'cuda' else None
            )
            
            # Check if LoRA adapter exists
            if (model_path / "adapter_config.json").exists():
                self.model = PeftModel.from_pretrained(base_model, str(model_path))
            else:
                self.model = AutoModelForCausalLM.from_pretrained(str(model_path))
            
            self.model.eval()
            
            print("Document model loaded successfully")
        except Exception as e:
            print(f"Failed to load model: {e}")
            self.model = None
            self.tokenizer = None
    
    def _init_feature_store(self):
        """Initialize feature store client"""
        try:
            from src.feature_store.feature_serving import FeatureStoreClient
            self.feature_store_client = FeatureStoreClient()
        except Exception as e:
            print(f"Failed to initialize feature store: {e}")
            self.feature_store_client = None
    
    def extract_timetable(self, image_path: str, model_version: Optional[str] = None) -> TimetableData:
        """
        Extract timetable data from image
        
        Args:
            image_path: Path to timetable image
            model_version: Model version to use
        
        Returns:
            TimetableData with extracted information
        """
        if self.model is None or self.tokenizer is None:
            raise RuntimeError("Model not loaded. Cannot extract timetable.")
        
        # Format prompt
        prompt = self._create_prompt(image_path)
        
        # Generate response
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.device)
        
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=512,
                temperature=0.1,
                do_sample=False
            )
        
        # Decode response
        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Parse response
        timetable_data = self._parse_response(response)
        
        # Store features if enabled
        if self.feature_store_client:
            self._store_features(image_path, timetable_data)
        
        return timetable_data
    
    def _create_prompt(self, image_path: str) -> str:
        """Create prompt for model"""
        # In production, you might include image embeddings or descriptions
        prompt = """Extract timetable data from this document and return JSON:

{
  "teacher": "Teacher name if visible",
  "className": "Class name if visible",
  "term": "Term/semester if visible",
  "year": 2024,
  "timeblocks": [
    {
      "day": "Monday",
      "name": "Subject name",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "notes": "Optional notes"
    }
  ]
}

Document: """
        return prompt
    
    def _parse_response(self, response: str) -> TimetableData:
        """Parse model response to TimetableData"""
        try:
            # Extract JSON from response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            
            if json_start == -1 or json_end == 0:
                raise ValueError("No JSON found in response")
            
            json_str = response[json_start:json_end]
            data = json.loads(json_str)
            
            # Parse timeblocks
            timeblocks = []
            for tb_data in data.get('timeblocks', []):
                timeblock = TimeBlock(
                    day=tb_data.get('day', ''),
                    name=tb_data.get('name', ''),
                    start_time=tb_data.get('startTime', ''),
                    end_time=tb_data.get('endTime', ''),
                    notes=tb_data.get('notes')
                )
                timeblocks.append(timeblock)
            
            return TimetableData(
                teacher=data.get('teacher'),
                class_name=data.get('className'),
                term=data.get('term'),
                year=data.get('year', 2024),
                timeblocks=timeblocks,
                confidence=0.90  # Placeholder
            )
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Failed to parse response: {e}")
            # Return empty timetable
            return TimetableData(confidence=0.0)
    
    def _store_features(self, image_path: str, timetable_data: TimetableData):
        """Store features in feature store"""
        if not self.feature_store_client:
            return
        
        try:
            document_id = Path(image_path).stem
            
            features = {
                'extraction_confidence': timetable_data.confidence,
                'timeblock_count': len(timetable_data.timeblocks),
                'has_teacher': timetable_data.teacher is not None,
                'has_class': timetable_data.class_name is not None
            }
            
            self.feature_store_client.store_features(document_id, features)
        except Exception as e:
            print(f"Failed to store features: {e}")


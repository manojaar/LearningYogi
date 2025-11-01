"""
Fine-tuned OCR Service

This service provides OCR inference using fine-tuned models
with support for feature store integration.
"""

import os
import torch
from pathlib import Path
from typing import Dict, List, Optional
from PIL import Image
import pytesseract

from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from peft import PeftModel


class OCRWord:
    """OCR word with confidence and position"""
    def __init__(self, text: str, confidence: float, left: int, top: int, width: int, height: int):
        self.text = text
        self.confidence = confidence
        self.left = left
        self.top = top
        self.width = width
        self.height = height
    
    def dict(self):
        return {
            'text': self.text,
            'confidence': self.confidence,
            'left': self.left,
            'top': self.top,
            'width': self.width,
            'height': self.height
        }


class OCRResult:
    """OCR processing result"""
    def __init__(self, text: str, confidence: float, words: List[OCRWord], engine: str):
        self.text = text
        self.confidence = confidence
        self.words = words
        self.engine = engine
    
    def dict(self):
        return {
            'text': self.text,
            'confidence': self.confidence,
            'words': [w.dict() for w in self.words],
            'engine': self.engine
        }


class FineTunedOCRService:
    """Fine-tuned OCR service with feature store support"""
    
    def __init__(
        self,
        model_path: Optional[str] = None,
        use_feature_store: bool = True,
        fallback_to_tesseract: bool = True,
        device: Optional[str] = None
    ):
        """
        Initialize OCR service
        
        Args:
            model_path: Path to fine-tuned model
            use_feature_store: Whether to use feature store
            fallback_to_tesseract: Fallback to Tesseract if model fails
            device: Device to run model on
        """
        self.model_path = model_path or os.getenv('OCR_MODEL_PATH', 'models/ocr_lora')
        self.use_feature_store = use_feature_store
        self.fallback_to_tesseract = fallback_to_tesseract
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        
        self.model = None
        self.processor = None
        self.feature_store_client = None
        
        # Load model if available
        self._load_model()
        
        # Initialize feature store if enabled
        if self.use_feature_store:
            self._init_feature_store()
    
    def _load_model(self):
        """Load fine-tuned OCR model"""
        model_path = Path(self.model_path)
        
        if not model_path.exists():
            print(f"Model not found at {model_path}, will use fallback")
            return
        
        try:
            print(f"Loading OCR model from {model_path}")
            self.processor = TrOCRProcessor.from_pretrained(str(model_path))
            
            # Load base model
            base_model_name = "microsoft/trocr-base-printed"
            base_model = VisionEncoderDecoderModel.from_pretrained(base_model_name)
            
            # Check if LoRA adapter exists
            if (model_path / "adapter_config.json").exists():
                self.model = PeftModel.from_pretrained(base_model, str(model_path))
            else:
                self.model = VisionEncoderDecoderModel.from_pretrained(str(model_path))
            
            self.model.to(self.device)
            self.model.eval()
            
            print("OCR model loaded successfully")
        except Exception as e:
            print(f"Failed to load model: {e}")
            self.model = None
            self.processor = None
    
    def _init_feature_store(self):
        """Initialize feature store client"""
        try:
            from src.feature_store.feature_serving import FeatureStoreClient
            self.feature_store_client = FeatureStoreClient()
        except Exception as e:
            print(f"Failed to initialize feature store: {e}")
            self.feature_store_client = None
    
    def process_image(self, image_path: str, model_version: Optional[str] = None) -> OCRResult:
        """
        Process image with OCR
        
        Args:
            image_path: Path to image file
            model_version: Model version to use
        
        Returns:
            OCRResult with extracted text and metadata
        """
        # Try fine-tuned model first
        if self.model is not None and self.processor is not None:
            try:
                return self._process_with_model(image_path)
            except Exception as e:
                print(f"Model inference failed: {e}")
                if not self.fallback_to_tesseract:
                    raise
        
        # Fallback to Tesseract
        if self.fallback_to_tesseract:
            return self._process_with_tesseract(image_path)
        
        raise RuntimeError("No OCR method available")
    
    def _process_with_model(self, image_path: str) -> OCRResult:
        """Process image with fine-tuned model"""
        # Load and preprocess image
        image = Image.open(image_path).convert('RGB')
        pixel_values = self.processor(image, return_tensors="pt").pixel_values
        pixel_values = pixel_values.to(self.device)
        
        # Generate text
        with torch.no_grad():
            generated_ids = self.model.generate(pixel_values)
            generated_text = self.processor.batch_decode(
                generated_ids,
                skip_special_tokens=True
            )[0]
        
        # Calculate confidence (simplified)
        # In production, use model's confidence scores if available
        confidence = 0.90  # Placeholder
        
        # Extract words (simplified - would need bounding boxes from model)
        words = self._extract_words_from_text(generated_text, confidence)
        
        # Store features if enabled
        if self.feature_store_client:
            self._store_features(image_path, generated_text, confidence)
        
        return OCRResult(
            text=generated_text,
            confidence=confidence,
            words=words,
            engine="fine_tuned_ocr"
        )
    
    def _process_with_tesseract(self, image_path: str) -> OCRResult:
        """Fallback to Tesseract OCR"""
        image = Image.open(image_path)
        
        # Run Tesseract OCR
        data = pytesseract.image_to_data(
            image,
            output_type=pytesseract.Output.DICT
        )
        
        # Extract words
        words = []
        text_parts = []
        
        for i in range(len(data['text'])):
            if int(data['conf'][i]) > 0:
                word = OCRWord(
                    text=data['text'][i],
                    confidence=float(data['conf'][i]) / 100.0,
                    left=data['left'][i],
                    top=data['top'][i],
                    width=data['width'][i],
                    height=data['height'][i]
                )
                words.append(word)
                text_parts.append(data['text'][i])
        
        text = ' '.join(text_parts)
        
        # Calculate overall confidence
        confidences = [w.confidence for w in words]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        
        return OCRResult(
            text=text,
            confidence=avg_confidence,
            words=words,
            engine="tesseract"
        )
    
    def _extract_words_from_text(self, text: str, confidence: float) -> List[OCRWord]:
        """Extract word objects from text (simplified)"""
        words = []
        for i, word in enumerate(text.split()):
            words.append(OCRWord(
                text=word,
                confidence=confidence,
                left=i * 50,  # Placeholder
                top=0,
                width=50,
                height=30
            ))
        return words
    
    def _store_features(self, image_path: str, text: str, confidence: float):
        """Store features in feature store"""
        if not self.feature_store_client:
            return
        
        try:
            # Extract document ID from path or generate one
            document_id = Path(image_path).stem
            
            features = {
                'text': text,
                'confidence': confidence,
                'word_count': len(text.split()),
            }
            
            self.feature_store_client.store_features(document_id, features)
        except Exception as e:
            print(f"Failed to store features: {e}")


"""
Knowledge base service - loads and manages extensible knowledge base
"""

import os
import json
import yaml
from typing import Dict, Any, Optional
from pathlib import Path


class KnowledgeBaseService:
    """Service for managing extensible knowledge base"""

    def __init__(self):
        kb_path = os.environ.get("KNOWLEDGE_BASE_PATH", "./config/knowledge_base")
        self.kb_dir = Path(__file__).parent.parent.parent.parent / kb_path
        
        # Default knowledge base
        self.default_kb = {
            "system_help": {
                "upload": "You can upload timetable images (PNG, JPG) or PDF files. Drag and drop them onto the upload area or click to browse.",
                "processing": "After upload, the system processes your timetable using OCR and AI. High confidence extractions (>80%) are validated directly, while lower confidence ones use AI enhancement.",
                "results": "You can view your extracted timetable in weekly or daily format. Each subject is color-coded for easy identification.",
                "export": "You can export your timetable data as CSV or JSON for use in other applications."
            },
            "faq": [
                {
                    "question": "What file formats are supported?",
                    "answer": "We support PNG, JPG, JPEG, and PDF files."
                },
                {
                    "question": "How accurate is the extraction?",
                    "answer": "The system achieves >90% accuracy. High-quality images typically get >80% confidence from OCR alone, while lower quality images are enhanced with AI."
                },
                {
                    "question": "Can I edit the extracted timetable?",
                    "answer": "Yes, you can review and validate the extracted data before saving."
                }
            ]
        }
        
        self.knowledge_base = self._load_knowledge_base()

    def _load_knowledge_base(self) -> Dict[str, Any]:
        """Load knowledge base from files"""
        kb = self.default_kb.copy()
        
        if not self.kb_dir.exists():
            return kb

        # Load JSON files
        for json_file in self.kb_dir.glob("*.json"):
            try:
                with open(json_file, "r") as f:
                    data = json.load(f)
                    kb.update(data)
            except Exception as e:
                print(f"Error loading {json_file}: {e}")

        # Load YAML files
        for yaml_file in self.kb_dir.glob("*.yaml"):
            try:
                with open(yaml_file, "r") as f:
                    data = yaml.safe_load(f)
                    kb.update(data)
            except Exception as e:
                print(f"Error loading {yaml_file}: {e}")

        return kb

    def get_system_prompt(self, mode: str = "general") -> str:
        """Get system prompt based on mode"""
        base_prompt = """You are a helpful AI assistant for the Learning Yogi timetable extraction platform.
You help users understand how to use the system, answer questions about uploaded documents, and provide information about extracted timetable data.
Be concise, accurate, and friendly in your responses."""

        if mode == "timetable":
            prompt = base_prompt + """

You have access to timetable and document data. When users ask about specific documents or timetables, you can query the database for accurate information.
Always provide specific details when available from the database."""
        else:
            prompt = base_prompt + """

You can engage in general conversation, but your primary role is to assist with timetable extraction workflows."""

        # Add knowledge base context
        if "system_help" in self.knowledge_base:
            help_text = "\n\nSystem Help Information:\n"
            for key, value in self.knowledge_base["system_help"].items():
                help_text += f"- {key}: {value}\n"
            prompt += help_text

        if "faq" in self.knowledge_base:
            faq_text = "\n\nFrequently Asked Questions:\n"
            for item in self.knowledge_base.get("faq", []):
                faq_text += f"Q: {item.get('question', '')}\nA: {item.get('answer', '')}\n"
            prompt += faq_text

        return prompt

    def search_knowledge(self, query: str) -> Optional[str]:
        """Search knowledge base for relevant information"""
        query_lower = query.lower()
        
        # Search FAQ
        if "faq" in self.knowledge_base:
            for item in self.knowledge_base["faq"]:
                if query_lower in item.get("question", "").lower() or query_lower in item.get("answer", "").lower():
                    return item.get("answer")
        
        # Search system help
        if "system_help" in self.knowledge_base:
            for key, value in self.knowledge_base["system_help"].items():
                if query_lower in key.lower() or query_lower in value.lower():
                    return value
        
        return None

    def add_knowledge(self, key: str, value: Any):
        """Add knowledge to the knowledge base (runtime)"""
        self.knowledge_base[key] = value


"""
AI Provider Factory - Creates appropriate AI service based on provider selection
"""

from typing import Optional
from app.models.ocr import TimetableData
from app.services.claude_service import ClaudeService
from app.services.google_vision_service import GoogleVisionService
from app.services.openai_vision_service import OpenAIVisionService


class AIProviderFactory:
    """Factory for creating AI provider services"""
    
    @staticmethod
    def create_provider(provider: str, api_key: Optional[str] = None, model: Optional[str] = None):
        """
        Create an AI provider service instance
        
        Args:
            provider: Provider name ('claude', 'google', 'openai', 'tesseract')
            api_key: API key for the provider (optional if using env vars)
            model: Model name to use (optional)
        
        Returns:
            AI service instance or None for tesseract
        """
        provider_lower = provider.lower()
        
        if provider_lower == 'tesseract':
            return None  # Tesseract-only mode, no AI service needed
        
        elif provider_lower == 'claude':
            service = ClaudeService()
            if api_key:
                service.set_api_key(api_key)
            if model:
                service.set_model(model)
            return service
        
        elif provider_lower == 'google':
            # Pass api_key and model directly to constructor for proper initialization
            service = GoogleVisionService(api_key=api_key, model=model)
            return service
        
        elif provider_lower == 'openai':
            # Pass api_key and model directly to constructor for proper initialization
            service = OpenAIVisionService(api_key=api_key, model=model)
            return service
        
        else:
            raise ValueError(f"Unknown provider: {provider}")


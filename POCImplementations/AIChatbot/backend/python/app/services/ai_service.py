"""
AI Service - manages multiple AI providers with fallback
"""

from typing import List, Optional, AsyncGenerator
from app.models.chat import ChatMessage
from app.services.claude_provider import ClaudeProvider
from app.services.openai_provider import OpenAIProvider
from app.services.local_llm_provider import LocalLLMProvider
import os


class AIService:
    """Service for managing AI providers with fallback logic"""

    def __init__(self):
        self.providers = {
            "claude": ClaudeProvider(),
            "openai": OpenAIProvider(),
            "local": LocalLLMProvider()
        }
        
        # Default provider preference order
        self.provider_preference = os.environ.get(
            "CHATBOT_PROVIDER_PREFERENCE",
            "claude,openai,local"
        ).split(",")

    def get_provider(self, provider_name: Optional[str] = None):
        """Get AI provider by name or best available"""
        if provider_name:
            provider = self.providers.get(provider_name.lower())
            if provider and provider.is_available():
                return provider
            raise ValueError(f"Provider {provider_name} not available")

        # Try providers in preference order
        for provider_name in self.provider_preference:
            provider = self.providers.get(provider_name.strip().lower())
            if provider and provider.is_available():
                return provider

        raise ValueError("No AI providers available. Please configure at least one provider.")

    async def chat(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        provider: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        **kwargs
    ) -> tuple[str, str]:
        """
        Generate chat response using best available provider

        Args:
            api_key: Dynamic API key to use (overrides environment variable)
            model: Dynamic model to use (overrides default)

        Returns:
            Tuple of (response_text, provider_name)
        """
        # If api_key is provided, create a temporary provider with that key
        if api_key and provider:
            from app.services.ai_provider import AIProvider
            if provider.lower() == "claude":
                from app.services.claude_provider import ClaudeProvider
                temp_provider = ClaudeProvider(api_key=api_key, model=model)
            elif provider.lower() == "openai":
                from app.services.openai_provider import OpenAIProvider
                temp_provider = OpenAIProvider(api_key=api_key, model=model)
            else:
                # Fall back to regular provider selection
                temp_provider = self.get_provider(provider)
            
            if temp_provider and temp_provider.is_available():
                response = await temp_provider.chat(messages, system_prompt, **kwargs)
                return response, provider.lower()
        
        # Use regular provider selection (falls back to environment variables)
        ai_provider = self.get_provider(provider)
        if model and hasattr(ai_provider, 'set_model'):
            ai_provider.set_model(model)
        response = await ai_provider.chat(messages, system_prompt, **kwargs)
        provider_name = next(
            (name for name, p in self.providers.items() if p == ai_provider),
            "unknown"
        )
        return response, provider_name

    async def chat_stream(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        provider: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        **kwargs
    ) -> AsyncGenerator[tuple[str, str], None]:
        """
        Generate streaming chat response

        Args:
            api_key: Dynamic API key to use (overrides environment variable)
            model: Dynamic model to use (overrides default)

        Yields:
            Tuples of (text_chunk, provider_name)
        """
        # If api_key is provided, create a temporary provider with that key
        if api_key and provider:
            if provider.lower() == "claude":
                from app.services.claude_provider import ClaudeProvider
                temp_provider = ClaudeProvider(api_key=api_key, model=model)
            elif provider.lower() == "openai":
                from app.services.openai_provider import OpenAIProvider
                temp_provider = OpenAIProvider(api_key=api_key, model=model)
            else:
                # Fall back to regular provider selection
                temp_provider = self.get_provider(provider)
            
            if temp_provider and temp_provider.is_available():
                async for chunk in temp_provider.chat_stream(messages, system_prompt, **kwargs):
                    yield chunk, provider.lower()
                return
        
        # Use regular provider selection (falls back to environment variables)
        ai_provider = self.get_provider(provider)
        if model and hasattr(ai_provider, 'set_model'):
            ai_provider.set_model(model)
        provider_name = next(
            (name for name, p in self.providers.items() if p == ai_provider),
            "unknown"
        )
        
        async for chunk in ai_provider.chat_stream(messages, system_prompt, **kwargs):
            yield chunk, provider_name


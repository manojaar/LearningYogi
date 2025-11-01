"""
OpenAI provider implementation
"""

import os
from typing import List, Optional, AsyncGenerator
from openai import OpenAI
from app.models.chat import ChatMessage
from app.services.ai_provider import AIProvider


class OpenAIProvider(AIProvider):
    """OpenAI API provider"""

    def __init__(self):
        self.api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("CHATBOT_OPENAI_API_KEY")
        self.model = os.environ.get("CHATBOT_OPENAI_MODEL", "gpt-3.5-turbo")
        self.client = None
        
        if self.api_key:
            try:
                self.client = OpenAI(api_key=self.api_key)
            except Exception:
                self.client = None

    def is_available(self) -> bool:
        """Check if OpenAI is available"""
        return self.client is not None and self.api_key is not None

    async def chat(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> str:
        """Generate chat response using OpenAI"""
        if not self.is_available():
            raise ValueError("OpenAI API key not configured")

        # Convert messages to OpenAI format
        openai_messages = []
        
        if system_prompt:
            openai_messages.append({
                "role": "system",
                "content": system_prompt
            })

        for msg in messages:
            if msg.role in ["user", "assistant"]:
                openai_messages.append({
                    "role": msg.role,
                    "content": msg.content
                })

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=openai_messages,
                max_tokens=kwargs.get("max_tokens", 4096),
                temperature=kwargs.get("temperature", 0.7)
            )

            return response.choices[0].message.content.strip()
        except Exception as e:
            raise Exception(f"OpenAI API error: {str(e)}")

    async def chat_stream(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """Generate streaming chat response using OpenAI"""
        if not self.is_available():
            raise ValueError("OpenAI API key not configured")

        # Convert messages to OpenAI format
        openai_messages = []
        
        if system_prompt:
            openai_messages.append({
                "role": "system",
                "content": system_prompt
            })

        for msg in messages:
            if msg.role in ["user", "assistant"]:
                openai_messages.append({
                    "role": msg.role,
                    "content": msg.content
                })

        try:
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=openai_messages,
                max_tokens=kwargs.get("max_tokens", 4096),
                temperature=kwargs.get("temperature", 0.7),
                stream=True
            )

            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            raise Exception(f"OpenAI streaming error: {str(e)}")


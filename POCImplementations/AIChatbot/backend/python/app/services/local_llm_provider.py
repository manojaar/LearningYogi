"""
Local LLM provider implementation (Ollama compatible)
"""

import os
from typing import List, Optional, AsyncGenerator
import httpx
from app.models.chat import ChatMessage
from app.services.ai_provider import AIProvider


class LocalLLMProvider(AIProvider):
    """Local LLM provider (Ollama, vLLM, etc.)"""

    def __init__(self):
        self.base_url = os.environ.get("LOCAL_LLM_URL", "http://localhost:11434")
        self.model = os.environ.get("LOCAL_LLM_MODEL", "llama2")
        self.api_path = os.environ.get("LOCAL_LLM_API_PATH", "/api/chat")  # Ollama: /api/chat, vLLM: /v1/chat/completions
        self.client = httpx.AsyncClient(timeout=60.0)

    def is_available(self) -> bool:
        """Check if local LLM is available"""
        try:
            # Synchronous check using httpx
            import httpx
            with httpx.Client(timeout=5.0) as client:
                response = client.get(f"{self.base_url}/api/tags")  # Ollama health check
                return response.status_code == 200
        except Exception:
            return False

    async def chat(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> str:
        """Generate chat response using local LLM"""
        # Convert messages to format expected by local LLM
        # Ollama format
        ollama_messages = []
        for msg in messages:
            ollama_messages.append({
                "role": msg.role,
                "content": msg.content
            })

        payload = {
            "model": self.model,
            "messages": ollama_messages,
            "stream": False
        }

        if system_prompt:
            payload["system"] = system_prompt

        try:
            response = await self.client.post(
                f"{self.base_url}{self.api_path}",
                json=payload
            )
            response.raise_for_status()
            data = response.json()
            
            # Extract response text (handle different response formats)
            if "message" in data:
                return data["message"].get("content", "").strip()
            elif "choices" in data and len(data["choices"]) > 0:
                return data["choices"][0]["message"]["content"].strip()
            elif "response" in data:
                return data["response"].strip()
            else:
                return str(data).strip()
        except httpx.HTTPError as e:
            raise Exception(f"Local LLM API error: {str(e)}")

    async def chat_stream(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """Generate streaming chat response using local LLM"""
        # Convert messages
        ollama_messages = []
        for msg in messages:
            ollama_messages.append({
                "role": msg.role,
                "content": msg.content
            })

        payload = {
            "model": self.model,
            "messages": ollama_messages,
            "stream": True
        }

        if system_prompt:
            payload["system"] = system_prompt

        try:
            async with self.client.stream(
                "POST",
                f"{self.base_url}{self.api_path}",
                json=payload
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        try:
                            import json
                            data = json.loads(line)
                            if "message" in data and "content" in data["message"]:
                                yield data["message"]["content"]
                            elif "delta" in data and "content" in data["delta"]:
                                yield data["delta"]["content"]
                        except json.JSONDecodeError:
                            continue
        except httpx.HTTPError as e:
            raise Exception(f"Local LLM streaming error: {str(e)}")


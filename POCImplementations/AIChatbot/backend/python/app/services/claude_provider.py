"""
Claude AI provider implementation
"""

import os
from typing import List, Optional, AsyncGenerator
from anthropic import Anthropic
from app.models.chat import ChatMessage
from app.services.ai_provider import AIProvider


class ClaudeProvider(AIProvider):
    """Claude API provider"""

    def __init__(self):
        self.api_key = os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("CHATBOT_CLAUDE_API_KEY")
        self.model = os.environ.get("CHATBOT_CLAUDE_MODEL", "claude-3-haiku-20240307")
        self.client = None
        
        if self.api_key:
            try:
                self.client = Anthropic(api_key=self.api_key)
            except Exception:
                self.client = None

    def is_available(self) -> bool:
        """Check if Claude is available"""
        return self.client is not None and self.api_key is not None

    async def chat(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> str:
        """Generate chat response using Claude"""
        if not self.is_available():
            raise ValueError("Claude API key not configured")

        # Convert messages to Claude format
        claude_messages = []
        for msg in messages:
            if msg.role == "user":
                claude_messages.append({
                    "role": "user",
                    "content": msg.content
                })
            elif msg.role == "assistant":
                claude_messages.append({
                    "role": "assistant",
                    "content": msg.content
                })

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=kwargs.get("max_tokens", 4096),
                temperature=kwargs.get("temperature", 0.7),
                system=system_prompt,
                messages=claude_messages
            )

            # Extract text from response
            text_content = ""
            for content_block in response.content:
                if hasattr(content_block, "text"):
                    text_content += content_block.text
                elif isinstance(content_block, dict) and content_block.get("type") == "text":
                    text_content += content_block.get("text", "")

            return text_content.strip()
        except Exception as e:
            raise Exception(f"Claude API error: {str(e)}")

    async def chat_stream(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """Generate streaming chat response using Claude"""
        if not self.is_available():
            raise ValueError("Claude API key not configured")

        # Convert messages to Claude format
        claude_messages = []
        for msg in messages:
            if msg.role == "user":
                claude_messages.append({
                    "role": "user",
                    "content": msg.content
                })
            elif msg.role == "assistant":
                claude_messages.append({
                    "role": "assistant",
                    "content": msg.content
                })

        try:
            with self.client.messages.stream(
                model=self.model,
                max_tokens=kwargs.get("max_tokens", 4096),
                temperature=kwargs.get("temperature", 0.7),
                system=system_prompt,
                messages=claude_messages
            ) as stream:
                for event in stream:
                    if event.type == "content_block_delta":
                        if hasattr(event.delta, "text"):
                            yield event.delta.text
                        elif isinstance(event.delta, dict):
                            yield event.delta.get("text", "")
        except Exception as e:
            raise Exception(f"Claude streaming error: {str(e)}")


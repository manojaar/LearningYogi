"""
Abstract base class for AI providers
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, AsyncGenerator
from app.models.chat import ChatMessage


class AIProvider(ABC):
    """Base class for AI providers"""

    @abstractmethod
    async def chat(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Generate chat response

        Args:
            messages: List of chat messages
            system_prompt: Optional system prompt
            **kwargs: Additional provider-specific parameters

        Returns:
            Response text
        """
        pass

    @abstractmethod
    async def chat_stream(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Generate streaming chat response

        Args:
            messages: List of chat messages
            system_prompt: Optional system prompt
            **kwargs: Additional provider-specific parameters

        Yields:
            Response text chunks
        """
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if provider is available"""
        pass


"""
Chat request and response models
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


class ChatContext(BaseModel):
    """Context for chat request"""
    document_id: Optional[str] = None
    project: Optional[str] = None
    user_id: Optional[str] = None
    custom_data: Optional[Dict[str, Any]] = None


class ChatRequest(BaseModel):
    """Chat message request"""
    message: str = Field(..., description="User message")
    session_id: Optional[str] = Field(None, description="Session ID for conversation continuity")
    context: Optional[ChatContext] = Field(None, description="Optional context information")
    provider: Optional[str] = Field(None, description="AI provider override (claude, openai, local)")
    stream: Optional[bool] = Field(False, description="Enable streaming response")
    llm_session_id: Optional[str] = Field(None, description="Main app's LLM session ID for API key retrieval")


class ChatMessage(BaseModel):
    """Single chat message"""
    role: str = Field(..., description="Message role: user or assistant")
    content: str = Field(..., description="Message content")
    timestamp: datetime = Field(default_factory=datetime.now)


class ChatResponse(BaseModel):
    """Chat response"""
    response: str = Field(..., description="Assistant response")
    session_id: str = Field(..., description="Session ID")
    timestamp: datetime = Field(default_factory=datetime.now)
    provider: str = Field(..., description="AI provider used")
    context_used: Optional[Dict[str, Any]] = Field(None, description="Context information used")


class ChatHistory(BaseModel):
    """Chat history for a session"""
    session_id: str
    messages: List[ChatMessage] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


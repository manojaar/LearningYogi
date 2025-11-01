"""
Chat service - manages conversations and context
"""

import uuid
from typing import Dict, List, Optional
from datetime import datetime
from app.models.chat import ChatMessage, ChatHistory
from app.services.ai_service import AIService
from app.context.database_context import DatabaseContextService
from app.context.knowledge_base import KnowledgeBaseService


class ChatService:
    """Service for managing chat conversations"""

    def __init__(self):
        self.ai_service = AIService()
        self.db_context = DatabaseContextService()
        self.kb_service = KnowledgeBaseService()
        
        # In-memory session storage (can be replaced with Redis/DB)
        self.sessions: Dict[str, ChatHistory] = {}

    def get_or_create_session(self, session_id: Optional[str] = None) -> str:
        """Get existing session or create new one"""
        if session_id and session_id in self.sessions:
            return session_id
        
        new_session_id = session_id or str(uuid.uuid4())
        self.sessions[new_session_id] = ChatHistory(
            session_id=new_session_id,
            messages=[]
        )
        return new_session_id

    def add_message_to_session(self, session_id: str, role: str, content: str):
        """Add message to session history"""
        if session_id not in self.sessions:
            self.get_or_create_session(session_id)
        
        message = ChatMessage(role=role, content=content)
        self.sessions[session_id].messages.append(message)
        self.sessions[session_id].updated_at = datetime.now()

    def get_session_history(self, session_id: str) -> List[ChatMessage]:
        """Get message history for session"""
        if session_id not in self.sessions:
            return []
        return self.sessions[session_id].messages

    def build_system_prompt(self, context: Optional[Dict] = None, mode: str = "general") -> str:
        """Build system prompt with context"""
        base_prompt = self.kb_service.get_system_prompt(mode)
        
        if context and context.get("document_id"):
            db_context = self.db_context.get_context_for_message(context.get("document_id"))
            if db_context.get("document"):
                doc_info = db_context["document"]
                base_prompt += f"\n\nCurrent Document Context:\n"
                base_prompt += f"- Document ID: {doc_info.get('id')}\n"
                base_prompt += f"- Filename: {doc_info.get('filename')}\n"
                base_prompt += f"- Status: {doc_info.get('status')}\n"
                
                if db_context.get("timetable"):
                    timetable = db_context["timetable"]
                    base_prompt += f"\nTimetable Information:\n"
                    base_prompt += f"- Teacher: {timetable.get('teacher_name', 'N/A')}\n"
                    base_prompt += f"- Class: {timetable.get('class_name', 'N/A')}\n"
                    base_prompt += f"- Confidence: {timetable.get('confidence', 0):.1%}\n"
        
        return base_prompt

    async def process_message(
        self,
        message: str,
        session_id: Optional[str] = None,
        context: Optional[Dict] = None,
        provider: Optional[str] = None,
        mode: str = "general"
    ) -> tuple[str, str]:
        """
        Process chat message and generate response

        Returns:
            Tuple of (response, session_id)
        """
        # Get or create session
        session_id = self.get_or_create_session(session_id)
        
        # Add user message to history
        self.add_message_to_session(session_id, "user", message)
        
        # Get conversation history
        history = self.get_session_history(session_id)
        
        # Build system prompt with context
        system_prompt = self.build_system_prompt(context, mode)
        
        # Generate response
        response, provider_name = await self.ai_service.chat(
            messages=history,
            system_prompt=system_prompt,
            provider=provider
        )
        
        # Add assistant response to history
        self.add_message_to_session(session_id, "assistant", response)
        
        return response, session_id


"""
Chat API endpoints
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.models.chat import ChatRequest, ChatResponse
from app.services.chat_service import ChatService
import json

router = APIRouter(prefix="/api/v1", tags=["chat"])
chat_service = ChatService()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Send a chat message and get response
    """
    try:
        # Determine mode based on context
        mode = "timetable" if request.context and request.context.document_id else "general"
        
        # Convert context to dict
        context_dict = None
        if request.context:
            context_dict = {
                "document_id": request.context.document_id,
                "project": request.context.project,
                "user_id": request.context.user_id,
                "custom_data": request.context.custom_data
            }
        
        if request.stream:
            # Streaming response
            return StreamingResponse(
                chat_stream_generator(
                    request.message,
                    request.session_id,
                    context_dict,
                    request.provider,
                    mode,
                    request.llm_session_id  # Pass LLM session ID for API key
                ),
                media_type="text/event-stream"
            )
        else:
            # Regular response
            response, session_id = await chat_service.process_message(
                message=request.message,
                session_id=request.session_id,
                context=context_dict,
                provider=request.provider,
                mode=mode,
                llm_session_id=request.llm_session_id  # Pass LLM session ID for API key
            )
            
            # Get provider info
            provider_used = request.provider or "auto"
            
            # Get context info
            context_used = {}
            if context_dict and context_dict.get("document_id"):
                db_context = chat_service.db_context.get_context_for_message(
                    context_dict["document_id"]
                )
                if db_context.get("has_database"):
                    context_used = {
                        "has_database": True,
                        "document_available": db_context.get("document") is not None,
                        "timetable_available": db_context.get("timetable") is not None
                    }
            
            from datetime import datetime
            return ChatResponse(
                response=response,
                session_id=session_id,
                provider=provider_used,
                context_used=context_used,
                timestamp=datetime.now()
            )
    except ValueError as e:
        # Provider not available or configuration error
        raise HTTPException(status_code=503, detail=f"AI service unavailable: {str(e)}")
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Chat API error: {error_details}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


async def chat_stream_generator(
    message: str,
    session_id: str = None,
    context: dict = None,
    provider: str = None,
    mode: str = "general",
    llm_session_id: str = None
):
    """Generate streaming response"""
    try:
        # Get session
        session_id = chat_service.get_or_create_session(session_id)
        
        # Add user message
        chat_service.add_message_to_session(session_id, "user", message)
        
        # Get history
        history = chat_service.get_session_history(session_id)
        
        # Build prompt
        system_prompt = chat_service.build_system_prompt(context, mode)
        
        # Fetch LLM settings from main app if llm_session_id is provided
        api_key_override = None
        provider_override = provider
        model_override = None
        
        if llm_session_id:
            llm_settings = await chat_service.session_client.get_llm_settings(llm_session_id)
            if llm_settings:
                api_key_override = llm_settings.get("apiKey")
                if not provider_override:
                    provider_override = llm_settings.get("provider")
                model_override = llm_settings.get("model")
        
        # Stream response with dynamic API key if available
        full_response = ""
        async for chunk, provider_name in chat_service.ai_service.chat_stream(
            messages=history,
            system_prompt=system_prompt,
            provider=provider_override,
            api_key=api_key_override,
            model=model_override
        ):
            full_response += chunk
            yield f"data: {json.dumps({'chunk': chunk, 'provider': provider_name})}\n\n"
        
        # Add to history
        chat_service.add_message_to_session(session_id, "assistant", full_response)
        
        # Final message
        yield f"data: {json.dumps({'done': True, 'session_id': session_id})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


@router.get("/chat/session/{session_id}")
async def get_session_history(session_id: str):
    """Get chat history for a session"""
    history = chat_service.get_session_history(session_id)
    if not history:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "session_id": session_id,
        "messages": [
            {
                "role": msg.role,
                "content": msg.content,
                "timestamp": msg.timestamp.isoformat()
            }
            for msg in history
        ]
    }


@router.delete("/chat/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a chat session"""
    if session_id in chat_service.sessions:
        del chat_service.sessions[session_id]
        return {"message": "Session deleted"}
    raise HTTPException(status_code=404, detail="Session not found")


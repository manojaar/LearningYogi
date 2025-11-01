"""
FastAPI Main Application - AI Chatbot Service
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import chat

app = FastAPI(
    title="AI Chatbot Service",
    description="Plug-and-play AI chatbot for POC projects",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "AI Chatbot Service",
        "version": "1.0.0",
        "endpoints": {
            "chat": "/api/v1/chat",
            "health": "/health"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    from app.services.ai_service import AIService
    from app.context.database_context import DatabaseContextService
    
    ai_service = AIService()
    db_context = DatabaseContextService()
    
    # Check available providers
    available_providers = []
    for name, provider in ai_service.providers.items():
        if provider.is_available():
            available_providers.append(name)
    
    return {
        "status": "healthy",
        "service": "ai-chatbot",
        "available_providers": available_providers,
        "database_context": db_context.is_available()
    }


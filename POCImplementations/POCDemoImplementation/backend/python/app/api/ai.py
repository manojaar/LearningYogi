"""AI API endpoints"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.ai_provider_factory import AIProviderFactory
from app.models.ocr import TimetableData

router = APIRouter(prefix="/ai", tags=["AI"])


class AIExtractRequest(BaseModel):
    """AI extraction request"""
    image_path: str
    provider: Optional[str] = "claude"  # Default to claude for backward compatibility
    model: Optional[str] = None
    api_key: Optional[str] = None


@router.post("/extract", response_model=TimetableData)
async def extract_timetable(request: AIExtractRequest):
    """
    Extract timetable data using selected AI provider (synchronous for backward compatibility)
    
    Args:
        request: AI request with image path, provider, model, and optional API key
    
    Returns:
        TimetableData with extracted information
    """
    try:
        # Create provider instance
        provider_instance = AIProviderFactory.create_provider(
            provider=request.provider,
            api_key=request.api_key,
            model=request.model
        )
        
        if not provider_instance:
            # Tesseract-only mode - return error or handle differently
            raise HTTPException(
                status_code=400,
                detail="Tesseract-only mode selected. Use OCR endpoint directly."
            )
        
        result = provider_instance.extract_timetable(request.image_path)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI extraction failed: {str(e)}")


@router.post("/extract-async", response_model=TimetableData)
async def extract_timetable_async(request: AIExtractRequest):
    """
    Extract timetable data using selected AI provider (async with streaming support)

    Args:
        request: AI request with image path, provider, model, and optional API key

    Returns:
        TimetableData with extracted information
    """
    try:
        # Create provider instance
        provider_instance = AIProviderFactory.create_provider(
            provider=request.provider,
            api_key=request.api_key,
            model=request.model
        )

        if not provider_instance:
            # Tesseract-only mode
            error_detail = {
                "error": "Tesseract-only mode selected. Use OCR endpoint directly.",
                "provider": request.provider,
                "error_type": "InvalidProviderError"
            }
            raise HTTPException(status_code=400, detail=error_detail)

        # Check if provider supports async
        if hasattr(provider_instance, 'extract_timetable_async'):
            print(f"📍 Calling async extraction for provider: {request.provider}")
            result = await provider_instance.extract_timetable_async(request.image_path)
            print(f"✅ Async extraction completed successfully")
        else:
            # Fallback to sync
            print(f"📍 Calling sync extraction for provider: {request.provider}")
            result = provider_instance.extract_timetable(request.image_path)
            print(f"✅ Sync extraction completed successfully")

        print(f"📊 Result type: {type(result)}")
        print(f"📊 Result: {result}")
        return result
    except FileNotFoundError as e:
        print(f"❌ FileNotFoundError caught: {str(e)}")
        error_detail = {
            "error": f"Image file not found: {str(e)}",
            "provider": request.provider,
            "model": request.model,
            "error_type": "FileNotFoundError"
        }
        raise HTTPException(status_code=404, detail=error_detail)
    except ValueError as e:
        print(f"❌ ValueError caught: {str(e)}")
        print(f"   Error details: {repr(e)}")
        import traceback
        print(f"   Traceback:\n{traceback.format_exc()}")
        error_detail = {
            "error": str(e),
            "provider": request.provider,
            "model": request.model,
            "error_type": "ValueError",
            "hint": "Check your API key and model selection"
        }
        raise HTTPException(status_code=400, detail=error_detail)
    except Exception as e:
        print(f"❌ Exception caught: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"   Traceback:\n{traceback.format_exc()}")
        error_detail = {
            "error": f"AI extraction failed: {str(e)}",
            "provider": request.provider,
            "model": request.model,
            "error_type": type(e).__name__
        }
        print(f"❌ AI Extraction Error: {error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)


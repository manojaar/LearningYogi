"""AI API endpoints"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.claude_service import ClaudeService
from app.models.ocr import TimetableData

router = APIRouter(prefix="/ai", tags=["AI"])
claude_service = ClaudeService()


class AIExtractRequest(BaseModel):
    """AI extraction request"""
    image_path: str


@router.post("/extract", response_model=TimetableData)
async def extract_timetable(request: AIExtractRequest):
    """
    Extract timetable data using Claude AI (synchronous for backward compatibility)
    
    Args:
        request: AI request with image path
    
    Returns:
        TimetableData with extracted information
    """
    try:
        result = claude_service.extract_timetable(request.image_path)
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
    Extract timetable data using Claude AI (async with streaming support)
    
    Args:
        request: AI request with image path
    
    Returns:
        TimetableData with extracted information
    """
    try:
        result = await claude_service.extract_timetable_async(request.image_path)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI extraction failed: {str(e)}")


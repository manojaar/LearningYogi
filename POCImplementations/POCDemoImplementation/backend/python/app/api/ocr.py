"""OCR API endpoints"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.ocr_service import OCRService
from app.models.ocr import OCRResult, QualityGateDecision

router = APIRouter(prefix="/ocr", tags=["OCR"])
ocr_service = OCRService()


class OCRRequest(BaseModel):
    """OCR processing request"""
    image_path: str


@router.post("/process", response_model=OCRResult)
async def process_ocr(request: OCRRequest):
    """
    Process image with OCR
    
    Args:
        request: OCR request with image path
    
    Returns:
        OCRResult with extracted text and confidence
    """
    try:
        result = ocr_service.process_image(request.image_path)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")


@router.post("/quality-gate", response_model=QualityGateDecision)
async def get_quality_gate(result: OCRResult):
    """
    Get quality gate routing decision
    
    Args:
        result: OCR result
    
    Returns:
        QualityGateDecision with routing information
    """
    decision = ocr_service.calculate_quality_gate(result)
    return decision


"""Preprocessing API endpoints"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.preprocessor import ImagePreprocessor

router = APIRouter(prefix="/preprocess", tags=["Preprocessing"])
preprocessor = ImagePreprocessor()


class PreprocessRequest(BaseModel):
    """Image preprocessing request"""
    image_path: str
    output_dir: str


@router.post("/enhance")
async def enhance_image(request: PreprocessRequest):
    """
    Enhance image for better OCR
    
    Args:
        request: Preprocess request with image path and output directory
    
    Returns:
        Path to enhanced image
    """
    try:
        output_path = preprocessor.enhance_image(request.image_path, request.output_dir)
        return {"enhanced_image_path": output_path}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image preprocessing failed: {str(e)}")


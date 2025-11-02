"""OCR request and response models"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class OCRWord(BaseModel):
    """Individual word from OCR result"""
    text: str
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score 0-1")
    left: int
    top: int
    width: int
    height: int


class OCRResult(BaseModel):
    """OCR processing result"""
    text: str
    confidence: float = Field(ge=0.0, le=1.0, description="Overall confidence 0-1")
    words: List[OCRWord]
    engine: str = "tesseract"


class OCRRequest(BaseModel):
    """OCR processing request"""
    image_path: str


class QualityGateDecision(BaseModel):
    """Quality gate routing decision"""
    route: str = Field(description="Routing decision: 'validation' or 'ai'")
    confidence: float = Field(ge=0.0, le=1.0)
    reason: str


class TimeBlock(BaseModel):
    """Timetable time block"""
    day: str
    name: str
    startTime: Optional[str] = Field(None, pattern=r"^\d{1,2}:\d{2}$", description="24-hour format H:MM or HH:MM")
    endTime: Optional[str] = Field(None, pattern=r"^\d{1,2}:\d{2}$", description="24-hour format H:MM or HH:MM")
    notes: Optional[str] = None


class TimetableData(BaseModel):
    """Extracted timetable data"""
    teacher: Optional[str] = None
    className: Optional[str] = None
    term: Optional[str] = None
    year: Optional[int] = Field(None, ge=2000, le=2100)
    timeblocks: List[TimeBlock]


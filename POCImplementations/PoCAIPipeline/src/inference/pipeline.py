"""
Inference Pipeline API

FastAPI service for OCR and document inference.
"""

import os
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

from src.inference.ocr_service import FineTunedOCRService, OCRResult
from src.inference.document_service import FineTunedDocumentService, TimetableData


app = FastAPI(title="AI Pipeline Inference API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
ocr_service = FineTunedOCRService(
    model_path=os.getenv('OCR_MODEL_PATH'),
    use_feature_store=os.getenv('FEATURE_STORE_ENABLED', 'false').lower() == 'true'
)

document_service = FineTunedDocumentService(
    model_path=os.getenv('DOCUMENT_MODEL_PATH'),
    use_feature_store=os.getenv('FEATURE_STORE_ENABLED', 'false').lower() == 'true'
)


# Request/Response models
class OCRRequest(BaseModel):
    image_path: str
    model_version: Optional[str] = None
    use_feature_store: Optional[bool] = True


class OCRResponse(BaseModel):
    text: str
    confidence: float
    words: list
    engine: str
    model_version: Optional[str] = None
    processing_time: float


class DocumentRequest(BaseModel):
    image_path: str
    model_version: Optional[str] = None
    extract_features: Optional[bool] = True


class DocumentResponse(BaseModel):
    teacher: Optional[str] = None
    className: Optional[str] = None
    term: Optional[str] = None
    year: Optional[int] = None
    timeblocks: list
    confidence: float
    model_version: Optional[str] = None
    processing_time: float


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "services": {
            "inference": "healthy",
            "feature_store": "healthy" if ocr_service.feature_store_client else "disabled"
        }
    }


# OCR inference
@app.post("/infer/ocr", response_model=OCRResponse)
async def ocr_inference(request: OCRRequest):
    """OCR inference endpoint"""
    import time
    start_time = time.time()
    
    try:
        result = ocr_service.process_image(
            request.image_path,
            model_version=request.model_version
        )
        
        processing_time = time.time() - start_time
        
        return OCRResponse(
            text=result.text,
            confidence=result.confidence,
            words=[w.dict() for w in result.words],
            engine=result.engine,
            model_version=request.model_version,
            processing_time=processing_time
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Document inference
@app.post("/infer/document", response_model=DocumentResponse)
async def document_inference(request: DocumentRequest):
    """Document extraction endpoint"""
    import time
    start_time = time.time()
    
    try:
        result = document_service.extract_timetable(
            request.image_path,
            model_version=request.model_version
        )
        
        processing_time = time.time() - start_time
        
        return DocumentResponse(
            teacher=result.teacher,
            className=result.class_name,
            term=result.term,
            year=result.year,
            timeblocks=[tb.dict() for tb in result.timeblocks],
            confidence=result.confidence,
            model_version=request.model_version,
            processing_time=processing_time
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# File upload endpoints
@app.post("/upload/ocr")
async def upload_ocr(file: UploadFile = File(...)):
    """Upload file for OCR processing"""
    import tempfile
    
    # Save uploaded file
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    # Process
    result = ocr_service.process_image(tmp_path)
    
    # Cleanup
    os.unlink(tmp_path)
    
    return result.dict()


@app.post("/upload/document")
async def upload_document(file: UploadFile = File(...)):
    """Upload file for document extraction"""
    import tempfile
    
    # Save uploaded file
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    # Process
    result = document_service.extract_timetable(tmp_path)
    
    # Cleanup
    os.unlink(tmp_path)
    
    return result.dict()


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)


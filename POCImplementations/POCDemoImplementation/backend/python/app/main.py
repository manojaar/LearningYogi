"""
FastAPI Main Application
"""

import logging
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import time

from app.api import ocr, ai, preprocess

# Configure logging
LOG_DIR = Path("/logs")
LOG_DIR.mkdir(exist_ok=True)

# Create formatters
detailed_formatter = logging.Formatter(
    '%(asctime)s | %(levelname)-8s | %(name)s | %(funcName)s:%(lineno)d | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# File handler for all logs
file_handler = RotatingFileHandler(
    LOG_DIR / "python-ai.log",
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5
)
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(detailed_formatter)

# File handler for errors only
error_handler = RotatingFileHandler(
    LOG_DIR / "python-ai-errors.log",
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5
)
error_handler.setLevel(logging.ERROR)
error_handler.setFormatter(detailed_formatter)

# Console handler
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(logging.Formatter('%(levelname)s: %(message)s'))

# Configure root logger
logging.basicConfig(
    level=logging.DEBUG,
    handlers=[file_handler, error_handler, console_handler]
)

logger = logging.getLogger(__name__)
logger.info("="*80)
logger.info("Starting Learning Yogi AI Middleware")
logger.info("="*80)

app = FastAPI(
    title="Learning Yogi AI Middleware",
    description="OCR and AI processing for timetable extraction",
    version="1.0.0"
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all HTTP requests and responses"""
    start_time = time.time()

    # Log request
    logger.info(f"→ {request.method} {request.url.path}")
    logger.debug(f"  Headers: {dict(request.headers)}")

    # Process request
    try:
        response = await call_next(request)
        process_time = time.time() - start_time

        # Log response
        logger.info(f"← {request.method} {request.url.path} - {response.status_code} ({process_time:.3f}s)")

        return response
    except Exception as e:
        process_time = time.time() - start_time
        logger.error(f"✗ {request.method} {request.url.path} - ERROR ({process_time:.3f}s)")
        logger.exception(f"Request failed: {str(e)}")
        raise

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(ocr.router)
app.include_router(ai.router)
app.include_router(preprocess.router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Learning Yogi AI Middleware API"}


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "ai-middleware"}


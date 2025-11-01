"""
OCR Processor Lambda Handler

Processes uploaded documents with OCR:
1. Downloads document from S3
2. Preprocesses image
3. Runs OCR (Tesseract or Google Cloud Vision)
4. Calculates confidence score
5. Routes to appropriate next step based on quality gates

Quality Gates:
- High confidence (>= 98%): Direct to validation
- Medium confidence (80-98%): Route to LLM processing
- Low confidence (< 80%): Route to Human-in-the-Loop

TDD Implementation: Tests in tests/test_ocr_processor.py
"""

import json
import logging
import os
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict

import boto3
from botocore.exceptions import ClientError
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

# OCR processing (reuse from PoC1)
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from processors.ocr_processor import OCRProcessor, OCRResult

# Initialize
logger = Logger()
tracer = Tracer()

s3_client = boto3.client('s3')
eventbridge_client = boto3.client('events')

# Configuration
S3_BUCKET = os.environ.get('S3_BUCKET', 'learningyogi-documents-dev')
USE_CLOUD_VISION = os.environ.get('USE_CLOUD_VISION', 'false').lower() == 'true'


@dataclass
class ProcessingResult:
    """OCR processing result"""
    document_id: str
    status: str  # 'completed', 'needs_llm', 'needs_hitl', 'failed'
    ocr_result: Optional[Dict[str, Any]] = None
    confidence: float = 0.0
    route: str = 'validation'  # 'validation', 'llm', 'hitl'
    error_message: Optional[str] = None


@tracer.capture_lambda_handler
@logger.inject_lambda_context
def handler(event: Dict[str, Any], context: LambdaContext) -> Dict[str, Any]:
    """
    Lambda handler for OCR processing

    Event structure (from EventBridge or Step Functions):
    {
        "documentId": "uuid-123",
        "s3Key": "uploads/user-123/doc-123/original.pdf",
        "userId": "user-123"
    }

    Returns:
    {
        "documentId": "uuid-123",
        "status": "completed",
        "confidence": 0.95,
        "route": "validation",
        "ocrResult": { ... }
    }
    """
    logger.info("OCR processing started", extra={"event": event})

    try:
        # Extract parameters
        document_id = event['documentId']
        s3_key = event['s3Key']
        user_id = event.get('userId')

        # Download document from S3
        local_path = download_from_s3(s3_key)

        # Initialize OCR processor
        processor = OCRProcessor(use_cloud_vision=USE_CLOUD_VISION)

        # Process image
        ocr_result = processor.process_image(local_path)

        # Calculate quality gate decision
        decision = processor.calculate_quality_gate_decision(ocr_result)

        # Determine status
        status = 'completed'
        if decision.route == 'llm':
            status = 'needs_llm'
        elif decision.route == 'hitl':
            status = 'needs_hitl'

        # Create processing result
        result = ProcessingResult(
            document_id=document_id,
            status=status,
            ocr_result={
                'text': ocr_result.text,
                'confidence': ocr_result.confidence,
                'words': ocr_result.words[:100],  # Limit to first 100 words to reduce payload
                'engine': ocr_result.engine,
            },
            confidence=ocr_result.confidence,
            route=decision.route,
        )

        # Save OCR result to S3
        save_ocr_result(document_id, user_id, ocr_result)

        # Emit completion event
        emit_event('OCR Completed', result)

        logger.info("OCR processing completed", extra={
            "documentId": document_id,
            "confidence": ocr_result.confidence,
            "route": decision.route
        })

        return asdict(result)

    except KeyError as e:
        logger.error("Missing required field", extra={"error": str(e)})
        return create_error_result(
            event.get('documentId', 'unknown'),
            f"Missing required field: {e}"
        )

    except ClientError as e:
        logger.error("AWS client error", extra={"error": str(e)})
        return create_error_result(
            event.get('documentId', 'unknown'),
            f"S3 error: {e.response['Error']['Message']}"
        )

    except Exception as e:
        logger.error("Unexpected error", extra={"error": str(e)}, exc_info=True)
        return create_error_result(
            event.get('documentId', 'unknown'),
            f"Processing failed: {str(e)}"
        )


@tracer.capture_method
def download_from_s3(s3_key: str) -> str:
    """
    Download file from S3 to /tmp

    Args:
        s3_key: S3 object key

    Returns:
        Local file path
    """
    # Extract filename
    filename = s3_key.split('/')[-1]
    local_path = f'/tmp/{filename}'

    logger.info(f"Downloading {s3_key} from S3")

    s3_client.download_file(S3_BUCKET, s3_key, local_path)

    return local_path


@tracer.capture_method
def save_ocr_result(
    document_id: str,
    user_id: Optional[str],
    ocr_result: OCRResult
) -> None:
    """
    Save OCR result to S3 for later retrieval

    Args:
        document_id: Document ID
        user_id: User ID
        ocr_result: OCR result object
    """
    result_key = f'processed/{document_id}/ocr_result.json'

    result_data = {
        'documentId': document_id,
        'userId': user_id,
        'text': ocr_result.text,
        'confidence': ocr_result.confidence,
        'words': ocr_result.words,
        'engine': ocr_result.engine,
        'processedAt': context.get_remaining_time_in_millis() if 'context' in globals() else None,
    }

    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=result_key,
        Body=json.dumps(result_data),
        ContentType='application/json',
    )

    logger.info(f"Saved OCR result to {result_key}")


@tracer.capture_method
def emit_event(detail_type: str, result: ProcessingResult) -> None:
    """
    Emit event to EventBridge for workflow continuation

    Args:
        detail_type: Event type
        result: Processing result
    """
    event = {
        'Source': 'custom.learningyogi',
        'DetailType': detail_type,
        'Detail': json.dumps(asdict(result)),
    }

    eventbridge_client.put_events(Entries=[event])

    logger.info(f"Emitted event: {detail_type}")


def create_error_result(document_id: str, error_message: str) -> Dict[str, Any]:
    """
    Create error result

    Args:
        document_id: Document ID
        error_message: Error message

    Returns:
        Error result dict
    """
    result = ProcessingResult(
        document_id=document_id,
        status='failed',
        error_message=error_message,
    )

    return asdict(result)

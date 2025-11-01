# API Reference

Complete API documentation for PoCAIPipeline inference services.

## Base URL

- **Local**: `http://localhost:8000`
- **POC1**: `http://ai-pipeline-inference/api/v1`
- **POC2**: `https://api.learningyogi.com/prod`

## Authentication

Currently, authentication is not required for POC. For production:

```
Authorization: Bearer <token>
```

## OCR Inference API

### POST /infer/ocr

Extract text from an image using fine-tuned OCR model.

**Request**:
```json
{
  "image_path": "/path/to/image.png",
  "model_version": "v1.0",
  "use_feature_store": true
}
```

**Response**:
```json
{
  "text": "Monday 9:00 Mathematics",
  "confidence": 0.95,
  "words": [
    {
      "text": "Monday",
      "confidence": 0.98,
      "left": 10,
      "top": 20,
      "width": 100,
      "height": 30
    }
  ],
  "engine": "fine_tuned_ocr",
  "model_version": "v1.0",
  "processing_time": 0.15
}
```

**Status Codes**:
- `200`: Success
- `400`: Invalid request
- `404`: Model not found
- `500`: Server error

## Document Inference API

### POST /infer/document

Extract structured timetable data from an image.

**Request**:
```json
{
  "image_path": "/path/to/timetable.png",
  "model_version": "v1.0",
  "extract_features": true
}
```

**Response**:
```json
{
  "teacher": "Mr. Smith",
  "className": "Grade 5",
  "term": "Term 1",
  "year": 2024,
  "timeblocks": [
    {
      "day": "Monday",
      "name": "Mathematics",
      "startTime": "09:00",
      "endTime": "10:00",
      "notes": null
    }
  ],
  "confidence": 0.92,
  "model_version": "v1.0",
  "processing_time": 0.25
}
```

## Feature Store API

### GET /features/{entity_id}

Retrieve features for a document entity.

**Request**:
```
GET /features/doc_123?features=ocr_confidence,layout_score
```

**Response**:
```json
{
  "entity_id": "doc_123",
  "features": {
    "ocr_confidence": 0.95,
    "layout_score": 0.88,
    "word_count": 150
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### POST /features

Store features for a document.

**Request**:
```json
{
  "entity_id": "doc_123",
  "features": {
    "ocr_confidence": 0.95,
    "layout_score": 0.88,
    "word_count": 150
  }
}
```

**Response**:
```json
{
  "status": "success",
  "entity_id": "doc_123"
}
```

## Model Management API

### GET /models

List available models.

**Response**:
```json
{
  "models": [
    {
      "name": "ocr_lora",
      "version": "v1.0",
      "type": "ocr",
      "status": "production",
      "accuracy": 0.95,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### GET /models/{model_name}

Get model details.

**Response**:
```json
{
  "name": "ocr_lora",
  "version": "v1.0",
  "type": "ocr",
  "status": "production",
  "metrics": {
    "accuracy": 0.95,
    "latency": 0.15,
    "throughput": 100
  },
  "created_at": "2024-01-01T00:00:00Z"
}
```

### POST /models/{model_name}/deploy

Deploy a model version to production.

**Request**:
```json
{
  "version": "v1.1",
  "validate": true
}
```

## Health Check API

### GET /health

Check service health.

**Response**:
```json
{
  "status": "healthy",
  "services": {
    "inference": "healthy",
    "feature_store": "healthy",
    "model_registry": "healthy"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Rate Limiting

Default rate limits:
- **Inference**: 100 requests/minute per IP
- **Features**: 1000 requests/minute per IP
- **Models**: 10 requests/minute per IP

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "MODEL_NOT_FOUND",
    "message": "Model 'ocr_lora' version 'v2.0' not found",
    "details": {}
  }
}
```

Common error codes:
- `INVALID_REQUEST`: Bad request format
- `MODEL_NOT_FOUND`: Model doesn't exist
- `FEATURE_STORE_ERROR`: Feature store unavailable
- `PROCESSING_ERROR`: Inference failed
- `RATE_LIMIT_EXCEEDED`: Too many requests

## SDK Examples

### Python SDK

```python
from ai_pipeline import InferenceClient

client = InferenceClient(base_url="http://localhost:8000")

# OCR inference
result = client.ocr_inference(
    image_path="timetable.png",
    model_version="v1.0"
)
print(f"Text: {result.text}, Confidence: {result.confidence}")

# Document inference
timetable = client.document_inference(
    image_path="timetable.png"
)
print(f"Teacher: {timetable.teacher}")

# Feature store
features = client.get_features(
    entity_id="doc_123",
    feature_names=["ocr_confidence", "layout_score"]
)
```

### Node.js SDK

```javascript
const InferenceClient = require('@learningyogi/ai-pipeline');

const client = new InferenceClient({
  baseURL: 'http://localhost:8000'
});

// OCR inference
const result = await client.ocrInference({
  imagePath: 'timetable.png',
  modelVersion: 'v1.0'
});

// Document inference
const timetable = await client.documentInference({
  imagePath: 'timetable.png'
});
```

## WebSocket API

### Connection

```
ws://localhost:8000/ws
```

### Events

**Client → Server**:
```json
{
  "type": "subscribe",
  "job_id": "job_123"
}
```

**Server → Client**:
```json
{
  "type": "status",
  "job_id": "job_123",
  "status": "processing",
  "progress": 0.5
}
```

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-01-01


# API Documentation

This document describes the API endpoints for the POCDemoImplementation.

## Base URLs

- **Node.js API**: `http://localhost:4000`
- **Python AI Middleware**: `http://localhost:8000`

## Node.js API

### Health Check

**GET** `/health`

Check API health status.

**Response**:
```json
{
  "status": "healthy",
  "service": "nodejs-api"
}
```

### Upload Document

**POST** `/api/v1/documents/upload`

Upload a timetable image for processing.

**Content-Type**: `multipart/form-data`

**Parameters**:
- `file` (file, required): Image file (PNG, JPG, JPEG, PDF)

**Response** (200 OK):
```json
{
  "documentId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "uploaded"
}
```

**Error Response** (400 Bad Request):
```json
{
  "error": "No file provided"
}
```

**Example**:
```bash
curl -X POST http://localhost:4000/api/v1/documents/upload \
  -F "file=@timetable.png"
```

### Get Document

**GET** `/api/v1/documents/:id`

Get document details by ID.

**Parameters**:
- `id` (path, required): Document UUID

**Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "timetable.png",
  "file_path": "./data/uploads/550e8400-e29b-41d4-a716-446655440000/file.png",
  "file_type": "image",
  "file_size": 1234567,
  "status": "completed",
  "created_at": "2025-01-01T10:00:00Z"
}
```

**Error Response** (404 Not Found):
```json
{
  "error": "Document not found"
}
```

### List Documents

**GET** `/api/v1/documents`

Get all documents with pagination.

**Query Parameters**:
- `limit` (optional, default: 20): Number of results
- `offset` (optional, default: 0): Pagination offset

**Response** (200 OK):
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "filename": "timetable.png",
    "file_type": "image",
    "file_size": 1234567,
    "status": "completed",
    "created_at": "2025-01-01T10:00:00Z"
  }
]
```

### Delete Document

**DELETE** `/api/v1/documents/:id`

Delete a document and its associated data.

**Parameters**:
- `id` (path, required): Document UUID

**Response** (200 OK):
```json
{
  "message": "Document deleted"
}
```

## Python AI Middleware

### Health Check

**GET** `/health`

Check middleware health status.

**Response**:
```json
{
  "status": "healthy",
  "service": "ai-middleware"
}
```

### Preprocess Image

**POST** `/preprocess/enhance`

Enhance image for better OCR results.

**Request Body**:
```json
{
  "image_path": "/path/to/image.png",
  "output_dir": "/path/to/output"
}
```

**Response** (200 OK):
```json
{
  "enhanced_image_path": "/path/to/output/preprocessed_uuid.png"
}
```

**Error Response** (404 Not Found):
```json
{
  "detail": "Image not found: /path/to/image.png"
}
```

### Process OCR

**POST** `/ocr/process`

Run OCR on an image with Tesseract.

**Request Body**:
```json
{
  "image_path": "/path/to/image.png"
}
```

**Response** (200 OK):
```json
{
  "text": "Monday 9:00 Mathematics 10:00 ...",
  "confidence": 0.85,
  "words": [
    {
      "text": "Monday",
      "confidence": 0.95,
      "left": 10,
      "top": 20,
      "width": 100,
      "height": 30
    }
  ],
  "engine": "tesseract"
}
```

**Error Response** (500 Internal Server Error):
```json
{
  "detail": "OCR processing failed: ..."
}
```

### Get Quality Gate Decision

**POST** `/ocr/quality-gate`

Determine routing based on OCR confidence.

**Request Body**:
```json
{
  "text": "Monday 9:00 Mathematics ...",
  "confidence": 0.75,
  "words": [...],
  "engine": "tesseract"
}
```

**Response** (200 OK):
```json
{
  "route": "ai",
  "confidence": 0.75,
  "reason": "Medium confidence (75.00%) - AI processing required"
}
```

**Quality Gate Routes**:
- `validation`: High confidence (≥80%)
- `ai`: Low confidence (<80%)

### Extract with AI

**POST** `/ai/extract`

Extract timetable data using Claude AI.

**Request Body**:
```json
{
  "image_path": "/path/to/image.png"
}
```

**Response** (200 OK):
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
    },
    {
      "day": "Monday",
      "name": "English",
      "startTime": "10:00",
      "endTime": "11:00",
      "notes": "Reading and Writing"
    }
  ]
}
```

**Error Response** (400 Bad Request):
```json
{
  "detail": "Failed to parse Claude response: ..."
}
```

**Error Response** (500 Internal Server Error):
```json
{
  "detail": "AI extraction failed: Claude API call failed: ..."
}
```

## API Interactive Documentation

The Python AI Middleware provides interactive API documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

Use these interfaces to explore endpoints and test API calls directly.

## Authentication

**Current Implementation**: None (POC)

**Production**: JWT-based authentication will be added.

## Rate Limiting

**Current Implementation**: None (POC)

**Production**: Rate limiting will be implemented based on API keys.

## Error Handling

### Standard Error Response

```json
{
  "error": "Error message"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request |
| 404 | Not Found |
| 500 | Internal Server Error |

## Examples

### Complete Processing Flow

```bash
# 1. Upload document
RESPONSE=$(curl -s -X POST http://localhost:4000/api/v1/documents/upload \
  -F "file=@data/sample_timetables/Teacher Timetable Example 1.1.png")

DOCUMENT_ID=$(echo $RESPONSE | jq -r '.documentId')
echo "Document ID: $DOCUMENT_ID"

# 2. Check document status
curl http://localhost:4000/api/v1/documents/$DOCUMENT_ID

# 3. Wait for processing (poll or check logs)

# 4. Get results
curl http://localhost:4000/api/v1/documents/$DOCUMENT_ID

# 5. Delete when done
curl -X DELETE http://localhost:4000/api/v1/documents/$DOCUMENT_ID
```

### Direct Python API Usage

```bash
# Preprocess image
curl -X POST http://localhost:8000/preprocess/enhance \
  -H "Content-Type: application/json" \
  -d '{
    "image_path": "/data/sample_timetables/timetable.png",
    "output_dir": "/data/processed"
  }'

# Run OCR
curl -X POST http://localhost:8000/ocr/process \
  -H "Content-Type: application/json" \
  -d '{
    "image_path": "/data/processed/preprocessed_uuid.png"
  }'

# Extract with AI
curl -X POST http://localhost:8000/ai/extract \
  -H "Content-Type: application/json" \
  -d '{
    "image_path": "/data/sample_timetables/timetable.png"
  }'
```

## Testing

Use the provided sample timetables for testing:

```bash
# Test with different image formats
curl -X POST http://localhost:4000/api/v1/documents/upload \
  -F "file=@data/sample_timetables/Teacher Timetable Example 1.1.png"

curl -X POST http://localhost:4000/api/v1/documents/upload \
  -F "file=@data/sample_timetables/Teacher Timetable Example 3.png"

curl -X POST http://localhost:4000/api/v1/documents/upload \
  -F "file=@data/sample_timetables/Teacher Timetable Example 4.jpeg"
```

---

**API Version**: 1.0.0  
**Last Updated**: 2025-01-01


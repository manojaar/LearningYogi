# API Specification - Implementation 1

## Overview

This document provides comprehensive API specifications for the Learning Yogi platform, following REST principles with clear contracts for all endpoints.

---

## API Design Principles

1. **RESTful**: Resource-oriented URLs, HTTP verbs for actions
2. **Versioning**: API version in URL path (`/api/v1/...`)
3. **JSON**: Request and response bodies in JSON format
4. **Idempotency**: PUT and DELETE operations are idempotent
5. **Error Handling**: Consistent error response format
6. **Authentication**: JWT-based authentication
7. **Rate Limiting**: Per-user rate limits
8. **Pagination**: Cursor-based or offset-based pagination

---

## Base URL

```
Production: https://api.learningyogi.com
Staging: https://api-staging.learningyogi.com
Development: http://localhost:3000
```

---

## Authentication

### JWT Token Format

```http
Authorization: Bearer <jwt_token>
```

**Token Payload**:
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john.smith@school.edu",
  "role": "teacher",
  "iat": 1698764400,
  "exp": 1698850800
}
```

**Token Lifetime**:
- Access Token: 15 minutes
- Refresh Token: 7 days

---

## Common Response Formats

### Success Response

```json
{
  "success": true,
  "data": {
    ...
  },
  "meta": {
    "requestId": "req-123456",
    "timestamp": "2024-10-31T10:30:00.000Z"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "meta": {
    "requestId": "req-123456",
    "timestamp": "2024-10-31T10:30:00.000Z"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

---

## API Endpoints

## 1. Authentication API

### POST /api/v1/auth/register

Register a new user account.

**Request:**
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "john.smith@school.edu",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Smith"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john.smith@school.edu",
      "firstName": "John",
      "lastName": "Smith",
      "role": "teacher",
      "emailVerified": false,
      "createdAt": "2024-10-31T10:30:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900
    }
  }
}
```

**Validation Rules:**
- Email: Valid email format, unique
- Password: Min 8 characters, 1 uppercase, 1 lowercase, 1 digit, 1 special char
- First/Last Name: Min 1, max 100 characters

---

### POST /api/v1/auth/login

Authenticate user and get tokens.

**Request:**
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john.smith@school.edu",
  "password": "SecurePassword123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john.smith@school.edu",
      "firstName": "John",
      "lastName": "Smith",
      "role": "teacher"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900
    }
  }
}
```

**Error (401 Unauthorized):**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid email or password"
  }
}
```

---

### POST /api/v1/auth/refresh

Refresh access token using refresh token.

**Request:**
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

---

### POST /api/v1/auth/logout

Invalidate current tokens.

**Request:**
```http
POST /api/v1/auth/logout
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

## 2. Documents API

### POST /api/v1/documents/upload

Upload a timetable document for processing.

**Request:**
```http
POST /api/v1/documents/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="file"; filename="timetable.pdf"
Content-Type: application/pdf

<binary data>
--boundary
Content-Disposition: form-data; name="metadata"

{
  "name": "Autumn Term 2024",
  "className": "2EJ"
}
--boundary--
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "jobId": "990e8400-e29b-41d4-a716-446655440004",
    "documentId": "880e8400-e29b-41d4-a716-446655440003",
    "status": "pending",
    "estimatedProcessingTime": 10000,
    "statusUrl": "/api/v1/jobs/990e8400-e29b-41d4-a716-446655440004"
  }
}
```

**Validation:**
- File size: Max 10MB
- File types: image/png, image/jpeg, application/pdf, .docx
- Rate limit: 10 uploads per minute per user

**Error (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid file type",
    "details": [
      {
        "field": "file",
        "message": "Only PNG, JPEG, PDF, and DOCX files are allowed"
      }
    ]
  }
}
```

---

### GET /api/v1/documents/:id

Get document metadata.

**Request:**
```http
GET /api/v1/documents/880e8400-e29b-41d4-a716-446655440003
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "fileName": "timetable_autumn_2024.pdf",
    "fileType": "application/pdf",
    "fileSize": 524288,
    "uploadStatus": "completed",
    "timetableId": "660e8400-e29b-41d4-a716-446655440001",
    "metadata": {
      "pageCount": 1,
      "dimensions": {"width": 2480, "height": 3508}
    },
    "createdAt": "2024-10-31T10:30:00.000Z",
    "updatedAt": "2024-10-31T10:30:03.000Z"
  }
}
```

---

### GET /api/v1/documents

List user's documents with pagination.

**Request:**
```http
GET /api/v1/documents?page=1&limit=20&status=completed
Authorization: Bearer <token>
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `status`: Filter by status (optional)
- `sortBy`: Sort field (default: createdAt)
- `order`: Sort order (asc/desc, default: desc)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "880e8400-e29b-41d4-a716-446655440003",
        "fileName": "timetable_autumn_2024.pdf",
        "fileType": "application/pdf",
        "uploadStatus": "completed",
        "createdAt": "2024-10-31T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

### DELETE /api/v1/documents/:id

Delete a document.

**Request:**
```http
DELETE /api/v1/documents/880e8400-e29b-41d4-a716-446655440003
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Document deleted successfully",
    "deletedId": "880e8400-e29b-41d4-a716-446655440003"
  }
}
```

---

## 3. Jobs API

### GET /api/v1/jobs/:id

Get processing job status and result.

**Request:**
```http
GET /api/v1/jobs/990e8400-e29b-41d4-a716-446655440004
Authorization: Bearer <token>
```

**Response - Processing (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440004",
    "status": "ocr",
    "stage": "text_extraction",
    "progress": 45,
    "confidence": null,
    "processingTier": "tesseract",
    "startedAt": "2024-10-31T10:30:00.000Z",
    "estimatedCompletion": "2024-10-31T10:30:10.000Z"
  }
}
```

**Response - Completed (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440004",
    "status": "completed",
    "confidence": 99.25,
    "processingTier": "tesseract",
    "timetableId": "660e8400-e29b-41d4-a716-446655440001",
    "result": {
      "timeblocks": [
        {
          "name": "Maths",
          "dayOfWeek": "Monday",
          "startTime": "09:00",
          "endTime": "10:00",
          "duration": 60,
          "notes": "",
          "color": "#10B981"
        }
      ]
    },
    "metadata": {
      "processingTime": 2700,
      "ocrEngine": "tesseract-5.3.0"
    },
    "startedAt": "2024-10-31T10:30:00.000Z",
    "completedAt": "2024-10-31T10:30:03.000Z"
  }
}
```

**Response - Failed (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440004",
    "status": "failed",
    "errorMessage": "Unable to extract text from document",
    "errorCode": "OCR_FAILED",
    "retryCount": 3,
    "startedAt": "2024-10-31T10:30:00.000Z",
    "completedAt": "2024-10-31T10:30:15.000Z"
  }
}
```

**Response - HITL Required (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440004",
    "status": "hitl_pending",
    "confidence": 65.3,
    "processingTier": "tesseract",
    "hitlTaskId": "aa0e8400-e29b-41d4-a716-446655440005",
    "draftData": {
      "timeblocks": [
        {
          "name": "Maths (uncertain)",
          "dayOfWeek": "Monday",
          "startTime": "09:00",
          "endTime": "10:00"
        }
      ]
    },
    "startedAt": "2024-10-31T10:30:00.000Z"
  }
}
```

---

### POST /api/v1/jobs/:id/retry

Retry a failed processing job.

**Request:**
```http
POST /api/v1/jobs/990e8400-e29b-41d4-a716-446655440004/retry
Authorization: Bearer <token>
Content-Type: application/json

{
  "useLlm": true
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "jobId": "990e8400-e29b-41d4-a716-446655440004",
    "status": "pending",
    "message": "Job queued for retry with LLM processing"
  }
}
```

---

## 4. Timetables API

### POST /api/v1/timetables

Create a new timetable.

**Request:**
```http
POST /api/v1/timetables
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Autumn Term 2024",
  "className": "2EJ",
  "term": "Autumn",
  "year": 2024,
  "weekStartDate": "2024-09-01"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Autumn Term 2024",
    "className": "2EJ",
    "term": "Autumn",
    "year": 2024,
    "weekStartDate": "2024-09-01",
    "status": "draft",
    "createdAt": "2024-10-31T10:30:00.000Z",
    "updatedAt": "2024-10-31T10:30:00.000Z"
  }
}
```

---

### GET /api/v1/timetables

List user's timetables.

**Request:**
```http
GET /api/v1/timetables?status=active&page=1&limit=20
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "timetables": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "name": "Autumn Term 2024",
        "className": "2EJ",
        "term": "Autumn",
        "year": 2024,
        "status": "active",
        "timeblockCount": 35,
        "createdAt": "2024-10-31T10:30:00.000Z",
        "updatedAt": "2024-10-31T10:35:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

---

### GET /api/v1/timetables/:id

Get timetable details with all timeblocks.

**Request:**
```http
GET /api/v1/timetables/660e8400-e29b-41d4-a716-446655440001
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Autumn Term 2024",
    "className": "2EJ",
    "term": "Autumn",
    "year": 2024,
    "weekStartDate": "2024-09-01",
    "status": "active",
    "timeblocks": [
      {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "name": "Maths",
        "dayOfWeek": "Monday",
        "startTime": "09:00",
        "endTime": "10:00",
        "duration": 60,
        "notes": "Focus on multiplication tables",
        "color": "#10B981",
        "position": 1
      },
      {
        "id": "770e8400-e29b-41d4-a716-446655440003",
        "name": "English",
        "dayOfWeek": "Monday",
        "startTime": "10:00",
        "endTime": "11:00",
        "duration": 60,
        "notes": "",
        "color": "#3B82F6",
        "position": 2
      }
    ],
    "createdAt": "2024-10-31T10:30:00.000Z",
    "updatedAt": "2024-10-31T10:35:00.000Z"
  }
}
```

---

### PUT /api/v1/timetables/:id

Update timetable metadata.

**Request:**
```http
PUT /api/v1/timetables/660e8400-e29b-41d4-a716-446655440001
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Autumn Term 2024 - Updated",
  "status": "active"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Autumn Term 2024 - Updated",
    "className": "2EJ",
    "term": "Autumn",
    "year": 2024,
    "status": "active",
    "updatedAt": "2024-10-31T10:40:00.000Z"
  }
}
```

---

### DELETE /api/v1/timetables/:id

Delete a timetable and all associated timeblocks.

**Request:**
```http
DELETE /api/v1/timetables/660e8400-e29b-41d4-a716-446655440001
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Timetable deleted successfully",
    "deletedId": "660e8400-e29b-41d4-a716-446655440001",
    "deletedTimeblocksCount": 35
  }
}
```

---

## 5. Timeblocks API

### POST /api/v1/timetables/:timetableId/timeblocks

Add a timeblock to a timetable.

**Request:**
```http
POST /api/v1/timetables/660e8400-e29b-41d4-a716-446655440001/timeblocks
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Science",
  "dayOfWeek": "Tuesday",
  "startTime": "09:00",
  "endTime": "10:00",
  "notes": "Lab session",
  "color": "#8B5CF6"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440010",
    "timetableId": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Science",
    "dayOfWeek": "Tuesday",
    "startTime": "09:00",
    "endTime": "10:00",
    "duration": 60,
    "notes": "Lab session",
    "color": "#8B5CF6",
    "position": 10,
    "createdAt": "2024-10-31T10:45:00.000Z"
  }
}
```

---

### PUT /api/v1/timeblocks/:id

Update a timeblock.

**Request:**
```http
PUT /api/v1/timeblocks/770e8400-e29b-41d4-a716-446655440010
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Science - Chemistry",
  "notes": "Lab session - Chemical reactions"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440010",
    "name": "Science - Chemistry",
    "dayOfWeek": "Tuesday",
    "startTime": "09:00",
    "endTime": "10:00",
    "duration": 60,
    "notes": "Lab session - Chemical reactions",
    "color": "#8B5CF6",
    "updatedAt": "2024-10-31T10:50:00.000Z"
  }
}
```

---

### DELETE /api/v1/timeblocks/:id

Delete a timeblock.

**Request:**
```http
DELETE /api/v1/timeblocks/770e8400-e29b-41d4-a716-446655440010
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Timeblock deleted successfully",
    "deletedId": "770e8400-e29b-41d4-a716-446655440010"
  }
}
```

---

## 6. HITL (Human-in-the-Loop) API

### GET /api/v1/hitl/tasks

Get pending HITL tasks (admin/reviewer only).

**Request:**
```http
GET /api/v1/hitl/tasks?status=pending&priority=high
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "aa0e8400-e29b-41d4-a716-446655440005",
        "jobId": "990e8400-e29b-41d4-a716-446655440004",
        "priority": "normal",
        "status": "pending",
        "assignedTo": null,
        "createdAt": "2024-10-31T10:30:00.000Z",
        "user": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "email": "john.smith@school.edu",
          "firstName": "John",
          "lastName": "Smith"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

---

### POST /api/v1/hitl/tasks/:id/submit

Submit reviewed data for HITL task.

**Request:**
```http
POST /api/v1/hitl/tasks/aa0e8400-e29b-41d4-a716-446655440005/submit
Authorization: Bearer <token>
Content-Type: application/json

{
  "timeblocks": [
    {
      "name": "Maths",
      "dayOfWeek": "Monday",
      "startTime": "09:00",
      "endTime": "10:00"
    }
  ],
  "reviewNotes": "Corrected subject name from unclear OCR"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440005",
    "status": "completed",
    "jobId": "990e8400-e29b-41d4-a716-446655440004",
    "timetableId": "660e8400-e29b-41d4-a716-446655440001",
    "completedAt": "2024-10-31T11:00:00.000Z"
  }
}
```

---

## WebSocket API

### Connection

```javascript
const socket = io('https://api.learningyogi.com', {
  auth: {
    token: '<jwt_token>'
  }
});
```

### Events

#### Client → Server

**Subscribe to job updates:**
```javascript
socket.emit('subscribe:job', {
  jobId: '990e8400-e29b-41d4-a716-446655440004'
});
```

**Unsubscribe from job:**
```javascript
socket.emit('unsubscribe:job', {
  jobId: '990e8400-e29b-41d4-a716-446655440004'
});
```

#### Server → Client

**Job status update:**
```javascript
socket.on('job:status', (data) => {
  console.log(data);
  /*
  {
    jobId: '990e8400-e29b-41d4-a716-446655440004',
    status: 'ocr',
    stage: 'text_extraction',
    progress: 45,
    timestamp: '2024-10-31T10:30:05.000Z'
  }
  */
});
```

**Job completed:**
```javascript
socket.on('job:completed', (data) => {
  console.log(data);
  /*
  {
    jobId: '990e8400-e29b-41d4-a716-446655440004',
    timetableId: '660e8400-e29b-41d4-a716-446655440001',
    confidence: 99.25,
    timestamp: '2024-10-31T10:30:10.000Z'
  }
  */
});
```

**Job failed:**
```javascript
socket.on('job:failed', (data) => {
  console.log(data);
  /*
  {
    jobId: '990e8400-e29b-41d4-a716-446655440004',
    error: 'OCR processing failed',
    errorCode: 'OCR_FAILED',
    timestamp: '2024-10-31T10:30:15.000Z'
  }
  */
});
```

**HITL required:**
```javascript
socket.on('job:hitl_required', (data) => {
  console.log(data);
  /*
  {
    jobId: '990e8400-e29b-41d4-a716-446655440004',
    confidence: 65.3,
    reason: 'low_confidence',
    timestamp: '2024-10-31T10:30:08.000Z'
  }
  */
});
```

---

## Rate Limiting

### Limits

| Endpoint Pattern | Rate Limit | Window |
|------------------|------------|--------|
| `/api/v1/auth/*` | 10 requests | 15 minutes |
| `/api/v1/documents/upload` | 10 requests | 1 minute |
| `/api/v1/timetables/*` (write) | 30 requests | 1 minute |
| `/api/v1/*` (read) | 100 requests | 1 minute |
| `/api/v1/*` (all) | 1000 requests | 1 hour |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1698764460
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "retryAfter": 60
  }
}
```

---

## Pagination

### Offset-based Pagination

**Request:**
```http
GET /api/v1/timetables?page=2&limit=20
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": true
  }
}
```

### Cursor-based Pagination (future)

```http
GET /api/v1/timetables?cursor=eyJpZCI6IjEyMyJ9&limit=20
```

---

## API Versioning Strategy

- Current version: `v1`
- Versioning in URL path: `/api/v1/...`
- Deprecation notice: 6 months before removal
- Deprecation header: `Sunset: Sat, 31 Dec 2025 23:59:59 GMT`

---

## OpenAPI Specification

Full OpenAPI 3.0 specification available at:
```
/api/v1/docs/openapi.yaml
/api/v1/docs/swagger-ui  # Interactive docs
```

---

## Conclusion

This API specification provides a complete contract for all interactions with the Learning Yogi platform, ensuring consistency, clarity, and ease of integration for frontend and third-party developers.

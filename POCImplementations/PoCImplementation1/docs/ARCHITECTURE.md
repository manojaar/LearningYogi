# Architecture Document - PoC Implementation 1

## Overview

This document describes the detailed architecture of the Microservices Queue-based implementation for the Learning Yogi timetable extraction platform.

**Architecture Pattern**: Microservices with Event-Driven Processing
**Message Queue**: BullMQ (Redis-based)
**Database**: PostgreSQL + Redis
**Deployment**: Kubernetes / Docker Compose

---

## System Context Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                      EXTERNAL ACTORS                              │
│                                                                   │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                  │
│  │ Teachers │    │  Admins  │    │   AI     │                  │
│  │  (Users) │    │  (HITL)  │    │  APIs    │                  │
│  └──────────┘    └──────────┘    └──────────┘                  │
│       │               │                │                         │
└───────┼───────────────┼────────────────┼─────────────────────────┘
        │               │                │
        ▼               ▼                ▼
┌──────────────────────────────────────────────────────────────────┐
│                   LEARNING YOGI PLATFORM                          │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    PRESENTATION LAYER                       │ │
│  │                                                             │ │
│  │   ┌─────────────────────────────────────────────────────┐  │ │
│  │   │          React PWA (Progressive Web App)            │  │ │
│  │   │  - Upload Interface                                 │  │ │
│  │   │  - Timetable Visualization                          │  │ │
│  │   │  - Real-time Status Updates                         │  │ │
│  │   │  - Admin Dashboard (HITL)                           │  │ │
│  │   └─────────────────────────────────────────────────────┘  │ │
│  │                           │                                 │ │
│  └───────────────────────────┼─────────────────────────────────┘ │
│                              │ HTTPS/WSS                         │
│  ┌───────────────────────────┼─────────────────────────────────┐ │
│  │                    API GATEWAY LAYER                        │ │
│  │                           │                                 │ │
│  │   ┌───────────────────────▼───────────────────────┐        │ │
│  │   │     NGINX Load Balancer + API Gateway         │        │ │
│  │   │  - SSL Termination                            │        │ │
│  │   │  - Rate Limiting                              │        │ │
│  │   │  - Request Routing                            │        │ │
│  │   │  - WebSocket Proxy                            │        │ │
│  │   └───────────────────────┬───────────────────────┘        │ │
│  └───────────────────────────┼─────────────────────────────────┘ │
│                              │                                   │
│  ┌───────────────────────────┼─────────────────────────────────┐ │
│  │                  APPLICATION LAYER (Node.js)                │ │
│  │                           │                                 │ │
│  │  ┌────────────┐  ┌────────┴────────┐  ┌─────────────────┐ │ │
│  │  │   Auth     │  │   Documents     │  │   WebSocket     │ │ │
│  │  │  Service   │  │   API Service   │  │     Server      │ │ │
│  │  │            │  │                 │  │                 │ │ │
│  │  │ - Login    │  │ - Upload        │  │ - Connections   │ │ │
│  │  │ - Register │  │ - List/Get      │  │ - Broadcast     │ │ │
│  │  │ - JWT      │  │ - Delete        │  │ - Rooms         │ │ │
│  │  └────────────┘  └────────┬────────┘  └─────────────────┘ │ │
│  └───────────────────────────┼─────────────────────────────────┘ │
│                              │                                   │
│  ┌───────────────────────────┼─────────────────────────────────┐ │
│  │              MESSAGE QUEUE LAYER (BullMQ/Redis)             │ │
│  │                           │                                 │ │
│  │  ┌────────────────────────▼─────────────────────────────┐  │ │
│  │  │                  Job Queues                           │  │ │
│  │  │                                                       │  │ │
│  │  │  [Classification] → [Preprocess] → [OCR] →          │  │ │
│  │  │       Priority: 10      Priority: 8     Priority: 7   │  │ │
│  │  │                                                       │  │ │
│  │  │         → [LLM] → [Validation] → [Notification]     │  │ │
│  │  │      Priority: 5   Priority: 6      Priority: 3     │  │ │
│  │  │                                                       │  │ │
│  │  │         → [HITL Queue]                               │  │ │
│  │  │           Priority: 1                                │  │ │
│  │  └───────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────┬─────────────────────────────────┘ │
│                              │                                   │
│  ┌───────────────────────────┼─────────────────────────────────┐ │
│  │            PROCESSING LAYER (Python Workers)                │ │
│  │                           │                                 │ │
│  │  ┌─────────────┐  ┌───────▼───────┐  ┌─────────────────┐  │ │
│  │  │ Classifier  │  │ Preprocessor   │  │  OCR Processor  │  │ │
│  │  │             │  │                │  │                 │  │ │
│  │  │ - ML Model  │  │ - OpenCV       │  │ - Tesseract     │  │ │
│  │  │ - Type Det  │  │ - Enhance      │  │ - Google Vision │  │ │
│  │  └─────────────┘  └───────────────────┘  │ - Confidence    │  │ │
│  │                                        └─────────────────┘  │ │
│  │  ┌─────────────┐  ┌────────────────┐                      │ │
│  │  │     LLM     │  │   Validator    │                      │ │
│  │  │  Processor  │  │                │                      │ │
│  │  │             │  │ - Parse        │                      │ │
│  │  │ - Claude    │  │ - Validate     │                      │ │
│  │  │ - Prompts   │  │ - Normalize    │                      │ │
│  │  └─────────────┘  └────────────────┘                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     DATA LAYER                               │ │
│  │                                                              │ │
│  │  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐  │ │
│  │  │  PostgreSQL  │  │    Redis    │  │   S3 Storage     │  │ │
│  │  │    (OLTP)    │  │   (Cache)   │  │                  │  │ │
│  │  │              │  │             │  │ - Documents      │  │ │
│  │  │ - Users      │  │ - OCR Cache │  │ - Preprocessed   │  │ │
│  │  │ - Timetables │  │ - Sessions  │  │ - Archive        │  │ │
│  │  │ - Timeblocks │  │ - Queue     │  │                  │  │ │
│  │  │ - Documents  │  │             │  │                  │  │ │
│  │  └──────────────┘  └─────────────┘  └──────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Frontend (React PWA)

**Technology**: React 18 + TypeScript + Vite + TailwindCSS

**Key Components**:
```typescript
components/
├── UploadZone/          # Drag-drop file upload
├── TimetableGrid/       # Timetable visualization
├── ProcessingStatus/    # Real-time progress
├── AdminDashboard/      # HITL interface
└── Auth/                # Login/Register
```

**Features**:
- Progressive Web App (offline support)
- Real-time WebSocket updates
- Responsive design (mobile + desktop)
- File upload with progress tracking
- Service Worker for caching

---

### 2. API Gateway (NGINX)

**Configuration**:
```nginx
upstream api_servers {
    least_conn;
    server api-1:4000;
    server api-2:4000;
    server api-3:4000;
}

server {
    listen 443 ssl http2;
    server_name api.learningyogi.com;

    ssl_certificate /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/key.pem;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://api_servers;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket upgrade
    location /ws {
        proxy_pass http://websocket_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

### 3. Node.js Services

#### 3.1 Authentication Service

**File**: `backend/nodejs/src/services/auth.service.ts`

**Responsibilities**:
- User registration and login
- JWT token generation/validation
- Password hashing (bcrypt)
- Refresh token rotation

**API Endpoints**:
```typescript
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

**Test Coverage**: 90% (unit + integration)

#### 3.2 Documents API Service

**File**: `backend/nodejs/src/services/documents.service.ts`

**Responsibilities**:
- File upload handling
- Job creation and tracking
- Document metadata management
- S3 integration

**API Endpoints**:
```typescript
POST   /api/v1/documents/upload
GET    /api/v1/documents
GET    /api/v1/documents/:id
DELETE /api/v1/documents/:id
GET    /api/v1/documents/:id/status
```

**Upload Flow**:
1. Validate file (type, size)
2. Generate unique ID
3. Upload to S3 (streaming)
4. Create database record
5. Enqueue classification job
6. Return job ID to client

#### 3.3 WebSocket Server

**File**: `backend/nodejs/src/websocket/server.ts`

**Technology**: Socket.IO

**Events**:
```typescript
// Client → Server
socket.on('subscribe:job', ({ jobId }) => { ... })
socket.on('unsubscribe:job', ({ jobId }) => { ... })

// Server → Client
socket.emit('job:status', { jobId, status, stage, progress })
socket.emit('job:completed', { jobId, result })
socket.emit('job:failed', { jobId, error })
socket.emit('hitl:required', { jobId, reason, confidence })
```

**Scalability**: Redis adapter for multi-instance sync

---

### 4. Python Processing Services

#### 4.1 Document Classifier

**File**: `backend/python/src/classifier/classify.py`

**Model**: MobileNetV2 (lightweight CNN)

**Input**: File header + first page thumbnail
**Output**: Document type + confidence

```python
class DocumentClassifier:
    def classify(self, file_path: str) -> ClassificationResult:
        """
        Classify document type
        Returns: { type: 'image'|'pdf'|'docx', confidence: float }
        """
        # Load model
        model = load_model('models/classifier.h5')

        # Extract features
        features = extract_features(file_path)

        # Predict
        prediction = model.predict(features)

        return ClassificationResult(
            type=DOCUMENT_TYPES[np.argmax(prediction)],
            confidence=float(np.max(prediction))
        )
```

**Performance**: <1s per document

#### 4.2 Image Preprocessor

**File**: `backend/python/src/preprocessor/enhance.py`

**Techniques**:
```python
def preprocess_image(image_path: str) -> str:
    """
    Enhance image quality for better OCR
    """
    img = cv2.imread(image_path)

    # 1. Grayscale conversion
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 2. Noise reduction
    denoised = cv2.fastNlMeansDenoising(gray)

    # 3. Adaptive thresholding
    thresh = cv2.adaptiveThreshold(
        denoised, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 11, 2
    )

    # 4. Deskew (rotation correction)
    angle = compute_skew_angle(thresh)
    rotated = rotate_image(thresh, angle)

    # 5. Save preprocessed image
    output_path = f"preprocessed/{uuid.uuid4()}.png"
    cv2.imwrite(output_path, rotated)

    return output_path
```

**Performance**: <500ms per image

#### 4.3 OCR Processor

**File**: `backend/python/src/ocr/processor.py`

**Engines**:
1. **Tesseract OCR** (free, fast)
2. **Google Cloud Vision** (paid, accurate)

**Confidence Scoring**:
```python
def calculate_confidence(ocr_result: dict) -> float:
    """
    Calculate overall confidence score
    """
    weights = {
        'char_confidence': 0.4,      # Mean character confidence
        'word_dict_match': 0.2,      # Dictionary match rate
        'layout_consistency': 0.2,   # Table structure detected
        'time_pattern_match': 0.2    # Time patterns found
    }

    scores = {
        'char_confidence': ocr_result['mean_confidence'],
        'word_dict_match': check_dictionary_match(ocr_result['words']),
        'layout_consistency': detect_table_structure(ocr_result),
        'time_pattern_match': find_time_patterns(ocr_result['text'])
    }

    return sum(weights[k] * scores[k] for k in weights)
```

**Quality Gate Logic**:
```python
confidence = calculate_confidence(ocr_result)

if confidence >= 0.98:
    # High confidence → Validation queue
    enqueue_job('validation', job_data)
elif confidence >= 0.80:
    # Medium confidence → LLM queue
    enqueue_job('llm', job_data)
else:
    # Low confidence → HITL queue
    enqueue_job('hitl', job_data)
```

#### 4.4 LLM Processor

**File**: `backend/python/src/llm/claude.py`

**Model**: Claude 3.5 Sonnet

**Note**: Can be replaced with PoCAIPipeline's fine-tuned document models for better accuracy and reduced API costs. See [PoCAIPipeline Integration](../../PoCAIPipeline/docs/INTEGRATION.md).

**Prompt Strategy**:
```python
SYSTEM_PROMPT = """
You are an expert at extracting timetable data from educational documents.

Extract all timeblock events with their times from the provided timetable image.

Return a JSON object with this exact structure:
{
  "teacher": "Teacher name",
  "className": "Class name",
  "term": "Term/semester",
  "year": 2024,
  "timeblocks": [
    {
      "day": "Monday|Tuesday|...",
      "name": "Event name (preserve exact spelling)",
      "startTime": "HH:MM" (24-hour format),
      "endTime": "HH:MM" (24-hour format),
      "notes": "Any additional notes"
    }
  ]
}

RULES:
1. Preserve original event names exactly as written
2. Convert all times to 24-hour format
3. If only duration given, calculate end time from start
4. Mark any uncertainty in the notes field
"""

async def process_with_llm(image_path: str) -> dict:
    client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

    with open(image_path, 'rb') as f:
        image_data = base64.b64encode(f.read()).decode()

    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=4096,
        temperature=0,  # Deterministic
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_data
                        }
                    },
                    {
                        "type": "text",
                        "text": SYSTEM_PROMPT
                    }
                ]
            }
        ]
    )

    return json.loads(response.content[0].text)
```

**Error Handling**:
- Retry with exponential backoff (3 attempts)
- Fallback to HITL if all retries fail
- Rate limit handling
- Timeout: 30 seconds

---

### 5. Message Queue (BullMQ)

**File**: `backend/nodejs/src/queue/config.ts`

**Queue Configuration**:
```typescript
const queues = {
  classification: {
    priority: 10,
    concurrency: 5,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
  },
  preprocessing: {
    priority: 8,
    concurrency: 10,
    attempts: 2
  },
  ocr: {
    priority: 7,
    concurrency: 20,
    attempts: 3
  },
  llm: {
    priority: 5,
    concurrency: 5,  // Rate limited
    attempts: 3,
    timeout: 30000
  },
  validation: {
    priority: 6,
    concurrency: 15,
    attempts: 2
  },
  hitl: {
    priority: 1,
    concurrency: 1  // Manual review
  },
  notification: {
    priority: 3,
    concurrency: 10,
    attempts: 5
  }
};
```

---

### 6. Database Schema

See [DATAFLOW.md](DATAFLOW.md) for complete schema.

**Core Tables**:
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'teacher',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE timetables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    teacher_name VARCHAR(255),
    class_name VARCHAR(255),
    term VARCHAR(100),
    year INTEGER,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE timeblocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timetable_id UUID REFERENCES timetables(id),
    day VARCHAR(20),
    name VARCHAR(255),
    start_time TIME,
    end_time TIME,
    notes TEXT,
    color VARCHAR(7)
);
```

---

## Deployment Architecture

### Development (Docker Compose)

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports: ["443:443"]
    volumes: ["./nginx.conf:/etc/nginx/nginx.conf"]

  api:
    build: ./backend/nodejs
    ports: ["4000:4000"]
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/learningyogi
      - REDIS_URL=redis://redis:6379

  classifier-worker:
    build: ./backend/python
    command: python -m src.classifier.worker

  ocr-worker:
    build: ./backend/python
    command: python -m src.ocr.worker

  llm-worker:
    build: ./backend/python
    command: python -m src.llm.worker

  postgres:
    image: postgres:14
    environment:
      - POSTGRES_DB=learningyogi

  redis:
    image: redis:7-alpine
```

### Production (Kubernetes)

See `/infrastructure/kubernetes` for complete manifests.

---

## Design Patterns

### 1. Queue-based Processing
- Decoupled services
- Automatic retry
- Priority-based execution
- Backpressure handling

### 2. Repository Pattern
- Data access abstraction
- Testability
- Database independence

### 3. Service Layer Pattern
- Business logic separation
- Reusability
- Clear responsibilities

### 4. Circuit Breaker
- External API protection
- Graceful degradation
- Fallback strategies

---

## AI Pipeline Integration (Optional)

For enhanced AI capabilities, integrate **PoCAIPipeline**:

### Benefits
- **Fine-tuned OCR Models**: Replace Tesseract/Cloud Vision with domain-specific models
- **Fine-tuned Document Models**: Replace Claude API with custom models
- **Feature Store**: Feast with Redis cluster for analytics
- **Cost Reduction**: 80-90% reduction in Claude API costs

### Integration Points
- Replace OCR Processor with PoCAIPipeline OCR service
- Replace LLM Processor with PoCAIPipeline document service
- Add Feast feature store alongside existing Redis
- Enable MLflow for model versioning

**See**: [PoCAIPipeline POC1 Migration Guide](../../PoCAIPipeline/docs/MIGRATION_POC1.md)

## Next Steps

1. Review [DATAFLOW.md](DATAFLOW.md) for detailed data flow
2. Review [TECHSTACK_JUSTIFICATION.md](TECHSTACK_JUSTIFICATION.md) for technology choices
3. Review implementation code in `/backend` and `/frontend`
4. **Optional**: Consider PoCAIPipeline integration for enhanced AI capabilities

---

**Version**: 1.0.0
**Last Updated**: 2025-01-01

# Implementation 1: Microservices Queue-based Architecture

## Overview

This implementation uses a traditional microservices architecture with message queues for asynchronous processing, providing fine-grained control over scaling, resource allocation, and cost optimization at high volume.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    React PWA (Web + Mobile)                           │   │
│  │  - Service Worker (Offline support)                                   │   │
│  │  - IndexedDB (Local caching)                                          │   │
│  │  - WebSocket Client (Real-time updates)                               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │ HTTPS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EDGE/CDN LAYER                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Cloudflare / CloudFront                                              │   │
│  │  - Static asset caching                                               │   │
│  │  - DDoS protection                                                     │   │
│  │  - WAF (Web Application Firewall)                                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY LAYER                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  NGINX / Kong / AWS ALB                                               │   │
│  │  - Rate limiting                                                       │   │
│  │  - Authentication (JWT)                                                │   │
│  │  - Request routing                                                     │   │
│  │  - SSL termination                                                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                                     │
        ┌───────────┴──────────┬──────────────────────────┴──────────┐
        │                      │                                      │
        ▼                      ▼                                      ▼
┌──────────────┐    ┌───────────────────┐              ┌─────────────────────┐
│  Auth        │    │  Backend For      │              │  WebSocket          │
│  Service     │    │  Frontend (BFF)   │              │  Server             │
│  (Node.js)   │    │  (Node.js)        │              │  (Node.js)          │
│              │    │                   │              │                     │
│  - Login     │    │  - REST APIs      │              │  - Real-time        │
│  - Register  │    │  - File upload    │              │    notifications    │
│  - JWT       │    │  - Orchestration  │              │  - Processing       │
│              │    │                   │              │    status           │
└──────────────┘    └───────────────────┘              └─────────────────────┘
                              │                                  │
                              │                                  │
                              ▼                                  ▼
                    ┌───────────────────┐              ┌─────────────────────┐
                    │  Object Storage   │              │  Redis              │
                    │  (S3/GCS/Azure)   │              │  - Pub/Sub          │
                    │                   │              │  - Sessions         │
                    │  - Documents      │              │  - Cache            │
                    │  - Processed      │              └─────────────────────┘
                    └───────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MESSAGE QUEUE LAYER                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        BullMQ (Redis-based)                           │   │
│  │                                                                        │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │ Classification│  │ OCR Queue    │  │ LLM Queue    │               │   │
│  │  │ Queue         │  │ (High        │  │ (Medium      │               │   │
│  │  │ (Highest      │  │ Priority)    │  │ Priority)    │               │   │
│  │  │ Priority)     │  │              │  │              │               │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  │                                                                        │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │ HITL Queue   │  │ Notification │  │ Analytics    │               │   │
│  │  │ (Low         │  │ Queue        │  │ Queue        │               │   │
│  │  │ Priority)    │  │              │  │              │               │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Classification  │  │  OCR Processing  │  │  LLM Processing  │
│  Service         │  │  Service         │  │  Service         │
│  (Python)        │  │  (Python)        │  │  (Python)        │
│                  │  │                  │  │                  │
│  - ML Model      │  │  - Tesseract     │  │  - Claude API    │
│  - Type detect   │  │  - Google CV     │  │  - Prompt eng.   │
│  - Route logic   │  │  - Confidence    │  │  - Retry logic   │
│                  │  │    scoring       │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
        │                     │                     │
        │                     ▼                     │
        │            ┌──────────────────┐           │
        │            │  Preprocessing   │           │
        │            │  Service         │           │
        │            │  (Python)        │           │
        │            │                  │           │
        │            │  - Image enhance │           │
        │            │  - Orientation   │           │
        │            │  - Noise removal │           │
        │            └──────────────────┘           │
        │                                            │
        └────────────────────┬───────────────────────┘
                             │
                             ▼
                   ┌──────────────────┐
                   │  Validation &    │
                   │  Extraction      │
                   │  Service         │
                   │  (Node.js)       │
                   │                  │
                   │  - Parse results │
                   │  - Validate      │
                   │  - Transform     │
                   └──────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                          │
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  PostgreSQL      │  │  Redis           │  │  TimescaleDB     │          │
│  │  (OLTP)          │  │  (Cache)         │  │  (Time-series)   │          │
│  │                  │  │                  │  │                  │          │
│  │  - Users         │  │  - OCR cache     │  │  - Metrics       │          │
│  │  - Timetables    │  │  - LLM cache     │  │  - Logs          │          │
│  │  - Documents     │  │  - Sessions      │  │  - Analytics     │          │
│  │  - Timeblocks    │  │  - Rate limit    │  │                  │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Service Breakdown

### 1. API Gateway / Load Balancer
**Technology**: NGINX, Kong, or AWS ALB
**Responsibilities**:
- SSL/TLS termination
- Request routing to appropriate services
- Rate limiting and throttling
- Authentication (JWT validation)
- Request/response logging
- CORS handling

**Why NGINX**:
- High performance (50,000+ req/s)
- Battle-tested reliability
- Flexible configuration
- Built-in caching
- WebSocket support

---

### 2. Auth Service (Node.js)
**Technology**: Node.js + Express + Passport.js
**Responsibilities**:
- User registration and login
- JWT token generation and validation
- Password hashing (bcrypt)
- Session management
- OAuth integration (future: Google, Microsoft)

**API Endpoints**:
```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

**Database**:
- PostgreSQL: User credentials, profiles

**Performance**:
- Target: <100ms response time
- Caching: JWT validation results in Redis

---

### 3. Backend For Frontend (BFF) Service (Node.js)
**Technology**: Node.js + NestJS (framework for structure)
**Responsibilities**:
- REST API for frontend
- File upload handling
- Job orchestration
- Timetable CRUD operations
- User data management
- API composition (aggregating data from multiple services)

**API Endpoints**:
```
POST   /api/v1/documents/upload
GET    /api/v1/documents/:id
GET    /api/v1/documents/:id/status
DELETE /api/v1/documents/:id

POST   /api/v1/timetables
GET    /api/v1/timetables
GET    /api/v1/timetables/:id
PUT    /api/v1/timetables/:id
DELETE /api/v1/timetables/:id

GET    /api/v1/timetables/:id/timeblocks
POST   /api/v1/timetables/:id/timeblocks
PUT    /api/v1/timeblocks/:id
DELETE /api/v1/timeblocks/:id

GET    /api/v1/jobs/:id
POST   /api/v1/jobs/:id/retry
```

**Key Features**:
- Multipart file upload with streaming
- Direct upload to S3 with signed URLs
- Job status polling or WebSocket subscription
- Pagination for list endpoints
- Filtering and sorting

**Performance**:
- Target: <200ms response time (excluding uploads)
- File upload: Chunked streaming to S3
- Connection pooling to database

---

### 4. WebSocket Server (Node.js)
**Technology**: Node.js + Socket.io or ws
**Responsibilities**:
- Real-time job status updates
- Push notifications to clients
- Bidirectional communication

**Events**:
```javascript
// Client → Server
socket.emit('subscribe:job', { jobId: 'xxx' })
socket.emit('unsubscribe:job', { jobId: 'xxx' })

// Server → Client
socket.emit('job:status', { jobId: 'xxx', status: 'processing', stage: 'ocr' })
socket.emit('job:completed', { jobId: 'xxx', result: {...} })
socket.emit('job:failed', { jobId: 'xxx', error: 'xxx' })
socket.emit('job:hitl_required', { jobId: 'xxx', reason: 'low_confidence' })
```

**Scalability**:
- Redis adapter for multi-instance synchronization
- Sticky sessions at load balancer
- Horizontal scaling with shared Redis pub/sub

---

### 5. Document Classification Service (Python)
**Technology**: Python + FastAPI + ML Model
**Responsibilities**:
- Classify document type (image, PDF, DOCX)
- Detect document quality
- Route to appropriate processing pipeline
- Extract metadata (dimensions, page count, etc.)

**ML Model**:
- Lightweight classifier (ResNet18 or MobileNetV2)
- Trained on document types
- Input: File header + first page thumbnail
- Output: Document type + confidence score

**Processing Flow**:
```python
1. Receive document from queue
2. Read file header and metadata
3. Extract first page/thumbnail
4. Run classification model
5. Determine routing:
   - Image → Image preprocessing → OCR
   - PDF → PDF extraction → OCR or LLM
   - DOCX → Text extraction → Parser
6. Publish to appropriate queue
7. Update job status
```

**Performance**:
- Target: <1s per document
- Model inference: <200ms
- CPU-based inference (no GPU needed for classification)

---

### 6. Preprocessing Service (Python)
**Technology**: Python + OpenCV + PIL
**Responsibilities**:
- Image quality enhancement
- Orientation correction (deskew)
- Noise reduction
- Contrast/brightness adjustment
- Resize and normalize

**Techniques**:
```python
- Grayscale conversion
- Adaptive thresholding
- Morphological operations (dilation, erosion)
- Gaussian blur for noise reduction
- Hough transform for rotation correction
- CLAHE (Contrast Limited Adaptive Histogram Equalization)
```

**Performance**:
- Target: <500ms per image
- Parallel processing for multi-page documents
- GPU acceleration optional (for high volume)

---

### 7. OCR Processing Service (Python)
**Technology**: Python + Tesseract OCR + Google Cloud Vision API
**Responsibilities**:
- Text extraction from images and PDFs
- Confidence scoring
- Layout detection (tables, columns)
- Quality gate decision

**Processing Flow**:
```python
1. Receive preprocessed document from queue
2. Run primary OCR (Tesseract)
3. Calculate confidence score
4. Decision tree:
   - Confidence ≥98%: Accept result, proceed to validation
   - Confidence 90-97%: Run Google Cloud Vision as secondary OCR
   - Confidence 80-89%: Route to LLM queue
   - Confidence <80%: Route to HITL queue
5. Publish result to next stage
6. Cache result in Redis (key: document hash)
```

**Confidence Scoring Algorithm**:
```python
def calculate_confidence(ocr_result):
    factors = {
        'mean_char_confidence': 0.4,  # Average character confidence from Tesseract
        'word_dictionary_match': 0.2,  # % of words in dictionary
        'layout_consistency': 0.2,     # Table structure detected correctly
        'time_pattern_match': 0.2      # Time patterns detected
    }
    return weighted_sum(factors)
```

**Performance**:
- Tesseract: 100-500ms per page
- Google Cloud Vision: 500-2000ms per page
- Target total: <3s per document (single page)

---

### 8. LLM Processing Service (Python)
**Technology**: Python + Anthropic SDK (Claude)
**Responsibilities**:
- Use Claude 3.5 Sonnet for complex document parsing
- Structured data extraction
- Handle ambiguous layouts
- Handwriting recognition

**Prompt Strategy**:
```python
SYSTEM_PROMPT = """
You are an expert at extracting timetable data from educational documents.
Extract all timeblock events with their times from the provided document.

Return a structured JSON response with:
- day: Day of week
- timeblocks: Array of events
  - name: Event name (preserve exact spelling)
  - startTime: Start time in HH:MM format (24-hour)
  - endTime: End time in HH:MM format (24-hour)
  - duration: Duration in minutes (if times not explicit)
  - notes: Any additional notes or comments

Rules:
- Preserve original event names exactly as written
- Convert all times to 24-hour format
- If only duration given, calculate end time from sequence
- Mark uncertainty in notes field
"""

USER_PROMPT = """
Extract the timetable from this document. The teacher is [teacher_name] and
the class is [class_name]. The document may be typed, handwritten, or partially filled.
Be thorough and preserve all information.
"""
```

**API Configuration**:
```python
client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=4096,
    temperature=0,  # Deterministic output
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {"type": "image", "source": {...}},
                {"type": "text", "text": USER_PROMPT}
            ]
        }
    ]
)
```

**Error Handling**:
- Retry with exponential backoff (3 attempts)
- Fallback to HITL if all retries fail
- Rate limit handling (429 errors)
- Timeout: 30 seconds

**Performance**:
- Target: <10s per document
- Batching: Process multiple pages in single call if under context limit
- Caching: Cache results by document hash

**Cost Optimization**:
```python
- Use caching for identical documents
- Compress images before sending (maintain quality)
- Use prompt caching for system prompt (Anthropic feature)
- Monitor token usage per request
```

---

### 9. Validation & Extraction Service (Node.js)
**Technology**: Node.js + Zod (schema validation)
**Responsibilities**:
- Parse OCR/LLM output
- Validate data structure
- Normalize time formats
- Detect and fix common errors
- Transform to internal schema

**Validation Rules**:
```typescript
const TimeblockSchema = z.object({
  name: z.string().min(1).max(100),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/), // HH:MM
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  duration: z.number().int().min(1).max(480).optional(), // max 8 hours
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  notes: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const TimetableSchema = z.object({
  teacher: z.string().min(1),
  className: z.string().min(1),
  term: z.string().optional(),
  year: z.number().int().min(2020).max(2100),
  timeblocks: z.array(TimeblockSchema).min(1),
});
```

**Normalization Logic**:
```typescript
// Convert 12-hour to 24-hour
"9:00 AM" → "09:00"
"2:30 PM" → "14:30"

// Handle abbreviated day names
"Mon" → "Monday"
"Wed" → "Wednesday"

// Calculate duration if missing
startTime: "09:00", endTime: "10:00" → duration: 60

// Detect overlaps and conflicts
```

**Quality Checks**:
```typescript
- No time overlaps within same day
- Start time < End time
- Reasonable duration (5 mins - 8 hours)
- At least one timeblock per day
- Valid day names
```

**Performance**:
- Target: <100ms per document
- In-memory processing, no I/O

---

### 10. Notification Service (Node.js)
**Technology**: Node.js + SendGrid (email) + Firebase (push)
**Responsibilities**:
- Send processing status emails
- Push notifications for mobile PWA
- HITL request notifications
- Error alerts

**Notification Types**:
```javascript
{
  'processing_complete': {
    channels: ['email', 'push', 'websocket'],
    template: 'Your timetable "{{timetableName}}" has been processed successfully.',
  },
  'processing_failed': {
    channels: ['email', 'websocket'],
    template: 'Failed to process "{{timetableName}}". Error: {{error}}',
  },
  'hitl_required': {
    channels: ['email', 'push'],
    template: 'Manual review needed for "{{timetableName}}". Confidence: {{confidence}}%',
  },
  'hitl_completed': {
    channels: ['email', 'push', 'websocket'],
    template: 'Your timetable "{{timetableName}}" has been reviewed and is ready.',
  },
}
```

**Performance**:
- Async processing via queue
- Batch email sending
- Rate limiting per user
- Retry failed notifications

---

## Data Flow: End-to-End Processing

### Happy Path: High Confidence OCR

```
1. User uploads document via React PWA
   └─ POST /api/v1/documents/upload

2. BFF Service:
   ├─ Validates file (type, size)
   ├─ Generates unique document ID
   ├─ Uploads file to S3 (streaming)
   ├─ Creates database record (status: 'uploaded')
   ├─ Publishes to Classification Queue
   └─ Returns jobId to client

3. Classification Service:
   ├─ Downloads file from S3
   ├─ Runs ML classifier
   ├─ Determines: Image/PDF/DOCX
   ├─ Updates job status: 'classifying' → 'preprocessing'
   └─ Publishes to Preprocessing Queue

4. Preprocessing Service:
   ├─ Downloads file from S3
   ├─ Enhances image quality
   ├─ Deskews and normalizes
   ├─ Uploads preprocessed to S3
   ├─ Updates job status: 'preprocessing' → 'ocr'
   └─ Publishes to OCR Queue

5. OCR Service:
   ├─ Downloads preprocessed file from S3
   ├─ Runs Tesseract OCR
   ├─ Calculates confidence: 99%
   ├─ Confidence ≥98%: Accept result
   ├─ Caches result in Redis
   ├─ Updates job status: 'ocr' → 'validating'
   └─ Publishes to Validation Queue

6. Validation Service:
   ├─ Receives OCR output
   ├─ Parses and validates structure
   ├─ Normalizes time formats
   ├─ Transforms to internal schema
   ├─ Saves timetable + timeblocks to PostgreSQL
   ├─ Updates job status: 'validating' → 'completed'
   ├─ Publishes to Notification Queue
   └─ Sends WebSocket event to client

7. Notification Service:
   ├─ Sends email to user
   └─ Sends push notification (if enabled)

8. Client receives WebSocket event:
   └─ Displays timetable in UI
```

**Total Time**: ~5-10 seconds

---

### Medium Confidence Path: LLM Fallback

```
1-4. [Same as above]

5. OCR Service:
   ├─ Runs Tesseract OCR
   ├─ Calculates confidence: 85%
   ├─ Confidence 80-98%: Route to LLM
   ├─ Updates job status: 'ocr' → 'llm_processing'
   └─ Publishes to LLM Queue

6. LLM Service:
   ├─ Downloads original file from S3
   ├─ Calls Claude 3.5 Sonnet API
   ├─ Receives structured JSON response
   ├─ Updates job status: 'llm_processing' → 'validating'
   └─ Publishes to Validation Queue

7-8. [Same as above]
```

**Total Time**: ~15-20 seconds

---

### Low Confidence Path: Human-in-the-Loop

```
1-4. [Same as above]

5. OCR Service:
   ├─ Runs Tesseract OCR
   ├─ Calculates confidence: 65%
   ├─ Confidence <80%: Route to HITL
   ├─ Updates job status: 'ocr' → 'hitl_pending'
   └─ Publishes to HITL Queue

6. HITL Service:
   ├─ Saves OCR output as draft
   ├─ Creates HITL task in database
   ├─ Updates job status: 'hitl_pending'
   ├─ Publishes to Notification Queue
   └─ Sends notification to user and admin

7. User/Admin reviews in web UI:
   ├─ Views OCR output side-by-side with original
   ├─ Corrects errors manually
   ├─ Submits corrected data
   └─ Updates job status: 'hitl_pending' → 'validating'

8-9. [Same as validation + notification above]
```

**Total Time**: Variable (minutes to hours, depends on human)

---

## Scalability Strategy

### Horizontal Scaling

**Services** (Docker containers in Kubernetes):
```yaml
- API Gateway (NGINX): 2-10 replicas (auto-scale on CPU/connections)
- Auth Service: 2-5 replicas (stateless)
- BFF Service: 3-20 replicas (auto-scale on request rate)
- WebSocket Server: 2-10 replicas (sticky sessions)
- Classification Service: 2-10 workers (auto-scale on queue depth)
- Preprocessing Service: 2-20 workers (GPU-enabled for high volume)
- OCR Service: 5-50 workers (CPU-intensive, scale on queue depth)
- LLM Service: 2-10 workers (rate-limited by API)
- Validation Service: 3-20 workers
- Notification Service: 2-5 workers
```

**Auto-scaling Triggers**:
```yaml
- CPU utilization > 70%
- Memory utilization > 80%
- Queue depth > 100 jobs
- Request latency > 500ms (p95)
```

### Database Scaling

**PostgreSQL**:
- Primary-Replica setup (1 primary, 2-3 read replicas)
- Connection pooling (PgBouncer)
- Partitioning for large tables (timeblocks by month)
- Indexing strategy for common queries

**Redis**:
- Redis Cluster (3 master, 3 replica minimum)
- Memory optimization (TTL for cache entries)
- Separate Redis instances for different purposes:
  - Cache: Short TTL, eviction policy LRU
  - Queue: Persistent, no eviction
  - Session: Medium TTL, volatile-lru

### Message Queue Scaling

**BullMQ**:
- Queue per service (isolation)
- Priority queues (Classification > OCR > LLM > HITL)
- Concurrency limits per worker
- Separate worker pools for different priorities

### Storage Scaling

**S3/Object Storage**:
- Lifecycle policies (hot → warm → cold)
- CloudFront CDN for frequently accessed documents
- Multipart upload for large files
- S3 Transfer Acceleration for global users

---

## High Availability & Fault Tolerance

### Service Redundancy
- Minimum 2 replicas per service
- Multi-AZ deployment
- Health checks and automatic restarts
- Circuit breakers for external dependencies

### Data Redundancy
- PostgreSQL: Streaming replication, point-in-time recovery
- Redis: AOF + RDB snapshots, cluster mode
- S3: Multi-region replication (optional)

### Failure Handling
```javascript
// Automatic retry with exponential backoff
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000, // 1s, 2s, 4s
  },
  removeOnComplete: false, // Keep for audit
  removeOnFail: false,
}
```

### Dead Letter Queue (DLQ)
- Failed jobs after max retries → DLQ
- Manual review and re-queue
- Alert on DLQ threshold

---

## Monitoring & Observability

### Metrics (Prometheus + Grafana)

**Application Metrics**:
```
- Documents processed per minute/hour/day
- Processing time by stage (p50, p95, p99)
- Success rate by document type
- Confidence score distribution
- Queue depth per queue
- Worker utilization
- API response time
- Error rate by endpoint
- Cache hit rate
```

**Infrastructure Metrics**:
```
- CPU, Memory, Disk utilization
- Network I/O
- Database connections and query time
- Redis operations per second
- S3 request count and latency
```

**Business Metrics**:
```
- User registrations per day
- Active users
- Documents uploaded per user
- OCR vs LLM usage ratio
- HITL request rate
- Cost per document (by tier)
```

### Logging (Winston → ELK Stack)

**Log Aggregation**:
```
Services → Winston → Logstash → Elasticsearch → Kibana
```

**Structured Logs**:
```json
{
  "timestamp": "2025-10-31T10:30:00.000Z",
  "level": "info",
  "service": "ocr-service",
  "requestId": "req-123456",
  "userId": "user-789",
  "documentId": "doc-abc",
  "jobId": "job-xyz",
  "message": "OCR processing completed",
  "duration": 1250,
  "confidence": 0.99,
  "metadata": {
    "pageCount": 1,
    "engine": "tesseract",
    "language": "eng"
  }
}
```

### Distributed Tracing (Jaeger)

**Trace Propagation**:
- Trace ID injected at API Gateway
- Propagated through all services
- End-to-end request visualization
- Performance bottleneck identification

### Alerting

**Critical Alerts** (PagerDuty):
```
- Service down (health check failure)
- Database connection failure
- Error rate > 5%
- Queue depth > 1000 (sustained 5 min)
- OCR/LLM API failure
- Disk space < 10%
```

**Warning Alerts** (Email/Slack):
```
- High latency (p95 > 1s)
- Cache hit rate < 80%
- HITL queue growing
- Cost threshold exceeded
```

---

## Security

### Authentication & Authorization
- JWT tokens with refresh tokens
- Role-based access control (RBAC)
- API key for service-to-service auth

### Data Security
- Encryption at rest (S3, RDS)
- Encryption in transit (TLS 1.3)
- Sensitive data masking in logs
- GDPR compliance (data deletion)

### Network Security
- VPC with private subnets for services
- Security groups and NACLs
- WAF at edge (Cloudflare/AWS WAF)
- DDoS protection

### API Security
- Rate limiting per user/IP
- Input validation and sanitization
- CORS configuration
- API versioning for breaking changes

---

## Cost Optimization

### Estimated Monthly Cost (1000 documents/day)

```
Infrastructure:
- Kubernetes cluster (3 nodes, 8 vCPU, 32GB RAM): $500
- PostgreSQL (db.t3.large): $150
- Redis (cache.t3.medium): $80
- S3 storage (100GB + requests): $50
- CloudFront CDN: $30
- Load balancer: $20
  Subtotal: $830/month

Processing:
- Tesseract OCR: Free (self-hosted)
- Google Cloud Vision (20% of docs, 6000/month): $9
- Claude API (10% of docs, 3000/month, ~1M tokens): $60
- Compute for processing workers: $200
  Subtotal: $269/month

Total: ~$1100/month (30,000 documents/month)
Cost per document: ~$0.037
```

### Cost Optimization Strategies
- Use Tesseract as primary (free)
- Cache OCR/LLM results aggressively
- Compress images before API calls
- Use spot instances for workers (70% cost saving)
- Implement smart routing (avoid LLM when possible)
- S3 lifecycle policies (move to Glacier after 90 days)

---

## Development & Deployment

### Technology Stack Summary

| Component | Technology | Justification |
|-----------|------------|---------------|
| API Gateway | NGINX | High performance, battle-tested |
| Auth Service | Node.js + Passport | JWT auth, extensive library support |
| BFF Service | Node.js + NestJS | Structured, TypeScript, DI container |
| WebSocket | Node.js + Socket.io | Real-time, auto-reconnect, fallbacks |
| Classification | Python + FastAPI | ML ecosystem, async support |
| Preprocessing | Python + OpenCV | Computer vision libraries |
| OCR Service | Python + Tesseract | Best OCR library support |
| LLM Service | Python + Anthropic SDK | Official SDK, type hints |
| Validation | Node.js + Zod | Schema validation, TypeScript |
| Message Queue | BullMQ (Redis) | Priority queues, Node.js native |
| Database | PostgreSQL | ACID, JSONB, full-text search |
| Cache | Redis | Sub-ms latency, rich data structures |
| Time-series | TimescaleDB | PostgreSQL extension, SQL interface |
| Object Storage | S3 | Scalable, durable, cheap |
| Monitoring | Prometheus + Grafana | Open source, Kubernetes native |
| Logging | ELK Stack | Powerful search, visualization |
| Tracing | Jaeger | OpenTelemetry compatible |

### Deployment Pipeline

```
Developer → Git Push → GitHub Actions → Build Docker Images →
Push to Container Registry → Update Kubernetes Manifests →
ArgoCD Sync → Rolling Update → Health Check → Success/Rollback
```

**CI/CD Stages**:
1. Lint and format check
2. Run unit tests
3. Run integration tests
4. Build Docker images
5. Scan images for vulnerabilities
6. Push to registry
7. Deploy to staging
8. Run E2E tests
9. Deploy to production (manual approval)

### Infrastructure as Code
- Terraform for cloud resources
- Kubernetes manifests for services
- Helm charts for complex deployments
- GitOps with ArgoCD

---

## Advantages of Implementation 1

1. **Predictable Performance**: No cold starts, consistent latency
2. **Cost Efficiency at Scale**: Lower per-document cost at high volume
3. **Full Control**: Fine-grained resource allocation and optimization
4. **Complex Workflows**: Easier to implement stateful, long-running processes
5. **Debugging**: Easier to debug with logs, metrics, traces
6. **No Timeout Limits**: Can process very large documents without time constraints
7. **Vendor Independence**: Can deploy on any cloud or on-premises

## Disadvantages of Implementation 1

1. **Operational Overhead**: Requires DevOps expertise for Kubernetes
2. **Higher Minimum Cost**: Base infrastructure cost even at zero usage
3. **Slower to Scale**: Takes minutes to spin up new workers
4. **Manual Capacity Planning**: Need to anticipate load and provision resources

---

## When to Choose Implementation 1

- Expected consistent, high volume (1000+ documents/day)
- Team has DevOps/Kubernetes expertise
- Need full control over infrastructure and performance tuning
- Cost optimization at scale is priority
- Long-running processing tasks (>15 minutes)
- Hybrid/multi-cloud or on-premises deployment

---

## Next Steps

1. Review detailed tech stack: `TECH-STACK.md`
2. Review database schema: `DATABASE-SCHEMA.md`
3. Review API specification: `API-SPECIFICATION.md`
4. Review testing strategy: `TESTING-STRATEGY.md`
5. Review deployment guide: `DEPLOYMENT.md`
6. Review sample code: `code-samples/` directory

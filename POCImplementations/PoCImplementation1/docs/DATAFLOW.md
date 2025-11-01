# Data Flow Document - PoC Implementation 1

## Overview

This document describes the end-to-end data flow through the microservices architecture, from document upload to timetable display.

---

## End-to-End Processing Flow

### Scenario 1: High Confidence OCR Path (70% of documents)

```
┌─────────┐
│  User   │  Uploads timetable.png
└────┬────┘
     │ 1. HTTP POST /api/v1/documents/upload
     ▼
┌─────────────────┐
│  React PWA      │
│  - File Upload  │
└────┬────────────┘
     │ 2. HTTPS
     ▼
┌─────────────────┐
│  NGINX          │
│  Load Balancer  │
└────┬────────────┘
     │ 3. Proxy to API server
     ▼
┌─────────────────────────────────────┐
│  Node.js API Server                  │
│                                      │
│  4. Validate file                    │
│     - Check type: .png, .jpeg, .pdf  │
│     - Check size: <50MB             │
│                                      │
│  5. Generate document ID             │
│     documentId = uuid.v4()           │
│                                      │
│  6. Upload to S3                     │
│     key: uploads/{userId}/{docId}    │
│                                      │
│  7. Create DB record                 │
│     INSERT INTO documents            │
│     status = 'uploaded'              │
│                                      │
│  8. Enqueue classification job       │
│     BullMQ.add('classification', {   │
│       documentId, userId, s3Key      │
│     })                               │
│                                      │
│  9. Return jobId to client           │
│     { jobId, documentId, status }    │
└────┬────────────────────────────────┘
     │ 10. Response to client
     ▼
┌─────────────────┐
│  React PWA      │  Shows "Processing..." status
│  WebSocket      │  Subscribes to job updates
└─────────────────┘

     Meanwhile...

┌────────────────────────────────────────────┐
│  BullMQ Classification Queue               │
│  Priority: 10 | Concurrency: 5             │
└────┬───────────────────────────────────────┘
     │ 11. Job dequeued by worker
     ▼
┌──────────────────────────────────────────┐
│  Python Classification Worker             │
│                                           │
│  12. Download document from S3            │
│      boto3.download_file(s3Key)           │
│                                           │
│  13. Run ML classification                │
│      model.predict(image)                 │
│      → type: 'image', confidence: 0.95    │
│                                           │
│  14. Update job status                    │
│      UPDATE documents                     │
│      SET status = 'classified'            │
│                                           │
│  15. Emit WebSocket event                 │
│      socket.emit('job:status', {          │
│        jobId, stage: 'classified'         │
│      })                                   │
│                                           │
│  16. Enqueue preprocessing job            │
│      BullMQ.add('preprocessing', {...})   │
└────┬──────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────┐
│  BullMQ Preprocessing Queue                │
│  Priority: 8 | Concurrency: 10             │
└────┬───────────────────────────────────────┘
     │ 17. Job dequeued
     ▼
┌──────────────────────────────────────────┐
│  Python Preprocessing Worker              │
│                                           │
│  18. Download original from S3            │
│                                           │
│  19. Image enhancement                    │
│      - Grayscale conversion               │
│      - Noise reduction (Gaussian blur)    │
│      - Adaptive thresholding              │
│      - Deskew (rotation correction)       │
│      - CLAHE (contrast enhancement)       │
│                                           │
│  20. Upload preprocessed to S3            │
│      key: preprocessed/{docId}.png        │
│                                           │
│  21. Update status: 'preprocessed'        │
│                                           │
│  22. Enqueue OCR job                      │
│      BullMQ.add('ocr', {                  │
│        documentId,                        │
│        s3Key: preprocessedKey             │
│      })                                   │
└────┬──────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────┐
│  BullMQ OCR Queue                          │
│  Priority: 7 | Concurrency: 20             │
└────┬───────────────────────────────────────┘
     │ 23. Job dequeued
     ▼
┌──────────────────────────────────────────┐
│  Python OCR Worker                        │
│                                           │
│  24. Check Redis cache                    │
│      key = f"ocr:{hash(image)}"           │
│      if cached: return cached_result      │
│                                           │
│  25. Download preprocessed from S3        │
│                                           │
│  26. Run Tesseract OCR                    │
│      result = pytesseract.image_to_data(  │
│        image, output_type=Output.DICT     │
│      )                                    │
│                                           │
│  27. Calculate confidence score           │
│      confidence = calculate_confidence(   │
│        mean_char_confidence=0.95,         │
│        word_dict_match=0.98,              │
│        layout_consistency=1.0,            │
│        time_pattern_match=1.0             │
│      )                                    │
│      → confidence = 99.2%                 │
│                                           │
│  28. Quality Gate Decision                │
│      if confidence >= 98%:                │
│        route = 'validation'  ✓            │
│      elif confidence >= 80%:              │
│        route = 'llm'                      │
│      else:                                │
│        route = 'hitl'                     │
│                                           │
│  29. Cache result in Redis                │
│      redis.setex(key, 2592000, result)    │
│      # TTL: 30 days                       │
│                                           │
│  30. Update status: 'ocr_completed'       │
│                                           │
│  31. Enqueue validation job               │
│      BullMQ.add('validation', {           │
│        documentId,                        │
│        ocrResult: {...},                  │
│        confidence: 0.992                  │
│      })                                   │
└────┬──────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────┐
│  BullMQ Validation Queue                   │
│  Priority: 6 | Concurrency: 15             │
└────┬───────────────────────────────────────┘
     │ 32. Job dequeued
     ▼
┌──────────────────────────────────────────┐
│  Node.js Validation Worker                │
│                                           │
│  33. Parse OCR output                     │
│      Extract timeblock data from text     │
│                                           │
│  34. Validate structure (Zod schema)      │
│      const schema = z.object({            │
│        teacher: z.string(),               │
│        className: z.string(),             │
│        timeblocks: z.array(...)           │
│      })                                   │
│                                           │
│  35. Normalize data                       │
│      - Convert "9:00 AM" → "09:00"        │
│      - "Mon" → "Monday"                   │
│      - Calculate duration                 │
│                                           │
│  36. Quality checks                       │
│      - No time overlaps                   │
│      - Start < End time                   │
│      - Valid day names                    │
│                                           │
│  37. Save to PostgreSQL                   │
│      BEGIN TRANSACTION;                   │
│                                           │
│      INSERT INTO timetables (...)         │
│      RETURNING id;                        │
│                                           │
│      INSERT INTO timeblocks (...)         │
│      VALUES                               │
│        ('Monday', 'Maths', '09:00', ...), │
│        ('Monday', 'English', '10:00', ...),│
│        ...                                │
│                                           │
│      UPDATE documents                     │
│      SET status = 'completed',            │
│          timetable_id = <new_id>          │
│                                           │
│      COMMIT;                              │
│                                           │
│  38. Enqueue notification                 │
│      BullMQ.add('notification', {...})    │
└────┬──────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────┐
│  BullMQ Notification Queue                 │
│  Priority: 3 | Concurrency: 10             │
└────┬───────────────────────────────────────┘
     │ 39. Job dequeued
     ▼
┌──────────────────────────────────────────┐
│  Node.js Notification Worker              │
│                                           │
│  40. Send WebSocket event                 │
│      socket.to(userId).emit(              │
│        'job:completed',                   │
│        {                                  │
│          jobId,                           │
│          timetableId,                     │
│          status: 'completed'              │
│        }                                  │
│      )                                    │
│                                           │
│  41. Send email (optional)                │
│      sendEmail({                          │
│        to: user.email,                    │
│        subject: "Timetable ready!",       │
│        body: "Your timetable has been..." │
│      })                                   │
└────┬──────────────────────────────────────┘
     │
     ▼
┌─────────────────┐
│  React PWA      │
│                 │
│  42. Receives WebSocket event             │
│      → Fetch timetable data               │
│                                           │
│  43. GET /api/v1/timetables/{id}          │
│      ← Returns timetable + timeblocks     │
│                                           │
│  44. Render timetable grid                │
│      <TimetableGrid data={timetable} />   │
└─────────────────┘

Total Time: 6-8 seconds ✓
```

---

## Scenario 2: Medium Confidence → LLM Path (20% of documents)

```
Steps 1-26: Same as above

27. Calculate confidence score
    → confidence = 85% (below 98% threshold)

28. Quality Gate Decision
    if confidence >= 80% AND confidence < 98%:
      route = 'llm'  ✓

29. Enqueue LLM job
    BullMQ.add('llm', {
      documentId,
      s3Key: originalImageKey
    })

┌────────────────────────────────────────────┐
│  BullMQ LLM Queue                          │
│  Priority: 5 | Concurrency: 5              │
└────┬───────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────┐
│  Python LLM Worker                        │
│                                           │
│  30. Download original image from S3      │
│                                           │
│  31. Encode image as base64               │
│                                           │
│  32. Call Anthropic Claude API            │
│      response = client.messages.create(   │
│        model="claude-3-5-sonnet-20241022",│
│        max_tokens=4096,                   │
│        temperature=0,                     │
│        messages=[{                        │
│          "role": "user",                  │
│          "content": [                     │
│            {"type": "image", ...},        │
│            {"type": "text", ...}          │
│          ]                                │
│        }]                                 │
│      )                                    │
│                                           │
│  33. Parse JSON response                  │
│      timetable_data = json.loads(         │
│        response.content[0].text           │
│      )                                    │
│                                           │
│  34. Update status: 'llm_completed'       │
│                                           │
│  35. Enqueue validation                   │
│      BullMQ.add('validation', {           │
│        documentId,                        │
│        llmResult: timetable_data          │
│      })                                   │
└────┬──────────────────────────────────────┘
     │
     ▼
(Continue with validation steps 33-44 from Scenario 1)

Total Time: 15-20 seconds
```

---

## Scenario 3: Low Confidence → HITL Path (10% of documents)

```
Steps 1-26: Same as above

27. Calculate confidence score
    → confidence = 65% (below 80% threshold)

28. Quality Gate Decision
    if confidence < 80%:
      route = 'hitl'  ✓

29. Enqueue HITL job
    BullMQ.add('hitl', {
      documentId,
      ocrDraft: ocrResult  # Save OCR as starting point
    })

┌────────────────────────────────────────────┐
│  BullMQ HITL Queue                         │
│  Priority: 1 | Concurrency: 1              │
└────┬───────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────┐
│  HITL Service                             │
│                                           │
│  30. Create HITL task                     │
│      INSERT INTO hitl_tasks (             │
│        document_id,                       │
│        status: 'pending',                 │
│        draft_data: ocrResult,             │
│        assigned_to: null                  │
│      )                                    │
│                                           │
│  31. Send notification to admin           │
│      - Email to admin team                │
│      - Dashboard notification             │
│      - WebSocket to admin UI              │
│                                           │
│  32. Update document status               │
│      status = 'hitl_pending'              │
└──────────────────────────────────────────┘

     User/Admin manually reviews...

┌──────────────────────────────────────────┐
│  Admin Dashboard (React)                  │
│                                           │
│  33. Admin opens HITL task                │
│                                           │
│  34. Side-by-side view                    │
│      - Original document (left)           │
│      - OCR draft (right, editable)        │
│                                           │
│  35. Admin corrects errors                │
│      - Fix misread times                  │
│      - Correct event names                │
│      - Add missing blocks                 │
│                                           │
│  36. Submit corrections                   │
│      PUT /api/v1/hitl-tasks/{id}/complete │
│      body: { timetableData: {...} }       │
└────┬──────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────┐
│  Node.js API                              │
│                                           │
│  37. Validate admin input                 │
│                                           │
│  38. Update HITL task                     │
│      UPDATE hitl_tasks                    │
│      SET status = 'completed',            │
│          completed_at = NOW(),            │
│          completed_by = admin_id          │
│                                           │
│  39. Save timetable to DB                 │
│      (Same as validation step 37)         │
│                                           │
│  40. Send notification to user            │
│      "Your timetable has been reviewed!"  │
└──────────────────────────────────────────┘

Total Time: Variable (minutes to hours)
```

---

## Database Schema

### Core Tables

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'teacher',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- Documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),  -- 'image', 'pdf', 'docx'
    file_size INTEGER,      -- bytes
    s3_key VARCHAR(500),
    status VARCHAR(50) DEFAULT 'uploaded',
      -- 'uploaded', 'classified', 'preprocessed', 'ocr_completed',
      -- 'llm_completed', 'completed', 'failed', 'hitl_pending'
    error_message TEXT,
    timetable_id UUID REFERENCES timetables(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);

-- Timetables table
CREATE TABLE timetables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    teacher_name VARCHAR(255),
    class_name VARCHAR(255),
    term VARCHAR(100),
    year INTEGER,
    status VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'active', 'archived'
    source VARCHAR(50),  -- 'ocr', 'llm', 'hitl', 'manual'
    confidence DECIMAL(5,2),  -- 0.00 - 100.00
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_timetables_user_id ON timetables(user_id);
CREATE INDEX idx_timetables_year_term ON timetables(year, term);

-- Timeblocks table
CREATE TABLE timeblocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timetable_id UUID REFERENCES timetables(id) ON DELETE CASCADE,
    day VARCHAR(20) NOT NULL,  -- 'Monday', 'Tuesday', etc.
    name VARCHAR(255) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration INTEGER,  -- minutes
    notes TEXT,
    color VARCHAR(7),  -- Hex color code
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_timeblocks_timetable_id ON timeblocks(timetable_id);
CREATE INDEX idx_timeblocks_day ON timeblocks(day);

-- HITL tasks table
CREATE TABLE hitl_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'in_progress', 'completed'
    assigned_to UUID REFERENCES users(id),
    draft_data JSONB,  -- OCR result as starting point
    final_data JSONB,  -- Admin's corrections
    confidence DECIMAL(5,2),
    reason TEXT,  -- Why it went to HITL
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    completed_by UUID REFERENCES users(id)
);

CREATE INDEX idx_hitl_tasks_status ON hitl_tasks(status);
CREATE INDEX idx_hitl_tasks_assigned_to ON hitl_tasks(assigned_to);

-- Processing jobs table (for tracking)
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    job_type VARCHAR(50),  -- 'classification', 'ocr', 'llm', etc.
    status VARCHAR(50),    -- 'pending', 'processing', 'completed', 'failed'
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_processing_jobs_document_id ON processing_jobs(document_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
```

---

## Redis Cache Strategy

### Cache Keys

```
ocr:result:{document_hash}        # OCR results (TTL: 30 days)
llm:result:{document_hash}        # LLM results (TTL: 90 days)
user:session:{user_id}            # User sessions (TTL: 7 days)
ratelimit:{user_id}:{endpoint}    # Rate limiting counters (TTL: 1 minute)
websocket:connections:{user_id}   # WebSocket connection IDs (TTL: 24 hours)
```

### Cache Hit Rate Target

- **OCR Cache**: >80% (many duplicate/similar timetables)
- **Session Cache**: >95%
- **Overall**: >85%

---

## Message Flow

### BullMQ Job Structure

```typescript
{
  id: 'job-uuid',
  name: 'process-document',
  data: {
    documentId: 'doc-uuid',
    userId: 'user-uuid',
    s3Key: 'uploads/user-uuid/doc.png',
    metadata: {
      filename: 'timetable.png',
      fileSize: 1024000,
      fileType: 'image/png'
    }
  },
  opts: {
    priority: 10,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    timeout: 30000,
    removeOnComplete: 100,  // Keep last 100 completed
    removeOnFail: false     // Keep all failed for debugging
  }
}
```

---

## Performance Metrics

| Stage | Target Time | Cache Impact |
|-------|-------------|--------------|
| Upload to S3 | <2s | N/A |
| Classification | <1s | N/A |
| Preprocessing | <500ms | N/A |
| OCR (Tesseract) | <3s | Cache hit: <10ms |
| OCR (Google Vision) | <2s | Cache hit: <10ms |
| LLM (Claude) | <10s | Cache hit: <10ms |
| Validation | <200ms | N/A |
| DB Write | <100ms | N/A |
| Notification | <50ms | N/A |

**Total (OCR path)**: 6-8 seconds
**Total (LLM path)**: 15-20 seconds
**Total (HITL path)**: Minutes to hours (human-dependent)

---

## Next Steps

1. Review [TECHSTACK_JUSTIFICATION.md](TECHSTACK_JUSTIFICATION.md) for technology choices
2. Review [RETURNONINVESTMENT.md](RETURNONINVESTMENT.md) for cost analysis
3. Explore code implementation in `/backend`

---

**Version**: 1.0.0
**Last Updated**: 2025-01-01

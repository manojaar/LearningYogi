# 🚀 Async Architecture Redesign Plan
## Real-Time Timetable Extraction System

**Date:** 2025-11-01
**Status:** Planning Phase
**Goal:** Transform blocking sync API → Real-time async streaming architecture

---

## 📊 CURRENT PROBLEMS IDENTIFIED

### Performance Issues
- ⏱️ **AI extraction: 92 seconds** (unacceptable wait time)
- 📡 **Polling every 2 seconds** (inefficient, wastes resources)
- 🖼️ **Large uncompressed images** transferred between services
- 🔄 **Synchronous blocking** - user sees nothing during processing
- ❌ **No progress feedback** - user doesn't know what's happening

### User Experience Issues
- 😐 **No visual feedback** during 92-second wait
- 🔁 **Manual refresh** or polling to check status
- ❓ **No indication** of which step is running
- 🚫 **No way to cancel** long-running operations

---

## 🎯 NEW ARCHITECTURE GOALS

### Performance Targets
- ⚡ **Instant feedback** - User sees processing start immediately
- 📊 **Real-time progress** - Live updates every step
- 🗜️ **50-70% smaller images** via compression
- 🔄 **Non-blocking async** - No waiting
- ⏱️ **<5s perceived wait** through progressive updates

### User Experience Goals
- ✨ **Immediate acknowledgment** - "Processing started"
- 📈 **Progress bar** with step-by-step updates
- 📢 **Notifications** - "Document ready!" when done
- 🔗 **Quick navigation** - Click to view results
- ⏸️ **Cancel option** - Stop long operations

---

## 🏗️ NEW ARCHITECTURE DESIGN

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Upload UI  │  │  SSE Client  │  │ Notification │     │
│  │              │  │              │  │   Center     │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │             │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          │ POST /upload     │ SSE /events/:id  │
          ▼                  ▼                  │
┌─────────────────────────────────────────────────────────────┐
│                      NODE.JS API                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Express    │  │ SSE Manager  │  │ Job Queue    │     │
│  │   Routes     │  │              │  │  (Bull)      │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │             │
│         │  1. Save file    │  3. Send events  │ 2. Queue   │
│         └──────────────────┴──────────────────┘             │
└─────────────────────────────────────────────────────────────┘
          │                                      │
          │ Image Compression                    │ Background
          │ (Sharp library)                      │ Processing
          ▼                                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   PYTHON AI SERVICE                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Async Queue │  │   Streaming  │  │   Claude AI  │     │
│  │   (Celery)   │  │   Response   │  │   (Async)    │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │             │
│         └──────────────────┴──────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 DETAILED IMPLEMENTATION PLAN

### PHASE 1: Backend Infrastructure (Week 1)

#### 1.1 Job Queue System (Node.js)
**Technology:** Bull (Redis-based queue)

**Implementation:**
```typescript
// New file: backend/nodejs/src/queues/documentQueue.ts

import Bull from 'bull';
import { processDocumentJob } from '../jobs/documentProcessor';

export const documentQueue = new Bull('document-processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

// Job processor
documentQueue.process(async (job) => {
  const { documentId, filePath } = job.data;

  // Emit progress updates via SSE
  await processDocumentJob(documentId, filePath, (progress) => {
    job.progress(progress.percentage);
    emitSSE(documentId, progress);
  });
});
```

**Why Bull?**
- ✅ Built on Redis (fast, reliable)
- ✅ Automatic retry on failure
- ✅ Progress tracking built-in
- ✅ Job prioritization
- ✅ Rate limiting support

#### 1.2 Server-Sent Events (SSE)
**Technology:** Express + SSE

**Implementation:**
```typescript
// New file: backend/nodejs/src/routes/events.ts

import { Router } from 'express';
import { sseManager } from '../services/sseManager';

const router = Router();

// SSE endpoint
router.get('/events/:documentId', (req, res) => {
  const { documentId } = req.params;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Register client
  sseManager.addClient(documentId, res);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // Cleanup on disconnect
  req.on('close', () => {
    sseManager.removeClient(documentId, res);
  });
});

export default router;
```

**SSE Manager:**
```typescript
// New file: backend/nodejs/src/services/sseManager.ts

class SSEManager {
  private clients = new Map<string, Set<Response>>();

  addClient(documentId: string, res: Response) {
    if (!this.clients.has(documentId)) {
      this.clients.set(documentId, new Set());
    }
    this.clients.get(documentId)!.add(res);
  }

  removeClient(documentId: string, res: Response) {
    this.clients.get(documentId)?.delete(res);
  }

  emit(documentId: string, event: ProcessingEvent) {
    const clients = this.clients.get(documentId);
    if (!clients) return;

    const data = JSON.stringify(event);
    clients.forEach(client => {
      client.write(`data: ${data}\n\n`);
    });
  }
}
```

#### 1.3 Image Compression
**Technology:** Sharp (Node.js image processing)

**Implementation:**
```typescript
// New file: backend/nodejs/src/services/imageCompressor.ts

import sharp from 'sharp';
import path from 'path';

export class ImageCompressor {
  async compress(inputPath: string): Promise<{
    path: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  }> {
    const outputPath = inputPath.replace(
      path.extname(inputPath),
      '.compressed.webp'
    );

    const originalStats = await fs.stat(inputPath);

    await sharp(inputPath)
      .resize(2048, 2048, { // Max dimensions
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 85 }) // Good balance
      .toFile(outputPath);

    const compressedStats = await fs.stat(outputPath);

    return {
      path: outputPath,
      originalSize: originalStats.size,
      compressedSize: compressedStats.size,
      compressionRatio: (1 - compressedStats.size / originalStats.size) * 100
    };
  }
}
```

**Compression Strategy:**
- Convert to WebP (50-70% smaller than PNG/JPEG)
- Resize to max 2048x2048 (maintains quality for OCR/AI)
- Quality: 85 (sweet spot for size vs quality)

---

### PHASE 2: Python Async Processing (Week 1)

#### 2.1 Async FastAPI Endpoints
**Technology:** FastAPI with async/await

**Implementation:**
```python
# Modify: backend/python/app/api/ai.py

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import StreamingResponse
import asyncio

router = APIRouter()

@router.post("/ai/extract-async")
async def extract_timetable_async(
    request: AIExtractRequest,
    background_tasks: BackgroundTasks
):
    """Start async AI extraction, return job ID immediately"""
    job_id = str(uuid.uuid4())

    # Start processing in background
    background_tasks.add_task(
        process_document_async,
        job_id,
        request.image_path
    )

    return {"job_id": job_id, "status": "processing"}

@router.get("/ai/extract-stream/{job_id}")
async def stream_extraction(job_id: str):
    """Stream processing updates via SSE"""

    async def event_generator():
        # Simulate chunked processing
        steps = [
            "Loading image",
            "Preprocessing",
            "Running OCR",
            "Analyzing structure",
            "Extracting with Claude AI",
            "Validating results"
        ]

        for i, step in enumerate(steps):
            yield f"data: {json.dumps({
                'step': step,
                'progress': (i + 1) / len(steps) * 100
            })}\n\n"

            await asyncio.sleep(0.1)  # Simulate work

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )
```

#### 2.2 Chunked Claude AI Processing
**Technology:** Anthropic async client

**Implementation:**
```python
# Modify: backend/python/app/services/claude_service.py

from anthropic import AsyncAnthropic

class AsyncClaudeService:
    def __init__(self):
        self.client = AsyncAnthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY")
        )
        self.model = "claude-3-opus-20240229"

    async def extract_with_streaming(
        self,
        image_path: str,
        progress_callback: callable
    ):
        """Extract timetable with progress updates"""

        # Step 1: Load and encode image
        await progress_callback("Loading image", 10)
        image_data = await self._load_image_async(image_path)

        # Step 2: Prepare request
        await progress_callback("Preparing AI request", 20)

        # Step 3: Call Claude AI (with timeout tracking)
        await progress_callback("Analyzing with Claude AI", 30)

        # Use async streaming API
        async with self.client.messages.stream(
            model=self.model,
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": [{
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/webp",
                        "data": image_data
                    }
                }]
            }]
        ) as stream:
            chunks = []
            async for text in stream.text_stream:
                chunks.append(text)
                # Update progress based on response size
                progress = min(90, 30 + len(''.join(chunks)) / 100)
                await progress_callback("Receiving AI response", progress)

        # Step 4: Parse and validate
        await progress_callback("Validating results", 95)
        result = self._parse_response(''.join(chunks))

        await progress_callback("Complete", 100)
        return result
```

---

### PHASE 3: Frontend Real-Time UI (Week 2)

#### 3.1 SSE Client Hook
**Technology:** React Hook for SSE

**Implementation:**
```typescript
// New file: frontend/src/hooks/useSSE.ts

import { useEffect, useState } from 'react';

interface ProcessingEvent {
  type: 'progress' | 'complete' | 'error';
  step?: string;
  percentage?: number;
  result?: any;
  error?: string;
}

export function useSSE(documentId: string | null) {
  const [event, setEvent] = useState<ProcessingEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!documentId) return;

    const eventSource = new EventSource(
      `/api/v1/events/${documentId}`
    );

    eventSource.onopen = () => setIsConnected(true);

    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setEvent(data);
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
    };

    return () => eventSource.close();
  }, [documentId]);

  return { event, isConnected };
}
```

#### 3.2 Progress Notification Component
**New Component:** `ProcessingNotification.tsx`

**Implementation:**
```typescript
// New file: frontend/src/components/ProcessingNotification.tsx

import React from 'react';
import { useSSE } from '../hooks/useSSE';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  documentId: string;
  onComplete: (result: any) => void;
}

export function ProcessingNotification({ documentId, onComplete }: Props) {
  const { event, isConnected } = useSSE(documentId);
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (event?.type === 'complete') {
      setTimeout(() => {
        onComplete(event.result);
        setShow(false);
      }, 2000);
    }
  }, [event]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 right-4 bg-white shadow-xl rounded-lg p-6 max-w-md"
        >
          {/* Connection Status */}
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Processing...' : 'Reconnecting...'}
            </span>
          </div>

          {/* Progress Bar */}
          {event?.type === 'progress' && (
            <>
              <div className="mb-2">
                <p className="text-sm font-medium text-gray-900">
                  {event.step || 'Processing'}
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <motion.div
                  className="bg-blue-600 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${event.percentage || 0}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {Math.round(event.percentage || 0)}% complete
              </p>
            </>
          )}

          {/* Success State */}
          {event?.type === 'complete' && (
            <div className="text-center">
              <div className="text-green-500 text-4xl mb-2">✓</div>
              <p className="text-lg font-semibold mb-2">
                Processing Complete!
              </p>
              <button
                onClick={() => onComplete(event.result)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                📅 View Timetable →
              </button>
            </div>
          )}

          {/* Error State */}
          {event?.type === 'error' && (
            <div className="text-center">
              <div className="text-red-500 text-4xl mb-2">✗</div>
              <p className="text-lg font-semibold mb-2">
                Processing Failed
              </p>
              <p className="text-sm text-gray-600">
                {event.error}
              </p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

#### 3.3 Updated Upload Flow
**Modified:** `HomePage.tsx`

```typescript
// Modified: frontend/src/pages/HomePage.tsx

const [documentId, setDocumentId] = useState<string | null>(null);
const [showNotification, setShowNotification] = useState(false);

const handleFileSelect = async (file: File) => {
  try {
    setIsUploading(true);

    // Upload file (immediate response)
    const response = await api.uploadDocument(file);
    setDocumentId(response.documentId);

    // Show notification (stays on current page)
    setShowNotification(true);

  } catch (error) {
    console.error('Upload failed:', error);
  } finally {
    setIsUploading(false);
  }
};

const handleProcessingComplete = (result: any) => {
  // Navigate to results
  navigate(`/results/${documentId}`);
};

return (
  <div>
    <UploadZone onFileSelect={handleFileSelect} />

    {showNotification && documentId && (
      <ProcessingNotification
        documentId={documentId}
        onComplete={handleProcessingComplete}
      />
    )}
  </div>
);
```

---

### PHASE 4: Database Schema Updates (Week 2)

#### 4.1 New Tables

**PROCESSING_EVENTS** (audit trail for SSE)
```sql
CREATE TABLE processing_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  event_type TEXT NOT NULL, -- 'progress', 'complete', 'error'
  step_name TEXT,
  percentage INTEGER,
  message TEXT,
  data JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE INDEX idx_processing_events_document ON processing_events(document_id);
CREATE INDEX idx_processing_events_created ON processing_events(created_at);
```

**JOB_QUEUE** (track async jobs)
```sql
CREATE TABLE job_queue (
  id TEXT PRIMARY KEY, -- UUID
  document_id INTEGER NOT NULL,
  job_type TEXT NOT NULL, -- 'extraction', 'ocr', 'preprocessing'
  status TEXT NOT NULL, -- 'queued', 'processing', 'completed', 'failed'
  priority INTEGER DEFAULT 0,
  progress INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  started_at DATETIME,
  completed_at DATETIME,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE INDEX idx_job_queue_status ON job_queue(status);
CREATE INDEX idx_job_queue_document ON job_queue(document_id);
```

---

### PHASE 5: Docker & Infrastructure (Week 3)

#### 5.1 Add Redis to docker-compose.yml

```yaml
# Add to docker-compose.yml

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  redis_data:
```

#### 5.2 Updated Environment Variables

```bash
# Add to .env

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# Job Queue Configuration
QUEUE_CONCURRENCY=2
QUEUE_MAX_RETRIES=3
QUEUE_TIMEOUT=300000

# Image Compression
MAX_IMAGE_DIMENSION=2048
IMAGE_QUALITY=85
OUTPUT_FORMAT=webp
```

---

## 📦 TECHNOLOGY STACK

### New Dependencies

**Node.js (backend/nodejs/package.json):**
```json
{
  "dependencies": {
    "bull": "^4.11.5",
    "ioredis": "^5.3.2",
    "sharp": "^0.32.6",
    "eventsource-parser": "^1.1.0"
  }
}
```

**Python (backend/python/requirements.txt):**
```
anthropic[async]>=0.18.0
celery>=5.3.0
redis>=5.0.0
Pillow>=10.1.0
```

**Frontend (frontend/package.json):**
```json
{
  "dependencies": {
    "framer-motion": "^10.16.4",
    "eventsource": "^2.0.2"
  }
}
```

---

## ⏱️ IMPLEMENTATION TIMELINE

### Week 1: Backend Infrastructure
- **Day 1-2:** Set up Bull queue + Redis
- **Day 3-4:** Implement SSE endpoints
- **Day 5:** Add image compression (Sharp)

### Week 2: Async Processing + Frontend
- **Day 1-2:** Convert Python endpoints to async
- **Day 3-4:** Build SSE client hook + notification UI
- **Day 5:** Update upload flow

### Week 3: Polish & Testing
- **Day 1-2:** Database migrations
- **Day 3:** Integration testing
- **Day 4:** Performance testing
- **Day 5:** Deploy & monitor

---

## 🎯 SUCCESS METRICS

### Performance Improvements
- ⚡ **Immediate response:** <200ms for upload
- 📊 **First update:** <500ms after upload
- 🗜️ **Image size:** 50-70% reduction
- 🔄 **No polling:** Event-driven only

### User Experience Improvements
- ✅ **Instant feedback:** User sees "Processing..." immediately
- 📈 **Progress visibility:** Real-time step updates
- 🔔 **Notifications:** "Document ready!" with link
- 📱 **Mobile friendly:** Works on all devices

---

## 🔒 SECURITY CONSIDERATIONS

### Rate Limiting
```typescript
// Apply to upload endpoint
import rateLimit from 'express-rate-limit';

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 uploads per window
  message: 'Too many uploads, please try again later'
});

router.post('/upload', uploadLimiter, uploadHandler);
```

### SSE Authentication
```typescript
// Verify ownership before SSE connection
router.get('/events/:documentId', authenticate, (req, res) => {
  // Check user owns document
  const document = await Document.findById(documentId);
  if (document.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // ... proceed with SSE
});
```

---

## 🧪 TESTING STRATEGY

### Unit Tests
- SSE manager functionality
- Image compression utility
- Job queue processing

### Integration Tests
- End-to-end upload → SSE → completion flow
- Redis connection handling
- Error recovery and retry logic

### Performance Tests
- Concurrent uploads (100 simultaneous)
- Large file handling (50MB PDFs)
- SSE connection stress test (1000 concurrent)

---

## 📚 MIGRATION STRATEGY

### Phase 1: Dual Mode (2 weeks)
- Keep old polling API active
- Run new SSE API in parallel
- Feature flag to toggle between modes

### Phase 2: Gradual Rollout (1 week)
- 10% traffic to new API
- Monitor errors and performance
- Increase to 50%, then 100%

### Phase 3: Deprecation (1 week)
- Remove old polling endpoints
- Clean up deprecated code
- Update documentation

---

## 🔧 ROLLBACK PLAN

If issues occur:
1. **Disable SSE via feature flag** → Revert to polling
2. **Database:** Keep old tables, migrations are additive
3. **Redis:** Optional dependency, app works without it
4. **Image compression:** Fall back to original images

---

## 📖 DOCUMENTATION UPDATES

### Developer Docs
- SSE integration guide
- Job queue usage examples
- Image compression best practices

### User Docs
- What to expect during processing
- Notification center guide
- Troubleshooting SSE connection issues

---

## 💰 COST ANALYSIS

### Infrastructure Costs
- **Redis:** $10-20/month (managed service)
- **Storage:** +30% due to compressed + original images
- **Bandwidth:** -50% due to compression

### API Costs
- **Claude AI:** Same (no change)
- **Server CPU:** -20% (async reduces blocking)

### Net Impact: **Cost neutral** or slight savings

---

## ✅ DELIVERABLES

1. ✅ Bull-based job queue system
2. ✅ SSE real-time event streaming
3. ✅ Image compression with Sharp
4. ✅ React notification component
5. ✅ Updated database schema
6. ✅ Docker compose with Redis
7. ✅ Comprehensive tests
8. ✅ Migration scripts
9. ✅ Documentation

---

## 🚀 NEXT STEPS

1. **Review & Approve** this plan
2. **Set up development environment** (Redis)
3. **Create feature branch** `feature/async-architecture`
4. **Begin Phase 1** (Backend infrastructure)

---

**Questions to Answer:**
1. Do you want to keep polling as fallback for older browsers?
2. Should we add WebSocket support in addition to SSE?
3. What's the maximum number of concurrent processing jobs?
4. Do you want a dashboard to monitor job queue health?

---

**Prepared by:** Claude Code
**Next Review:** After Phase 1 completion
**Estimated Effort:** 3 weeks (1 developer)

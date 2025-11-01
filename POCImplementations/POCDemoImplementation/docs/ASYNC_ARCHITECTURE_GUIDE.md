# Async Architecture Guide
## Performance & UX Optimization Implementation

This guide explains how to use and test the new async architecture with real-time progress updates.

## Overview

The POCDemoImplementation has been upgraded from a blocking, polling-based system to a real-time async architecture using:

- **Bull Queue** (Redis-based) for background job processing
- **Server-Sent Events (SSE)** for real-time progress updates
- **Image Compression** using Sharp for 50-70% size reduction
- **Async Python Processing** with streaming support

## Architecture Flow

```
User Upload → Node.js API → Queue Job → Background Processing
     ↓                                        ↓
Immediate Response                     Progress Updates via SSE
     ↓                                        ↓
Stay on Page                           Real-time Notification
                                        ↓
                                   Processing Complete
                                        ↓
                                   Navigate to Results
```

## Key Features

### 1. Real-Time Progress Updates

Instead of polling every 2 seconds, the frontend now receives real-time updates via Server-Sent Events:

- **Instant connection** after upload
- **Step-by-step progress** (Compressing, Preprocessing, OCR, AI, Validation)
- **Percentage tracking** (0-100%)
- **Automatic reconnection** on disconnect

### 2. Non-Blocking User Experience

- **No immediate redirect** - Users stay on the upload page
- **Notification widget** appears with progress updates
- **Continue browsing** while document processes
- **Navigate to results** when processing completes

### 3. Image Optimization

Images are automatically compressed before processing:
- **Format conversion** to WebP (50-70% smaller)
- **Smart resizing** (max 2048x2048, maintains OCR quality)
- **Quality balance** (85% - optimal for size vs quality)

### 4. Background Job Processing

- **Immediate response** to upload (<200ms)
- **Background processing** via Bull queue
- **Automatic retries** on transient failures
- **Concurrent processing** (configurable, default 2 jobs)

## Setup

### Prerequisites

1. **Redis** - Required for job queue
2. **Node.js dependencies** - Bull, ioredis, sharp
3. **Python dependencies** - anthropic[async], redis

### Environment Variables

Add to your `.env` file:

```bash
# Redis Configuration
REDIS_HOST=localhost
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

### Start Services

```bash
# Start all services including Redis
docker-compose up -d

# Verify Redis is running
docker-compose ps redis

# Check logs
docker-compose logs -f nodejs-api
```

## Testing

### Manual Testing

1. **Start Services**
   ```bash
   docker-compose up -d
   ```

2. **Upload Document**
   - Navigate to http://localhost:3000
   - Upload a timetable image
   - Observe notification widget appears immediately

3. **Monitor Progress**
   - Watch real-time progress updates in notification
   - Check browser DevTools Network tab for SSE connection
   - Verify progress percentages update smoothly

4. **Verify Completion**
   - Notification shows "Processing Complete!"
   - Click "View Timetable" button
   - Verify timetable data is displayed

### Testing SSE Connection

Use curl to test SSE endpoint:

```bash
# Connect to SSE endpoint
curl -N http://localhost:4000/api/v1/events/{documentId}

# You should see events like:
# data: {"type":"connected","documentId":"..."}
# data: {"type":"progress","step":"Compressing image","percentage":10}
```

### Testing Queue Processing

Check queue status via Bull Dashboard (optional):

```bash
# Install Bull Dashboard
npm install -g bull-board

# Or check Redis directly
redis-cli
> KEYS bull:document-processing:*
> GET bull:document-processing:active
```

## API Endpoints

### SSE Events Endpoint

```
GET /api/v1/events/:documentId
```

**Response:** Server-Sent Events stream

**Events:**
- `connected` - Connection established
- `progress` - Processing progress update
  ```json
  {
    "type": "progress",
    "step": "Running OCR",
    "percentage": 40,
    "documentId": "..."
  }
  ```
- `complete` - Processing complete
  ```json
  {
    "type": "complete",
    "step": "Processing complete",
    "percentage": 100,
    "documentId": "...",
    "result": {
      "documentId": "...",
      "timetableId": "...",
      "validated": true
    }
  }
  ```
- `error` - Processing failed
  ```json
  {
    "type": "error",
    "error": "Error message",
    "documentId": "..."
  }
  ```

### Upload Endpoint (Updated)

```
POST /api/v1/documents/upload
```

**Response:** Immediate (no longer waits for processing)
```json
{
  "documentId": "uuid",
  "status": "uploaded"
}
```

Processing happens in background. Use SSE endpoint to track progress.

## Frontend Integration

### Using SSE Hook

```typescript
import { useSSE } from '@/hooks/useSSE';

function MyComponent() {
  const { event, isConnected, error } = useSSE(documentId);
  
  useEffect(() => {
    if (event?.type === 'complete') {
      // Navigate to results
    }
  }, [event]);
}
```

### Using Processing Notification

```typescript
import { ProcessingNotification } from '@/components/ProcessingNotification';

function HomePage() {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);

  return (
    <>
      {/* Upload form */}
      
      {showNotification && documentId && (
        <ProcessingNotification
          documentId={documentId}
          onClose={() => setShowNotification(false)}
        />
      )}
    </>
  );
}
```

## Troubleshooting

### Redis Connection Issues

**Error:** "Redis not available, queue processing disabled"

**Solution:**
1. Verify Redis container is running: `docker-compose ps redis`
2. Check Redis connection: `redis-cli ping`
3. Verify environment variables: `REDIS_HOST`, `REDIS_PORT`

### SSE Connection Fails

**Error:** SSE events not received

**Solution:**
1. Check browser console for errors
2. Verify SSE endpoint is accessible: `curl http://localhost:4000/api/v1/events/test`
3. Check CORS settings if frontend on different domain
4. Verify document ID exists in database

### Processing Not Starting

**Symptoms:** Upload succeeds but no progress updates

**Solution:**
1. Check Node.js API logs: `docker-compose logs nodejs-api`
2. Verify job was queued: Check Redis for Bull keys
3. Check queue processor is running (should start automatically)
4. Verify Python API is accessible

### Image Compression Issues

**Error:** Compression fails silently

**Solution:**
1. Verify Sharp is installed: `npm list sharp`
2. Check file permissions
3. Verify image format is supported (PNG, JPEG, WebP)
4. Check logs for specific error messages

## Performance Metrics

### Expected Improvements

- **Upload Response Time:** <200ms (from ~1s)
- **First Progress Update:** <500ms after upload
- **Image Size Reduction:** 50-70% (via compression)
- **Eliminated Polling:** 0 polling requests (from every 2s)
- **Perceived Wait Time:** <5s (through progressive updates)

### Monitoring

Monitor queue performance:

```bash
# Check queue stats
redis-cli
> LLEN bull:document-processing:waiting
> LLEN bull:document-processing:active
> LLEN bull:document-processing:completed
> LLEN bull:document-processing:failed
```

## Rollback Plan

If issues occur, the system gracefully degrades:

1. **Redis Unavailable:** Falls back to synchronous processing
2. **SSE Fails:** Frontend can fall back to polling (if implemented)
3. **Image Compression Fails:** Uses original images

## Migration Notes

### From Polling to SSE

The frontend automatically uses SSE when available. No code changes needed for existing implementations, but:

- Remove any polling logic (already done)
- Ensure SSE endpoint is accessible
- Verify notification component is used

### Database Changes

New tables are added automatically on first run:
- `processing_events` - SSE event audit trail
- `job_queue` - Job tracking table

No migration script needed - tables are created via `IF NOT EXISTS`.

## Next Steps

1. **Monitor Performance:** Track queue metrics and processing times
2. **Optimize Concurrency:** Adjust `QUEUE_CONCURRENCY` based on server capacity
3. **Add Monitoring:** Set up Bull Dashboard or custom monitoring
4. **Scale Horizontally:** Run multiple queue workers for high load

## Support

For issues or questions:
- Check logs: `docker-compose logs -f`
- Review this guide
- Check GitHub issues
- Contact development team

---

**Last Updated:** 2025-01-01  
**Version:** 1.0.0


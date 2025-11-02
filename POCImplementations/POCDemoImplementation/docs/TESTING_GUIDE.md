# Testing Guide
## Async Architecture Testing

This guide covers testing strategies for the new async architecture with SSE and job queues.

## Test Setup

### Prerequisites

1. **Test Redis Instance**
   ```bash
   # Use Docker for isolated test Redis
   docker run -d --name test-redis -p 6380:6379 redis:7-alpine
   ```

2. **Test Database**
   ```bash
   # Use in-memory SQLite for tests
   export DATABASE_URL=:memory:
   ```

3. **Test Environment Variables**
   ```bash
   export REDIS_HOST=localhost
   export REDIS_PORT=6380
   export NODE_ENV=test
   ```

## Unit Tests

### SSE Manager Tests

```typescript
describe('SSEManager', () => {
  it('should add and remove clients', () => {
    const manager = new SSEManager();
    const mockResponse = {} as Response;
    
    manager.addClient('doc-1', mockResponse);
    expect(manager.getClientCount('doc-1')).toBe(1);
    
    manager.removeClient('doc-1', mockResponse);
    expect(manager.getClientCount('doc-1')).toBe(0);
  });

  it('should emit events to all clients', () => {
    const manager = new SSEManager();
    const mockResponse1 = { write: jest.fn() } as any;
    const mockResponse2 = { write: jest.fn() } as any;
    
    manager.addClient('doc-1', mockResponse1);
    manager.addClient('doc-1', mockResponse2);
    
    manager.emit('doc-1', { type: 'progress', percentage: 50 });
    
    expect(mockResponse1.write).toHaveBeenCalled();
    expect(mockResponse2.write).toHaveBeenCalled();
  });
});
```

### Image Compressor Tests

```typescript
describe('ImageCompressor', () => {
  it('should compress image and reduce size', async () => {
    const compressor = new ImageCompressor();
    const result = await compressor.compress('/path/to/test-image.png');
    
    expect(result.compressedSize).toBeLessThan(result.originalSize);
    expect(result.compressionRatio).toBeGreaterThan(0);
    expect(result.path).toContain('.compressed.webp');
  });

  it('should detect compressible file types', () => {
    expect(ImageCompressor.isCompressible('image/png')).toBe(true);
    expect(ImageCompressor.isCompressible('image/jpeg')).toBe(true);
    expect(ImageCompressor.isCompressible('application/pdf')).toBe(false);
  });
});
```

## Integration Tests

### End-to-End Upload Flow

```typescript
describe('E2E: Upload → SSE → Completion', () => {
  it('should process document and emit SSE events', async () => {
    // 1. Upload document
    const uploadResponse = await request(app)
      .post('/api/v1/documents/upload')
      .attach('file', 'test-image.png');
    
    const { documentId } = uploadResponse.body;
    expect(documentId).toBeDefined();

    // 2. Connect to SSE
    const events: any[] = [];
    const sseRequest = request(app)
      .get(`/api/v1/events/${documentId}`)
      .expect(200)
      .on('data', (chunk: Buffer) => {
        const data = chunk.toString();
        if (data.startsWith('data: ')) {
          const event = JSON.parse(data.replace('data: ', ''));
          events.push(event);
        }
      });

    // 3. Wait for processing to complete
    await waitForEvent(events, 'complete', 30000);

    // 4. Verify final state
    const finalEvent = events.find(e => e.type === 'complete');
    expect(finalEvent).toBeDefined();
    expect(finalEvent.percentage).toBe(100);

    // 5. Verify document status
    const docResponse = await request(app)
      .get(`/api/v1/documents/${documentId}`)
      .expect(200);
    
    expect(docResponse.body.status).toBe('completed');
  });
});
```

### SSE Connection Tests

```typescript
describe('SSE Connection', () => {
  it('should establish connection and send heartbeat', async () => {
    const heartbeats: string[] = [];
    
    request(app)
      .get('/api/v1/events/test-doc')
      .expect(200)
      .on('data', (chunk: Buffer) => {
        const data = chunk.toString();
        if (data.startsWith(': heartbeat')) {
          heartbeats.push(data);
        }
      });

    await new Promise(resolve => setTimeout(resolve, 35000));
    
    // Should receive at least one heartbeat in 35 seconds
    expect(heartbeats.length).toBeGreaterThan(0);
  });

  it('should handle multiple concurrent connections', async () => {
    const connections = 5;
    const established: number[] = [];

    for (let i = 0; i < connections; i++) {
      request(app)
        .get('/api/v1/events/test-doc')
        .expect(200)
        .on('data', (chunk: Buffer) => {
          const data = chunk.toString();
          if (data.includes('connected')) {
            established.push(i);
          }
        });
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    
    expect(established.length).toBe(connections);
  });
});
```

## Performance Tests

### Concurrent Uploads

```typescript
describe('Performance: Concurrent Uploads', () => {
  it('should handle 100 concurrent uploads', async () => {
    const uploads = Array.from({ length: 100 }, (_, i) =>
      request(app)
        .post('/api/v1/documents/upload')
        .attach('file', `test-image-${i}.png`)
    );

    const results = await Promise.all(uploads);
    
    expect(results.every(r => r.status === 200)).toBe(true);
    expect(results.length).toBe(100);
  }, 60000); // 60 second timeout
});
```

### SSE Connection Stress Test

```typescript
describe('Performance: SSE Stress Test', () => {
  it('should handle 1000 concurrent SSE connections', async () => {
    const connections = 1000;
    const connected: number[] = [];

    for (let i = 0; i < connections; i++) {
      request(app)
        .get(`/api/v1/events/doc-${i}`)
        .expect(200)
        .on('data', (chunk: Buffer) => {
          const data = chunk.toString();
          if (data.includes('connected')) {
            connected.push(i);
          }
        });
    }

    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Should handle most connections
    expect(connected.length).toBeGreaterThan(connections * 0.9);
  }, 30000);
});
```

### Queue Processing Speed

```typescript
describe('Performance: Queue Processing', () => {
  it('should process jobs within timeout', async () => {
    const startTime = Date.now();
    const job = await queue.add({
      documentId: 'perf-test',
      filePath: '/path/to/test.png',
    });

    await job.finished();
    const duration = Date.now() - startTime;

    // Should complete within 5 minutes
    expect(duration).toBeLessThan(300000);
  });
});
```

## Manual Testing Checklist

### Basic Flow

- [ ] Upload document via web UI
- [ ] Notification widget appears immediately
- [ ] Progress updates appear in real-time
- [ ] Notification shows completion
- [ ] Can navigate to results from notification
- [ ] Results page shows timetable correctly

### Edge Cases

- [ ] Upload very large image (>10MB)
- [ ] Upload corrupted/invalid image
- [ ] Close browser tab during processing
- [ ] Reconnect after network interruption
- [ ] Upload multiple documents simultaneously
- [ ] Process document with low OCR confidence
- [ ] Process document with high OCR confidence (skip AI)

### Error Scenarios

- [ ] Redis unavailable (should fall back to sync)
- [ ] Python API unavailable (should show error)
- [ ] Invalid file format (should reject gracefully)
- [ ] Processing timeout (should retry or fail gracefully)

## Test Utilities

### Helper Functions

```typescript
// Wait for SSE event
export async function waitForEvent(
  events: any[],
  eventType: string,
  timeout: number = 10000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkInterval = setInterval(() => {
      const event = events.find(e => e.type === eventType);
      if (event) {
        clearInterval(checkInterval);
        resolve(event);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error(`Timeout waiting for ${eventType} event`));
      }
    }, 100);
  });
}

// Create test document
export async function createTestDocument(): Promise<string> {
  const response = await request(app)
    .post('/api/v1/documents/upload')
    .attach('file', 'test-image.png');
  
  return response.body.documentId;
}
```

## Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Performance tests
npm run test:performance

# All tests with coverage
npm run test:coverage
```

## Continuous Integration

Example GitHub Actions workflow:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - run: npm ci
      - run: npm test
      - run: npm run test:integration
```

---

**Last Updated:** 2025-01-01  
**Version:** 1.0.0



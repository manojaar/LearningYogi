# API Reference

Complete API reference for the AI Chatbot service.

## Base URL

Default: `http://localhost:9000`

## Endpoints

### POST /api/v1/chat

Send a chat message and receive a response.

**Request Body:**

```json
{
  "message": "string (required)",
  "session_id": "string (optional)",
  "context": {
    "document_id": "string (optional)",
    "project": "string (optional)",
    "user_id": "string (optional)",
    "custom_data": "object (optional)"
  },
  "provider": "claude|openai|local (optional)",
  "stream": "boolean (optional, default: false)"
}
```

**Response:**

```json
{
  "response": "string",
  "session_id": "string",
  "timestamp": "ISO8601 string",
  "provider": "string",
  "context_used": {
    "has_database": "boolean",
    "document_available": "boolean",
    "timetable_available": "boolean"
  }
}
```

**Example:**

```bash
curl -X POST http://localhost:9000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is a timetable?",
    "context": {
      "document_id": "doc-123"
    }
  }'
```

**Status Codes:**

- `200 OK`: Successful response
- `400 Bad Request`: Invalid request
- `500 Internal Server Error`: Server error

### GET /api/v1/chat/session/{session_id}

Get chat history for a session.

**Response:**

```json
{
  "session_id": "string",
  "messages": [
    {
      "role": "user|assistant",
      "content": "string",
      "timestamp": "ISO8601 string"
    }
  ]
}
```

**Example:**

```bash
curl http://localhost:9000/api/v1/chat/session/abc123
```

### DELETE /api/v1/chat/session/{session_id}

Delete a chat session and its history.

**Response:**

```json
{
  "message": "Session deleted"
}
```

**Status Codes:**

- `200 OK`: Session deleted
- `404 Not Found`: Session not found

### GET /health

Health check endpoint with service status.

**Response:**

```json
{
  "status": "healthy",
  "service": "ai-chatbot",
  "available_providers": ["claude", "openai"],
  "database_context": true
}
```

**Example:**

```bash
curl http://localhost:9000/health
```

### GET /

Root endpoint with service information.

**Response:**

```json
{
  "message": "AI Chatbot Service",
  "version": "1.0.0",
  "endpoints": {
    "chat": "/api/v1/chat",
    "health": "/health"
  }
}
```

## Streaming Responses

Enable streaming with `"stream": true` in the request:

```json
{
  "message": "Tell me a story",
  "stream": true
}
```

**Response Format (Server-Sent Events):**

```
data: {"chunk": "Once", "provider": "claude"}

data: {"chunk": " upon", "provider": "claude"}

data: {"chunk": " a", "provider": "claude"}

data: {"done": true, "session_id": "abc123"}

```

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error message"
}
```

**Common Errors:**

- `"No AI providers available"`: No API keys configured
- `"Provider {name} not available"`: Provider not configured
- `"Session not found"`: Invalid session ID

## Rate Limiting

Currently no rate limiting. For production, implement:

- Per-session rate limits
- Per-IP rate limits
- Global rate limits

## Authentication

Currently no authentication. For production:

- Add API key authentication
- JWT token validation
- OAuth2 integration

## CORS

CORS is enabled for all origins by default. Configure in production:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],
    allow_credentials=True,
)
```

## WebSocket Support

WebSocket support not yet implemented. Use Server-Sent Events for streaming.

## Request/Response Limits

- Max message length: 10,000 characters
- Max context size: 1MB
- Session timeout: 24 hours (in-memory)

## Best Practices

1. **Session Management**: Reuse session_id for conversation continuity
2. **Error Handling**: Always check response status
3. **Timeout Handling**: Set appropriate timeouts (30s recommended)
4. **Retry Logic**: Implement exponential backoff for failures
5. **Streaming**: Use streaming for long responses

## Examples

### JavaScript/TypeScript

```typescript
async function sendMessage(message: string, sessionId?: string) {
  const response = await fetch('http://localhost:9000/api/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      session_id: sessionId
    })
  });
  
  return await response.json();
}
```

### Python

```python
import requests

def send_message(message: str, session_id: str = None):
    response = requests.post(
        'http://localhost:9000/api/v1/chat',
        json={
            'message': message,
            'session_id': session_id
        }
    )
    return response.json()
```

### cURL

```bash
# Simple message
curl -X POST http://localhost:9000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'

# With context
curl -X POST http://localhost:9000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is my document status?",
    "context": {"document_id": "doc-123"}
  }'
```


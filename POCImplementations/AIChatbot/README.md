# AI Chatbot Plugin - Plug and Play Solution

A standalone, plug-and-play AI chatbot service that can be integrated into any POC project. Supports multiple AI providers (Claude, OpenAI, Local LLM), database context awareness, and extensible knowledge base.

## Features

- **Multiple AI Providers**: Claude API, OpenAI API, and Local LLM (Ollama/vLLM) support with automatic fallback
- **Context Awareness**: Optional database integration for querying document/timetable data
- **Extensible Knowledge Base**: JSON/YAML knowledge base files for custom information
- **Dual Integration Modes**: 
  - React component (importable, standalone)
  - Docker microservice (add to any docker-compose.yml)
- **Session Management**: Conversation history and session continuity
- **Flexible Configuration**: Environment-based setup with sensible defaults

## Quick Start

### Standalone Deployment

1. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys (at least one provider required)
   ```

2. **Start Service**
   ```bash
   docker-compose up -d
   ```

3. **Access API**
   - API: http://localhost:9000
   - Health Check: http://localhost:9000/health
   - API Docs: http://localhost:9000/docs

### Using React Component

```tsx
import { Chatbot } from '@learning-yogi/ai-chatbot';

function App() {
  return (
    <Chatbot
      apiUrl="http://localhost:9000"
      context={{ document_id: "doc-123" }}
    />
  );
}
```

### Adding as Microservice

Add to your `docker-compose.yml`:

```yaml
services:
  ai-chatbot:
    build: ./AIChatbot/backend/python
    ports:
      - "9000:9000"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - CHATBOT_ENABLE_CONTEXT=true
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Claude API key | Required |
| `OPENAI_API_KEY` | OpenAI API key | Optional |
| `CHATBOT_PROVIDER_PREFERENCE` | Provider order | `claude,openai,local` |
| `CHATBOT_ENABLE_CONTEXT` | Enable DB context | `false` |
| `POC_DB_URL` | Database path | `./data/database/app.db` |
| `LOCAL_LLM_URL` | Local LLM endpoint | `http://localhost:11434` |
| `LOCAL_LLM_MODEL` | Local LLM model | `llama2` |

### AI Providers

The chatbot supports three AI providers with automatic fallback:

1. **Claude (Anthropic)**: Best for general conversation and structured responses
2. **OpenAI**: GPT-4/3.5 support for versatile chat
3. **Local LLM**: Ollama, vLLM, or any OpenAI-compatible endpoint

Configure via `CHATBOT_PROVIDER_PREFERENCE` environment variable.

## API Reference

### POST /api/v1/chat

Send a chat message and receive a response.

**Request:**
```json
{
  "message": "What is a timetable?",
  "session_id": "optional-session-id",
  "context": {
    "document_id": "doc-123",
    "project": "POCDemoImplementation"
  },
  "provider": "claude",
  "stream": false
}
```

**Response:**
```json
{
  "response": "A timetable is a schedule...",
  "session_id": "uuid",
  "timestamp": "2025-01-01T00:00:00Z",
  "provider": "claude",
  "context_used": {
    "has_database": true,
    "document_available": true
  }
}
```

### GET /api/v1/chat/session/{session_id}

Get chat history for a session.

### DELETE /api/v1/chat/session/{session_id}

Delete a chat session.

### GET /health

Health check endpoint with provider availability status.

## Integration Guides

- [POCDemoImplementation Integration](integration/POCDemoImplementation.md)
- [React Component Usage](integration/REACT_COMPONENT.md)
- [Microservice Integration](integration/MICROSERVICE.md)
- [API Reference](integration/API_REFERENCE.md)

## Project Structure

```
AIChatbot/
├── backend/python/          # FastAPI service
│   ├── app/
│   │   ├── api/             # API endpoints
│   │   ├── services/        # AI providers
│   │   ├── context/         # DB & knowledge base
│   │   └── models/          # Pydantic models
│   └── requirements.txt
├── frontend/                # React components
│   ├── components/          # Chatbot UI
│   └── hooks/               # React hooks
├── config/
│   └── knowledge_base/      # Knowledge files
└── docker-compose.yml
```

## Development

### Running Locally

```bash
cd backend/python
pip install -r requirements.txt
python run.py
```

### Adding Custom Knowledge

Create JSON/YAML files in `config/knowledge_base/`:

```json
{
  "faq": [
    {
      "question": "Custom question?",
      "answer": "Custom answer."
    }
  ]
}
```

## Testing

```bash
# Backend tests
cd backend/python
pytest

# Integration test
curl -X POST http://localhost:9000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'
```

## License

MIT License


# POCDemoImplementation Integration Guide

This guide shows how to integrate the AI Chatbot into POCDemoImplementation.

## Integration Overview

The chatbot has been integrated into POCDemoImplementation in two ways:

1. **Backend Service**: Added as a docker-compose service
2. **Frontend Component**: Added as a floating chat widget

## Prerequisites

- POCDemoImplementation running with docker-compose
- At least one AI provider API key configured

## Setup

### 1. Environment Configuration

Add chatbot configuration to `.env`:

```bash
# AI Chatbot Configuration
CHATBOT_PROVIDER_PREFERENCE=claude,openai,local
CHATBOT_ENABLE_CONTEXT=true
CHATBOT_CLAUDE_MODEL=claude-3-haiku-20240307
```

### 2. Start Services

The chatbot service is already added to `docker-compose.yml`. Start all services:

```bash
docker-compose up -d
```

The chatbot will be available at:
- Backend API: http://localhost:9000
- Health Check: http://localhost:9000/health

### 3. Frontend Integration

The chatbot component has been integrated into `HomePage.tsx` as a floating widget:

- **Floating Button**: Bottom-right corner
- **Chat Panel**: Opens when button is clicked
- **Context Aware**: Automatically uses document ID if available

## Usage

### Basic Usage

The chatbot appears as a floating button in the bottom-right corner. Click to open/close the chat panel.

### Document Context

When a document is uploaded, the chatbot automatically has access to that document's information:

```tsx
// The chatbot receives documentId automatically
<Chatbot documentId={documentId} />
```

Users can ask questions like:
- "What's the status of my document?"
- "Show me the timetable for this document"
- "What classes are scheduled on Monday?"

### Custom Integration

To add the chatbot to other pages:

```tsx
import { Chatbot } from '@/components/Chatbot';

function MyPage() {
  return (
    <div>
      <Chatbot documentId="doc-123" className="my-custom-class" />
    </div>
  );
}
```

## Configuration Options

### Enable/Disable Database Context

Set `CHATBOT_ENABLE_CONTEXT=false` in `.env` to disable database queries.

### Change AI Provider

Set `CHATBOT_PROVIDER_PREFERENCE` to change the order:

```bash
# Prefer OpenAI, fallback to Claude
CHATBOT_PROVIDER_PREFERENCE=openai,claude
```

### Use Local LLM

1. Start Ollama or your local LLM server
2. Configure in `.env`:
   ```bash
   LOCAL_LLM_URL=http://localhost:11434
   LOCAL_LLM_MODEL=llama2
   CHATBOT_PROVIDER_PREFERENCE=local,claude,openai
   ```

## Customizing Knowledge Base

Edit `AIChatbot/config/knowledge_base/default.json` to add custom FAQ or help content:

```json
{
  "faq": [
    {
      "question": "How do I export timetables?",
      "answer": "Use the export button in the results view."
    }
  ]
}
```

## Troubleshooting

### Chatbot Not Appearing

1. Check if service is running: `docker-compose ps`
2. Check logs: `docker-compose logs ai-chatbot`
3. Verify health endpoint: `curl http://localhost:9000/health`

### No Responses

1. Verify API keys are set in `.env`
2. Check provider availability in health endpoint
3. Review logs for errors

### Database Context Not Working

1. Ensure `CHATBOT_ENABLE_CONTEXT=true`
2. Verify `POC_DB_URL` points to correct database
3. Check database file permissions

## Next Steps

- Customize the knowledge base for your specific use case
- Add custom context handlers for specific document types
- Integrate into ResultsPage for document-specific chat


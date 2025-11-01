# Microservice Integration Guide

Guide for integrating the AI Chatbot as a microservice in docker-compose.

## Overview

The chatbot can be added as a standalone microservice to any docker-compose setup, allowing it to be shared across multiple applications.

## Basic Integration

### Step 1: Add Service to docker-compose.yml

```yaml
services:
  ai-chatbot:
    build:
      context: ./AIChatbot/backend/python
      dockerfile: Dockerfile
    container_name: ai-chatbot
    ports:
      - "9000:9000"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - CHATBOT_ENABLE_CONTEXT=${CHATBOT_ENABLE_CONTEXT:-false}
    networks:
      - default
    restart: unless-stopped
```

### Step 2: Configure Environment

Add to your `.env`:

```bash
ANTHROPIC_API_KEY=your_key_here
CHATBOT_PROVIDER_PREFERENCE=claude,openai,local
CHATBOT_ENABLE_CONTEXT=true
```

### Step 3: Start Services

```bash
docker-compose up -d
```

## Advanced Configuration

### With Database Context

If you want the chatbot to query your database:

```yaml
services:
  ai-chatbot:
    # ... base config ...
    environment:
      - CHATBOT_ENABLE_CONTEXT=true
      - POC_DB_URL=/data/database/app.db
    volumes:
      - ./data:/data:ro  # Mount database directory
```

### With Shared Network

For services to communicate:

```yaml
services:
  ai-chatbot:
    # ... config ...
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

### With Knowledge Base

Mount custom knowledge base:

```yaml
services:
  ai-chatbot:
    # ... config ...
    volumes:
      - ./AIChatbot/config/knowledge_base:/config/knowledge_base:ro
    environment:
      - KNOWLEDGE_BASE_PATH=/config/knowledge_base
```

## Integration Patterns

### Pattern 1: Shared Service

One chatbot instance for multiple apps:

```yaml
services:
  app1:
    # ...
    depends_on:
      - ai-chatbot
  
  app2:
    # ...
    depends_on:
      - ai-chatbot
  
  ai-chatbot:
    # ... config ...
```

### Pattern 2: Service per App

Separate instance per application:

```yaml
services:
  app1-chatbot:
    build: ./AIChatbot/backend/python
    # ... config ...
  
  app2-chatbot:
    build: ./AIChatbot/backend/python
    # ... config ...
```

### Pattern 3: External Service

Reference chatbot from external docker-compose:

```yaml
# docker-compose.override.yml
services:
  my-app:
    external_links:
      - ai-chatbot:chatbot
```

## Health Checks

The service includes health checks:

```yaml
services:
  ai-chatbot:
    # ... config ...
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Dependency Management

### Make Other Services Wait

```yaml
services:
  my-app:
    depends_on:
      ai-chatbot:
        condition: service_healthy
```

## Scaling

### Multiple Instances

```yaml
services:
  ai-chatbot:
    # ... config ...
    deploy:
      replicas: 3
```

Note: Session state is in-memory. For production, use Redis or database-backed sessions.

## Networking

### Internal Communication

```yaml
services:
  ai-chatbot:
    # ... config ...
    networks:
      - internal
  
  my-app:
    # ... config ...
    networks:
      - internal
    environment:
      - CHATBOT_URL=http://ai-chatbot:9000
```

### External Access

```yaml
services:
  ai-chatbot:
    # ... config ...
    ports:
      - "9000:9000"  # Expose to host
```

## Resource Limits

```yaml
services:
  ai-chatbot:
    # ... config ...
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

## Monitoring

### Logs

```bash
docker-compose logs -f ai-chatbot
```

### Metrics

Check `/health` endpoint for provider availability:

```bash
curl http://localhost:9000/health
```

## Troubleshooting

### Service Won't Start

1. Check logs: `docker-compose logs ai-chatbot`
2. Verify build context path is correct
3. Check environment variables

### Can't Connect from Other Services

1. Verify services are on same network
2. Use service name, not localhost
3. Check health endpoint

### High Memory Usage

1. Set resource limits
2. Reduce number of concurrent sessions
3. Consider Redis for session storage

## Best Practices

1. **Health Checks**: Always include health checks
2. **Resource Limits**: Set appropriate limits
3. **Networks**: Use dedicated networks for isolation
4. **Secrets**: Store API keys in secrets, not environment
5. **Logging**: Configure proper logging
6. **Monitoring**: Set up monitoring for production


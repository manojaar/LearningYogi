# AI Chatbot Integration Guide - PoC1 (Microservices)

This guide shows how to integrate the AI Chatbot into the PoC1 microservices architecture.

## Overview

The AI Chatbot provides context-aware conversational assistance for users. It integrates seamlessly with the microservices architecture and can be deployed as a containerized service in Kubernetes or Docker Compose.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend (React)                       │
│              + Chatbot UI Component                     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
        ┌────────────────┐
        │  API Gateway   │
        │   (NGINX)      │
        └────────┬───────┘
                 │
    ┌────────────┴────────────┐
    │                         │
    ▼                         ▼
┌─────────────┐      ┌──────────────────┐
│ Node.js API │      │  AI Chatbot      │
│  Service    │      │   Service        │
└──────┬──────┘      │  (FastAPI)       │
       │             └────────┬─────────┘
       │                      │
       └──────┬───────────────┘
              │
              ▼
       ┌──────────────┐
       │ PostgreSQL   │
       │ (Shared DB)  │
       └──────────────┘
```

## Prerequisites

- PoC1 infrastructure running (PostgreSQL, Redis, Kubernetes or Docker Compose)
- At least one AI provider API key (Claude, OpenAI, or Local LLM)
- Access to AIChatbot repository

## Deployment Methods

### Method 1: Docker Compose (Development)

#### 1. Add to Docker Compose

Add the chatbot service to `infrastructure/docker-compose.yml`:

```yaml
services:
  # ... existing services ...

  ai-chatbot:
    build: ../../AIChatbot/backend/python
    ports:
      - "9000:9000"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - CHATBOT_PROVIDER_PREFERENCE=${CHATBOT_PROVIDER_PREFERENCE:-claude,openai,local}
      - CHATBOT_ENABLE_CONTEXT=true
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/learningyogi
      - KNOWLEDGE_BASE_PATH=/config/knowledge_base
    volumes:
      - ../../AIChatbot/config:/config:ro
    depends_on:
      - postgres
      - nodejs-api
    networks:
      - learning-yogi-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  learning-yogi-network:
    external: false
```

#### 2. Update Environment Variables

Add to `.env`:

```bash
# AI Chatbot Configuration
CHATBOT_PROVIDER_PREFERENCE=claude,openai,local
CHATBOT_CLAUDE_MODEL=claude-3-haiku-20240307
CHATBOT_OPENAI_MODEL=gpt-3.5-turbo
CHATBOT_ENABLE_CONTEXT=true
```

#### 3. Start Services

```bash
docker-compose -f infrastructure/docker-compose.yml up -d ai-chatbot
```

### Method 2: Kubernetes (Production)

#### 1. Create Deployment Manifest

Create `infrastructure/kubernetes/chatbot-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-chatbot
  labels:
    app: ai-chatbot
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ai-chatbot
  template:
    metadata:
      labels:
        app: ai-chatbot
    spec:
      containers:
      - name: chatbot
        image: ai-chatbot:latest
        ports:
        - containerPort: 9000
        env:
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: anthropic-api-key
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: openai-api-key
        - name: CHATBOT_PROVIDER_PREFERENCE
          value: "claude,openai,local"
        - name: CHATBOT_ENABLE_CONTEXT
          value: "true"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-config
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 9000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 9000
          initialDelaySeconds: 10
          periodSeconds: 5
        volumeMounts:
        - name: knowledge-base
          mountPath: /config/knowledge_base
          readOnly: true
      volumes:
      - name: knowledge-base
        configMap:
          name: chatbot-knowledge-base
---
apiVersion: v1
kind: Service
metadata:
  name: ai-chatbot
spec:
  selector:
    app: ai-chatbot
  ports:
  - port: 9000
    targetPort: 9000
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ai-chatbot-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ai-chatbot
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

#### 2. Create ConfigMap for Knowledge Base

```yaml
# infrastructure/kubernetes/chatbot-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: chatbot-knowledge-base
data:
  default.json: |
    {
      "faq": [
        {
          "question": "How do I upload a timetable?",
          "answer": "Use the upload button on the homepage."
        }
      ]
    }
```

#### 3. Create Secrets for API Keys

```bash
kubectl create secret generic api-keys \
  --from-literal=anthropic-api-key='sk-ant-...' \
  --from-literal=openai-api-key='sk-...'

kubectl create secret generic database-config \
  --from-literal=url='postgresql://user:pass@postgres:5432/db'
```

#### 4. Deploy to Kubernetes

```bash
kubectl apply -f infrastructure/kubernetes/chatbot-deployment.yaml
kubectl apply -f infrastructure/kubernetes/chatbot-config.yaml

# Verify deployment
kubectl get pods -l app=ai-chatbot
kubectl logs -f deployment/ai-chatbot
```

### Method 3: Service Mesh (Advanced)

For Istio or Linkerd service mesh integration:

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: ai-chatbot
spec:
  hosts:
  - ai-chatbot
  http:
  - route:
    - destination:
        host: ai-chatbot
        port:
          number: 9000
    timeout: 30s
    retries:
      attempts: 3
      perTryTimeout: 10s
```

## Frontend Integration

### Add Chatbot Component

Install the chatbot React component:

```bash
cd frontend/react
npm install @learning-yogi/ai-chatbot
```

Use in your main layout:

```tsx
// frontend/react/src/components/Layout.tsx
import { Chatbot } from '@learning-yogi/ai-chatbot';

export function Layout({ children }) {
  return (
    <div>
      {children}
      <Chatbot 
        apiUrl="http://localhost:9000"
        position="bottom-right"
      />
    </div>
  );
}
```

In Kubernetes, use service discovery:

```tsx
<Chatbot 
  apiUrl="http://ai-chatbot:9000"
  position="bottom-right"
/>
```

## Database Integration

### Schema Updates (Optional)

Add chatbot-specific tables if needed:

```sql
-- Session management table
CREATE TABLE chatbot_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Chat history (or use existing conversation tables)
CREATE TABLE chatbot_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chatbot_sessions(id),
    role VARCHAR(20) NOT NULL,  -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_chatbot_sessions_user ON chatbot_sessions(user_id);
CREATE INDEX idx_chatbot_sessions_last_activity ON chatbot_sessions(last_activity);
CREATE INDEX idx_chatbot_messages_session ON chatbot_messages(session_id);
```

### Context Queries

The chatbot can query existing PoC1 tables for context:

- `documents` - Document status and metadata
- `timetables` - Extracted timetable information
- `processing_jobs` - Processing status
- Custom business tables

## Service Discovery

### Internal Communication

With service mesh or DNS:

```python
# The chatbot service discovers other services
NODEJS_API_URL = "http://nodejs-api:4000"
PYTHON_AI_URL = "http://python-ai:8000"
```

### External Access

Through NGINX or API Gateway:

```nginx
# nginx.conf
location /api/v1/chat/ {
    proxy_pass http://ai-chatbot:9000/api/v1/chat/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## Configuration Options

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ANTHROPIC_API_KEY` | Claude API key | - | Yes* |
| `OPENAI_API_KEY` | OpenAI API key | - | No |
| `CHATBOT_PROVIDER_PREFERENCE` | Provider order | `claude,openai,local` | No |
| `CHATBOT_CLAUDE_MODEL` | Claude model | `claude-3-haiku-20240307` | No |
| `CHATBOT_OPENAI_MODEL` | OpenAI model | `gpt-3.5-turbo` | No |
| `CHATBOT_ENABLE_CONTEXT` | Enable DB context | `false` | No |
| `DATABASE_URL` | PostgreSQL connection | - | If context enabled |
| `LOCAL_LLM_URL` | Local LLM endpoint | `http://localhost:11434` | No |
| `LOCAL_LLM_MODEL` | Local LLM model | `llama2` | No |

\* At least one AI provider required

### Kubernetes ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: chatbot-config
data:
  CHATBOT_PROVIDER_PREFERENCE: "claude,openai,local"
  CHATBOT_CLAUDE_MODEL: "claude-3-haiku-20240307"
  CHATBOT_ENABLE_CONTEXT: "true"
```

## Monitoring and Observability

### Prometheus Metrics

The chatbot exposes metrics at `/metrics`:

```yaml
# Add to Prometheus scrape config
- job_name: 'ai-chatbot'
  static_configs:
    - targets: ['ai-chatbot:9000']
```

### Logging

Structured JSON logs with correlation IDs:

```bash
# View logs
kubectl logs -f deployment/ai-chatbot

# Filter by level
kubectl logs -f deployment/ai-chatbot | grep ERROR
```

### Alerts

Example Prometheus alerts:

```yaml
groups:
- name: chatbot
  rules:
  - alert: ChatbotHighErrorRate
    expr: rate(chatbot_errors_total[5m]) > 0.05
    for: 5m
    annotations:
      summary: "Chatbot error rate is high"
  
  - alert: ChatbotHighLatency
    expr: histogram_quantile(0.95, chatbot_request_duration_seconds) > 5
    for: 5m
    annotations:
      summary: "Chatbot p95 latency is high"
```

## Cost Analysis

### Monthly Costs (1,000 docs/day)

| Component | Cost | Notes |
|-----------|------|-------|
| **Compute** | $30 | 2 pods × 1GB RAM × $0.015/GB-hr |
| **AI API (Claude)** | $5 | ~500 requests/day @ $3/1K |
| **Database** | $0 | Shared with existing infrastructure |
| **Storage** | $0 | Shared with existing infrastructure |
| **Network** | $0 | Internal traffic |
| **Monitoring** | $5 | Additional metrics/logs |
| **Total** | **$40/month** | ~25% of PoC1 base cost |

### Scaling Costs

| Traffic | Pods | API Costs | Total Monthly |
|---------|------|-----------|---------------|
| 1,000 docs/day | 2 | $5 | $40 |
| 5,000 docs/day | 5 | $25 | $85 |
| 10,000 docs/day | 10 | $50 | $160 |

## Testing

### Unit Tests

```bash
cd AIChatbot/backend/python
pytest tests/unit/
```

### Integration Tests

```bash
# Test with real PostgreSQL
pytest tests/integration/ -v
```

### Load Testing

```bash
# Use k6 or locust
k6 run load_test.js
```

Example test:

```javascript
import http from 'k6/http';

export default function () {
  const payload = JSON.stringify({
    message: "What's the status of my document?",
    context: { document_id: "test-123" }
  });
  
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };
  
  http.post('http://ai-chatbot:9000/api/v1/chat', payload, params);
}
```

## Troubleshooting

### Common Issues

**1. Chatbot can't connect to database**

```bash
# Check service connectivity
kubectl exec -it pod/ai-chatbot -- nc -zv postgres 5432

# Verify database URL
kubectl get configmap chatbot-config -o yaml
```

**2. No AI providers available**

```bash
# Check API keys
kubectl get secrets api-keys -o jsonpath='{.data}' | base64 -d

# Test health endpoint
curl http://ai-chatbot:9000/health
```

**3. High latency**

```bash
# Check resource usage
kubectl top pods ai-chatbot

# Review logs for errors
kubectl logs deployment/ai-chatbot --tail=100
```

### Debug Mode

Enable debug logging:

```yaml
env:
- name: LOG_LEVEL
  value: "DEBUG"
```

## Security Considerations

### API Key Management

- Use Kubernetes Secrets, not ConfigMaps
- Rotate keys regularly
- Restrict access to secrets via RBAC

### Network Security

- Use NetworkPolicies to restrict traffic
- Enable TLS for internal communication
- Implement rate limiting

### Data Privacy

- Don't log sensitive user data
- Implement data retention policies
- Encrypt chat history at rest

## Next Steps

1. **Integrate with frontend**: Add chatbot UI component
2. **Customize knowledge base**: Add domain-specific FAQ
3. **Enable context**: Configure database queries
4. **Set up monitoring**: Configure Prometheus and Grafana
5. **Load testing**: Validate performance under load
6. **Security audit**: Review and harden configuration

## References

- [AIChatbot Documentation](../../AIChatbot/README.md)
- [AIChatbot API Reference](../../AIChatbot/integration/API_REFERENCE.md)
- [Kubernetes Documentation](https://kubernetes.io/docs/)

---

**Version**: 1.0.0  
**Last Updated**: 2025-01-01  
**Status**: Production-Ready


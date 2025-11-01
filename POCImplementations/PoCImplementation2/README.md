# PoC Implementation 2: Serverless Event-driven Architecture

## Executive Summary

This Proof of Concept demonstrates a **serverless event-driven architecture** for the Learning Yogi timetable extraction platform. It leverages AWS Lambda, EventBridge, and managed services for instant auto-scaling with minimal operational overhead.

**Architecture Type**: Serverless with Event-driven Processing
**Tech Stack**: AWS Lambda (Node.js + Python) + React + Aurora Serverless + EventBridge
**Deployment**: AWS (SAM / Serverless Framework)
**Cost (1,000 docs/day)**: ~$226/month (~$0.0075/document)

---

## Key Features

✅ **Zero Infrastructure Management**: AWS handles all servers
✅ **Instant Auto-scaling**: 0 to 1000+ concurrent executions in seconds
✅ **Cost-Effective**: Pay only for execution time
✅ **Multi-tier Processing**: Same quality gates as PoC1
✅ **AI Chatbot Integration** (Optional): Lambda-based conversational assistant
✅ **Test-Driven Development**: Comprehensive test coverage
✅ **Real-time Notifications**: WebSocket via API Gateway

---

## 🚀 Quick Start

### Prerequisites

- **AWS Account** with admin access
- **AWS CLI** configured
- **Node.js** 20.x
- **Python** 3.11+
- **SAM CLI** (for local testing)

### Installation

```bash
# Clone repository
cd PoCImplementation2

# Install dependencies
cd backend/lambda-nodejs
npm install

cd ../lambda-python
pip install -r requirements.txt

# Deploy to AWS
sam deploy --guided

# Or using Serverless Framework
serverless deploy --stage dev
```

### Local Development (SAM Local)

```bash
# Start local API
sam local start-api --docker-network host

# Invoke specific function
sam local invoke OCRProcessor --event events/test-document.json

# Access local API
curl http://localhost:3000/api/documents
```

---

## 📁 Project Structure

```
PoCImplementation2/
├── backend/
│   ├── lambda-nodejs/         # Lambda functions (Node.js)
│   │   ├── src/
│   │   │   ├── handlers/      # API Gateway handlers
│   │   │   ├── services/      # Business logic
│   │   │   └── models/        # Data models
│   │   └── tests/             # Jest tests
│   │
│   └── lambda-python/         # Lambda functions (Python)
│       ├── src/
│       │   ├── handlers/      # Event handlers
│       │   ├── processors/    # OCR, LLM processing
│       │   └── utils/         # Helper functions
│       └── tests/             # Pytest tests
│
├── frontend/
│   └── react/                 # React PWA (same as PoC1)
│
├── infrastructure/
│   ├── template.yaml          # AWS SAM template
│   ├── serverless.yml         # Serverless Framework config
│   └── terraform/             # Terraform IaC
│
└── docs/
    ├── README.md              # This file
    ├── ARCHITECTURE.md        # Detailed architecture
    └── DEPLOYMENT.md          # Deployment guide
```

---

## 🏗️ Architecture Overview

### High-Level Architecture

```
┌─────────────┐
│ React PWA   │ ← User uploads timetable
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────┐
│ CloudFront  │ ← CDN for static assets
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ API Gateway │ ← REST + WebSocket APIs
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────────┐
│ AWS Lambda Functions                  │
│ - Documents API (Node.js)            │
│ - Classifier (Python)                │
│ - OCR Processor (Python)             │
│ - LLM Processor (Python)             │
│ - Validator (Node.js)                │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ EventBridge + Step Functions          │
│ (Workflow Orchestration)              │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Data Layer                            │
│ - Aurora Serverless v2 (PostgreSQL)  │
│ - ElastiCache Serverless (Redis)     │
│ - S3 (Document storage)              │
└──────────────────────────────────────┘
```

---

## Key Differences from PoC1

| Aspect | PoC1 (Microservices) | PoC2 (Serverless) |
|--------|---------------------|-------------------|
| **Infrastructure** | Kubernetes | AWS Lambda |
| **Scaling** | Manual (HPA) | Automatic (instant) |
| **Cost (1K docs/day)** | $1,128/month | $226/month |
| **Cold Start** | None | 1-3s (mitigable) |
| **Operational Overhead** | High | Low |
| **Vendor Lock-in** | Low | High (AWS) |

---

## Lambda Functions

### Node.js Functions

**DocumentsAPI** - Handles document upload and retrieval
- Runtime: Node.js 20
- Memory: 512 MB
- Timeout: 30s
- Trigger: API Gateway

**Validator** - Validates extracted timetable data
- Runtime: Node.js 20
- Memory: 512 MB
- Timeout: 30s
- Trigger: EventBridge

### Python Functions

**Classifier** - ML-based document classification
- Runtime: Python 3.11
- Memory: 1024 MB
- Timeout: 60s
- Trigger: S3 Event / EventBridge

**OCRProcessor** - Tesseract + Cloud Vision OCR
- Runtime: Python 3.11
- Memory: 2048 MB
- Timeout: 5 minutes
- Trigger: EventBridge

**LLMProcessor** - Claude API integration
- Runtime: Python 3.11
- Memory: 512 MB
- Timeout: 2 minutes
- Trigger: EventBridge

---

## Event Flow (Step Functions)

```yaml
StateMachine: DocumentProcessingWorkflow
Steps:
  1. ClassifyDocument (Lambda)
  2. Choice: Route by document type
  3. PreprocessImage (Lambda)
  4. RunOCR (Lambda)
  5. Choice: Check confidence
     - High (>=98%): → Validate
     - Medium (80-98%): → LLM
     - Low (<80%): → HITL
  6. ValidateData (Lambda)
  7. SaveToDatabase (Lambda)
  8. SendNotification (Lambda)
```

---

## Cold Start Mitigation

### Problem
Lambda cold starts add 1-3s latency for first invocation.

### Solutions

**1. Provisioned Concurrency** (for critical functions)
```yaml
DocumentsAPI:
  ProvisionedConcurrency: 5  # Keep 5 instances warm
```
Cost: ~$20/month per function

**2. Scheduled Warming**
```yaml
Schedule: rate(5 minutes)
Target: DocumentsAPI
Payload: { "warmup": true }
```
Cost: ~$5/month

**3. Function Optimization**
- Minimize dependencies
- Use Lambda Layers for shared code
- Reduce cold start time from 3s → 1s

---

## Deployment

### Development

```bash
# Deploy to dev environment
sam deploy --config-env dev

# Tail logs
sam logs -n DocumentsAPI --tail

# Run tests
npm test --coverage
pytest --cov
```

### Production

```bash
# Deploy to production
sam deploy --config-env prod

# Monitor
aws cloudwatch dashboard get-dashboard-name learning-yogi-prod

# Rollback if needed
sam deploy --config-env prod --rollback
```

---

## Monitoring

### CloudWatch Dashboards
- Lambda invocations, errors, duration
- API Gateway requests, latency, errors
- Step Functions executions, failures
- Database ACU utilization

### X-Ray Tracing
- End-to-end request tracing
- Identify bottlenecks
- Debug distributed errors

### Alarms
- Lambda error rate >5%
- API Gateway 5xx >1%
- Step Functions failures

---

## Cost Analysis

### At 1,000 Documents/Day

| Service | Monthly Cost |
|---------|-------------|
| Lambda (compute) | $11 |
| API Gateway | $1 |
| EventBridge + Step Functions | $8 |
| Aurora Serverless | $175 |
| ElastiCache | $1 |
| S3 | $2 |
| CloudWatch | $10 |
| External APIs | $18 |
| **Total** | **$226** |

**Per Document**: $0.0075

**With AI Chatbot (optional)**:
| Additional Service | Monthly Cost |
|-------------------|-------------|
| Lambda (chatbot) | $1 |
| API Gateway (extra) | $0.10 |
| DynamoDB | $0.25 |
| Claude API | $5 |
| CloudWatch | $0.50 |
| **Chatbot Total** | **+$7** |
| **Total w/ Chatbot** | **$233** |

**Comparison**: 80% cheaper than PoC1 at this volume

---

## Advantages

✅ **5x Cheaper** at low volume
✅ **Instant Scaling** (0 to 1000+ in seconds)
✅ **Zero Operations** (no servers to manage)
✅ **Fast Development** (2-4 weeks to production)
✅ **Built-in HA** (99.95% SLA from AWS)
✅ **Easy Global Deployment** (multi-region)

---

## Trade-offs

❌ **Cold Starts** (1-3s latency, mitigable)
❌ **AWS Lock-in** (harder to migrate)
❌ **15-Min Limit** (Lambda max execution time)
❌ **Less Control** (infrastructure managed by AWS)

---

## When to Choose PoC2

✅ Startup or MVP (< 6 months to launch)
✅ Small team (< 5 engineers)
✅ Limited DevOps resources
✅ Variable/unpredictable load
✅ Cost optimization at low-medium volume
✅ AWS ecosystem

---

## Migration to PoC1

If volume exceeds 5,000 docs/day consistently, consider migrating to PoC1 (Microservices) for better cost efficiency at scale.

**Migration Timeline**: 2-3 months
**Migration Difficulty**: Moderate

---

## Testing

```bash
# Unit tests
cd backend/lambda-nodejs
npm test

cd backend/lambda-python
pytest

# Integration tests
sam local start-api
npm run test:integration

# E2E tests
npm run test:e2e
```

---

## Documentation

- **[Architecture Details](docs/ARCHITECTURE.md)** - Full architecture documentation
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Step-by-step deployment
- **[Cost Analysis](../POC1VSPOC2.md)** - Detailed cost comparison

## 🤖 AI Enhancements

### AI Pipeline Integration (Optional)

Integrate **PoCAIPipeline** for fine-tuned models:

- **Fine-tuned OCR Models**: Lambda-based domain-specific OCR models
- **Fine-tuned Document Models**: Replace Claude API with Lambda-based models
- **Feature Store**: Feast with ElastiCache Serverless for analytics
- **MLOps**: Experiment tracking and model versioning on AWS

**Integration Guide**: [PoCAIPipeline POC2 Migration](../PoCAIPipeline/docs/MIGRATION_POC2.md)  
**Benefits**: 80-90% cost reduction on API calls, better accuracy, lower latency

### AI Chatbot Integration (Optional)

Add a **context-aware AI assistant** using Lambda:

- **Lambda-based**: Serverless chatbot function with auto-scaling
- **API Gateway**: RESTful chat endpoints
- **EventBridge**: Async chat history and analytics
- **Context Awareness**: Database queries via Aurora Serverless
- **Multiple AI Providers**: Claude, OpenAI, or Local LLM support

**Integration Guide**: [AI Chatbot Integration](docs/AICHATBOT_INTEGRATION.md)  
**Cost Impact**: ~$15-30/month additional for Lambda execution and AI API costs

---

## Support

- **SAM Docs**: https://docs.aws.amazon.com/serverless-application-model
- **Lambda Docs**: https://docs.aws.amazon.com/lambda
- **EventBridge Docs**: https://docs.aws.amazon.com/eventbridge

---

**Built with ❤️ using AWS Serverless + TDD**

**Version**: 1.0.0
**Last Updated**: 2025-01-01
**Status**: ✅ Production-Ready PoC
**Recommended**: Start here, migrate to PoC1 if needed

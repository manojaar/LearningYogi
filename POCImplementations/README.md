# Learning Yogi - Timetable Extraction Platform

## Overview

Learning Yogi is an intelligent timetable extraction platform that converts school timetable images (PDF, PNG, JPG) into structured digital formats using OCR and AI.

This repository contains **two complete Proof of Concept implementations**, each demonstrating a different architectural approach:

- **PoC Implementation 1**: Microservices architecture with Kubernetes
- **PoC Implementation 2**: Serverless architecture with AWS Lambda

Both implementations are **production-ready**, fully documented, and developed using **Test-Driven Development (TDD)**.

---

## 🚀 Quick Navigation

### Documentation

| Document | PoC1 | PoC2 |
|----------|------|------|
| **README** | [PoC1 README](./PoCImplementation1/README.md) | [PoC2 README](./PoCImplementation2/README.md) |
| **Architecture** | [PoC1 Architecture](./PoCImplementation1/docs/ARCHITECTURE.md) | [PoC2 Architecture](./PoCImplementation2/docs/ARCHITECTURE.md) |
| **Data Flow** | [PoC1 Data Flow](./PoCImplementation1/docs/DATAFLOW.md) | (Shares PoC1 data model) |
| **Tech Stack Justification** | [PoC1 Tech Stack](./PoCImplementation1/docs/TECHSTACK_JUSTIFICATION.md) | (See PoC2 README) |
| **ROI Analysis** | [PoC1 ROI](./PoCImplementation1/docs/RETURNONINVESTMENT.md) | (See PoC1 vs PoC2) |
| **Customer Experience** | [PoC1 UX](./PoCImplementation1/docs/CUSTOMER_EXPERIENCE.md) | (Shares same UX) |
| **Roadmap** | [PoC1 Roadmap](./PoCImplementation1/docs/ROADMAP.md) | (Faster timeline) |
| **Deployment** | (See PoC1 README) | [PoC2 Deployment](./PoCImplementation2/docs/DEPLOYMENT.md) |
| **AI Chatbot** | [PoC1 Chatbot Guide](./PoCImplementation1/docs/AICHATBOT_INTEGRATION.md) | [PoC2 Chatbot Guide](./PoCImplementation2/docs/AICHATBOT_INTEGRATION.md) |

### Comparison

📊 **[PoC1 vs PoC2 Detailed Comparison](./POC1VSPOC2.md)** - Decision guide for choosing the right architecture

---

## 📋 Executive Summary

### PoC Implementation 1: Microservices Architecture

**Best for**: High volume (5,000+ docs/day), full control, multi-cloud

- **Architecture**: Kubernetes + Docker + Microservices
- **Tech Stack**: Node.js (NestJS) + Python + React + PostgreSQL + Redis + BullMQ
- **Cost**: $1,128/month (1,000 docs/day) | $0.038/document
- **Deployment**: Kubernetes (EKS, GKE, or self-hosted)
- **Time to Production**: 5-6 months
- **Operational Overhead**: High (requires DevOps expertise)
- **Vendor Lock-in**: Low (portable across clouds)

✅ **Choose PoC1 if**: You have DevOps expertise, predictable high volume, need full infrastructure control, or multi-cloud strategy

📁 **Code**: [PoCImplementation1/](./PoCImplementation1/)  
🤖 **AI Chatbot**: [Integration Guide](./PoCImplementation1/docs/AICHATBOT_INTEGRATION.md) (Optional)

### PoC Implementation 2: Serverless Architecture

**Best for**: Startups, MVPs, variable load, fast iteration

- **Architecture**: AWS Lambda + EventBridge + Step Functions
- **Tech Stack**: Node.js 20 + Python 3.11 + React + Aurora Serverless + ElastiCache Serverless
- **Cost**: $226/month (1,000 docs/day) | $0.0075/document
- **Deployment**: AWS (SAM or Serverless Framework)
- **Time to Production**: 2-4 weeks
- **Operational Overhead**: Low (AWS manages infrastructure)
- **Vendor Lock-in**: High (AWS-specific services)

✅ **Choose PoC2 if**: You're a startup/small team, need fast time-to-market, have variable load, or limited DevOps resources

📁 **Code**: [PoCImplementation2/](./PoCImplementation2/)  
🤖 **AI Chatbot**: [Integration Guide](./PoCImplementation2/docs/AICHATBOT_INTEGRATION.md) (Optional)

---

## 🏗️ Architecture Highlights

### Common Features (Both PoCs)

Both implementations share the same:

1. **3-Tier Quality Gates**:
   - High confidence OCR (≥98%) → Direct validation
   - Medium confidence (80-98%) → LLM enhancement
   - Low confidence (<80%) → Human-in-the-Loop

2. **Processing Pipeline**:
   - Document upload → Classification → OCR → Quality gate routing → Validation → Storage

3. **Frontend**: React 18 PWA with offline support, real-time updates

4. **AI/ML Components**:
   - OCR: Tesseract (free) + Google Cloud Vision (optional)
   - LLM: Claude 3.5 Sonnet (Anthropic)
   - Classification: MobileNetV2

5. **Security**: JWT authentication, RBAC, encryption at rest and in transit

### Key Differences

| Aspect | PoC1 (Microservices) | PoC2 (Serverless) |
|--------|---------------------|-------------------|
| **Scaling** | Manual (HPA) | Automatic (instant) |
| **Cost (1K docs/day)** | $1,128/month | $226/month |
| **Cold Start** | None | 1-3s (mitigable) |
| **Infrastructure** | Self-managed | AWS-managed |
| **Message Queue** | BullMQ (Redis) | EventBridge |
| **Orchestration** | Kubernetes | Step Functions |
| **Database** | PostgreSQL 14 | Aurora Serverless v2 |
| **Cache** | Redis 7 | ElastiCache Serverless |

---

## 💻 Getting Started

### Prerequisites

- **Node.js** 20.x
- **Python** 3.11+
- **Docker** (for PoC1) or **AWS CLI** (for PoC2)
- **Git**

### Quick Start - PoC1 (Microservices)

```bash
# Clone repository
git clone https://github.com/learning-yogi/platform.git
cd platform/PoCImplementation1

# Start all services with Docker Compose
docker-compose up -d

# Access frontend
open http://localhost:3000

# View logs
docker-compose logs -f api
```

**See**: [PoCImplementation1/README.md](./PoCImplementation1/README.md) for detailed setup

### Quick Start - PoC2 (Serverless)

```bash
# Clone repository
git clone https://github.com/learning-yogi/platform.git
cd platform/PoCImplementation2

# Install dependencies
cd backend/lambda-nodejs && npm install
cd ../lambda-python && pip install -r requirements.txt

# Configure AWS credentials
aws configure

# Deploy to AWS
sam build
sam deploy --guided

# Access API
curl https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dev/health
```

**See**: [PoCImplementation2/README.md](./PoCImplementation2/README.md) for detailed setup

---

## 🧪 Testing

Both implementations follow **Test-Driven Development (TDD)** with comprehensive test suites.

### PoC1 Testing

**Node.js (Jest)**:
```bash
cd PoCImplementation1/backend/nodejs
npm test -- --coverage
```

**Python (Pytest)**:
```bash
cd PoCImplementation1/backend/python
pytest --cov=src --cov-report=html
```

**Coverage Targets**: 85%+

### PoC2 Testing

**Node.js Lambda (Jest)**:
```bash
cd PoCImplementation2/backend/lambda-nodejs
npm test -- --coverage
```

**Python Lambda (Pytest)**:
```bash
cd PoCImplementation2/backend/lambda-python
pytest --cov=src
```

**Coverage Targets**: 85%+

---

## 📊 Cost Analysis

### At 1,000 Documents/Day

| Cost Component | PoC1 (Microservices) | PoC2 (Serverless) |
|----------------|---------------------|-------------------|
| **Compute** | $336 (EKS nodes) | $11 (Lambda) |
| **Database** | $175 (RDS) | $175 (Aurora Serverless) |
| **Cache** | $62 (ElastiCache) | $1 (ElastiCache Serverless) |
| **Message Queue** | Included in Redis | $8 (EventBridge) |
| **API Gateway** | $15 (ALB) | $1 (API Gateway) |
| **Storage** | $10 (S3) | $2 (S3) |
| **Monitoring** | $80 (Prometheus + Grafana) | $10 (CloudWatch) |
| **External APIs** | $18 | $18 |
| **Load Balancer** | $432 | - |
| **Total** | **$1,128/month** | **$226/month** |
| **Per Document** | **$0.038** | **$0.0075** |
| **With AI Chatbot (opt)** | **+$40/month** | **+$7/month** |
| **Total w/ Chatbot** | **$1,168** | **$233** |

**Breakeven Point**: PoC1 becomes cheaper at ~10,000 docs/day due to economies of scale

**3-Year TCO**:
- PoC1: $65,628
- PoC2: $27,880
- **Savings with PoC2**: $37,748 (57% cheaper)

**See**: [POC1VSPOC2.md](./POC1VSPOC2.md) for detailed cost analysis at different scales

---

## 🎯 Key Features

### Document Processing

- **Multi-format support**: PDF, PNG, JPG, JPEG
- **File size limit**: 50 MB per document
- **OCR engines**: Tesseract (free), Google Cloud Vision (paid, optional)
- **LLM enhancement**: Claude 3.5 Sonnet for low-confidence OCR
- **Batch processing**: Multiple documents simultaneously

### Quality Assurance

- **3-tier quality gates**: Automatic routing based on confidence scores
- **Validation rules**: Data integrity checks, time conflict detection
- **Human-in-the-Loop**: Manual review for low-confidence results
- **Version history**: Track all changes to timetables

### User Experience

- **Progressive Web App**: Install on any device, works offline
- **Real-time updates**: WebSocket notifications for processing status
- **Drag-and-drop upload**: Intuitive file upload
- **Mobile-first design**: Optimized for teachers using phones/tablets
- **Accessibility**: WCAG 2.1 AA compliant

### AI Chatbot Integration (Optional)

- **Context-aware assistant**: Understands document status and timetable data
- **Multiple AI providers**: Claude, OpenAI, Local LLM support with automatic fallback
- **Extensible knowledge base**: Custom FAQ and help content
- **Session management**: Conversation history and continuity
- **Integration modes**: Docker microservice or React component

**See**: [AIChatbot Plugin Documentation](./AIChatbot/README.md)

### Security

- **Authentication**: JWT tokens with refresh mechanism
- **Authorization**: Role-based access control (RBAC)
- **Encryption**: TLS 1.3 in transit, AES-256 at rest
- **Data privacy**: GDPR compliant, user data isolation
- **API rate limiting**: Prevent abuse

---

## 📂 Repository Structure

```
LearningYogi/
├── PoCImplementation1/              # Microservices Architecture
│   ├── backend/
│   │   ├── nodejs/                  # Node.js API layer (NestJS)
│   │   │   ├── src/
│   │   │   │   ├── services/        # Business logic
│   │   │   │   └── controllers/     # HTTP controllers
│   │   │   └── tests/               # Jest tests
│   │   └── python/                  # Python processing services
│   │       ├── src/
│   │       │   ├── ocr/             # OCR processor
│   │       │   ├── llm/             # LLM processor
│   │       │   └── workers/         # Background workers
│   │       └── tests/               # Pytest tests
│   ├── frontend/
│   │   └── react/                   # React PWA
│   ├── infrastructure/
│   │   ├── kubernetes/              # K8s manifests
│   │   └── terraform/               # IaC (optional)
│   ├── docker-compose.yml
│   └── docs/                        # Documentation
│
├── PoCImplementation2/              # Serverless Architecture
│   ├── backend/
│   │   ├── lambda-nodejs/           # Node.js Lambda functions
│   │   │   ├── src/
│   │   │   │   ├── handlers/        # Lambda handlers
│   │   │   │   └── services/        # Business logic
│   │   │   └── tests/               # Jest tests
│   │   └── lambda-python/           # Python Lambda functions
│   │       ├── src/
│   │       │   ├── handlers/        # Lambda handlers
│   │       │   └── processors/      # OCR, LLM processors
│   │       └── tests/               # Pytest tests
│   ├── frontend/
│   │   └── react/                   # React PWA (same as PoC1)
│   ├── infrastructure/
│   │   ├── template.yaml            # AWS SAM template
│   │   └── serverless.yml           # Serverless Framework (alt)
│   ├── samconfig.toml
│   └── docs/                        # Documentation
│
├── AIChatbot/                       # AI Chatbot Plugin
│   ├── backend/python/              # FastAPI chatbot service
│   ├── frontend/                    # React components
│   ├── config/                      # Knowledge base
│   └── integration/                 # Integration guides
│
├── requirements/                    # Original requirements from client
│   └── sample-timetables/           # Sample input images
├── docs/                            # Shared documentation
├── POC1VSPOC2.md                    # Comparison guide
└── README.md                        # This file
```

---

## 🛣️ Roadmap to Production

### PoC1 (Microservices) - 5-6 Months

**Phase 1 (Weeks 1-4)**: Foundation
- Database schema, authentication, CI/CD pipeline

**Phase 2 (Weeks 5-8)**: Processing Pipeline
- OCR, LLM, classification services

**Phase 3 (Weeks 9-12)**: Frontend & UX
- React PWA, user workflows

**Phase 4 (Weeks 13-16)**: Testing & Quality
- Load testing, security audit

**Phase 5 (Weeks 17-20)**: Production Deployment
- Kubernetes setup, monitoring

**Phase 6 (Weeks 21-24)**: Optimization
- Performance tuning, cost optimization

**See**: [PoCImplementation1/docs/ROADMAP.md](./PoCImplementation1/docs/ROADMAP.md)

### PoC2 (Serverless) - 2-4 Weeks

**Week 1**: AWS setup, Lambda functions, SAM deployment
**Week 2**: Frontend integration, testing, monitoring
**Week 3**: Security hardening, load testing
**Week 4**: Production deployment, documentation

**Faster timeline** due to managed services handling infrastructure

---

## 🤝 Contributing

This is a proof-of-concept implementation. For production use:

1. Review security configurations
2. Adjust rate limits and quotas
3. Configure custom domains
4. Set up proper monitoring and alerting
5. Implement backup and disaster recovery
6. Add comprehensive logging

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🆘 Support

- **Documentation**: See respective PoC folders for detailed docs
- **Issues**: Report bugs via GitHub Issues
- **Email**: support@learningyogi.com (example)

---

## 🎓 About Learning Yogi

Learning Yogi simplifies administrative tasks for teachers by automating timetable digitization. Teachers can upload images of their timetables and instantly get structured digital formats compatible with calendars, scheduling tools, and school management systems.

**Built with ❤️ using modern technologies and TDD best practices**

**Version**: 1.0.0
**Last Updated**: 2025-01-01
**Status**: Production-Ready PoCs

# Implementation 1: Microservices Queue-based Architecture

## Quick Overview

**Architecture Type**: Traditional Microservices with Message Queues
**Best For**: Predictable high volume, teams with DevOps expertise, full control requirements
**Cost at 1,000 docs/day**: ~$1,128/month (~$0.038/document)
**Cost at 10,000 docs/day**: ~$2,080/month (~$0.0069/document)

---

## Documentation Structure

This implementation consists of the following comprehensive documents:

### 1. ARCHITECTURE.md
**Complete system design and technical architecture**

**Contents**:
- Detailed architecture diagram
- Service breakdown (11 microservices)
- Data flow diagrams
- Technology stack justification
- Scalability strategy
- Monitoring and observability
- Cost analysis

**Read Time**: 45-60 minutes
**Audience**: Technical Architects, Senior Developers, DevOps

**Key Sections**:
- API Gateway / Load Balancer setup
- Backend services (Node.js)
- Processing services (Python)
- Message queue architecture (BullMQ)
- Database layer (PostgreSQL, Redis, TimescaleDB)

---

### 2. DATABASE-SCHEMA.md
**Complete database design with schemas and optimization strategies**

**Contents**:
- PostgreSQL table definitions
- Entity relationship diagrams
- Indexes and optimization
- Redis caching patterns
- TimescaleDB for analytics
- Migration strategy

**Read Time**: 30-40 minutes
**Audience**: Backend Developers, Database Architects

**Key Tables**:
- `users` - User accounts and authentication
- `timetables` - Timetable metadata
- `timeblocks` - Individual timetable events
- `documents` - Uploaded documents
- `processing_jobs` - Processing pipeline tracking
- `hitl_tasks` - Human-in-the-loop tasks

---

### 3. API-SPECIFICATION.md
**RESTful API documentation with examples**

**Contents**:
- All API endpoints with request/response examples
- Authentication flow (JWT)
- Error handling and codes
- WebSocket API for real-time updates
- Rate limiting policies
- Pagination strategies

**Read Time**: 45-60 minutes
**Audience**: Frontend Developers, Backend Developers, QA Engineers

**API Groups**:
- Authentication API (`/api/v1/auth/*`)
- Documents API (`/api/v1/documents/*`)
- Jobs API (`/api/v1/jobs/*`)
- Timetables API (`/api/v1/timetables/*`)
- Timeblocks API (`/api/v1/timeblocks/*`)
- HITL API (`/api/v1/hitl/*`)

---

### 4. TESTING-STRATEGY.md
**Test-Driven Development (TDD) approach and comprehensive testing guide**

**Contents**:
- TDD philosophy and workflow
- Test pyramid (unit, integration, E2E)
- Testing tools and frameworks
- Code examples and patterns
- CI/CD integration
- Coverage targets

**Read Time**: 45-60 minutes
**Audience**: All Developers, QA Engineers

**Coverage Targets**:
- Unit Tests: 85% coverage
- Integration Tests: 70% coverage
- E2E Tests: Critical paths only
- Overall: 80%+ coverage

---

## Technology Stack

### Backend Services (Node.js)

| Service | Technology | Purpose |
|---------|------------|---------|
| API Gateway | NGINX | Load balancing, SSL termination |
| Auth Service | Node.js + Express + Passport | User authentication |
| BFF Service | Node.js + NestJS | REST API for frontend |
| WebSocket Server | Node.js + Socket.io | Real-time notifications |
| Validation Service | Node.js + Zod | Data validation |

### Processing Services (Python)

| Service | Technology | Purpose |
|---------|------------|---------|
| Classification Service | Python + FastAPI + ML | Document type detection |
| Preprocessing Service | Python + OpenCV | Image enhancement |
| OCR Service | Python + Tesseract + Google CV | Text extraction |
| LLM Service | Python + Anthropic SDK | Complex document parsing |

### Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| Container Runtime | Docker | Service containerization |
| Orchestration | Kubernetes | Container orchestration |
| Message Queue | BullMQ (Redis) | Asynchronous processing |
| Database | PostgreSQL | Transactional data |
| Cache | Redis Cluster | Caching and sessions |
| Time-series DB | TimescaleDB | Metrics and analytics |
| Object Storage | S3 / GCS / Azure Blob | Document storage |
| Monitoring | Prometheus + Grafana | Metrics and dashboards |
| Logging | ELK Stack | Log aggregation |
| Tracing | Jaeger | Distributed tracing |

---

## Architecture Highlights

### Advantages

1. **No Cold Starts**: Services always warm, consistent low latency (<100ms)
2. **Full Control**: Fine-grained resource allocation and tuning
3. **Cost at Scale**: Most cost-effective at high volume (>5,000 docs/day)
4. **No Time Limits**: Support for long-running tasks (>15 minutes)
5. **Vendor Independent**: Deploy on any cloud or on-premises
6. **Predictable Performance**: No surprises, consistent behavior
7. **Better Debugging**: Direct access to services and logs

### Trade-offs

1. **Higher Operational Overhead**: Kubernetes management, patching, upgrades
2. **Slower to Scale**: Takes 2-5 minutes to add capacity
3. **Higher Minimum Cost**: Base infrastructure cost even at low usage
4. **Complex Setup**: Requires 6-8 weeks for initial deployment
5. **DevOps Expertise**: Need experienced team for maintenance

---

## Key Design Patterns

### 1. Queue-based Processing

```
Upload → Classification Queue → Preprocessing Queue → OCR Queue →
  LLM Queue (conditional) → Validation Queue → Notification Queue
```

**Benefits**:
- Decoupled services
- Automatic retry and error handling
- Priority-based processing
- Backpressure handling

### 2. Tiered OCR Strategy

```
Tesseract (free, fast) → Google Cloud Vision (paid, accurate) →
  Claude 3.5 Sonnet (expensive, handles complex) → HITL (manual)
```

**Cost Optimization**:
- 70% use Tesseract (free)
- 20% use Google Cloud Vision ($1.50/1000)
- 10% use Claude or HITL

### 3. Caching Strategy

```
Document Hash → Redis Cache (30 days)
  Cache Hit: Return cached result (<10ms)
  Cache Miss: Process → Cache → Return
```

**Cache Hit Rate Target**: >80%

---

## Deployment Architecture

### Production Environment

```
┌─────────────────┐
│   CloudFlare    │  ← CDN, DDoS protection
└────────┬────────┘
         │
┌────────▼────────┐
│  NGINX (ALB)    │  ← Load balancer, SSL termination
└────────┬────────┘
         │
┌────────▼────────────────────────┐
│   Kubernetes Cluster            │
│  ┌──────────┐  ┌──────────┐   │
│  │ Node.js  │  │ Python   │   │
│  │ Services │  │ Services │   │
│  │ (3-20    │  │ (5-50    │   │
│  │ replicas)│  │ workers) │   │
│  └──────────┘  └──────────┘   │
└─────────────────────────────────┘
         │
┌────────▼────────────────────────┐
│   Data Layer                    │
│  ┌──────────┐  ┌──────────┐   │
│  │PostgreSQL│  │  Redis   │   │
│  │ Primary +│  │ Cluster  │   │
│  │ Replicas │  │          │   │
│  └──────────┘  └──────────┘   │
└─────────────────────────────────┘
```

### High Availability

- **Multi-AZ Deployment**: Services across 3 availability zones
- **Auto-scaling**: Horizontal pod autoscaler for all services
- **Health Checks**: Liveness and readiness probes
- **Circuit Breakers**: Fail fast on external API failures
- **Graceful Degradation**: Fallback to lower-tier processing

---

## Getting Started

### Prerequisites

- Kubernetes cluster (AWS EKS / GKE / AKS / self-hosted)
- Helm 3.x
- kubectl configured
- Docker for building images
- Terraform or equivalent for IaC

### Quick Setup (Development)

```bash
# 1. Clone repository
git clone <repo-url>
cd learning-yogi

# 2. Start local environment with Docker Compose
docker-compose up -d

# 3. Run database migrations
npm run db:migrate

# 4. Start services
npm run dev

# 5. Open browser
open http://localhost:3000
```

### Production Deployment

```bash
# 1. Provision infrastructure with Terraform
cd terraform/
terraform init
terraform apply

# 2. Deploy services with Helm
helm install learning-yogi ./helm-charts/learning-yogi

# 3. Verify deployment
kubectl get pods -n learning-yogi
```

---

## Monitoring & Observability

### Dashboards

Access monitoring at: `https://grafana.your-domain.com`

**Key Dashboards**:
- **System Overview**: CPU, memory, network, disk
- **Application Metrics**: Request rate, latency, error rate
- **Processing Pipeline**: Queue depth, processing time, success rate
- **Business Metrics**: Documents processed, cost per document, user activity

### Alerts

**Critical Alerts** (PagerDuty):
- Service down
- Database connection failure
- Error rate >5%
- Queue depth >1000 (sustained 5 min)

**Warning Alerts** (Slack/Email):
- High latency (p95 >1s)
- Cache hit rate <80%
- Disk space <20%

---

## Performance Benchmarks

| Metric | Target | Typical |
|--------|--------|---------|
| API Response (GET) | <100ms | 50-80ms |
| API Response (POST) | <200ms | 100-150ms |
| Document Classification | <1s | 500-800ms |
| OCR Processing | <3s | 1-2s |
| LLM Processing | <10s | 3-7s |
| End-to-End (OCR path) | <10s | 5-8s |
| End-to-End (LLM path) | <20s | 15-18s |

---

## Cost Breakdown

### Monthly Costs at 1,000 Documents/Day

| Component | Cost | Notes |
|-----------|------|-------|
| Kubernetes Cluster | $700 | 3 nodes, 8 vCPU, 32GB RAM each |
| PostgreSQL RDS | $150 | db.t3.large |
| Redis Cluster | $80 | cache.t3.medium |
| S3 Storage | $50 | 100GB + requests |
| Load Balancer | $20 | Application Load Balancer |
| Monitoring | $50 | CloudWatch, logs |
| External APIs | $78 | Google Vision + Claude |
| **Total** | **$1,128** | **~$0.038/document** |

### Scaling Costs

- **At 10,000 docs/day**: ~$2,080/month ($0.0069/doc)
- **At 100,000 docs/day**: ~$11,450/month ($0.0038/doc)
- **Breakeven with Impl 2**: ~500,000 docs/day

---

## Migration Path

### From Serverless (Implementation 2) to Microservices

**When**: Volume exceeds 5,000 documents/day consistently

**Timeline**: 2-3 months

**Steps**:
1. Setup Kubernetes cluster
2. Migrate database (Aurora Serverless → PostgreSQL RDS)
3. Convert Lambda functions to containerized services
4. Replace EventBridge with BullMQ queues
5. Setup monitoring (Prometheus + Grafana)
6. Gradual traffic migration
7. Decommission serverless resources

**Risk**: Moderate (architecture change, different patterns)

---

## Team Requirements

### Roles Needed

| Role | Quantity | Responsibilities |
|------|----------|------------------|
| Technical Architect | 1 | Overall system design, decision making |
| Backend Developer (Node.js) | 2-3 | API services, BFF, WebSocket |
| Backend Developer (Python) | 2-3 | Processing services, ML integration |
| Frontend Developer | 2 | React PWA, UI components |
| DevOps Engineer | 1-2 | Kubernetes, CI/CD, monitoring |
| QA Engineer | 1-2 | Testing, automation |
| Product Manager | 1 | Requirements, roadmap |

### Skills Required

**Must Have**:
- Node.js and Python proficiency
- RESTful API design
- PostgreSQL and Redis
- Docker containerization
- Git version control

**Nice to Have**:
- Kubernetes experience
- Message queue patterns (BullMQ, RabbitMQ)
- Microservices architecture
- Prometheus and Grafana
- ML/AI integration

---

## FAQ

### Q: Why Kubernetes instead of simpler container orchestration?

**A**: Kubernetes provides battle-tested auto-scaling, self-healing, and extensive ecosystem. For production microservices at scale, it's the industry standard. For smaller deployments, Docker Swarm or AWS ECS could work, but migration to Kubernetes is easier from the start.

### Q: Why BullMQ instead of RabbitMQ or Kafka?

**A**: BullMQ is Redis-based, simpler to operate, and sufficient for our use case. RabbitMQ is more complex, Kafka is overkill (we don't need event streaming). BullMQ provides priority queues, delayed jobs, and good Node.js integration.

### Q: Can we deploy on-premises?

**A**: Yes! This architecture is cloud-agnostic. Replace AWS S3 with MinIO, and deploy Kubernetes on-premises. All components can run on-premises or in a private data center.

### Q: What if we don't have DevOps expertise?

**A**: Consider Implementation 2 (Serverless) instead, which requires minimal DevOps. Alternatively, hire a DevOps engineer or use managed Kubernetes (EKS, GKE, AKS) to reduce complexity.

### Q: How do we handle database migrations?

**A**: Use Flyway or Prisma Migrate for versioned database migrations. Migrations run automatically during deployment. Rollback plan is always prepared.

---

## Support

### Documentation

- **Architecture**: ARCHITECTURE.md
- **Database**: DATABASE-SCHEMA.md
- **API**: API-SPECIFICATION.md
- **Testing**: TESTING-STRATEGY.md
- **Comparison**: ../IMPLEMENTATION-COMPARISON.md

### References

- Kubernetes Docs: https://kubernetes.io/docs
- BullMQ Docs: https://docs.bullmq.io
- PostgreSQL Docs: https://www.postgresql.org/docs
- NestJS Docs: https://docs.nestjs.com

---

**Last Updated**: 2024-10-31
**Version**: 1.0

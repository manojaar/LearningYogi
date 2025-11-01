# Implementation 2: Serverless Event-driven Architecture

## Quick Overview

**Architecture Type**: Serverless with Event-driven Processing
**Best For**: Variable load, limited DevOps resources, fast time-to-market
**Cost at 1,000 docs/day**: ~$226/month (~$0.0075/document)
**Cost at 10,000 docs/day**: ~$795/month (~$0.0027/document)

---

## Documentation Structure

This implementation shares most documentation with Implementation 1, with serverless-specific architecture:

### 1. ARCHITECTURE.md
**Serverless system design and event-driven architecture**

**Contents**:
- Serverless architecture diagram
- Lambda function breakdown
- Event-driven flow (EventBridge + Step Functions)
- Auto-scaling characteristics
- Cost optimization strategies
- Monitoring with CloudWatch

**Read Time**: 45-60 minutes
**Audience**: Technical Architects, Cloud Developers, Serverless Engineers

**Key Components**:
- AWS Lambda functions (Node.js & Python)
- API Gateway (REST + WebSocket)
- EventBridge event bus
- Step Functions workflows
- Aurora Serverless v2

---

### 2. DATABASE-SCHEMA.md
**References Implementation 1 schema**

**Note**: Database schema is identical to Implementation 1. The only difference is:
- **Implementation 1**: PostgreSQL (RDS or self-hosted)
- **Implementation 2**: Aurora Serverless v2 (PostgreSQL-compatible)

**See**: `../implementation1/DATABASE-SCHEMA.md`

---

### 3. API-SPECIFICATION.md
**References Implementation 1 API spec**

**Note**: REST API is identical to Implementation 1. Both implementations expose the same API contracts to maintain frontend compatibility.

**See**: `../implementation1/API-SPECIFICATION.md`

**Differences**:
- Implementation 1: NGINX → Node.js services
- Implementation 2: API Gateway → Lambda functions

---

### 4. TESTING-STRATEGY.md
**Serverless testing approach with SAM Local and mocking**

**Contents**:
- TDD approach for serverless
- Lambda-specific testing patterns
- Mocking AWS services
- Integration testing with SAM Local
- E2E testing with staging environment

**Read Time**: 30-40 minutes
**Audience**: All Developers, QA Engineers

**Differences from Implementation 1**:
- More mocking required (AWS services)
- SAM Local for local testing
- Testcontainers for integration tests

---

## Technology Stack

### Compute (AWS Lambda)

| Function | Runtime | Memory | Timeout | Purpose |
|----------|---------|--------|---------|---------|
| Auth Handler | Node.js 20 | 256 MB | 10s | User authentication |
| Documents API | Node.js 20 | 512 MB | 30s | Document management |
| Document Classifier | Python 3.11 | 1024 MB | 60s | ML-based classification |
| Preprocessor | Python 3.11 | 2048 MB | 5min | Image enhancement |
| OCR Processor | Python 3.11 | 2048 MB | 5min | Text extraction |
| LLM Processor | Python 3.11 | 512 MB | 2min | Claude API integration |
| Validator | Node.js 20 | 512 MB | 30s | Data validation |
| WebSocket Handler | Node.js 20 | 256 MB | 10s | Real-time notifications |

### Managed Services

| Service | Purpose | Why |
|---------|---------|-----|
| API Gateway | REST + WebSocket APIs | Fully managed, auto-scaling |
| EventBridge | Event bus | Loose coupling, event routing |
| Step Functions | Workflow orchestration | Visual workflows, error handling |
| Aurora Serverless v2 | PostgreSQL database | Auto-scaling, pay-per-use |
| ElastiCache Serverless | Redis cache | Auto-scaling cache |
| S3 | Object storage | Scalable, durable |
| DynamoDB | WebSocket connections | Single-digit ms latency |
| CloudWatch | Monitoring & logging | Built-in, integrated |
| X-Ray | Distributed tracing | Serverless-native tracing |

---

## Architecture Highlights

### Advantages

1. **Zero Operational Overhead**: No servers to manage, patch, or maintain
2. **Instant Auto-scaling**: Scale from 0 to 1000+ requests in seconds
3. **Cost at Low Volume**: Pay only for execution, 5x cheaper at 1,000 docs/day
4. **Fast Time-to-Market**: Deploy in 2-4 weeks vs. 6-8 weeks
5. **Built-in HA**: Multi-AZ by default, 99.95% SLA from AWS
6. **Global Reach**: Easy multi-region deployment
7. **Integrated Monitoring**: CloudWatch and X-Ray out-of-the-box

### Trade-offs

1. **Cold Start Latency**: 1-5s for first invocation (mitigable)
2. **Vendor Lock-in**: AWS-specific, harder to migrate
3. **Execution Time Limits**: 15 minutes max per Lambda
4. **Debugging Complexity**: Distributed, async, requires tracing
5. **Cost at Very High Scale**: Can become expensive >100K docs/day
6. **Less Control**: Limited control over underlying infrastructure

---

## Key Design Patterns

### 1. Event-driven Processing

```
S3 Upload Event → EventBridge → Lambda (Classifier) →
  EventBridge → Lambda (Preprocessor) → EventBridge →
  Lambda (OCR) → EventBridge → Lambda (Validator)
```

**Benefits**:
- Loose coupling between functions
- Easy to add new consumers
- Automatic retry and DLQ
- Event replay for debugging

### 2. Step Functions Workflow

```yaml
Start → Classify → Choice (Image/PDF/DOCX) → Preprocess →
  OCR → Choice (Confidence) → LLM (conditional) → Validate →
  Save → Notify → End
```

**Benefits**:
- Visual workflow representation
- Built-in error handling and retry
- State persistence across functions
- Execution history for debugging

### 3. Pre-signed URL Upload

```javascript
Client → API Gateway → Lambda (Generate Pre-signed URL) → Client
Client → S3 (Direct Upload via Pre-signed URL)
S3 → EventBridge Event → Lambda (Processing)
```

**Benefits**:
- Bypass Lambda payload limits (6 MB)
- Reduce Lambda execution time
- Better upload performance

---

## Cold Start Mitigation

### Problem
- Cold start: 1-5s for first invocation
- Affects user experience for latency-sensitive APIs

### Solutions

**1. Provisioned Concurrency** (for critical functions)
```yaml
AuthHandler:
  ProvisionedConcurrency: 5  # Keep 5 instances warm
```
- **Cost**: ~$0.015/GB-hour per instance
- **Use for**: Auth, Document Upload APIs
- **Savings**: Eliminate cold starts for these functions

**2. Lambda SnapStart** (Java only)
```yaml
# Not applicable for Node.js/Python
# Use for future Java-based functions
```

**3. Scheduled Warming** (ping every minute)
```yaml
Schedule: rate(1 minute)
Target: AuthHandler
Payload: { "warmup": true }
```
- **Cost**: ~$5/month
- **Use for**: Less critical functions

**4. Function Optimization**
- Minimize dependencies
- Use Lambda layers for shared code
- Reduce package size
- Initialize connections outside handler

---

## Deployment Architecture

### Production Environment

```
┌─────────────────┐
│   CloudFront    │  ← CDN for React app
└────────┬────────┘
         │
┌────────▼────────────────────────┐
│   API Gateway                   │
│  ┌──────────┐  ┌──────────┐   │
│  │ REST API │  │WebSocket │   │
│  └──────────┘  └──────────┘   │
└────────┬────────────────────────┘
         │
┌────────▼────────────────────────┐
│   Lambda Functions              │
│  ┌──────────┐  ┌──────────┐   │
│  │ Node.js  │  │ Python   │   │
│  │ (API)    │  │(Process) │   │
│  └──────────┘  └──────────┘   │
└─────────────────────────────────┘
         │
┌────────▼────────────────────────┐
│   EventBridge / Step Functions  │
│  (Workflow Orchestration)       │
└─────────────────────────────────┘
         │
┌────────▼────────────────────────┐
│   Data Layer                    │
│  ┌──────────┐  ┌──────────┐   │
│  │  Aurora  │  │ElastiCache│   │
│  │Serverless│  │Serverless │   │
│  └──────────┘  └──────────┘   │
└─────────────────────────────────┘
```

### Multi-Region Deployment

```
┌─────────────────────────────────┐
│   Route 53 (DNS)                │
│   - Geolocation routing         │
└────────┬────────────────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐  ┌────────┐
│ US-EAST│  │ EU-WEST│
│ Region │  │ Region │
└────────┘  └────────┘
```

**Benefits**:
- Lower latency for global users
- Disaster recovery
- Compliance (data residency)

---

## Getting Started

### Prerequisites

- AWS Account with admin access
- AWS CLI configured
- Node.js 20.x
- Python 3.11
- SAM CLI (for local testing)
- Terraform or AWS CDK

### Quick Setup (Development)

```bash
# 1. Clone repository
git clone <repo-url>
cd learning-yogi

# 2. Install dependencies
npm install
pip install -r requirements.txt

# 3. Start local environment with SAM
sam local start-api --docker-network host

# 4. Start local DynamoDB and Redis
docker-compose -f docker-compose.local.yml up -d

# 5. Open browser
open http://localhost:3000
```

### Production Deployment

```bash
# Using AWS CDK
cd cdk/
npm install
cdk bootstrap
cdk deploy --all

# Or using Terraform
cd terraform/
terraform init
terraform apply
```

**Deployment Time**: ~10-15 minutes for full stack

---

## Monitoring & Observability

### CloudWatch Dashboards

Access at: AWS Console → CloudWatch → Dashboards

**Key Dashboards**:
- **Lambda Metrics**: Invocations, duration, errors, throttles
- **API Gateway**: Request count, latency, 4xx/5xx errors
- **Step Functions**: Executions, success/failure rate
- **Database**: Aurora ACU utilization, connections, query latency

### X-Ray Tracing

**View at**: AWS Console → X-Ray → Traces

**Use Cases**:
- End-to-end request tracing
- Identify bottlenecks
- Debug errors across functions
- Optimize cold starts

### Alerts

**CloudWatch Alarms** → **SNS** → **Email/Slack/PagerDuty**

**Critical Alarms**:
- Lambda error rate >5%
- API Gateway 5xx >1%
- Step Functions execution failures
- Aurora ACU maxed out (16 ACU)

**Warning Alarms**:
- Lambda duration >3s (p95)
- API Gateway latency >500ms (p95)
- Lambda throttles >10/min

---

## Performance Benchmarks

| Metric | Target | Typical (Warm) | Typical (Cold) |
|--------|--------|----------------|----------------|
| API Response (GET) | <200ms | 100-150ms | 1-2s (first call) |
| API Response (POST) | <300ms | 150-250ms | 1-3s (first call) |
| Document Classification | <2s | 800-1200ms | 2-4s |
| OCR Processing | <5s | 1-3s | 3-6s |
| LLM Processing | <15s | 3-10s | 5-12s |
| End-to-End (OCR path) | <15s | 8-12s | 12-18s |
| End-to-End (LLM path) | <30s | 18-25s | 25-35s |

**Note**: Cold starts primarily affect first invocation after 5+ minutes of inactivity. Mitigate with provisioned concurrency for critical functions.

---

## Cost Breakdown

### Monthly Costs at 1,000 Documents/Day (30,000/month)

| Component | Cost | Notes |
|-----------|------|-------|
| Lambda (Compute) | $11 | 450K invocations, avg 3s, 512MB |
| API Gateway | $1 | 500K requests |
| EventBridge + Step Functions | $8 | 30K workflows, 10 transitions each |
| Aurora Serverless v2 | $175 | Avg 2 ACU, 720 hours |
| ElastiCache Serverless | $1 | 5 GB storage, 10M ECPU |
| S3 Storage | $2 | 100 GB + requests |
| CloudWatch | $10 | Logs, metrics, alarms |
| External APIs | $18 | Google Vision + Claude |
| **Total** | **$226** | **~$0.0075/document** |

### Scaling Costs

- **At 10,000 docs/day**: ~$795/month ($0.0027/doc)
- **At 100,000 docs/day**: ~$5,350/month ($0.0018/doc)
- **Breakeven with Impl 1**: ~500,000 docs/day

---

## Migration Path

### From Microservices (Implementation 1) to Serverless

**When**: Want to reduce operational overhead, variable load

**Timeline**: 3-4 months

**Steps**:
1. Setup AWS infrastructure (API Gateway, Lambda, etc.)
2. Convert services to Lambda functions
3. Replace BullMQ with EventBridge events
4. Migrate database (PostgreSQL → Aurora Serverless)
5. Setup CloudWatch monitoring
6. Gradual traffic migration
7. Decommission Kubernetes cluster

**Risk**: High (significant architecture change)

---

## Team Requirements

### Roles Needed

| Role | Quantity | Responsibilities |
|------|----------|------------------|
| Technical Architect | 1 | Serverless architecture, AWS services |
| Cloud Developer (Node.js) | 2 | Lambda functions (API layer) |
| Cloud Developer (Python) | 2 | Lambda functions (processing) |
| Frontend Developer | 2 | React PWA, API integration |
| Cloud Engineer | 1 | Infrastructure as Code (CDK/Terraform) |
| QA Engineer | 1-2 | Testing, SAM Local, staging |
| Product Manager | 1 | Requirements, roadmap |

### Skills Required

**Must Have**:
- Node.js and Python proficiency
- AWS Lambda experience
- RESTful API design
- Infrastructure as Code (Terraform or CDK)
- Git version control

**Nice to Have**:
- AWS Certified Developer or Solutions Architect
- Serverless Framework or SAM experience
- Event-driven architecture patterns
- Step Functions workflows
- CloudWatch and X-Ray

---

## FAQ

### Q: How do we handle cold starts?

**A**:
1. Use Provisioned Concurrency for critical functions (Auth, Document Upload)
2. Optimize function size and dependencies
3. Keep functions warm with scheduled pings (optional)
4. Accept 1-2s latency for less critical functions

**Cost**: Provisioned Concurrency adds ~$20-50/month for 5 instances

---

### Q: What if a task needs more than 15 minutes?

**A**:
1. **Best**: Break into smaller functions (most tasks <15min)
2. **Alternative**: Use ECS Fargate for long-running tasks
3. **Workaround**: Chain multiple Step Functions executions

**Reality**: In this use case, no task exceeds 15 minutes.

---

### Q: Can we deploy on-premises?

**A**: No, serverless is cloud-specific. Consider Implementation 1 for on-premises or hybrid cloud.

**Alternative**: Use OpenFaaS or Knative on Kubernetes for serverless-like experience on-premises.

---

### Q: How do we test Lambda functions locally?

**A**:
1. **SAM Local**: Emulate Lambda + API Gateway locally
2. **LocalStack**: Mock AWS services
3. **Unit Tests**: Test business logic separately
4. **Integration Tests**: Use Testcontainers for dependencies

```bash
# Start SAM Local
sam local start-api --docker-network host

# Invoke specific function
sam local invoke AuthHandler --event events/login.json
```

---

### Q: What about vendor lock-in?

**A**: Serverless is inherently AWS-specific. To mitigate:
1. **Abstract**: Hide AWS-specific code behind interfaces
2. **IaC**: Use Terraform (cloud-agnostic) instead of CDK
3. **Accept**: For this architecture, vendor lock-in is a trade-off for simplicity

**Reality**: Migration to GCP Cloud Functions or Azure Functions is possible but requires refactoring (1-2 months).

---

### Q: How do we handle database connections in Lambda?

**A**:
1. **RDS Proxy**: Manage connections between Lambda and Aurora
2. **Connection Reuse**: Store connection in global scope
3. **Aurora Serverless v2**: Better handling of many connections

```javascript
// Reuse connection across invocations
let dbClient;

exports.handler = async (event) => {
  if (!dbClient) {
    dbClient = await createDbClient();
  }
  // Use dbClient
};
```

---

## Support

### Documentation

- **Architecture**: ARCHITECTURE.md
- **Database**: ../implementation1/DATABASE-SCHEMA.md
- **API**: ../implementation1/API-SPECIFICATION.md
- **Testing**: TESTING-STRATEGY.md
- **Comparison**: ../IMPLEMENTATION-COMPARISON.md

### AWS Resources

- AWS Lambda Docs: https://docs.aws.amazon.com/lambda
- API Gateway Docs: https://docs.aws.amazon.com/apigateway
- Step Functions Docs: https://docs.aws.amazon.com/step-functions
- Aurora Serverless Docs: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html

### Serverless Community

- Serverless Framework: https://www.serverless.com
- SAM CLI: https://docs.aws.amazon.com/serverless-application-model
- AWS CDK: https://aws.amazon.com/cdk

---

**Last Updated**: 2024-10-31
**Version**: 1.0

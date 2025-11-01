# PoC Implementation 2 - Serverless Architecture

## Executive Summary

This document provides a comprehensive architectural overview of the **serverless event-driven implementation** for the Learning Yogi timetable extraction platform. This architecture leverages AWS managed services to achieve instant auto-scaling with minimal operational overhead.

---

## Table of Contents

1. [Architecture Principles](#architecture-principles)
2. [System Context](#system-context)
3. [Component Architecture](#component-architecture)
4. [Lambda Functions](#lambda-functions)
5. [Event Flow & Orchestration](#event-flow--orchestration)
6. [Data Architecture](#data-architecture)
7. [Security Architecture](#security-architecture)
8. [Scalability & Performance](#scalability--performance)
9. [Monitoring & Observability](#monitoring--observability)
10. [Disaster Recovery](#disaster-recovery)

---

## Architecture Principles

### Core Principles

1. **Serverless-First**: No infrastructure management - AWS handles all servers
2. **Event-Driven**: Asynchronous processing with EventBridge orchestration
3. **Managed Services**: Prefer fully managed AWS services over self-managed
4. **Cost-Optimized**: Pay only for what you use, no idle resources
5. **Auto-Scaling**: Instant scaling from 0 to 1000+ concurrent executions
6. **High Availability**: Multi-AZ deployment by default
7. **Security by Design**: IAM least privilege, encryption at rest and in transit

### Design Patterns

- **Event-Driven Architecture**: EventBridge for service coordination
- **State Machine Pattern**: Step Functions for workflow orchestration
- **API Gateway Pattern**: Single entry point for all API requests
- **CQRS Pattern**: Separate read and write operations
- **Circuit Breaker**: Graceful degradation with exponential backoff

---

## System Context

### External Actors

```
┌─────────────────────────────────────────────────────────────────┐
│                         System Context                           │
└─────────────────────────────────────────────────────────────────┘

    [Teachers/Admin]
           │
           │ HTTPS
           ▼
    ┌──────────────┐
    │  CloudFront  │ ← Global CDN (React PWA)
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ API Gateway  │ ← REST + WebSocket APIs
    └──────┬───────┘
           │
           ▼
    ┌──────────────────────────────────────────┐
    │         AWS Lambda Functions              │
    │  (Event-driven Processing Pipeline)       │
    └──────┬───────────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────────────┐
    │     EventBridge + Step Functions          │
    │      (Workflow Orchestration)             │
    └──────┬───────────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────────────┐
    │          Data & Storage Layer             │
    │  - Aurora Serverless v2 (PostgreSQL)     │
    │  - ElastiCache Serverless (Redis)        │
    │  - S3 (Document Storage)                 │
    └──────────────────────────────────────────┘
```

### External Integrations

| Service | Purpose | Authentication |
|---------|---------|----------------|
| **Anthropic Claude API** | LLM-based timetable extraction | API Key |
| **Google Cloud Vision** | OCR fallback (optional) | Service Account |
| **AWS SES** | Email notifications | IAM Role |
| **Stripe** | Payment processing | API Key |

---

## Component Architecture

### Frontend Layer

**React PWA (CloudFront + S3)**

- **Deployment**: Static files in S3, served via CloudFront
- **Tech Stack**: React 18, TypeScript, Vite, TailwindCSS
- **Caching Strategy**:
  - Static assets: Cache-Control max-age=31536000 (1 year)
  - HTML: Cache-Control max-age=300 (5 minutes)
- **Features**:
  - Progressive Web App (offline support)
  - Real-time updates via WebSocket (API Gateway)
  - Optimistic UI updates
  - Image compression before upload

```
CloudFront Distribution
├── Origin: S3 Bucket (Static Website)
├── SSL Certificate: ACM
├── Custom Domain: app.learningyogi.com
├── Lambda@Edge: Security headers
└── Behaviors:
    ├── /static/* → Cache 1 year
    ├── /api/* → Origin API Gateway
    └── /* → Cache 5 minutes
```

---

### API Layer

**API Gateway (REST + WebSocket)**

#### REST API

```
API Gateway REST API
├── /api/v1/auth
│   ├── POST /login
│   ├── POST /register
│   └── POST /refresh-token
├── /api/v1/documents
│   ├── POST /upload
│   ├── GET /{documentId}
│   ├── GET /list
│   └── DELETE /{documentId}
├── /api/v1/timetables
│   ├── GET /{timetableId}
│   ├── PUT /{timetableId}
│   └── GET /list
└── /api/v1/users
    ├── GET /me
    └── PUT /me
```

**Authorizer**: Lambda authorizer with JWT validation

#### WebSocket API

```
API Gateway WebSocket API
├── $connect → ConnectionHandler Lambda
├── $disconnect → DisconnectionHandler Lambda
└── sendMessage → MessageHandler Lambda
```

**Use Cases**:
- Real-time processing status updates
- Live validation feedback
- Multi-user collaboration (future)

---

### Compute Layer

**Lambda Functions (Node.js 20 + Python 3.11)**

#### API Functions (Node.js)

**1. DocumentsAPI**
```javascript
// Handler: src/handlers/documents.handler.ts
exports.handler = async (event, context) => {
  // Routes:
  // POST /upload → uploadDocument()
  // GET /{id} → getDocument()
  // DELETE /{id} → deleteDocument()
}
```

**Configuration**:
- Runtime: Node.js 20.x
- Memory: 512 MB
- Timeout: 30 seconds
- Concurrency: Reserved 10, Burst 100
- VPC: Yes (access to Aurora, ElastiCache)
- Layers: common-layer (shared utilities)

**Environment Variables**:
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
S3_BUCKET=learningyogi-documents-prod
JWT_SECRET=<secrets-manager>
```

**2. TimetablesAPI**
```javascript
// Handler: src/handlers/timetables.handler.ts
exports.handler = async (event, context) => {
  // Routes:
  // GET /{id} → getTimetable()
  // PUT /{id} → updateTimetable()
  // GET /list → listTimetables()
}
```

**3. Validator**
```javascript
// Handler: src/handlers/validator.handler.ts
exports.handler = async (event, context) => {
  // Triggered by: EventBridge
  // Validates timetable structure, data integrity
  // Outputs: validation_status, errors[]
}
```

#### Processing Functions (Python)

**1. Classifier**
```python
# Handler: src/handlers/classifier.py
def handler(event, context):
    """
    Classifies document type using MobileNetV2
    Trigger: S3 Event or EventBridge
    Output: { document_type, confidence }
    """
```

**Configuration**:
- Runtime: Python 3.11
- Memory: 1024 MB (ML model)
- Timeout: 60 seconds
- Layers: ml-models-layer (TensorFlow Lite)

**2. OCRProcessor**
```python
# Handler: src/handlers/ocr_processor.py
def handler(event, context):
    """
    Performs OCR using Tesseract + optional Cloud Vision
    Implements quality gates (98%, 80% thresholds)
    Output: { text, confidence, words[], route }
    """
```

**Configuration**:
- Runtime: Python 3.11
- Memory: 2048 MB (Tesseract + OpenCV)
- Timeout: 5 minutes (long-running OCR)
- EFS Mount: /mnt/efs (Tesseract data files)

**3. LLMProcessor**
```python
# Handler: src/handlers/llm_processor.py
def handler(event, context):
    """
    Processes medium-confidence OCR with Claude API
    Extracts structured timetable data
    Output: { timeblocks[], confidence }
    """
```

**Configuration**:
- Runtime: Python 3.11
- Memory: 512 MB
- Timeout: 2 minutes
- Retry: 3 attempts with exponential backoff

---

### Orchestration Layer

**Step Functions State Machine**

```yaml
StateMachine: DocumentProcessingWorkflow
Type: STANDARD
Definition:

  StartAt: ClassifyDocument

  States:
    ClassifyDocument:
      Type: Task
      Resource: arn:aws:lambda:...:function:Classifier
      Next: CheckDocumentType
      Retry:
        - ErrorEquals: [Lambda.ServiceException]
          IntervalSeconds: 2
          MaxAttempts: 3
          BackoffRate: 2
      Catch:
        - ErrorEquals: [States.ALL]
          Next: HandleError

    CheckDocumentType:
      Type: Choice
      Choices:
        - Variable: $.document_type
          StringEquals: "timetable"
          Next: PreprocessImage
        - Variable: $.document_type
          StringEquals: "other"
          Next: RejectDocument
      Default: PreprocessImage

    PreprocessImage:
      Type: Task
      Resource: arn:aws:lambda:...:function:ImagePreprocessor
      Next: RunOCR

    RunOCR:
      Type: Task
      Resource: arn:aws:lambda:...:function:OCRProcessor
      Next: CheckOCRConfidence

    CheckOCRConfidence:
      Type: Choice
      Choices:
        - Variable: $.ocr_confidence
          NumericGreaterThanEquals: 0.98
          Next: ValidateData
        - Variable: $.ocr_confidence
          NumericGreaterThanEquals: 0.80
          Next: RunLLMProcessing
        - Variable: $.ocr_confidence
          NumericLessThan: 0.80
          Next: RouteToHITL

    RunLLMProcessing:
      Type: Task
      Resource: arn:aws:lambda:...:function:LLMProcessor
      Next: ValidateData
      Retry:
        - ErrorEquals: [ThrottlingException]
          IntervalSeconds: 5
          MaxAttempts: 5
          BackoffRate: 2

    ValidateData:
      Type: Task
      Resource: arn:aws:lambda:...:function:Validator
      Next: SaveToDatabase

    SaveToDatabase:
      Type: Task
      Resource: arn:aws:lambda:...:function:DatabaseWriter
      Next: SendNotification

    SendNotification:
      Type: Task
      Resource: arn:aws:lambda:...:function:NotificationHandler
      End: true

    RouteToHITL:
      Type: Task
      Resource: arn:aws:lambda:...:function:HITLHandler
      End: true

    RejectDocument:
      Type: Task
      Resource: arn:aws:lambda:...:function:RejectionHandler
      End: true

    HandleError:
      Type: Task
      Resource: arn:aws:lambda:...:function:ErrorHandler
      End: true
```

**EventBridge Rules**

```yaml
Rules:
  - Name: NewDocumentUploaded
    EventPattern:
      source: [custom.learningyogi]
      detail-type: [Document Uploaded]
    Targets:
      - Arn: arn:aws:states:...:stateMachine:DocumentProcessingWorkflow

  - Name: OCRCompleted
    EventPattern:
      source: [custom.learningyogi]
      detail-type: [OCR Completed]
    Targets:
      - Arn: arn:aws:lambda:...:function:LLMProcessor

  - Name: ValidationFailed
    EventPattern:
      source: [custom.learningyogi]
      detail-type: [Validation Failed]
    Targets:
      - Arn: arn:aws:lambda:...:function:HITLHandler
```

---

## Data Architecture

### Aurora Serverless v2 (PostgreSQL 14)

**Configuration**:
- Engine: PostgreSQL 14.6
- Capacity: 0.5 ACU (min) to 16 ACU (max)
- Storage: Auto-scaling up to 128 GB
- Multi-AZ: Yes (high availability)
- Backups: Automated daily, 7-day retention
- Encryption: AES-256 at rest

**Connection Pooling**:
- Use RDS Proxy to manage Lambda connections
- Max connections per Lambda: 2
- Proxy connection limit: 500

**Schema** (see PoC1 DATAFLOW.md for full schema):

```sql
-- Core tables (simplified view)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE documents (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'uploaded',
  s3_key VARCHAR(500),
  processing_metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE timetables (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  timeblocks JSONB,
  confidence DECIMAL(5,4),
  validated_at TIMESTAMP
);
```

### ElastiCache Serverless (Redis)

**Configuration**:
- Engine: Redis 7.0
- Data Tiering: Yes
- Snapshot: Daily
- Encryption: In transit + at rest

**Cache Strategy**:

```
Cache Keys:
- user:{userId} → User object (TTL: 1 hour)
- document:{documentId} → Document metadata (TTL: 30 minutes)
- timetable:{timetableId} → Timetable data (TTL: 1 hour)
- processing_status:{documentId} → Status updates (TTL: 24 hours)
- rate_limit:{userId}:{endpoint} → API rate limiting (TTL: 1 minute)
```

**Eviction Policy**: allkeys-lru (least recently used)

### S3 Storage

**Bucket Structure**:

```
learningyogi-documents-prod/
├── uploads/
│   └── {userId}/
│       └── {documentId}/
│           ├── original.{ext}
│           ├── preprocessed.png
│           └── thumbnail.jpg
├── processed/
│   └── {documentId}/
│       ├── ocr_result.json
│       └── llm_result.json
└── exports/
    └── {userId}/
        └── timetable_{date}.csv
```

**Lifecycle Policies**:
- Original documents: Transition to Glacier after 90 days
- Processed results: Delete after 30 days
- Exports: Delete after 7 days

**Access Control**:
- Bucket Policy: Deny all public access
- Lambda IAM Role: Scoped to specific prefixes
- Pre-signed URLs: 15-minute expiration for uploads/downloads

---

## Security Architecture

### Identity & Access Management

**Lambda Execution Roles**:

```yaml
DocumentsAPIRole:
  Policies:
    - S3: PutObject, GetObject (bucket: learningyogi-documents-*)
    - DynamoDB: GetItem, PutItem (table: sessions)
    - RDS: Connect (via RDS Proxy)
    - ElastiCache: Connect
    - Secrets Manager: GetSecretValue (JWT_SECRET)

OCRProcessorRole:
  Policies:
    - S3: GetObject, PutObject
    - EventBridge: PutEvents
    - CloudWatch: PutMetricData

LLMProcessorRole:
  Policies:
    - S3: GetObject
    - Secrets Manager: GetSecretValue (ANTHROPIC_API_KEY)
    - EventBridge: PutEvents
```

**API Gateway Authorizer**:

```javascript
// Lambda Authorizer
exports.handler = async (event) => {
  const token = event.headers.Authorization.replace('Bearer ', '');

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    return {
      principalId: payload.userId,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [{
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: event.methodArn
        }]
      },
      context: {
        userId: payload.userId,
        email: payload.email
      }
    };
  } catch (error) {
    throw new Error('Unauthorized');
  }
};
```

### Data Protection

**Encryption**:
- **At Rest**:
  - S3: AES-256 (SSE-S3)
  - Aurora: AES-256 (AWS KMS)
  - ElastiCache: AES-256
- **In Transit**:
  - TLS 1.3 for all API calls
  - VPC endpoints for AWS service communication

**Secrets Management**:
- AWS Secrets Manager for API keys
- Automatic rotation every 90 days
- Lambda environment variables reference secrets, not hardcoded

### Network Security

**VPC Configuration**:

```
VPC: learningyogi-prod (10.0.0.0/16)
├── Public Subnets (10.0.1.0/24, 10.0.2.0/24)
│   └── NAT Gateways
├── Private Subnets (10.0.10.0/24, 10.0.11.0/24)
│   └── Lambda Functions, RDS Proxy, ElastiCache
└── Security Groups
    ├── LambdaSG: Outbound all, Inbound none
    ├── DatabaseSG: Inbound 5432 from LambdaSG
    └── CacheSG: Inbound 6379 from LambdaSG
```

**WAF Rules** (CloudFront + API Gateway):
- Rate limiting: 2000 requests/5 minutes per IP
- SQL injection protection
- XSS protection
- Geo-blocking (optional)

---

## Scalability & Performance

### Auto-Scaling Behavior

**Lambda Concurrency**:
- **Burst Concurrency**: 3000 (regional limit)
- **Reserved Concurrency**:
  - DocumentsAPI: 100
  - OCRProcessor: 50
  - LLMProcessor: 20
- **Provisioned Concurrency** (optional):
  - DocumentsAPI: 5 warm instances ($20/month)

**Aurora Serverless Scaling**:
- **Scale Up**: When CPU > 70% or connections > 80%
- **Scale Down**: After 15 minutes of low activity
- **Scaling Speed**: Seconds to minutes

**ElastiCache Serverless**:
- Auto-scales based on memory and CPU utilization
- No manual intervention required

### Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| **API Latency (p95)** | < 200ms | 150ms |
| **Document Upload** | < 3s | 2.1s |
| **OCR Processing** | < 10s | 6-8s |
| **End-to-End (High Conf)** | < 15s | 8-10s |
| **Cold Start (API)** | < 1s | 800ms |
| **Cold Start (OCR)** | < 3s | 2.5s |

### Caching Strategy

**Multi-Layer Caching**:

1. **CloudFront (Edge Cache)**:
   - Static assets: 1 year
   - API responses: No cache (dynamic)

2. **ElastiCache (Application Cache)**:
   - User sessions: 1 hour
   - Document metadata: 30 minutes
   - Timetable data: 1 hour

3. **Lambda Memory Cache**:
   - Database connections (reused across invocations)
   - ML models (loaded once per container)

---

## Monitoring & Observability

### CloudWatch Dashboards

**Operational Dashboard**:
```
┌─────────────────────────────────────────────────────────────┐
│ Learning Yogi - Production Dashboard                        │
├─────────────────────────────────────────────────────────────┤
│ Lambda Invocations       │ API Gateway Requests             │
│ [Graph: Last 24h]        │ [Graph: 5xx/4xx errors]         │
├─────────────────────────────────────────────────────────────┤
│ Step Functions Execution │ Aurora ACU Utilization          │
│ [Graph: Success/Fail]    │ [Graph: Current capacity]       │
├─────────────────────────────────────────────────────────────┤
│ Cache Hit Rate           │ External API Latency            │
│ [Gauge: 87%]             │ [Graph: Anthropic, Vision]      │
└─────────────────────────────────────────────────────────────┘
```

### X-Ray Tracing

**Service Map**:
```
[API Gateway] → [DocumentsAPI Lambda] → [RDS Proxy] → [Aurora]
                      ↓
                 [EventBridge] → [Step Functions] → [OCRProcessor]
                                                           ↓
                                                    [LLMProcessor]
```

**Trace Details**:
- End-to-end latency breakdown
- Cold start identification
- Error root cause analysis

### CloudWatch Alarms

**Critical Alarms** (PagerDuty integration):

```yaml
Alarms:
  - Name: LambdaErrorRateHigh
    Metric: Errors
    Threshold: > 5% of invocations
    Period: 5 minutes
    Action: SNS → PagerDuty

  - Name: APIGateway5xxErrorsHigh
    Metric: 5XXError
    Threshold: > 1% of requests
    Period: 5 minutes
    Action: SNS → PagerDuty

  - Name: StepFunctionFailureRate
    Metric: ExecutionsFailed
    Threshold: > 10% of executions
    Period: 15 minutes
    Action: SNS → PagerDuty

  - Name: AuroraACUMaxedOut
    Metric: ACUUtilization
    Threshold: > 90% for 5 minutes
    Period: 5 minutes
    Action: SNS → Slack
```

**Warning Alarms** (Slack notifications):
- Lambda cold starts > 2 seconds
- Cache hit rate < 70%
- External API latency > 2 seconds

### Logging Strategy

**Structured Logging**:

```javascript
// Example: Lambda function logging
const logger = require('./utils/logger');

logger.info('Document uploaded', {
  userId: event.userId,
  documentId: document.id,
  fileSize: event.fileSize,
  processingTime: Date.now() - startTime
});

logger.error('OCR processing failed', {
  documentId: document.id,
  error: error.message,
  stack: error.stack,
  ocrEngine: 'tesseract'
});
```

**Log Retention**:
- CloudWatch Logs: 30 days
- S3 Archive: 1 year (compressed)

**Log Insights Queries**:

```sql
-- Top errors in last 24 hours
fields @timestamp, @message, error.message
| filter level = "ERROR"
| stats count() by error.message
| sort count desc
| limit 10

-- Average processing time by document type
fields document_type, processing_time
| stats avg(processing_time) by document_type
```

---

## Disaster Recovery

### Backup Strategy

**Aurora Automated Backups**:
- Frequency: Daily at 3:00 AM UTC
- Retention: 7 days
- Point-in-time recovery: Up to 5 minutes before failure

**S3 Versioning**:
- Enabled for all document buckets
- Deleted objects retained for 30 days

**Database Snapshots**:
- Manual snapshot before major deployments
- Retention: 30 days

### Recovery Objectives

- **RTO (Recovery Time Objective)**: 1 hour
- **RPO (Recovery Point Objective)**: 5 minutes

### Recovery Procedures

**Scenario 1: Lambda Function Failure**
1. CloudWatch Alarm triggers
2. Auto-rollback to previous version (if recent deployment)
3. Manual investigation if persistent

**Scenario 2: Database Corruption**
1. Identify last known good snapshot
2. Create new Aurora cluster from snapshot
3. Update RDS Proxy endpoint
4. Test with read-only queries
5. Switch over (downtime: ~15 minutes)

**Scenario 3: Regional Failure**
1. Route53 health check fails
2. Automatic DNS failover to secondary region (if multi-region setup)
3. S3 Cross-Region Replication provides data in secondary region
4. Aurora Global Database promotes secondary cluster

---

## Cost Optimization

### Strategies

1. **Right-Sizing Lambda Memory**:
   - Profile each function's memory usage
   - OCRProcessor: 2048 MB (CPU-bound)
   - API functions: 512 MB (I/O-bound)

2. **Reserved Concurrency**:
   - Only for critical user-facing APIs
   - Avoid over-provisioning

3. **Aurora Serverless v2 Min ACU**:
   - Set to 0.5 ACU (not 0) to avoid cold starts
   - Scale up quickly during peak hours

4. **S3 Intelligent-Tiering**:
   - Automatically moves objects to cheaper storage classes
   - Savings: ~30% on storage costs

5. **CloudFront Caching**:
   - Reduce origin requests by 80%
   - Savings: ~$50/month on API Gateway

### Monthly Cost Breakdown (1,000 docs/day)

| Service | Cost |
|---------|------|
| Lambda (compute) | $11 |
| API Gateway | $1 |
| EventBridge + Step Functions | $8 |
| Aurora Serverless | $175 |
| ElastiCache | $1 |
| S3 | $2 |
| CloudWatch | $10 |
| External APIs | $18 |
| **Total** | **$226** |

---

## Comparison with PoC1

| Aspect | PoC1 (Microservices) | PoC2 (Serverless) |
|--------|---------------------|-------------------|
| **Infrastructure** | Kubernetes (EKS) | Lambda + Managed Services |
| **Scaling** | Manual (HPA) | Automatic (instant) |
| **Cost (1K docs/day)** | $1,128/month | $226/month |
| **Cold Start** | None | 1-3s (mitigable) |
| **Operational Overhead** | High | Low |
| **Vendor Lock-in** | Low | High (AWS) |
| **Best For** | High volume, predictable load | Variable load, fast iteration |

---

## Deployment Architecture

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment procedures.

**CI/CD Pipeline**:

```
GitHub → CodePipeline → CodeBuild → SAM Deploy → Production
           │
           └→ Run Tests → Security Scan → Deploy to Dev → Manual Approval
```

---

## Conclusion

This serverless architecture provides:

✅ **Instant Auto-scaling**: 0 to 1000+ concurrent executions in seconds
✅ **Cost Efficiency**: 80% cheaper than PoC1 at low-medium volume
✅ **Low Operations**: No infrastructure to manage
✅ **High Availability**: 99.95% SLA from AWS
✅ **Fast Time-to-Market**: 2-4 weeks to production

**Recommended for**: Startups, MVPs, variable workloads, small teams

## AI Pipeline Integration (Optional)

For enhanced AI capabilities, integrate **PoCAIPipeline**:

### Benefits
- **Fine-tuned OCR Models**: Lambda-based domain-specific OCR models
- **Fine-tuned Document Models**: Replace Claude API with Lambda-based models
- **Feature Store**: Feast with ElastiCache Serverless
- **Cost Reduction**: 80-90% reduction in Claude API costs
- **Lower Latency**: Local inference vs API calls

### Integration Points
- Deploy PoCAIPipeline OCR Lambda functions
- Deploy PoCAIPipeline document Lambda functions
- Set up ElastiCache Serverless for feature store
- Use Lambda Layers for model distribution

**See**: [PoCAIPipeline POC2 Migration Guide](../../PoCAIPipeline/docs/MIGRATION_POC2.md)

---

**Document Version**: 1.0.0
**Last Updated**: 2025-01-01
**Status**: Production-Ready Architecture

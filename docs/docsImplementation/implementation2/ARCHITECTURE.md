# Implementation 2: Serverless Event-driven Architecture

## Overview

This implementation leverages serverless technologies for instant auto-scaling, reduced operational overhead, and cost efficiency at variable load. It uses cloud-native services (AWS Lambda/Google Cloud Functions) with event-driven patterns for document processing.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    React PWA (Web + Mobile)                           │   │
│  │  - Service Worker (Offline support)                                   │   │
│  │  - IndexedDB (Local caching)                                          │   │
│  │  - WebSocket Client (Real-time updates via API Gateway WebSocket)    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │ HTTPS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CDN LAYER                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  CloudFront / Cloud CDN                                               │   │
│  │  - Static assets (React app)                                          │   │
│  │  - Edge caching                                                        │   │
│  │  - DDoS protection                                                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY LAYER                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  AWS API Gateway / Google Cloud API Gateway                           │   │
│  │                                                                        │   │
│  │  REST API:                        WebSocket API:                      │   │
│  │  - /api/v1/...                    - wss://...                         │   │
│  │  - JWT authorizer                 - Connection management             │   │
│  │  - Request validation             - Real-time notifications           │   │
│  │  - Rate limiting                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                                     │
        ┌───────────┴──────────┬──────────────────────────┴──────────┐
        │                      │                                      │
        ▼                      ▼                                      ▼
┌──────────────┐    ┌───────────────────┐              ┌─────────────────────┐
│  Lambda:     │    │  Lambda:          │              │  Lambda:            │
│  Auth        │    │  Documents API    │              │  WebSocket Handler  │
│  Handler     │    │  Handler          │              │                     │
│              │    │                   │              │  - Connect          │
│  - Login     │    │  - Upload         │              │  - Disconnect       │
│  - Register  │    │  - List           │              │  - Message          │
│  - Refresh   │    │  - Get/Delete     │              │  - Broadcast        │
└──────────────┘    └───────────────────┘              └─────────────────────┘
        │                      │                                  │
        │                      ▼                                  │
        │            ┌───────────────────┐              ┌─────────────────────┐
        │            │  S3 Bucket        │              │  DynamoDB           │
        │            │  (Documents)      │              │  (WebSocket         │
        │            │                   │              │   Connections)      │
        │            │  - Original files │              └─────────────────────┘
        │            │  - Processed      │
        │            └───────────────────┘
        │                      │
        │                      ▼
        │            ┌───────────────────┐
        │            │  EventBridge      │
        │            │  (Event Bus)      │
        │            │                   │
        │            │  Events:          │
        │            │  - document.      │
        │            │    uploaded       │
        │            │  - job.completed  │
        │            │  - job.failed     │
        │            └───────────────────┘
        │                      │
        ├──────────────────────┼─────────────────────┐
        │                      │                     │
        ▼                      ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Lambda:         │  │  Lambda:         │  │  Lambda:         │
│  Document        │  │  OCR Processor   │  │  LLM Processor   │
│  Classifier      │  │                  │  │                  │
│                  │  │  - Tesseract     │  │  - Anthropic SDK │
│  - Type detect   │  │  - Cloud Vision  │  │  - Claude 3.5    │
│  - Route logic   │  │  - Confidence    │  │  - Structured    │
│  - Emit events   │  │    scoring       │  │    extraction    │
└──────────────────┘  └──────────────────┘  └──────────────────┘
        │                      │                     │
        │                      ▼                     │
        │            ┌──────────────────┐            │
        │            │  Lambda:         │            │
        │            │  Preprocessor    │            │
        │            │                  │            │
        │            │  - Image enhance │            │
        │            │  - Orientation   │            │
        │            │  - Noise removal │            │
        │            └──────────────────┘            │
        │                                             │
        └────────────────────┬────────────────────────┘
                             │
                             ▼
                   ┌──────────────────┐
                   │  Lambda:         │
                   │  Validator &     │
                   │  Transformer     │
                   │                  │
                   │  - Parse results │
                   │  - Validate      │
                   │  - Save to DB    │
                   │  - Emit events   │
                   └──────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                          │
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Aurora          │  │  ElastiCache     │  │  Timestream /    │          │
│  │  Serverless      │  │  (Redis)         │  │  BigQuery        │          │
│  │  PostgreSQL      │  │                  │  │                  │          │
│  │                  │  │  - OCR cache     │  │  - Time-series   │          │
│  │  - Users         │  │  - LLM cache     │  │    metrics       │          │
│  │  - Timetables    │  │  - Sessions      │  │  - Analytics     │          │
│  │  - Documents     │  │  - Rate limit    │  │                  │          │
│  │  - Timeblocks    │  │                  │  │                  │          │
│  │                  │  │  Auto-scaling    │  │                  │          │
│  │  Auto-scaling    │  │  based on load   │  │                  │          │
│  │  0.5 - 16 ACUs   │  │                  │  │                  │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘

                  ┌───────────────────────────────┐
                  │  Step Functions               │
                  │  (Workflow Orchestration)     │
                  │                               │
                  │  Document Processing Flow:    │
                  │  1. Upload → S3               │
                  │  2. Classify                  │
                  │  3. Preprocess                │
                  │  4. OCR / LLM (conditional)   │
                  │  5. Validate                  │
                  │  6. Save                      │
                  │  7. Notify                    │
                  │                               │
                  │  - Visual workflow editor     │
                  │  - Error handling & retry     │
                  │  - State persistence          │
                  └───────────────────────────────┘
```

---

## Key Components

### 1. API Gateway (AWS API Gateway / Google Cloud API Gateway)

**REST API**:
- HTTP API with JWT authorizer
- Request validation and transformation
- Built-in rate limiting and throttling
- CORS configuration
- Access logging

**WebSocket API**:
- Real-time bidirectional communication
- Connection management (connect, disconnect, message routes)
- Integration with Lambda for message handling
- Broadcast to specific connections

**Configuration**:
```yaml
# AWS API Gateway HTTP API
Type: AWS::ApiGatewayV2::Api
Properties:
  Name: learning-yogi-api
  ProtocolType: HTTP
  CorsConfiguration:
    AllowOrigins: ['https://app.learningyogi.com']
    AllowMethods: [GET, POST, PUT, DELETE, OPTIONS]
    AllowHeaders: [Content-Type, Authorization]

# JWT Authorizer
Authorizers:
  JWTAuthorizer:
    IdentitySource: $request.header.Authorization
    JwtConfiguration:
      Audience: ['learning-yogi-api']
      Issuer: https://auth.learningyogi.com
```

**Why API Gateway**:
- Fully managed, no servers to maintain
- Automatic scaling (millions of requests)
- Built-in security features
- Pay-per-request pricing
- Regional and edge-optimized deployment

---

### 2. Lambda Functions (AWS Lambda / Google Cloud Functions)

#### Authentication Handler

**Runtime**: Node.js 20.x
**Memory**: 256 MB
**Timeout**: 10 seconds
**Concurrency**: Auto-scaling (up to 1000 concurrent executions)

**Endpoints**:
```
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

**Environment Variables**:
```
JWT_SECRET=xxx
JWT_EXPIRY=900
DATABASE_URL=xxx
REDIS_URL=xxx
```

**Cold Start Optimization**:
- Provisioned concurrency for critical functions (optional)
- Lambda SnapStart (Java) or equivalent
- Keep functions warm with scheduled ping (1/min)

---

#### Document API Handler

**Runtime**: Node.js 20.x
**Memory**: 512 MB
**Timeout**: 30 seconds

**Endpoints**:
```
POST /documents/upload
GET /documents
GET /documents/:id
DELETE /documents/:id
```

**S3 Upload Strategy**:
```javascript
// Generate pre-signed URL for direct client upload
const presignedUrl = await s3.getSignedUrlPromise('putObject', {
  Bucket: 'learning-yogi-documents',
  Key: `uploads/${userId}/${documentId}.pdf`,
  Expires: 3600, // 1 hour
  ContentType: 'application/pdf',
});

// Return URL to client for direct upload
return {
  uploadUrl: presignedUrl,
  documentId: documentId,
};
```

**Benefits**:
- Bypass Lambda payload limits (6 MB)
- Reduce Lambda execution time and cost
- Better upload performance for large files

---

#### Document Classifier (Python)

**Runtime**: Python 3.11
**Memory**: 1024 MB (for ML model)
**Timeout**: 60 seconds

**Trigger**: S3 Event (ObjectCreated) or EventBridge event

**Functionality**:
- Download document from S3
- Run classification model
- Determine document type
- Emit event to EventBridge for routing

**Container Image** (recommended for ML):
```dockerfile
FROM public.ecr.aws/lambda/python:3.11

# Install dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy model and code
COPY model/ model/
COPY app/ app/

CMD ["app.handler.lambda_handler"]
```

**Why Container Image**:
- Package large dependencies (ML libraries, models)
- Bypass 250 MB deployment package limit
- Faster deployment with layer caching

---

#### Preprocessing Service (Python)

**Runtime**: Python 3.11 (Container Image)
**Memory**: 2048 MB (for image processing)
**Timeout**: 5 minutes

**Trigger**: EventBridge event (document.classified)

**Dependencies**:
- OpenCV
- Pillow
- NumPy

**Optimization**:
- Use /tmp directory for temporary files (512 MB available)
- Stream processing where possible
- Clean up temp files after processing

---

#### OCR Processor (Python)

**Runtime**: Python 3.11 (Container Image)
**Memory**: 2048 MB
**Timeout**: 5 minutes

**Trigger**: EventBridge event (document.preprocessed)

**Functionality**:
- Download preprocessed image from S3
- Run Tesseract OCR or call Cloud Vision API
- Calculate confidence score
- Route based on confidence:
  - ≥98%: Emit to validator
  - 80-98%: Emit to LLM processor
  - <80%: Emit to HITL queue

**Caching**:
```python
# Check Redis cache before processing
cache_key = f"ocr:result:{document_hash}"
cached_result = redis_client.get(cache_key)
if cached_result:
    return json.loads(cached_result)

# Process and cache result
result = process_ocr(document)
redis_client.setex(cache_key, 2592000, json.dumps(result))  # 30 days
```

---

#### LLM Processor (Python)

**Runtime**: Python 3.11
**Memory**: 512 MB
**Timeout**: 2 minutes

**Trigger**: EventBridge event (ocr.low_confidence)

**Functionality**:
- Download document from S3
- Call Anthropic Claude API
- Extract structured timetable data
- Emit to validator

**Error Handling**:
```python
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(RateLimitError)
)
def call_claude_api(document_path):
    # API call logic
    pass
```

---

#### Validator & Transformer (Node.js)

**Runtime**: Node.js 20.x
**Memory**: 512 MB
**Timeout**: 30 seconds

**Trigger**: EventBridge event (ocr.completed or llm.completed)

**Functionality**:
- Validate extracted data
- Transform to internal schema
- Save to Aurora Serverless PostgreSQL
- Emit job.completed event
- Trigger notification

---

### 3. Step Functions (Workflow Orchestration)

**State Machine**: Document Processing Workflow

```json
{
  "Comment": "Document processing workflow",
  "StartAt": "Classify Document",
  "States": {
    "Classify Document": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:DocumentClassifier",
      "Next": "Check Document Type",
      "Retry": [
        {
          "ErrorEquals": ["States.TaskFailed"],
          "IntervalSeconds": 2,
          "MaxAttempts": 3,
          "BackoffRate": 2
        }
      ],
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "Next": "Classification Failed"
        }
      ]
    },
    "Check Document Type": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.documentType",
          "StringEquals": "image",
          "Next": "Preprocess Image"
        },
        {
          "Variable": "$.documentType",
          "StringEquals": "pdf",
          "Next": "Preprocess Document"
        }
      ],
      "Default": "Unsupported Type"
    },
    "Preprocess Image": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:ImagePreprocessor",
      "Next": "Run OCR",
      "Timeout": 300
    },
    "Run OCR": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:OCRProcessor",
      "Next": "Check Confidence",
      "ResultPath": "$.ocrResult"
    },
    "Check Confidence": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.ocrResult.confidence",
          "NumericGreaterThanEquals": 98,
          "Next": "Validate Data"
        },
        {
          "Variable": "$.ocrResult.confidence",
          "NumericGreaterThanEquals": 80,
          "Next": "Process with LLM"
        }
      ],
      "Default": "Request Human Review"
    },
    "Process with LLM": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:LLMProcessor",
      "Next": "Validate Data",
      "Timeout": 120
    },
    "Validate Data": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:Validator",
      "Next": "Save to Database"
    },
    "Save to Database": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:DatabaseWriter",
      "Next": "Send Notification"
    },
    "Send Notification": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:NotificationSender",
      "End": true
    },
    "Request Human Review": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:HITLQueueWriter",
      "End": true
    },
    "Classification Failed": {
      "Type": "Fail",
      "Error": "ClassificationError",
      "Cause": "Failed to classify document after retries"
    },
    "Unsupported Type": {
      "Type": "Fail",
      "Error": "UnsupportedDocumentType",
      "Cause": "Document type not supported"
    }
  }
}
```

**Benefits of Step Functions**:
- Visual workflow representation
- Built-in error handling and retry
- State persistence across function calls
- Long-running workflows (up to 1 year)
- Execution history and debugging

**Alternative**: AWS EventBridge Pipes + Lambda (simpler, event-driven)

---

### 4. EventBridge (Event Bus)

**Event-Driven Architecture**:
```javascript
// Emit event after document upload
await eventBridge.putEvents({
  Entries: [
    {
      Source: 'learning-yogi.documents',
      DetailType: 'document.uploaded',
      Detail: JSON.stringify({
        documentId: '880e8400-e29b-41d4-a716-446655440003',
        userId: '550e8400-e29b-41d4-a716-446655440000',
        s3Bucket: 'learning-yogi-documents',
        s3Key: 'uploads/2024/10/31/doc.pdf',
      }),
      EventBusName: 'learning-yogi-events',
    },
  ],
}).promise();

// Event routing rules
{
  "Name": "route-to-classifier",
  "EventPattern": {
    "source": ["learning-yogi.documents"],
    "detail-type": ["document.uploaded"]
  },
  "Targets": [
    {
      "Arn": "arn:aws:lambda:REGION:ACCOUNT:function:DocumentClassifier",
      "Id": "ClassifierTarget"
    }
  ]
}
```

**Event Types**:
```
- document.uploaded
- document.classified
- document.preprocessed
- ocr.completed
- ocr.low_confidence
- llm.completed
- validation.completed
- job.completed
- job.failed
- hitl.requested
- hitl.completed
```

**Benefits**:
- Loose coupling between services
- Easy to add new consumers
- Event replay for debugging
- Schema registry for event validation

---

### 5. Databases

#### Aurora Serverless v2 (PostgreSQL)

**Why Aurora Serverless**:
- Auto-scaling capacity (0.5 ACU to 128 ACU)
- Pay only for capacity used
- Scales in seconds based on load
- Compatible with PostgreSQL (same schema as Implementation 1)
- Multi-AZ for high availability

**Configuration**:
```yaml
Engine: aurora-postgresql
EngineVersion: 14.6
ScalingConfiguration:
  MinCapacity: 0.5  # 1 GB RAM
  MaxCapacity: 16   # 32 GB RAM
  AutoPause: true
  SecondsUntilAutoPause: 300  # 5 minutes
```

**Cost**:
- ~$0.12 per ACU-hour
- At 1 ACU average: ~$87/month
- No cost when paused (development/staging)

---

#### ElastiCache for Redis (Serverless)

**Why ElastiCache Serverless**:
- Auto-scaling based on load
- No capacity planning
- Compatible with Redis clients
- Sub-millisecond latency

**Configuration**:
```yaml
CacheUsageLimits:
  DataStorage:
    Maximum: 10  # GB
  ECPUPerSecond:
    Maximum: 5000
```

**Cost**:
- Pay per GB-hour and ECPU-second
- ~$0.125 per GB-month storage
- ~$0.0034 per million ECPUs

---

#### DynamoDB (for WebSocket connections)

**Why DynamoDB**:
- Serverless, auto-scaling
- Single-digit millisecond latency
- No connection limits
- On-demand billing

**Table**: WebSocketConnections

```javascript
{
  connectionId: 'abc123',  // Partition key
  userId: '550e8400-e29b-41d4-a716-446655440000',
  connectedAt: 1698764400000,
  ttl: 1698850800  // Auto-delete after 24 hours
}
```

**Indexes**:
- GSI: userId → connectionId (for broadcasting to user)

---

### 6. Storage

#### S3 (Simple Storage Service)

**Buckets**:
```
learning-yogi-documents-prod
├── uploads/
│   ├── {userId}/
│   │   └── {documentId}.{ext}
├── preprocessed/
│   └── {documentId}_preprocessed.png
└── archive/
    └── {year}/{month}/{documentId}.{ext}
```

**Lifecycle Policies**:
```yaml
- Rule: Transition to Intelligent-Tiering after 30 days
- Rule: Transition to Glacier after 90 days
- Rule: Delete after 365 days (optional)
```

**Event Notifications**:
```yaml
# Trigger Lambda on object creation
Events:
  - s3:ObjectCreated:*
LambdaFunctionArn: arn:aws:lambda:REGION:ACCOUNT:function:DocumentProcessor
```

---

## Data Flow: End-to-End Processing

### Happy Path: High Confidence OCR

```
1. User uploads document via React PWA
   └─ Client calls API to get pre-signed S3 URL

2. API Gateway → Lambda: Generate Pre-signed URL
   ├─ Create document record in Aurora (status: 'pending')
   ├─ Generate S3 pre-signed URL
   └─ Return URL and documentId to client

3. Client uploads directly to S3
   └─ PUT to pre-signed URL

4. S3 triggers EventBridge event: document.uploaded
   └─ Invokes Step Functions workflow

5. Step Functions: Start Execution
   └─ State: Classify Document

6. Lambda: Document Classifier
   ├─ Download from S3
   ├─ Run ML classification
   ├─ Determine: Image
   └─ Return: { documentType: 'image', confidence: 0.95 }

7. Step Functions: Choice State
   └─ documentType === 'image' → Next: Preprocess Image

8. Lambda: Image Preprocessor
   ├─ Download original from S3
   ├─ Enhance quality, deskew
   ├─ Upload preprocessed to S3
   └─ Return: { s3Key: 'preprocessed/doc.png' }

9. Step Functions: Run OCR

10. Lambda: OCR Processor
    ├─ Download preprocessed from S3
    ├─ Run Tesseract OCR
    ├─ Calculate confidence: 99.2%
    └─ Return: { text: '...', confidence: 99.2 }

11. Step Functions: Choice State (Check Confidence)
    └─ confidence ≥ 98 → Next: Validate Data

12. Lambda: Validator
    ├─ Parse OCR text
    ├─ Extract timeblocks
    ├─ Validate structure
    └─ Return: { timeblocks: [...] }

13. Step Functions: Save to Database

14. Lambda: Database Writer
    ├─ Insert timetable record
    ├─ Insert timeblocks
    ├─ Update document status: 'completed'
    └─ Return: { timetableId: '...' }

15. Step Functions: Send Notification

16. Lambda: Notification Sender
    ├─ Send email via SES
    ├─ Send WebSocket message via API Gateway
    └─ End workflow

17. Client receives WebSocket event: job.completed
    └─ Fetch and display timetable
```

**Total Time**: ~8-15 seconds (including cold starts)
**Cost per Execution**: ~$0.005 - $0.015

---

## Scalability & Performance

### Auto-scaling Characteristics

**Lambda**:
```
- Concurrent executions: 0 → 1000 (default, can request increase)
- Scaling: Instant (within seconds)
- Cold start: ~1-2s (Node.js), ~2-4s (Python with ML libs)
- Warm execution: 50-500ms
```

**Aurora Serverless**:
```
- Capacity: 0.5 ACU → 16 ACU (configurable)
- Scaling: ~30 seconds to add/remove ACU
- Auto-pause: After 5 minutes of inactivity
- Resume: ~10-30 seconds from pause
```

**ElastiCache Serverless**:
```
- Storage: Auto-scales to configured max
- ECPU: Auto-scales based on requests
- Scaling: Instant
```

**API Gateway**:
```
- Requests: Unlimited (millions per second)
- Throttling: 10,000 req/s default (can increase)
- Scaling: Fully managed, instant
```

### Performance Optimization

#### Lambda Optimization

**1. Provisioned Concurrency** (for critical functions):
```yaml
# Keep 5 instances warm
ProvisionedConcurrencyConfig:
  ProvisionedConcurrentExecutions: 5
```

**Cost**: ~$0.015 per GB-hour per instance
**When**: Use for latency-sensitive APIs (auth, document upload)

**2. Lambda Layers** (for shared dependencies):
```
Layer: nodejs-dependencies (40 MB)
├── node_modules/
│   ├── axios
│   ├── aws-sdk
│   └── jsonwebtoken
```

**Benefits**:
- Reduce deployment package size
- Share dependencies across functions
- Faster deployments

**3. Environment Variable Optimization**:
```javascript
// Load once during cold start
const DB_CONNECTION_STRING = process.env.DATABASE_URL;
let dbClient;

exports.handler = async (event) => {
  // Reuse connection across invocations
  if (!dbClient) {
    dbClient = await createDbClient(DB_CONNECTION_STRING);
  }
  // Handler logic
};
```

**4. Memory Allocation**:
```
- More memory = More CPU
- Find optimal memory with AWS Lambda Power Tuning
- Typical: 512-1024 MB for most functions
- ML functions: 2048-3008 MB
```

#### Database Optimization

**Connection Pooling with RDS Proxy**:
```yaml
# Aurora Serverless v2 + RDS Proxy
RDSProxy:
  IdleClientTimeout: 1800
  MaxConnectionsPercent: 100
  MaxIdleConnectionsPercent: 50
```

**Benefits**:
- Reuse database connections across Lambda invocations
- Reduce connection overhead
- Handle Lambda concurrency surges

---

## Cost Estimation

### Monthly Cost (1000 documents/day = 30,000/month)

**Compute (Lambda)**:
```
Assumptions:
- Avg 15 invocations per document
- Avg 512 MB memory, 3 seconds duration
- 450,000 total invocations

Lambda Cost:
- Requests: 450,000 × $0.20/1M = $0.09
- Duration: 450,000 × 3s × 512MB × $0.0000166667 = $11.25
Total: $11.34
```

**Database (Aurora Serverless v2)**:
```
Assumptions:
- Avg 2 ACU (4 GB RAM)
- 720 hours/month

Aurora Cost:
- 2 ACU × 720 hours × $0.12 = $172.80
- Storage: 20 GB × $0.10 = $2.00
Total: $174.80
```

**Cache (ElastiCache Serverless)**:
```
Assumptions:
- 5 GB storage
- 10M ECPU/month

ElastiCache Cost:
- Storage: 5 GB × $0.125 = $0.63
- ECPU: 10M × $0.0034/1M = $0.03
Total: $0.66
```

**Storage (S3)**:
```
Assumptions:
- 100 GB stored
- 50,000 GET requests
- 30,000 PUT requests

S3 Cost:
- Storage: 100 GB × $0.023 = $2.30
- GET: 50,000 × $0.0004/1000 = $0.02
- PUT: 30,000 × $0.005/1000 = $0.15
Total: $2.47
```

**API Gateway**:
```
Assumptions:
- 500,000 requests

API Gateway Cost:
- 500,000 × $1.00/1M = $0.50
Total: $0.50
```

**EventBridge**:
```
Assumptions:
- 200,000 events

EventBridge Cost:
- 200,000 × $1.00/1M = $0.20
Total: $0.20
```

**Step Functions**:
```
Assumptions:
- 30,000 workflow executions
- Avg 10 state transitions each

Step Functions Cost:
- 300,000 transitions × $0.025/1000 = $7.50
Total: $7.50
```

**External APIs**:
```
- Tesseract: Free (self-hosted in Lambda)
- Google Cloud Vision (20%): 6,000 × $1.50/1000 = $9.00
- Claude API (10%): 3,000 × $0.003/image ≈ $9.00
Total: $18.00
```

**CDN (CloudFront)**:
```
- Data transfer: 50 GB × $0.085 = $4.25
- Requests: 1M × $0.01/10000 = $1.00
Total: $5.25
```

### Grand Total: ~$220/month
### Cost per Document: ~$0.0073

**Comparison with Implementation 1**:
- Implementation 1: $1,100/month → $0.037/document
- Implementation 2: $220/month → $0.0073/document

**Serverless wins at low-to-medium volume**
**Breakeven point**: ~3,000-5,000 documents/day

---

## Advantages of Implementation 2

1. **Zero Operational Overhead**: No servers to manage, patch, or maintain
2. **Instant Auto-scaling**: Scale from 0 to 1000s instantly
3. **Cost Efficiency at Low Volume**: Pay only for what you use
4. **Built-in High Availability**: Multi-AZ, fault-tolerant by default
5. **Faster Development**: Focus on code, not infrastructure
6. **Global Reach**: Easy multi-region deployment
7. **Integrated Services**: Seamless integration with cloud services

## Disadvantages of Implementation 2

1. **Cold Start Latency**: 1-3s for cold starts (mitigated with provisioned concurrency)
2. **Vendor Lock-in**: Harder to migrate between clouds
3. **Execution Time Limits**: 15 minutes max (Lambda), workarounds needed for longer tasks
4. **Debugging Complexity**: Distributed tracing required
5. **Cost at High Volume**: Can become expensive at massive scale
6. **Less Control**: Limited control over underlying infrastructure

---

## When to Choose Implementation 2

- Startup or MVP with limited DevOps resources
- Unpredictable or variable workload
- Need for rapid development and iteration
- Global user base requiring multi-region deployment
- Cost optimization at low-to-medium volume
- Want to focus on product, not infrastructure

---

## Next Steps

1. Review database schema: `DATABASE-SCHEMA.md` (same as Implementation 1)
2. Review API specification: `API-SPECIFICATION.md` (same as Implementation 1)
3. Review testing strategy: `TESTING-STRATEGY.md`
4. Review deployment guide: `DEPLOYMENT.md`
5. Review Infrastructure as Code: `terraform/` or `cdk/` directory

# PoC Implementation Recommendation - Learning Yogi Platform

## Executive Summary

This document outlines a **Proof of Concept (PoC)** implementation strategy for the Learning Yogi timetable extraction platform that can be rapidly developed in **2-4 weeks** and evolved into either of the two production architectures (Microservices or Serverless) without requiring a complete rewrite.

**Key Principles**:
- **Rapid Development**: Launch working PoC in 2-4 weeks
- **Flexible Architecture**: Can evolve to Implementation 1 or 2
- **Modular Design**: Components designed for easy migration
- **Real Learning**: Validates core AI/ML assumptions
- **Minimal Resources**: 3-4 person team

---

## Table of Contents

1. [PoC Objectives](#poc-objectives)
2. [Scope and Constraints](#scope-and-constraints)
3. [Architecture Design](#architecture-design)
4. [Evolution Paths](#evolution-paths)
5. [Implementation Plan](#implementation-plan)
6. [Resource Requirements](#resource-requirements)
7. [Success Criteria](#success-criteria)
8. [Risk Mitigation](#risk-mitigation)

---

## PoC Objectives

### Primary Goals

1. **Validate Core AI Hypothesis**: Can we extract timetable data with >90% accuracy?
2. **Prove Technical Feasibility**: Does the tiered OCR → LLM approach work?
3. **Demonstrate User Value**: Can teachers use the system end-to-end?
4. **Test Quality Gates**: Do confidence thresholds (98%/80%) work as designed?
5. **Inform Architecture Decision**: Gather data to choose Implementation 1 vs 2

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Accuracy** | >90% without human review | Manual verification on 100 test documents |
| **Processing Time** | <30 seconds per document | System logs |
| **Tesseract Success Rate** | >60% (confidence ≥98%) | Processing pipeline metrics |
| **User Completion Rate** | >80% complete upload → view | Analytics tracking |
| **System Stability** | No crashes during demo | Testing period |

---

## Scope and Constraints

### In Scope (MVP Features)

✅ **Must Have**:
- User registration and login (email/password)
- Document upload (images and PDFs only, no Word docs yet)
- OCR processing with Tesseract
- LLM processing with Claude (for low confidence)
- Basic timetable display (simple grid view)
- Manual review interface (HITL)
- Basic error handling

✅ **Core Processing**:
- Document classification (image vs PDF)
- Image preprocessing (basic)
- Confidence scoring
- Quality gate routing (98% / 80% thresholds)
- Timetable data extraction and validation

### Out of Scope (Post-PoC)

❌ **Deferred**:
- Real-time notifications (WebSocket) → Use polling
- Advanced timetable editing
- Multi-user collaboration
- Word document support
- Mobile-optimized UI (PWA features)
- Production-grade monitoring
- Auto-scaling infrastructure
- Multi-region deployment
- Advanced security (basic JWT auth only)

### Constraints

- **Timeline**: 2-4 weeks
- **Team**: 3-4 developers
- **Budget**: <$500 infrastructure cost
- **Test Dataset**: 50-100 sample timetables
- **Users**: Internal testing only (5-10 beta users)

---

## Architecture Design

### PoC Architecture: Simplified Monolith with External AI Services

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (React SPA)                       │
│  - Basic upload form                                         │
│  - Simple timetable grid display                            │
│  - Admin review interface                                    │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              SINGLE NODE.JS SERVER (Express)                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  API Endpoints:                                      │   │
│  │  - POST /api/auth/login                             │   │
│  │  - POST /api/documents/upload                       │   │
│  │  - GET  /api/documents/:id/status                   │   │
│  │  - GET  /api/timetables/:id                         │   │
│  │  - POST /api/hitl/:id/submit                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Processing Logic (In-Process):                     │   │
│  │  1. Upload to Local Storage / S3                    │   │
│  │  2. Document Classification (simple mime-type)      │   │
│  │  3. Image Preprocessing (Python subprocess)         │   │
│  │  4. OCR Processing (Python subprocess)              │   │
│  │  5. LLM Fallback (if confidence <98%)              │   │
│  │  6. Validation & Storage                            │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  PostgreSQL  │  │  S3 / Local  │  │  External    │
│  (Docker)    │  │  Storage     │  │  AI Services │
│              │  │              │  │              │
│  - users     │  │  - Documents │  │  - Claude    │
│  - documents │  │  - Temp files│  │    API       │
│  - timetables│  │              │  │  - Optional: │
│  - timeblocks│  │              │  │    Google CV │
│  - jobs      │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘

┌─────────────────────────────────────────────────────────────┐
│              PYTHON PROCESSING SCRIPTS                       │
│  - preprocess.py (image enhancement)                        │
│  - ocr.py (Tesseract)                                       │
│  - llm_extract.py (Claude API)                              │
│  - validate.py (data validation)                            │
│  (Called via child_process from Node.js)                    │
└─────────────────────────────────────────────────────────────┘
```

### Why This Architecture for PoC?

**Advantages**:
1. **Simplest Possible**: Single Node.js process, no complex orchestration
2. **Fast Development**: No Kubernetes, no Lambda setup, no message queues
3. **Easy Debugging**: All logs in one place, direct function calls
4. **Low Cost**: Single VM or local dev machine, minimal cloud resources
5. **Easy Demo**: Run entire stack on laptop for presentations

**Limitations** (Acceptable for PoC):
1. **No Concurrency**: Processes one document at a time (synchronous)
2. **No Scaling**: Single instance only
3. **No Fault Tolerance**: If server crashes, in-progress jobs lost
4. **No Queue**: Long-running jobs block API responses
5. **State in Memory**: Worker status in process memory

### Technology Stack (PoC)

| Component | Technology | Why |
|-----------|------------|-----|
| **Backend** | Node.js + Express | Simple, fast setup |
| **Frontend** | React (Create React App) | Quick start, no build complexity |
| **Database** | PostgreSQL (Docker) | Production-compatible, easy local setup |
| **Storage** | Local filesystem or S3 | Local for dev, S3 for demo deployment |
| **OCR** | Tesseract (Python) | Free, proven |
| **LLM** | Claude API (Python) | Best accuracy |
| **Auth** | JWT (simple) | Stateless, good enough |
| **Deployment** | Single EC2 instance or Heroku | One-click deploy |

---

## Evolution Paths

### Path 1: PoC → Implementation 2 (Serverless) ⭐ RECOMMENDED

**Why This Path**:
- **Easiest Migration**: Natural evolution from monolith to functions
- **Code Reuse**: 70-80% of code can be reused with minimal changes
- **Timeline**: 3-4 weeks from PoC to Production

**Migration Steps**:

```
PoC Monolith
     │
     ├─ Step 1: Extract Python scripts to Lambda functions (Week 1)
     │   └─ OCR, LLM, Preprocessing → Separate Lambda functions
     │
     ├─ Step 2: Add EventBridge for event routing (Week 1-2)
     │   └─ Replace in-process calls with event emissions
     │
     ├─ Step 3: Move Node.js API to API Gateway + Lambda (Week 2)
     │   └─ Split monolith into handler functions
     │
     ├─ Step 4: Replace PostgreSQL with Aurora Serverless (Week 2-3)
     │   └─ Same schema, just different connection string
     │
     ├─ Step 5: Add Step Functions for orchestration (Week 3)
     │   └─ Visual workflow, error handling, retry
     │
     └─ Step 6: Production hardening (Week 4)
         └─ Monitoring, alarms, IAM, security
```

**Code Changes Required**:

| Component | PoC Code | Serverless Code | Effort |
|-----------|----------|-----------------|--------|
| API Routes | Express routes | Lambda handlers | Low (restructure exports) |
| Python Scripts | Subprocess calls | Lambda functions | Very Low (wrap in handler) |
| Database | Direct connection | RDS Proxy connection | Low (connection string) |
| File Storage | Local → S3 | S3 (same) | None |
| Processing Flow | Synchronous calls | EventBridge events | Medium (async pattern) |

**Example: Migrating OCR Function**

**PoC Code** (Node.js calling Python):
```javascript
// poc-server/routes/documents.js
app.post('/api/documents/upload', async (req, res) => {
  const file = req.file;

  // Call Python OCR script
  const { exec } = require('child_process');
  const result = await new Promise((resolve, reject) => {
    exec(`python3 ocr.py ${file.path}`, (err, stdout) => {
      if (err) reject(err);
      else resolve(JSON.parse(stdout));
    });
  });

  // Continue processing...
});
```

**Serverless Code** (Lambda):
```javascript
// lambda-functions/ocr-processor/index.js
exports.handler = async (event) => {
  const { documentId, s3Key } = event.detail;

  // Download from S3
  const file = await s3.getObject({ Bucket: 'docs', Key: s3Key }).promise();

  // OCR processing (now in Lambda runtime)
  const result = await tesseractOCR(file.Body);

  // Emit event to next stage
  await eventBridge.putEvents({
    Entries: [{
      Source: 'learning-yogi.ocr',
      DetailType: 'ocr.completed',
      Detail: JSON.stringify({ documentId, result })
    }]
  }).promise();
};
```

**Effort**: ~1-2 days per function (4-5 functions total)

---

### Path 2: PoC → Implementation 1 (Microservices)

**Why This Path**:
- **More Control**: Better for teams with DevOps expertise
- **Better for Scale**: If expecting high volume immediately
- **Timeline**: 5-6 weeks from PoC to Production

**Migration Steps**:

```
PoC Monolith
     │
     ├─ Step 1: Dockerize PoC application (Week 1)
     │   └─ Create Dockerfile, docker-compose
     │
     ├─ Step 2: Split into microservices (Week 1-2)
     │   └─ Auth, API, Processing services
     │
     ├─ Step 3: Add message queue (BullMQ) (Week 2-3)
     │   └─ Replace sync calls with queue jobs
     │
     ├─ Step 4: Setup Kubernetes cluster (Week 3-4)
     │   └─ Deploy services, setup ingress
     │
     ├─ Step 5: Add monitoring stack (Week 4-5)
     │   └─ Prometheus, Grafana, ELK
     │
     └─ Step 6: Production hardening (Week 5-6)
         └─ Auto-scaling, HA, security
```

**Code Changes Required**:

| Component | PoC Code | Microservices Code | Effort |
|-----------|----------|-------------------|--------|
| API Routes | Express monolith | Separate API service | Medium (split services) |
| Python Scripts | Subprocess | Containerized services | Medium (dockerize + API) |
| Database | Direct connection | Connection pooling | Low (add PgBouncer) |
| Processing Flow | Synchronous | Queue-based | High (redesign flow) |
| Deployment | Single process | K8s manifests | High (learn K8s) |

**Effort**: ~4-6 weeks with DevOps engineer

---

## Implementation Plan

### Phase 0: Pre-PoC Setup (2-3 days)

**Objectives**: Environment and team readiness

**Tasks**:
- [ ] Assemble team (3-4 developers)
- [ ] Setup development environment
- [ ] Create GitHub repository
- [ ] Setup PostgreSQL (Docker)
- [ ] Obtain Claude API key
- [ ] Gather 50-100 test timetable documents

**Deliverables**:
- Development environment ready
- Team onboarded
- Test dataset prepared

---

### Phase 1: Core Backend (Week 1)

**Objectives**: Working API with database and basic upload

**Tasks**:

**Days 1-2: Project Setup & Authentication**
- [ ] Initialize Node.js project (Express + TypeScript)
- [ ] Setup PostgreSQL schema (users, documents, timetables, timeblocks)
- [ ] Implement user registration and login (JWT)
- [ ] Basic API structure and middleware

**Days 3-4: Document Upload & Storage**
- [ ] File upload endpoint (Multer)
- [ ] S3 or local storage integration
- [ ] Document metadata storage in PostgreSQL
- [ ] Basic validation (file type, size)

**Days 5-7: OCR Processing**
- [ ] Python script for Tesseract OCR (`ocr.py`)
- [ ] Node.js integration (child_process)
- [ ] Confidence score calculation
- [ ] Store OCR results in database

**Deliverables**:
- Working API with auth
- Document upload functionality
- Basic OCR processing
- API documentation (Postman collection)

**Team**:
- Backend Developer 1: Auth + Database
- Backend Developer 2: Upload + OCR integration

---

### Phase 2: AI Processing Pipeline (Week 2)

**Objectives**: Complete processing pipeline with quality gates

**Tasks**:

**Days 8-9: LLM Integration**
- [ ] Claude API integration (`llm_extract.py`)
- [ ] Prompt engineering for timetable extraction
- [ ] Structured output parsing (JSON)
- [ ] Error handling and retry logic

**Days 10-11: Quality Gates & Routing**
- [ ] Implement confidence threshold logic (98% / 80%)
- [ ] Route to LLM if OCR confidence < 98%
- [ ] Route to HITL if confidence < 80%
- [ ] Processing status tracking

**Days 12-14: Data Validation & Extraction**
- [ ] Timetable parser (OCR/LLM output → structured data)
- [ ] Validation logic (time formats, day names, etc.)
- [ ] Timeblock creation in database
- [ ] Error handling and fallback logic

**Deliverables**:
- Complete processing pipeline
- Quality gate implementation
- Data extraction and validation
- 90%+ accuracy on test dataset

**Team**:
- Backend Developer 1: LLM integration + Quality gates
- Backend Developer 2: Data validation + Extraction

---

### Phase 3: Frontend & HITL (Week 3-4)

**Objectives**: User interface and human-in-the-loop workflow

**Tasks**:

**Days 15-17: Frontend - Upload & Display**
- [ ] React app setup (Create React App)
- [ ] Login/Registration UI
- [ ] Document upload interface
- [ ] Processing status polling
- [ ] Timetable grid display (simple table)

**Days 18-20: Frontend - HITL Interface**
- [ ] Admin view for low-confidence documents
- [ ] Side-by-side comparison (original + extracted)
- [ ] Manual correction interface
- [ ] Submit corrections API integration

**Days 21-23: Testing & Bug Fixes**
- [ ] End-to-end testing with real documents
- [ ] Bug fixes and edge cases
- [ ] Performance optimization
- [ ] UI polish

**Days 24-28: Demo Preparation**
- [ ] Deploy to staging (EC2 or Heroku)
- [ ] Load test data (50 sample timetables)
- [ ] Create demo script
- [ ] Internal testing and feedback
- [ ] Final polish and documentation

**Deliverables**:
- Working frontend application
- HITL workflow
- Deployed staging environment
- Demo-ready system

**Team**:
- Frontend Developer 1: Upload + Display
- Frontend Developer 2: HITL Interface
- Backend Developers: API support + Bug fixes

---

## Detailed PoC Architecture

### Backend API Structure

```
poc-server/
├── src/
│   ├── config/
│   │   ├── database.ts          # PostgreSQL connection
│   │   ├── storage.ts           # S3 or local storage
│   │   └── auth.ts              # JWT configuration
│   │
│   ├── models/
│   │   ├── User.ts
│   │   ├── Document.ts
│   │   ├── Timetable.ts
│   │   ├── Timeblock.ts
│   │   └── ProcessingJob.ts
│   │
│   ├── routes/
│   │   ├── auth.ts              # POST /api/auth/login, /register
│   │   ├── documents.ts         # POST /api/documents/upload
│   │   ├── timetables.ts        # GET /api/timetables/:id
│   │   └── hitl.ts              # POST /api/hitl/:id/submit
│   │
│   ├── services/
│   │   ├── ocrService.ts        # Calls Python OCR script
│   │   ├── llmService.ts        # Calls Python LLM script
│   │   ├── validationService.ts # Data validation
│   │   └── processingService.ts # Orchestration
│   │
│   ├── middleware/
│   │   ├── auth.ts              # JWT verification
│   │   ├── validation.ts        # Request validation
│   │   └── errorHandler.ts     # Error handling
│   │
│   └── app.ts                   # Express app setup
│
├── python/
│   ├── requirements.txt
│   ├── preprocess.py            # Image preprocessing
│   ├── ocr.py                   # Tesseract OCR
│   ├── llm_extract.py           # Claude API
│   └── validate.py              # Data validation
│
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

### Frontend Structure

```
poc-client/
├── src/
│   ├── components/
│   │   ├── Auth/
│   │   │   ├── Login.tsx
│   │   │   └── Register.tsx
│   │   ├── Upload/
│   │   │   ├── UploadForm.tsx
│   │   │   └── ProcessingStatus.tsx
│   │   ├── Timetable/
│   │   │   ├── TimetableGrid.tsx
│   │   │   └── TimeblockCard.tsx
│   │   └── HITL/
│   │       ├── ReviewInterface.tsx
│   │       └── ComparisonView.tsx
│   │
│   ├── services/
│   │   └── api.ts               # Axios API client
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── usePolling.ts
│   │
│   ├── App.tsx
│   └── index.tsx
│
├── public/
├── package.json
└── tsconfig.json
```

---

## Database Schema (PoC)

### Simplified Schema (5 Tables)

```sql
-- Minimal schema for PoC
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    file_name VARCHAR(255),
    file_path TEXT,  -- S3 key or local path
    file_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'uploaded',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id),
    status VARCHAR(50) DEFAULT 'pending',
    stage VARCHAR(50),
    confidence DECIMAL(5,2),
    processing_tier VARCHAR(20),  -- tesseract, llm, hitl
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE timetables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    document_id UUID REFERENCES documents(id),
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE timeblocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timetable_id UUID REFERENCES timetables(id),
    name VARCHAR(255),
    day_of_week VARCHAR(10),
    start_time TIME,
    end_time TIME,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Migration to Production**: Add indexes, constraints, additional columns as needed.

---

## Resource Requirements

### Team Composition

| Role | Allocation | Responsibilities |
|------|------------|------------------|
| **Backend Developer 1** | Full-time (4 weeks) | Auth, Database, OCR integration |
| **Backend Developer 2** | Full-time (4 weeks) | Upload, LLM integration, Processing logic |
| **Frontend Developer** | Full-time (2 weeks, then part-time) | React UI, HITL interface |
| **Technical Lead** | Part-time (50%, 4 weeks) | Architecture decisions, code review, demo |

**Total**: 3.5 FTE for 4 weeks = **14 person-weeks**

### Infrastructure Costs (PoC)

| Resource | Cost | Notes |
|----------|------|-------|
| **Development** | $0 | Local machines + Docker |
| **Staging/Demo** | $50-100 | Single EC2 t3.medium (2 vCPU, 4GB RAM) |
| **Database** | $0 | PostgreSQL in Docker (local) or RDS free tier |
| **Storage** | $5-10 | S3 for documents (10-20 GB) |
| **Claude API** | $50-100 | ~1000-2000 API calls for testing |
| **Google Cloud Vision** | $0-20 | Optional, 1000 free calls/month |
| **Domain & SSL** | $20 | Optional for demo URL |
| **Total** | **$125-250** | For entire 4-week PoC |

### Test Data Requirements

| Item | Quantity | Source |
|------|----------|--------|
| **Sample Timetables** | 50-100 | Schools, online templates, generated |
| **Variety** | Mixed | Typed, scanned, color-coded, handwritten |
| **Format Distribution** | 60% images, 40% PDFs | Representative mix |
| **Quality Levels** | Low, medium, high | Test robustness |

---

## Success Criteria

### Technical Success Criteria

| Criterion | Target | Measurement Method |
|-----------|--------|-------------------|
| **OCR Accuracy** | >85% for clear documents | Manual review of 50 documents |
| **LLM Accuracy** | >95% for complex documents | Manual review of 20 documents |
| **Processing Time** | <30 seconds | System logs (average) |
| **Tesseract Success Rate** | >60% at confidence ≥98% | Pipeline metrics |
| **System Uptime** | 99%+ during testing | Monitoring logs |
| **No Data Loss** | 0 lost documents | Audit logs |

### Business Success Criteria

| Criterion | Target | Measurement Method |
|-----------|--------|-------------------|
| **User Completion Rate** | >80% | Analytics tracking (upload → view) |
| **Stakeholder Approval** | Positive feedback | Demo presentation |
| **Decision on Production Path** | Clear choice of Impl 1 or 2 | Cost and scale analysis |
| **Test User Satisfaction** | >4/5 rating | Survey (5-10 test users) |

### Demo Success Criteria

- [ ] Live upload and processing in front of stakeholders
- [ ] Display of 10+ successfully extracted timetables
- [ ] Demonstration of HITL workflow for low-confidence case
- [ ] Explanation of quality gates with real examples
- [ ] Q&A session with technical details

---

## Risk Mitigation

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **OCR accuracy lower than expected** | High | Medium | - Test with diverse dataset early<br>- Adjust confidence thresholds<br>- Fall back to LLM more aggressively |
| **Claude API rate limits** | Medium | Low | - Cache results<br>- Implement exponential backoff<br>- Have Google Cloud Vision as backup |
| **Processing time too slow** | Medium | Medium | - Optimize image preprocessing<br>- Use smaller models where possible<br>- Accept 30-60s for PoC |
| **Complex timetable layouts** | Medium | High | - Focus on common layouts initially<br>- Document known limitations<br>- HITL for edge cases |
| **Integration issues (Node.js ↔ Python)** | Low | Low | - Test integration early (Week 1)<br>- Use proven libraries (child_process) |

### Project Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Timeline slippage** | Medium | Medium | - Weekly checkpoint meetings<br>- Cut non-essential features<br>- Prioritize demo over polish |
| **Team availability** | High | Low | - Confirm commitment upfront<br>- Have backup developers identified |
| **Scope creep** | Medium | High | - Strict scope document<br>- "No" to new features during PoC<br>- Document for post-PoC |
| **Test data quality** | Medium | Medium | - Start collecting early<br>- Generate synthetic data if needed<br>- Accept imperfect test set |

---

## Evolution Decision Matrix

After PoC completion, use this matrix to decide on production architecture:

### Decision Factors

| Factor | Points to Impl 1 (Microservices) | Points to Impl 2 (Serverless) |
|--------|-----------------------------------|-------------------------------|
| **Expected Volume** | >5,000 docs/day | <5,000 docs/day |
| **Team Size** | >5 developers + DevOps | <5 developers, no dedicated DevOps |
| **Budget** | >$10K/month infrastructure budget | <$10K/month infrastructure budget |
| **Timeline to Production** | 8+ weeks acceptable | Need launch in <6 weeks |
| **Control Requirements** | Need full infrastructure control | OK with managed services |
| **Latency Sensitivity** | Need <100ms API responses | OK with 200-500ms responses |
| **Vendor Preference** | Want cloud-agnostic | OK with AWS lock-in |

### Recommendation Logic

```
Score:
- Impl 1: Count of factors pointing to Impl 1
- Impl 2: Count of factors pointing to Impl 2

if (Impl 2 Score >= Impl 1 Score + 2):
    RECOMMEND: Implementation 2 (Serverless)
    REASON: Clear advantages in cost, speed, simplicity

elif (Impl 1 Score >= Impl 2 Score + 2):
    RECOMMEND: Implementation 1 (Microservices)
    REASON: Scale, control, and team capability justify complexity

else:
    RECOMMEND: Implementation 2 (Serverless)
    REASON: Start simple, migrate if needed
    CAVEAT: Plan migration to Impl 1 if volume grows >5K docs/day
```

---

## Post-PoC Next Steps

### Immediate Actions (Week 5)

1. **Demo to Stakeholders**
   - Present working PoC
   - Show metrics and learnings
   - Get feedback and approval

2. **Evaluate Architecture Decision**
   - Review volume projections
   - Assess team capability
   - Use decision matrix
   - Document chosen path

3. **Plan Production Migration**
   - Create detailed migration plan
   - Estimate timeline and resources
   - Identify gaps and risks

### Production Migration Timeline

**If choosing Implementation 2 (Serverless)** - RECOMMENDED:
```
Week 5-6:   Serverless infrastructure setup (Lambda, API Gateway, etc.)
Week 7-8:   Migrate API and processing to Lambda functions
Week 9-10:  Add Step Functions, EventBridge orchestration
Week 11-12: Testing, monitoring, security hardening
Week 13:    Production launch 🎉

Total: 8 weeks from PoC to Production
```

**If choosing Implementation 1 (Microservices)**:
```
Week 5-6:   Kubernetes cluster setup, service decomposition
Week 7-8:   Containerize services, add message queue
Week 9-10:  Monitoring stack (Prometheus, Grafana, ELK)
Week 11-12: Auto-scaling, HA configuration
Week 13-14: Testing and security hardening
Week 15:    Production launch

Total: 10-11 weeks from PoC to Production
```

---

## Sample Code Snippets

### PoC Processing Flow (Node.js)

```typescript
// src/services/processingService.ts

export class ProcessingService {
  async processDocument(documentId: string): Promise<ProcessingResult> {
    // 1. Fetch document from database
    const doc = await Document.findById(documentId);

    // 2. Classify document type
    const docType = this.classifyDocument(doc.filePath);

    // 3. Preprocess (if image)
    let processedPath = doc.filePath;
    if (docType === 'image') {
      processedPath = await this.runPythonScript('preprocess.py', doc.filePath);
    }

    // 4. Run OCR
    const ocrResult = await this.runPythonScript('ocr.py', processedPath);
    const { text, confidence } = JSON.parse(ocrResult);

    // 5. Quality gate decision
    let finalResult;
    if (confidence >= 98) {
      // High confidence: proceed with OCR result
      finalResult = { text, confidence, tier: 'tesseract' };
    } else if (confidence >= 80) {
      // Medium confidence: use LLM
      const llmResult = await this.runPythonScript('llm_extract.py', doc.filePath);
      finalResult = { ...JSON.parse(llmResult), tier: 'llm' };
    } else {
      // Low confidence: flag for human review
      await this.createHITLTask(documentId, { text, confidence });
      return { status: 'hitl_required', confidence };
    }

    // 6. Validate and store
    const timetable = await this.validateAndStore(documentId, finalResult);

    return { status: 'completed', timetableId: timetable.id };
  }

  private async runPythonScript(script: string, inputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      exec(`python3 python/${script} ${inputPath}`, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });
  }
}
```

### Python OCR Script

```python
# python/ocr.py

import sys
import json
import pytesseract
from PIL import Image

def calculate_confidence(data):
    """Calculate average confidence from Tesseract output"""
    confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
    return sum(confidences) / len(confidences) if confidences else 0

def main(image_path):
    # Load image
    image = Image.open(image_path)

    # Run Tesseract with data output
    data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)

    # Extract text
    text = pytesseract.image_to_string(image)

    # Calculate confidence
    confidence = calculate_confidence(data)

    # Return JSON result
    result = {
        'text': text,
        'confidence': round(confidence, 2),
        'word_count': len(text.split())
    }

    print(json.dumps(result))

if __name__ == '__main__':
    main(sys.argv[1])
```

---

## Conclusion

This PoC implementation provides a **rapid, low-risk path** to validate the Learning Yogi concept while maintaining flexibility to evolve into either production architecture. By focusing on core functionality and deferring non-essential features, the team can deliver a working prototype in **2-4 weeks** with minimal resources.

**Key Takeaways**:

1. **Start Simple**: Monolithic architecture for PoC
2. **Prove Core Value**: AI extraction accuracy is the critical hypothesis
3. **Stay Flexible**: Design allows evolution to either Implementation 1 or 2
4. **Move Fast**: 2-4 weeks to demo, 8-12 weeks to production
5. **Learn and Adapt**: Use PoC insights to inform architecture decision

**Recommended Path**:
PoC (4 weeks) → **Implementation 2 Serverless** (8 weeks) → Production Launch (Week 13) 🚀

---

**Next Document**: See `AIHorizontalService.md` for reusable AI infrastructure that can be integrated post-PoC to enable feature store, reinforcement learning, and responsible AI capabilities across the platform.

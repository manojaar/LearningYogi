# Migration Guide: POCDemo → POC1 (Microservices)

This guide provides step-by-step instructions for migrating the POCDemoImplementation to the POC1 microservices architecture.

## Overview

**POCDemo** → **POC1**
- **Architecture**: Monolithic → Microservices
- **Database**: SQLite → PostgreSQL
- **Storage**: Local filesystem → S3
- **Queue**: In-process → BullMQ (Redis)
- **Deployment**: Docker Compose → Kubernetes

## High-Level Comparison

| Aspect | POCDemo | POC1 |
|--------|---------|------|
| **Deployment** | Docker Compose | Kubernetes |
| **Database** | SQLite | PostgreSQL RDS |
| **Storage** | Local FS | S3 |
| **Queue** | In-process | BullMQ (Redis) |
| **Scaling** | Manual | Horizontal (HPA) |
| **Cost** | $0 (local) | $1,128/month |

## Migration Steps

### 1. Replace SQLite with PostgreSQL

#### 1.1 Update Database Connection

**Before** (POCDemo):
```typescript
// src/database/init.ts
import Database from 'better-sqlite3';
const db = new Database('app.db');
```

**After** (POC1):
```typescript
// src/database/init.ts
import { Pool } from 'pg';
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});
```

#### 1.2 Migrate Schema

Update SQL schema for PostgreSQL:

```sql
-- UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER,
    status VARCHAR(50) DEFAULT 'uploaded',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Processing jobs table
CREATE TABLE IF NOT EXISTS processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id),
    job_type VARCHAR(50),
    status VARCHAR(50),
    confidence REAL,
    result_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Timetables table
CREATE TABLE IF NOT EXISTS timetables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id),
    teacher_name VARCHAR(255),
    class_name VARCHAR(255),
    term VARCHAR(100),
    year INTEGER,
    timeblocks JSONB,
    confidence REAL,
    validated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_created ON documents(created_at);
CREATE INDEX idx_processing_jobs_document ON processing_jobs(document_id);
CREATE INDEX idx_timetables_document ON timetables(document_id);
```

#### 1.3 Update Models

Replace SQLite-specific code with PostgreSQL:

```typescript
// src/models/Document.ts
export class DocumentModel {
  async create(doc: DocumentData): Promise<DocumentRow> {
    const result = await this.pool.query(`
      INSERT INTO documents (id, filename, file_path, file_type, file_size, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [doc.id, doc.filename, doc.file_path, doc.file_type, doc.file_size, doc.status]);
    
    return result.rows[0];
  }
}
```

### 2. Replace Local Storage with S3

#### 2.1 Install AWS SDK

```bash
npm install aws-sdk
npm install --save-dev @types/aws-sdk
```

#### 2.2 Update Storage Service

**Before** (POCDemo):
```typescript
import * as fs from 'fs';

export class StorageService {
  async saveFile(buffer: Buffer, filename: string): Promise<string> {
    const filePath = path.join(this.basePath, filename);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }
}
```

**After** (POC1):
```typescript
import S3 from 'aws-sdk/clients/s3';

export class StorageService {
  private s3: S3;
  
  constructor() {
    this.s3 = new S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });
  }

  async saveFile(buffer: Buffer, filename: string): Promise<string> {
    const key = `uploads/${filename}`;
    
    await this.s3.putObject({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: 'image/png',
    }).promise();
    
    return key;
  }

  async getFile(key: string): Promise<Buffer> {
    const result = await this.s3.getObject({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
    }).promise();
    
    return result.Body as Buffer;
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3.deleteObject({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
    }).promise();
  }
}
```

### 3. Add BullMQ Message Queues

#### 3.1 Install Dependencies

```bash
npm install bullmq ioredis
```

#### 3.2 Setup Redis Connection

```typescript
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

const redisConnection = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

// Create queues
const classificationQueue = new Queue('classification', {
  connection: redisConnection,
});

const ocrQueue = new Queue('ocr', {
  connection: redisConnection,
});

const llmQueue = new Queue('llm', {
  connection: redisConnection,
});
```

#### 3.3 Create Workers

```typescript
// src/workers/classification.worker.ts
import { Worker } from 'bullmq';

const classificationWorker = new Worker('classification', async (job) => {
  // Process classification
  const { documentId } = job.data;
  // ... classification logic
}, {
  connection: redisConnection,
  concurrency: 5,
});

// src/workers/ocr.worker.ts
const ocrWorker = new Worker('ocr', async (job) => {
  const { documentId, imagePath } = job.data;
  // ... OCR processing
}, {
  connection: redisConnection,
  concurrency: 20,
});
```

#### 3.4 Replace Direct Calls with Queue Jobs

**Before** (POCDemo):
```typescript
// Direct processing call
const ocrResult = await processing.processOCR(imagePath);
```

**After** (POC1):
```typescript
// Enqueue job
await ocrQueue.add('process-ocr', {
  documentId,
  imagePath,
}, {
  priority: 10,
  attempts: 3,
});
```

### 4. Split into Microservices

#### 4.1 Create Separate Services

```
services/
├── api-service/          # Node.js Express API
├── classification-worker/ # Python classification
├── ocr-worker/           # Python OCR
├── llm-worker/           # Python LLM
└── validator-worker/     # Node.js validation
```

#### 4.2 API Service

Keep the main API in Node.js:

```typescript
// services/api-service/src/index.ts
import express from 'express';
import { Queue } from 'bullmq';

const app = express();
const classificationQueue = new Queue('classification', { ... });

app.post('/api/v1/documents/upload', async (req, res) => {
  // Upload to S3
  const s3Key = await storage.saveFile(buffer, filename);
  
  // Enqueue classification
  await classificationQueue.add('classify', { documentId, s3Key });
  
  res.json({ documentId });
});
```

#### 4.3 Python Worker Services

Create separate Python services for processing:

```python
# services/ocr-worker/app/main.py
from worker import create_worker
import redis
from bullmq import Worker

redis_conn = redis.Redis(host='redis', port=6379)

def process_ocr(job):
    # OCR processing logic
    pass

worker = Worker('ocr', process_ocr, redis_conn)
```

### 5. Deploy to Kubernetes

#### 5.1 Create Kubernetes Manifests

```yaml
# k8s/api-service-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-service
  template:
    metadata:
      labels:
        app: api-service
    spec:
      containers:
      - name: api-service
        image: learningyogi/api-service:latest
        ports:
        - containerPort: 4000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        - name: REDIS_HOST
          value: redis-service
---
apiVersion: v1
kind: Service
metadata:
  name: api-service
spec:
  selector:
    app: api-service
  ports:
  - port: 80
    targetPort: 4000
  type: LoadBalancer
```

#### 5.2 Setup PostgreSQL

```yaml
# k8s/postgres-deployment.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 1
  template:
    spec:
      containers:
      - name: postgres
        image: postgres:14
        env:
        - name: POSTGRES_DB
          value: learningyogi
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 20Gi
```

#### 5.3 Setup Redis

```yaml
# k8s/redis-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: redis-service
spec:
  selector:
    app: redis
  ports:
  - port: 6379
```

#### 5.4 Deploy

```bash
kubectl apply -f k8s/
```

## Configuration Changes

### Environment Variables

**Add**:
```bash
# PostgreSQL
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=learningyogi
POSTGRES_USER=admin
POSTGRES_PASSWORD=secure_password

# Redis
REDIS_HOST=redis-service
REDIS_PORT=6379

# AWS S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET=learning-yogi-documents
```

### Docker Compose for Development

```yaml
# docker-compose.k8s-dev.yml
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: learningyogi
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

  api-service:
    build: ./services/api-service
    depends_on:
      - postgres
      - redis

  # Add worker services...
```

## Testing Migration

1. **Test Database Migration**
```bash
# Export SQLite data
sqlite3 app.db .dump > backup.sql

# Convert to PostgreSQL format
# (manual conversion or use sqlite3-to-postgres)

# Import to PostgreSQL
psql -d learningyogi < backup.sql
```

2. **Test Storage Migration**
```bash
# Migrate files to S3
aws s3 sync ./data/uploads s3://learning-yogi-documents/uploads
```

3. **Test Queue Integration**
```bash
# Verify queues are working
redis-cli LLEN bull:classification:wait
```

## Rollback Plan

If issues occur:

1. Keep POCDemo running in parallel
2. Migrate data back from PostgreSQL to SQLite
3. Sync files back from S3 to local storage
4. Revert Kubernetes deployments

## Optional: AI Pipeline Integration

For enhanced AI capabilities, consider integrating **PoCAIPipeline** during migration:

### Benefits
- **Fine-tuned OCR Models**: Replace Tesseract with domain-specific models (LoRA/Distillation)
- **Fine-tuned Document Models**: Replace Claude API with custom models
- **Feature Store**: Feast-based feature store with Redis for analytics
- **MLOps**: Complete experiment tracking and model versioning

### Integration Steps

1. **Deploy PoCAIPipeline alongside POC1**:
   - Follow [PoCAIPipeline POC1 Migration Guide](../../PoCAIPipeline/docs/MIGRATION_POC1.md)
   - Deploy inference services as Kubernetes pods
   - Set up Feast feature store with Redis cluster

2. **Replace OCR Service**:
   ```python
   # Before (POCDemo)
   from app.services.ocr_service import OCRService
   
   # After (POC1 with PoCAIPipeline)
   from inference.ocr_service import FineTunedOCRService
   ocr_service = FineTunedOCRService(model_path="s3://models/ocr_lora")
   ```

3. **Replace Document Service**:
   ```python
   # Before (POCDemo)
   from app.services.claude_service import ClaudeService
   
   # After (POC1 with PoCAIPipeline)
   from inference.document_service import FineTunedDocumentService
   doc_service = FineTunedDocumentService(model_path="s3://models/document_lora")
   ```

4. **Update Kubernetes Deployments**:
   - Reference PoCAIPipeline models from S3
   - Configure model serving pods
   - Set up feature store Redis cluster

**See**: [PoCAIPipeline Integration Guide](../../PoCAIPipeline/docs/INTEGRATION.md) and [PoCAIPipeline POC1 Migration](../../PoCAIPipeline/docs/MIGRATION_POC1.md)

## Timeline

**Estimated Duration**: 2-3 weeks (4-5 weeks with PoCAIPipeline integration)

- Week 1: Database migration, storage migration
- Week 2: Queue implementation, service splitting
- Week 3: Kubernetes deployment, testing, optimization
- Week 4-5 (Optional): PoCAIPipeline integration, fine-tuned model deployment

## Support

For migration issues:
- Check logs: `kubectl logs -f <pod-name>`
- Verify connectivity: `kubectl exec -it <pod> -- curl ...`
- Review configurations: `kubectl describe <resource>`

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-01-01


# Database Schema - Implementation 1

## Overview

This document details the database schema for the microservices architecture. We use **PostgreSQL** as the primary OLTP database, **Redis** for caching and queuing, and **TimescaleDB** for time-series analytics.

---

## PostgreSQL Schema

### Entity Relationship Diagram

```
┌──────────────┐         ┌────────────────┐         ┌──────────────┐
│    users     │         │   timetables   │         │  timeblocks  │
│──────────────│         │────────────────│         │──────────────│
│ id (PK)      │────────<│ user_id (FK)   │────────<│ timetable_id │
│ email        │         │ id (PK)        │         │ id (PK)      │
│ password_hash│         │ name           │         │ name         │
│ first_name   │         │ term           │         │ start_time   │
│ last_name    │         │ year           │         │ end_time     │
│ role         │         │ status         │         │ duration     │
│ created_at   │         │ created_at     │         │ day_of_week  │
│ updated_at   │         │ updated_at     │         │ notes        │
└──────────────┘         └────────────────┘         │ color        │
                                  │                  │ position     │
                                  │                  │ created_at   │
                         ┌────────┴────────┐        │ updated_at   │
                         │                 │        └──────────────┘
                         ▼                 ▼
                ┌──────────────┐   ┌──────────────┐
                │  documents   │   │ processing_  │
                │──────────────│   │    jobs      │
                │ id (PK)      │   │──────────────│
                │ timetable_id │   │ id (PK)      │
                │ file_name    │   │ timetable_id │
                │ file_type    │   │ document_id  │
                │ file_size    │   │ user_id (FK) │
                │ s3_key       │   │ status       │
                │ s3_bucket    │   │ stage        │
                │ upload_status│   │ confidence   │
                │ created_at   │   │ error_message│
                │ updated_at   │   │ metadata     │
                └──────────────┘   │ started_at   │
                                   │ completed_at │
                                   │ created_at   │
                                   │ updated_at   │
                                   └──────────────┘
                                          │
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │  hitl_tasks  │
                                   │──────────────│
                                   │ id (PK)      │
                                   │ job_id (FK)  │
                                   │ assigned_to  │
                                   │ draft_data   │
                                   │ final_data   │
                                   │ status       │
                                   │ created_at   │
                                   │ completed_at │
                                   └──────────────┘
```

---

## Table Definitions

### 1. users

Stores user account information and authentication credentials.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'teacher'
        CHECK (role IN ('teacher', 'admin', 'reviewer')),
    email_verified BOOLEAN DEFAULT FALSE,
    profile_image_url TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Trigger for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

**Sample Data**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john.smith@school.edu",
  "first_name": "John",
  "last_name": "Smith",
  "role": "teacher",
  "settings": {
    "notifications": {
      "email": true,
      "push": true
    },
    "theme": "light",
    "language": "en"
  }
}
```

---

### 2. timetables

Stores timetable metadata for each teacher.

```sql
CREATE TABLE timetables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    class_name VARCHAR(100),
    term VARCHAR(50),
    year INTEGER NOT NULL,
    week_start_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'archived')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_timetables_user_id ON timetables(user_id);
CREATE INDEX idx_timetables_status ON timetables(status);
CREATE INDEX idx_timetables_year ON timetables(year);
CREATE INDEX idx_timetables_created_at ON timetables(created_at);

-- Composite index for common queries
CREATE INDEX idx_timetables_user_status ON timetables(user_id, status);

-- Full-text search on name and class_name
CREATE INDEX idx_timetables_search ON timetables
    USING GIN (to_tsvector('english', name || ' ' || COALESCE(class_name, '')));

-- Trigger for updated_at
CREATE TRIGGER update_timetables_updated_at
    BEFORE UPDATE ON timetables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

**Sample Data**:
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Class 2EJ - Autumn Term",
  "class_name": "2EJ",
  "term": "Autumn 2024",
  "year": 2024,
  "week_start_date": "2024-09-01",
  "status": "active",
  "metadata": {
    "totalWeeks": 12,
    "breakWeeks": [6],
    "schoolName": "Little Themed Primary School"
  }
}
```

---

### 3. timeblocks

Stores individual timetable events/lessons.

```sql
CREATE TABLE timeblocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timetable_id UUID NOT NULL REFERENCES timetables(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    day_of_week VARCHAR(10) NOT NULL
        CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_time - start_time)) / 60
    ) STORED, -- Duration in minutes, auto-calculated
    notes TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color code
    position INTEGER DEFAULT 0, -- For custom ordering
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT check_start_before_end CHECK (start_time < end_time),
    CONSTRAINT check_valid_duration CHECK (
        EXTRACT(EPOCH FROM (end_time - start_time)) BETWEEN 300 AND 28800
    ) -- 5 minutes to 8 hours
);

-- Indexes
CREATE INDEX idx_timeblocks_timetable_id ON timeblocks(timetable_id);
CREATE INDEX idx_timeblocks_day ON timeblocks(day_of_week);
CREATE INDEX idx_timeblocks_start_time ON timeblocks(start_time);

-- Composite index for common queries (fetch all blocks for a day)
CREATE INDEX idx_timeblocks_timetable_day ON timeblocks(timetable_id, day_of_week, start_time);

-- Full-text search on name and notes
CREATE INDEX idx_timeblocks_search ON timeblocks
    USING GIN (to_tsvector('english', name || ' ' || COALESCE(notes, '')));

-- Trigger for updated_at
CREATE TRIGGER update_timeblocks_updated_at
    BEFORE UPDATE ON timeblocks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

**Sample Data**:
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "timetable_id": "660e8400-e29b-41d4-a716-446655440001",
  "name": "Maths",
  "day_of_week": "Monday",
  "start_time": "09:00:00",
  "end_time": "10:00:00",
  "duration": 60,
  "notes": "Focus on multiplication tables",
  "color": "#10B981",
  "position": 1,
  "metadata": {
    "subject": "Mathematics",
    "room": "Room 12",
    "teacher": "Ms. Johnson"
  }
}
```

---

### 4. documents

Stores uploaded document metadata and S3 references.

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timetable_id UUID REFERENCES timetables(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL
        CHECK (file_type IN ('image/png', 'image/jpeg', 'image/jpg', 'application/pdf',
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
    file_size BIGINT NOT NULL, -- bytes
    s3_bucket VARCHAR(255) NOT NULL,
    s3_key VARCHAR(512) NOT NULL,
    s3_version_id VARCHAR(255),
    upload_status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (upload_status IN ('pending', 'completed', 'failed')),
    mime_type VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_documents_timetable_id ON documents(timetable_id);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_upload_status ON documents(upload_status);
CREATE INDEX idx_documents_created_at ON documents(created_at);

-- Unique constraint for S3 location
CREATE UNIQUE INDEX idx_documents_s3_location ON documents(s3_bucket, s3_key);

-- Trigger for updated_at
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

**Sample Data**:
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "timetable_id": "660e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "file_name": "timetable_autumn_2024.pdf",
  "file_type": "application/pdf",
  "file_size": 524288,
  "s3_bucket": "learning-yogi-documents-prod",
  "s3_key": "uploads/2024/10/31/880e8400-e29b-41d4-a716-446655440003.pdf",
  "upload_status": "completed",
  "metadata": {
    "originalName": "Class 2EJ Timetable.pdf",
    "pageCount": 1,
    "dimensions": {"width": 2480, "height": 3508}
  }
}
```

---

### 5. processing_jobs

Tracks the status of document processing pipelines.

```sql
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    timetable_id UUID REFERENCES timetables(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'classifying', 'preprocessing', 'ocr',
                         'llm_processing', 'validating', 'completed', 'failed',
                         'hitl_pending', 'hitl_in_progress')),
    stage VARCHAR(50),
    confidence DECIMAL(5,2), -- 0.00 to 100.00
    processing_tier VARCHAR(20)
        CHECK (processing_tier IN ('tesseract', 'cloud_ocr', 'llm', 'hitl')),
    error_message TEXT,
    error_code VARCHAR(50),
    retry_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_processing_jobs_document_id ON processing_jobs(document_id);
CREATE INDEX idx_processing_jobs_timetable_id ON processing_jobs(timetable_id);
CREATE INDEX idx_processing_jobs_user_id ON processing_jobs(user_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_created_at ON processing_jobs(created_at);

-- Composite index for common queries
CREATE INDEX idx_processing_jobs_user_status ON processing_jobs(user_id, status);

-- Index for analytics queries
CREATE INDEX idx_processing_jobs_analytics ON processing_jobs(
    status, processing_tier, confidence, created_at
);

-- Trigger for updated_at
CREATE TRIGGER update_processing_jobs_updated_at
    BEFORE UPDATE ON processing_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

**Sample Data**:
```json
{
  "id": "990e8400-e29b-41d4-a716-446655440004",
  "document_id": "880e8400-e29b-41d4-a716-446655440003",
  "timetable_id": "660e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "stage": "validation",
  "confidence": 99.25,
  "processing_tier": "tesseract",
  "metadata": {
    "classification": "pdf",
    "pageCount": 1,
    "ocrEngine": "tesseract-5.3.0",
    "processingTime": {
      "classification": 850,
      "preprocessing": 420,
      "ocr": 1250,
      "validation": 180,
      "total": 2700
    }
  },
  "started_at": "2024-10-31T10:30:00Z",
  "completed_at": "2024-10-31T10:30:03Z"
}
```

---

### 6. hitl_tasks

Human-in-the-Loop tasks for manual review and correction.

```sql
CREATE TABLE hitl_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    priority VARCHAR(20) DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
    draft_data JSONB, -- Initial OCR/LLM output for reference
    final_data JSONB, -- Corrected data after human review
    review_notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    assigned_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_hitl_tasks_job_id ON hitl_tasks(job_id);
CREATE INDEX idx_hitl_tasks_assigned_to ON hitl_tasks(assigned_to);
CREATE INDEX idx_hitl_tasks_status ON hitl_tasks(status);
CREATE INDEX idx_hitl_tasks_priority ON hitl_tasks(priority);
CREATE INDEX idx_hitl_tasks_created_at ON hitl_tasks(created_at);

-- Composite index for task assignment queries
CREATE INDEX idx_hitl_tasks_status_priority ON hitl_tasks(status, priority, created_at);

-- Trigger for updated_at
CREATE TRIGGER update_hitl_tasks_updated_at
    BEFORE UPDATE ON hitl_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

**Sample Data**:
```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440005",
  "job_id": "990e8400-e29b-41d4-a716-446655440004",
  "assigned_to": "550e8400-e29b-41d4-a716-446655440999",
  "priority": "normal",
  "status": "completed",
  "draft_data": {
    "timeblocks": [
      {
        "name": "Maths (OCR: uncertain)",
        "day": "Monday",
        "startTime": "09:00",
        "endTime": "10:00"
      }
    ]
  },
  "final_data": {
    "timeblocks": [
      {
        "name": "Maths",
        "day": "Monday",
        "startTime": "09:00",
        "endTime": "10:00"
      }
    ]
  },
  "review_notes": "Corrected subject name from unclear OCR"
}
```

---

### 7. audit_logs

Audit trail for compliance and debugging.

```sql
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Partition by month for performance
CREATE TABLE audit_logs_y2024m10 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
```

---

## Helper Functions

### update_updated_at_column()

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Views

### v_active_timetables

View for quickly accessing active timetables with user info.

```sql
CREATE VIEW v_active_timetables AS
SELECT
    t.id,
    t.name,
    t.class_name,
    t.term,
    t.year,
    t.status,
    t.created_at,
    t.updated_at,
    u.id AS user_id,
    u.email,
    u.first_name,
    u.last_name,
    COUNT(DISTINCT tb.id) AS timeblock_count,
    COUNT(DISTINCT d.id) AS document_count
FROM timetables t
INNER JOIN users u ON t.user_id = u.id
LEFT JOIN timeblocks tb ON t.id = tb.timetable_id
LEFT JOIN documents d ON t.id = d.timetable_id
WHERE t.status = 'active'
GROUP BY t.id, u.id;
```

### v_processing_queue_stats

View for monitoring queue health.

```sql
CREATE VIEW v_processing_queue_stats AS
SELECT
    status,
    processing_tier,
    COUNT(*) AS job_count,
    AVG(confidence) AS avg_confidence,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) AS avg_duration_seconds,
    MIN(created_at) AS oldest_job,
    MAX(created_at) AS newest_job
FROM processing_jobs
WHERE status IN ('pending', 'classifying', 'preprocessing', 'ocr', 'llm_processing', 'validating')
GROUP BY status, processing_tier;
```

---

## Redis Schema

### Key Patterns

#### 1. Session Storage
```
Pattern: session:{userId}
Type: Hash
TTL: 7 days
Value: { userId, email, role, lastAccess, ... }

Example:
session:550e8400-e29b-41d4-a716-446655440000
```

#### 2. OCR Result Cache
```
Pattern: ocr:result:{documentHash}
Type: String (JSON)
TTL: 30 days
Value: { text, confidence, layout, ... }

Example:
ocr:result:sha256:abc123...
```

#### 3. LLM Result Cache
```
Pattern: llm:result:{documentHash}:{promptHash}
Type: String (JSON)
TTL: 90 days
Value: { timeblocks: [...], metadata: {...} }

Example:
llm:result:sha256:abc123...:sha256:def456...
```

#### 4. Rate Limiting
```
Pattern: ratelimit:{userId}:{endpoint}
Type: String (counter)
TTL: 1 hour
Value: request count

Example:
ratelimit:550e8400-e29b-41d4-a716-446655440000:/api/v1/documents/upload
```

#### 5. Job Progress
```
Pattern: job:progress:{jobId}
Type: Hash
TTL: 7 days
Value: { status, stage, progress, confidence, ... }

Example:
job:progress:990e8400-e29b-41d4-a716-446655440004
```

#### 6. WebSocket Subscriptions
```
Pattern: ws:subscriptions:{userId}
Type: Set
TTL: None (managed by application)
Value: Set of jobIds user is subscribed to

Example:
ws:subscriptions:550e8400-e29b-41d4-a716-446655440000
```

#### 7. BullMQ Queues
```
Pattern: bull:{queueName}:{type}
Types: wait, active, completed, failed, delayed
Managed by BullMQ automatically

Examples:
bull:classification-queue:wait
bull:ocr-queue:active
bull:llm-queue:completed
```

---

## TimescaleDB Schema

### Time-series Tables

#### 1. processing_metrics

Tracks processing performance metrics over time.

```sql
CREATE TABLE processing_metrics (
    time TIMESTAMPTZ NOT NULL,
    job_id UUID,
    user_id UUID,
    document_type VARCHAR(50),
    processing_tier VARCHAR(20),
    stage VARCHAR(50),
    duration_ms INTEGER,
    confidence DECIMAL(5,2),
    success BOOLEAN,
    error_code VARCHAR(50),
    metadata JSONB
);

-- Convert to hypertable (TimescaleDB)
SELECT create_hypertable('processing_metrics', 'time');

-- Create indexes
CREATE INDEX idx_processing_metrics_user_time ON processing_metrics(user_id, time DESC);
CREATE INDEX idx_processing_metrics_tier_time ON processing_metrics(processing_tier, time DESC);
CREATE INDEX idx_processing_metrics_stage ON processing_metrics(stage, time DESC);

-- Create continuous aggregate for hourly stats
CREATE MATERIALIZED VIEW processing_metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    processing_tier,
    COUNT(*) AS total_jobs,
    AVG(duration_ms) AS avg_duration_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration_ms,
    AVG(confidence) AS avg_confidence,
    SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*) AS success_rate
FROM processing_metrics
GROUP BY bucket, processing_tier;

-- Refresh policy (refresh every hour, lag 1 hour)
SELECT add_continuous_aggregate_policy('processing_metrics_hourly',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');
```

#### 2. api_metrics

Tracks API request metrics.

```sql
CREATE TABLE api_metrics (
    time TIMESTAMPTZ NOT NULL,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    status_code INTEGER,
    duration_ms INTEGER,
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB
);

SELECT create_hypertable('api_metrics', 'time');

CREATE INDEX idx_api_metrics_endpoint_time ON api_metrics(endpoint, time DESC);
CREATE INDEX idx_api_metrics_user_time ON api_metrics(user_id, time DESC);
CREATE INDEX idx_api_metrics_status ON api_metrics(status_code, time DESC);
```

---

## Data Retention Policies

### PostgreSQL

```sql
-- Delete old audit logs (keep 1 year)
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '1 year';

-- Archive old completed jobs (move to cold storage after 90 days)
-- Keep in hot database for 90 days, then archive
```

### Redis

```
- Session: 7 days TTL
- OCR cache: 30 days TTL
- LLM cache: 90 days TTL
- Rate limit: 1 hour TTL
- Job progress: 7 days TTL
```

### TimescaleDB

```sql
-- Retention policy: Keep raw data for 30 days, aggregates for 1 year
SELECT add_retention_policy('processing_metrics', INTERVAL '30 days');
SELECT add_retention_policy('api_metrics', INTERVAL '30 days');

-- Keep aggregates longer
SELECT add_retention_policy('processing_metrics_hourly', INTERVAL '1 year');
```

---

## Database Performance Optimization

### Connection Pooling

```javascript
// PgBouncer configuration
[databases]
learningyogi = host=postgres-primary port=5432 dbname=learningyogi

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
reserve_pool_size = 5
reserve_pool_timeout = 3
```

### Query Optimization

**Common Queries**:

1. **Fetch user's active timetables**:
```sql
SELECT t.*, COUNT(tb.id) as timeblock_count
FROM timetables t
LEFT JOIN timeblocks tb ON t.id = tb.timetable_id
WHERE t.user_id = $1 AND t.status = 'active'
GROUP BY t.id
ORDER BY t.updated_at DESC
LIMIT 10;

-- Uses index: idx_timetables_user_status
```

2. **Fetch timetable with all timeblocks**:
```sql
SELECT
    t.*,
    json_agg(
        json_build_object(
            'id', tb.id,
            'name', tb.name,
            'dayOfWeek', tb.day_of_week,
            'startTime', tb.start_time,
            'endTime', tb.end_time,
            'duration', tb.duration,
            'notes', tb.notes,
            'color', tb.color
        ) ORDER BY tb.day_of_week, tb.start_time
    ) as timeblocks
FROM timetables t
LEFT JOIN timeblocks tb ON t.id = tb.timetable_id
WHERE t.id = $1
GROUP BY t.id;

-- Uses indexes: idx_timeblocks_timetable_day
```

3. **Fetch processing job status**:
```sql
SELECT
    pj.*,
    d.file_name,
    d.file_type,
    t.name as timetable_name
FROM processing_jobs pj
INNER JOIN documents d ON pj.document_id = d.id
LEFT JOIN timetables t ON pj.timetable_id = t.id
WHERE pj.id = $1;

-- Uses primary keys and foreign key indexes
```

### Backup Strategy

```bash
# Daily full backup
pg_dump -h postgres-primary -U postgres -d learningyogi -F c -f backup_$(date +%Y%m%d).dump

# Continuous archiving (WAL)
# Enable in postgresql.conf:
# wal_level = replica
# archive_mode = on
# archive_command = 'aws s3 cp %p s3://learning-yogi-backups/wal/%f'

# Point-in-time recovery available
```

---

## Database Migration Strategy

### Tool: Flyway or Prisma Migrate

**Migration Naming**:
```
V001__initial_schema.sql
V002__add_hitl_tasks_table.sql
V003__add_processing_tier_index.sql
V004__add_audit_logs_partition.sql
```

**Migration Process**:
1. Test migration in development
2. Run on staging
3. Backup production database
4. Run migration on production during low-traffic window
5. Verify data integrity
6. Rollback plan ready

---

## Conclusion

This database schema provides:
- **Scalability**: Partitioning, indexing, and caching strategies
- **Performance**: Optimized queries and connection pooling
- **Reliability**: ACID compliance, backups, and replication
- **Flexibility**: JSONB columns for extensibility
- **Observability**: Audit logs and metrics tables

The schema supports the full document processing pipeline while maintaining data integrity and enabling fast queries for the frontend.

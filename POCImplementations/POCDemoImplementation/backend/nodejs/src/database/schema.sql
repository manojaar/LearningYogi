-- Database schema for Learning Yogi POC Demo
-- SQLite compatible

CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    status TEXT DEFAULT 'uploaded',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS processing_jobs (
    id TEXT PRIMARY KEY,
    document_id TEXT REFERENCES documents(id),
    job_type TEXT,  -- 'ocr', 'ai', 'validation'
    status TEXT,    -- 'pending', 'processing', 'completed', 'failed'
    confidence REAL,
    result_data TEXT,  -- JSON
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS timetables (
    id TEXT PRIMARY KEY,
    document_id TEXT REFERENCES documents(id),
    teacher_name TEXT,
    class_name TEXT,
    term TEXT,
    year INTEGER,
    saved_name TEXT,  -- User-defined name for saving timetable
    timeblocks TEXT,  -- JSON array
    confidence REAL,
    validated BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Processing events table for SSE audit trail
CREATE TABLE IF NOT EXISTS processing_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL REFERENCES documents(id),
    event_type TEXT NOT NULL,  -- 'progress', 'complete', 'error', 'connected'
    step_name TEXT,
    percentage INTEGER,
    message TEXT,
    data TEXT,  -- JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job queue table (for tracking async jobs)
CREATE TABLE IF NOT EXISTS job_queue (
    id TEXT PRIMARY KEY,  -- UUID
    document_id TEXT NOT NULL REFERENCES documents(id),
    job_type TEXT NOT NULL,  -- 'extraction', 'ocr', 'preprocessing'
    status TEXT NOT NULL,  -- 'queued', 'processing', 'completed', 'failed'
    priority INTEGER DEFAULT 0,
    progress INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_document ON processing_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_timetables_document ON timetables(document_id);
CREATE INDEX IF NOT EXISTS idx_processing_events_document ON processing_events(document_id);
CREATE INDEX IF NOT EXISTS idx_processing_events_created ON processing_events(created_at);
CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_document ON job_queue(document_id);


# Architecture Documentation - POCDemoImplementation

## System Overview

The POCDemoImplementation is a local-first development and demonstration environment for the Learning Yogi timetable extraction platform. It provides a complete working implementation that can run entirely on a local machine without cloud services.

## Design Principles

1. **Local-First**: All services run locally, no AWS/cloud dependencies
2. **Easy Setup**: Docker Compose for one-command deployment
3. **Production-Ready Patterns**: Code structured for easy cloud migration
4. **TDD Approach**: Comprehensive tests with sample data
5. **Modular Design**: Clear separation of concerns

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER / CLIENT                           │
│  (React Frontend + Chatbot UI Widget)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               Node.js API Layer                             │
│  (Express + TypeScript)                                     │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Upload API   │  │ Status API   │  │ Retrieve API │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │          Processing Orchestration                   │    │
│  └────────────────────────────────────────────────────┘    │
└────┬────────────────────────────────────┬──────────────────┘
     │                                    │
     ▼                                    ▼
┌──────────────────────┐    ┌──────────────────────────────────┐
│ Python AI Middleware │    │    AI Chatbot Service            │
│ (FastAPI)            │    │    (FastAPI)                     │
│                      │    │                                  │
│ ┌──────────────────┐ │    │ ┌──────────────────────────┐   │
│ │ Preprocessor     │ │    │ │ AI Provider Service      │   │
│ │ (OpenCV)         │ │    │ │ - Claude API             │   │
│ └──────────────────┘ │    │ │ - OpenAI API             │   │
│                      │    │ │ - Local LLM              │   │
│ ┌──────────────────┐ │    │ └──────────────────────────┘   │
│ │ OCR Service      │ │    │ ┌──────────────────────────┐   │
│ │ (Tesseract)      │ │    │ │ Context Service          │   │
│ └──────────────────┘ │    │ │ - Database queries       │   │
│                      │    │ │ - Knowledge base          │   │
│ ┌──────────────────┐ │    │ └──────────────────────────┘   │
│ │ Claude AI        │ │    │ ┌──────────────────────────┐   │
│ │ Service          │ │    │ │ Session Management       │   │
│ └──────────────────┘ │    │ └──────────────────────────┘   │
└──────────┬───────────┘    └───────────┬────────────────────┘
           │                            │
           └──────────┬─────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                               │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ SQLite       │  │ Local        │  │ In-Memory    │    │
│  │ Database     │  │ File Storage │  │ Cache        │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### Node.js API Layer

**Technology**: Express 4, TypeScript, better-sqlite3

**Responsibilities**:
- File upload handling
- Database operations
- Processing orchestration
- API endpoint management

**Key Services**:

**DocumentService**:
- Uploads files to storage
- Creates database records
- Triggers processing pipeline
- Manages document lifecycle

**StorageService**:
- Abstract file storage interface
- Local filesystem implementation
- Ready for S3 migration

**ProcessingService**:
- Orchestrates OCR → AI pipeline
- Calls Python middleware APIs
- Handles quality gate routing

**ValidationService**:
- Validates extracted data
- Checks time conflicts
- Ensures data integrity

**API Endpoints**:
- `POST /api/v1/documents/upload` - Upload document
- `GET /api/v1/documents/:id` - Get document
- `GET /api/v1/documents` - List documents
- `DELETE /api/v1/documents/:id` - Delete document

### Python AI Middleware

**Technology**: FastAPI, Tesseract, Anthropic Claude API

**Responsibilities**:
- Image preprocessing
- OCR processing
- AI extraction
- Quality gate decisions

**Key Services**:

**ImagePreprocessor**:
- Converts to grayscale
- Applies noise reduction
- Performs adaptive thresholding
- Outputs optimized image for OCR

**OCRService**:
- Runs Tesseract OCR
- Calculates confidence scores
- Extracts word-level data
- Determines quality gate routing

**ClaudeService**:
- Calls Claude Vision API
- Processes structured extraction
- Validates JSON output
- Handles API errors

**Note**: This service can be replaced with PoCAIPipeline's fine-tuned document models for better accuracy and lower costs. See [PoCAIPipeline Integration Guide](../PoCAIPipeline/docs/INTEGRATION.md).

**API Endpoints**:
- `POST /preprocess/enhance` - Preprocess image
- `POST /ocr/process` - Run OCR
- `POST /ocr/quality-gate` - Get quality gate
- `POST /ai/extract` - Extract with AI
- `GET /health` - Health check

### AI Chatbot Service

**Technology**: FastAPI, Anthropic Claude API / OpenAI API / Local LLM

**Responsibilities**:
- Context-aware conversational assistance
- Document and timetable information queries
- Knowledge base management
- Session management

**Key Services**:

**AIProviderService**:
- Multiple provider support (Claude, OpenAI, Local LLM)
- Automatic fallback mechanism
- Provider preference configuration
- Streaming support

**ContextService**:
- Database integration for document status queries
- Knowledge base retrieval (FAQ, help content)
- Timetable information extraction
- Context-aware responses

**SessionManagement**:
- Conversation history tracking
- Multi-turn dialogue support
- Session cleanup and expiration

**API Endpoints**:
- `POST /api/v1/chat` - Send chat message
- `GET /api/v1/chat/session/{session_id}` - Get chat history
- `DELETE /api/v1/chat/session/{session_id}` - Delete session
- `GET /health` - Health check with provider status

**Integration**: The chatbot service runs as a separate container but shares the same database for context awareness. The frontend integrates a React component that communicates with this service.

### Data Layer

**SQLite Database**:
- `documents` table: Document metadata
- `timetables` table: Extracted timetable data
- `processing_jobs` table: Job tracking

**Local File Storage**:
- `uploads/` directory: Original files
- `processed/` directory: Enhanced images

**Optional PostgreSQL**:
- Same schema with enhanced types
- JSONB for structured data
- Docker Compose setup available

## Processing Pipeline

### Flow Diagram

```
Upload Document
      ↓
Save to Storage
      ↓
Create DB Record
      ↓
Preprocess Image (OpenCV)
      ↓
Run OCR (Tesseract)
      ↓
Calculate Confidence
      ↓
┌─────────Quality Gate─────────┐
│                               │
▼                               ▼
High Confidence (≥80%)    Low Confidence (<80%)
      ↓                               ↓
Direct Validation            Claude AI Extraction
      ↓                               ↓
      └───────────Validation──────────┘
                ↓
          Store Results
                ↓
          Update Status
```

### Quality Gate Logic

**Threshold**: 80% confidence

**Routes**:
- **≥80%**: Direct validation (sufficient OCR quality)
- **<80%**: Claude AI enhancement (needs AI processing)

**Confidence Calculation**:
- 40%: Mean character confidence
- 20%: Dictionary match rate
- 20%: Layout consistency
- 20%: Time pattern detection

## Data Models

### Document Model

```typescript
interface Document {
  id: string;              // UUID
  filename: string;
  file_path: string;
  file_type: string;       // image, pdf
  file_size: number;
  status: string;          // uploaded, processing, completed, failed
  created_at: timestamp;
}
```

### Timetable Model

```typescript
interface Timetable {
  id: string;              // UUID
  document_id: string;
  teacher_name: string;
  class_name: string;
  term: string;
  year: number;
  timeblocks: TimeBlock[]; // JSON array
  confidence: number;      // 0-1
  validated: boolean;
  created_at: timestamp;
}
```

### TimeBlock Model

```typescript
interface TimeBlock {
  day: string;             // Monday-Friday
  name: string;            // Subject/event name
  startTime: string;       // HH:MM 24-hour
  endTime: string;         // HH:MM 24-hour
  notes?: string;
}
```

## API Contracts

### OCR Result

```json
{
  "text": "Full extracted text",
  "confidence": 0.85,
  "words": [
    {
      "text": "Monday",
      "confidence": 0.95,
      "left": 10,
      "top": 20,
      "width": 100,
      "height": 30
    }
  ],
  "engine": "tesseract"
}
```

### Timetable Data

```json
{
  "teacher": "Mr. Smith",
  "className": "Grade 5",
  "term": "Term 1",
  "year": 2024,
  "timeblocks": [
    {
      "day": "Monday",
      "name": "Mathematics",
      "startTime": "09:00",
      "endTime": "10:00",
      "notes": null
    }
  ]
}
```

## Security Considerations

### Current Implementation (POC)

- Basic CORS configuration
- File upload validation
- SQL injection protection (parameterized queries)
- Environment variable management

### Production Enhancements

- Authentication (JWT tokens)
- Authorization (RBAC)
- HTTPS/TLS
- Rate limiting
- Input sanitization
- API key management

## Migration Paths

### To POC1 (Microservices)

1. Replace SQLite with PostgreSQL
2. Add Redis for caching
3. Add BullMQ for message queues
4. Split into microservices
5. Deploy to Kubernetes
6. **Optional**: Integrate PoCAIPipeline for fine-tuned models

**See**: MIGRATION_TO_POC1.md

### To POC2 (Serverless)

1. Convert to Lambda functions
2. Replace SQLite with Aurora Serverless
3. Add Step Functions
4. Replace local storage with S3
5. Deploy with AWS SAM
6. **Optional**: Integrate PoCAIPipeline for fine-tuned models

**See**: MIGRATION_TO_POC2.md

### AI Pipeline Enhancement

For enhanced AI capabilities, integrate **PoCAIPipeline**:

- Replace OCR service with fine-tuned OCR models (LoRA/Distillation)
- Replace Claude API with fine-tuned document understanding models
- Add Feast feature store for analytics and model improvements
- Enable complete MLOps lifecycle (experiment tracking, model registry)

**See**: [PoCAIPipeline Integration Guide](../PoCAIPipeline/docs/INTEGRATION.md)

## Performance Characteristics

### Typical Processing Times

| Stage | Time | Notes |
|-------|------|-------|
| Upload | <1s | File transfer |
| Preprocess | <500ms | Image enhancement |
| OCR | 1-3s | Tesseract processing |
| AI Extraction | 5-10s | Claude API call |
| Validation | <100ms | Data checks |
| **Total (High Conf)** | **6-8s** | Direct path |
| **Total (Low Conf)** | **15-20s** | With AI |

### Resource Usage

| Component | CPU | Memory | Disk |
|-----------|-----|--------|------|
| Node.js API | Low | 100MB | 10MB |
| Python AI | Medium | 200MB | 50MB |
| SQLite DB | Low | 50MB | 100MB |
| **Total** | **Low** | **350MB** | **160MB** |

## Testing Strategy

### Unit Tests

- Service logic validation
- Confidence calculation
- Validation rules
- Error handling

### Integration Tests

- Full pipeline execution
- API endpoint testing
- Database operations
- Cross-service communication

### E2E Tests

- Complete user workflows
- Sample timetable processing
- Error scenarios
- Performance benchmarking

## Monitoring and Observability

### Current (POC)

- Console logging
- Error stack traces
- Basic health checks

### Production Additions

- Structured logging (Winston)
- Request tracing
- Performance metrics
- Error tracking (Sentry)
- Health dashboards

## Scalability Considerations

### Current Limitations

- Single instance only
- SQLite not suitable for high concurrency
- Local storage limits
- No load balancing

### Scaling Options

- **Vertical**: Larger machine
- **Horizontal**: Multiple instances
- **Database**: PostgreSQL cluster
- **Storage**: S3/object storage
- **Caching**: Redis cluster

## Future Enhancements

1. React frontend for UI
2. Real-time status updates (WebSocket)
3. Batch processing support
4. Export formats (CSV, iCal)
5. Admin dashboard
6. Analytics and reporting

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-01-01


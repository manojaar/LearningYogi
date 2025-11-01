# POCDemoImplementation - Learning Yogi Timetable Extraction Platform

## Overview

This is a locally runnable proof-of-concept implementation of the Learning Yogi timetable extraction platform. It demonstrates the core functionality of converting school timetable images into structured digital formats using OCR and AI without requiring cloud infrastructure.

**Key Features:**
- ✅ OCR processing with Tesseract and confidence scoring
- ✅ Claude AI integration for low-confidence extractions
- ✅ **AI Chatbot Assistant** (context-aware, multiple AI providers)
- ✅ 3-tier quality gate system
- ✅ Local-first architecture (SQLite, filesystem storage)
- ✅ Docker Compose for easy deployment
- ✅ Test-Driven Development with sample timetables
- ✅ Clear migration path to production (POC1/POC2)

**Tech Stack:**
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **API Layer**: Node.js 20 + Express + TypeScript
- **AI Middleware**: Python 3.11 + FastAPI + Claude Vision
- **Database**: SQLite (PostgreSQL optional)
- **Storage**: Local filesystem (S3-compatible interface)

**Optional: AI Pipeline Enhancement**
- Plug-and-play integration with PoCAIPipeline for fine-tuned models
- See [AI Pipeline Integration](#ai-pipeline-integration) section below

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- Claude API key ([get one here](https://console.anthropic.com/))

### Setup

1. **Clone and navigate to directory**
```bash
cd POCImplementations/POCDemoImplementation
```

2. **Configure environment**
```bash
cp env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

3. **Start services with Docker Compose**
```bash
docker-compose up -d
```

4. **Access services**
- Frontend: http://localhost:3000
- API: http://localhost:4000
- Python AI Middleware: http://localhost:8000
- AI Chatbot: http://localhost:9000
- API Docs: http://localhost:8000/docs (FastAPI auto-generated docs)

### Upload and Process a Timetable

**Via Web UI** (Recommended):
1. Open http://localhost:3000
2. Drag and drop a sample timetable from `data/sample_timetables/`
3. Watch the processing progress
4. View your beautiful timetable!

**Via API**:
```bash
# Upload a sample timetable
curl -X POST http://localhost:4000/api/v1/documents/upload \
  -F "file=@data/sample_timetables/Teacher Timetable Example 1.1.png"

# Check status
curl http://localhost:4000/api/v1/documents/{documentId}

# View extracted timetable
curl http://localhost:4000/api/v1/timetables/{timetableId}
```

## Architecture

### High-Level Flow

```
User Upload → Node.js API → File Storage
                ↓
        Python AI Middleware
                ↓
     [OCR Processing] → Confidence Score
                ↓
    Quality Gate Decision (≥80%)
                ↓
    ┌───────────┴───────────┐
    ↓                       ↓
Direct Validation    Claude AI Extraction
    ↓                       ↓
    └───────────┬───────────┘
                ↓
        Validation & Storage
                ↓
        Return Results

AI Chatbot Service (Parallel Service)
                ↓
    Context-aware AI Assistant
    - Document status queries
    - Timetable information
    - General help & FAQ
```

### Component Details

**Python AI Middleware (FastAPI)**
- `/preprocess/enhance` - Image enhancement for OCR
- `/ocr/process` - Tesseract OCR with confidence scoring
- `/ocr/quality-gate` - Quality gate routing decision
- `/ai/extract` - Claude Vision extraction

**Node.js API Layer**
- `/api/v1/documents/upload` - Upload and process documents
- `/api/v1/documents/:id` - Get document details
- `/api/v1/timetables/:id` - Get extracted timetable data

**React Frontend**
- Modern, responsive UI with TailwindCSS
- Drag-and-drop file upload
- Real-time processing status
- Weekly and daily timetable views
- Color-coded subjects by type
- Confidence indicators
- Export to CSV/JSON
- AI Chatbot floating widget

**AI Chatbot Service (FastAPI)**
- Context-aware document queries
- Timetable information retrieval
- Extensible knowledge base
- Multiple AI provider support (Claude, OpenAI, Local LLM)
- Session management and conversation history
- Database integration for context awareness

**Processing Pipeline**
1. Upload → Save to storage, create DB record
2. Preprocess → Enhance image (OpenCV)
3. OCR → Extract text + calculate confidence
4. Quality Gate → Route by confidence (≥80% threshold)
5. AI Processing → Claude Vision (if confidence < 80%)
6. Validation → Data integrity checks
7. Save → Store in database

## Database Schema

### Documents Table
- id, filename, file_path, file_type, file_size
- status (uploaded, processing, completed, failed)
- created_at

### Timetables Table
- id, document_id, teacher_name, class_name
- term, year, timeblocks (JSON)
- confidence, validated
- created_at

### Processing Jobs Table
- id, document_id, job_type (ocr, ai, validation)
- status (pending, processing, completed, failed)
- confidence, result_data, error_message
- created_at

## Testing

### Run Python Tests
```bash
cd backend/python
pytest --cov=app --cov-report=html
```

### Run Node.js Tests
```bash
cd backend/nodejs
npm test
npm run test:coverage
```

### Test with Sample Timetables
Sample timetables are available in `data/sample_timetables/`:
- Teacher Timetable Example 1.1.png
- Teacher Timetable Example 1.2.png
- Teacher Timetable Example 2.pdf
- Teacher Timetable Example 3.png
- Teacher Timetable Example 4.jpeg

## AI Chatbot Assistant

The AI Chatbot is a **core feature** that provides intelligent, context-aware assistance throughout the platform.

### Features

- **Context Awareness**: Understands document status, timetable information, and processing state
- **Multiple AI Providers**: Claude, OpenAI, or Local LLM support with automatic fallback
- **Knowledge Base**: Extensible FAQ and help content for timetable management
- **Floating UI Widget**: Accessible chat interface in bottom-right corner
- **Session Management**: Conversation history and continuity
- **Database Integration**: Queries real-time document and timetable data

### Usage

The chatbot appears as a floating button in the bottom-right corner of the frontend. Click to open the chat panel and ask questions like:
- "What's the status of my uploaded document?"
- "Show me classes scheduled on Monday"
- "What times does Mathematics class run?"

### Configuration

Environment variables in `.env`:
```bash
CHATBOT_PROVIDER_PREFERENCE=claude,openai,local
CHATBOT_ENABLE_CONTEXT=true
CHATBOT_CLAUDE_MODEL=claude-3-haiku-20240307
```

**See**: [AIChatbot Integration Guide](../AIChatbot/integration/POCDemoImplementation.md) for detailed configuration options.

## AI Pipeline Integration (Optional)

This implementation supports plug-and-play integration with **PoCAIPipeline** for enhanced AI capabilities:

- **Fine-tuned OCR Models**: Replace Tesseract with domain-specific fine-tuned models (LoRA or Knowledge Distillation)
- **Fine-tuned Document Models**: Replace Claude API calls with custom fine-tuned models for timetable extraction
- **Feature Store**: Optional Feast-based feature store with Redis for analytics and model improvements
- **MLOps Integration**: MLflow tracking, model versioning, and deployment pipelines

### Quick Integration

See the comprehensive integration guide: **[PoCAIPipeline Integration Guide](../PoCAIPipeline/docs/INTEGRATION.md)**

**Benefits:**
- Reduced API costs (fine-tuned models instead of Claude API)
- Better accuracy (domain-specific fine-tuning)
- Feature-driven improvements (Feast feature store)
- Complete MLOps lifecycle (experiment tracking, model registry)

## Migration to Production

This POC is designed to be easily migrated to production implementations:

### To POC1 (Microservices)
- Replace SQLite with PostgreSQL
- Replace local storage with S3
- Add BullMQ message queues
- Split into microservices
- Deploy to Kubernetes
- **Optional**: Integrate PoCAIPipeline for fine-tuned models (see [PoCAIPipeline POC1 Migration](../PoCAIPipeline/docs/MIGRATION_POC1.md))

**See:** [docs/MIGRATION_TO_POC1.md](docs/MIGRATION_TO_POC1.md)

### To POC2 (Serverless)
- Convert to Lambda functions
- Replace SQLite with Aurora Serverless
- Add Step Functions workflow
- Replace local storage with S3
- Deploy with AWS SAM
- **Optional**: Integrate PoCAIPipeline for fine-tuned models (see [PoCAIPipeline POC2 Migration](../PoCAIPipeline/docs/MIGRATION_POC2.md))

**See:** [docs/MIGRATION_TO_POC2.md](docs/MIGRATION_TO_POC2.md)

## Documentation

- [Quick Start](QUICKSTART.md) - Get started in 5 minutes
- [Setup Guide](docs/SETUP.md) - Detailed setup instructions
- [Architecture](docs/ARCHITECTURE.md) - System architecture and design
- [API Documentation](docs/API_DOCUMENTATION.md) - API endpoints reference
- [Features](docs/FEATURES.md) - Frontend features and design
- [Testing](docs/TESTING.md) - Testing strategies and guide
- [Migration to POC1](docs/MIGRATION_TO_POC1.md) - Microservices migration
- [Migration to POC2](docs/MIGRATION_TO_POC2.md) - Serverless migration
- [Production Readiness](docs/PRODUCTION_READINESS.md) - Production checklist
- [Implementation Summary](docs/IMPLEMENTATION_SUMMARY.md) - Complete overview

## Development

### Local Development

**Start Python AI Middleware:**
```bash
cd backend/python
pip install -r requirements.txt
python run.py
```

**Start Node.js API:**
```bash
cd backend/nodejs
npm install
npm run dev
```

**Start Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Or use Docker Compose** (Recommended):
```bash
docker-compose up -d
```

### Project Structure

```
POCDemoImplementation/
├── frontend/             # React application
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API clients
│   │   └── styles/       # Global styles
│   └── package.json
├── backend/
│   ├── python/           # FastAPI AI middleware
│   │   ├── app/
│   │   │   ├── api/      # API endpoints
│   │   │   ├── services/ # OCR, AI services
│   │   │   └── models/   # Pydantic models
│   │   ├── tests/        # Pytest tests
│   │   └── Dockerfile
│   └── nodejs/           # Node.js API layer
│       ├── src/
│       │   ├── routes/   # API routes
│       │   ├── services/ # Business logic
│       │   ├── models/   # Database models
│       │   └── database/ # Database init
│       ├── tests/        # Jest tests
│       └── Dockerfile
├── data/
│   ├── sample_timetables/ # Test images
│   ├── uploads/          # User uploads
│   ├── processed/        # Processed results
│   └── database/         # SQLite DB
├── docs/                 # Documentation
├── docker-compose.yml    # Docker setup
├── QUICKSTART.md         # Quick start guide
└── README.md            # This file
```

## Environment Variables

See `env.example` for required environment variables:

- `ANTHROPIC_API_KEY` - Claude API key (required)
- `PYTHON_API_URL` - Python AI middleware URL
- `STORAGE_PATH` - File storage path
- `DATABASE_URL` - Database connection string

## Contributing

This is a POC implementation. For production use:
1. Review security configurations
2. Add authentication and authorization
3. Configure proper monitoring
4. Add comprehensive error handling
5. Set up backup and recovery

## License

MIT License

## Support

- **Issues**: Report issues in GitHub Issues
- **Documentation**: See `/docs` folder
- **API Docs**: http://localhost:8000/docs (FastAPI auto-generated)

---

**Version**: 1.0.0  
**Status**: ✅ Functional POC  
**Last Updated**: 2025-01-01


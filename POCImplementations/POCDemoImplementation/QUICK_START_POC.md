# 🚀 Quick Start Guide - POCDemoImplementation
## Complete Setup & Testing Guide

**Version:** 2.0.0 (Async Architecture)  
**Status:** ✅ Ready to Use  
**Python Version:** 3.11 (Recommended Stable)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Python Environment Setup](#python-environment-setup)
3. [Environment Configuration](#environment-configuration)
4. [Install Dependencies](#install-dependencies)
5. [Build & Start Services](#build--start-services)
6. [Testing](#testing)
7. [Verification & Troubleshooting](#verification--troubleshooting)
8. [Quick Reference](#quick-reference)

---

## Prerequisites

### Required Software

- **Docker** and **Docker Compose** (latest version)
- **Node.js** 20+ (for local development)
- **Python 3.11** (for local development, Docker handles this)
- **Git** (for cloning repository)

### Required Accounts

- **Claude API Key** from Anthropic ([Get one here](https://console.anthropic.com/))
- **15 minutes** of setup time

### System Requirements

- **RAM:** Minimum 4GB (8GB recommended)
- **Disk Space:** 2GB free space
- **Internet:** Required for API calls and Docker images

---

## Python Environment Setup

### Option 1: Using Docker (Recommended)

The Docker setup uses **Python 3.11-slim**, which is automatically configured. No manual Python setup needed when using Docker.

### Option 2: Local Python Environment (For Development)

If developing locally without Docker:

```bash
# Check Python version (should be 3.11 or 3.12)
python3 --version

# Install Python 3.11 if not present (macOS)
brew install python@3.11

# Or use pyenv for version management
pyenv install 3.11.7
pyenv local 3.11.7

# Create virtual environment
cd POCImplementations/POCDemoImplementation/backend/python
python3.11 -m venv venv

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
# OR
.\venv\Scripts\activate  # Windows

# Verify Python version in venv
python --version  # Should show 3.11.x
```

**Note:** Python 3.11 is recommended for stability and compatibility with all dependencies. Python 3.12 is also supported but Python 3.11 is battle-tested.

---

## Environment Configuration

### Step 1: Navigate to Project

```bash
cd POCImplementations/POCDemoImplementation
```

### Step 2: Create Environment File

```bash
# Copy example environment file
cp env.example .env
```

### Step 3: Configure Environment Variables

Edit `.env` file with your preferred editor:

```bash
nano .env  # or use: vim, code, or any text editor
```

### Step 4: Required Configuration

**Minimum Required Settings:**

```bash
# Claude API Key (REQUIRED for AI features)
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here

# Redis Configuration (REQUIRED for async features)
REDIS_HOST=localhost
REDIS_PORT=6379

# Storage Path
STORAGE_PATH=./data/uploads

# Database Path
DATABASE_URL=./data/database/app.db
```

**Full Configuration Example:**

```bash
# Claude API Configuration
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here

# Python AI Middleware
PYTHON_API_URL=http://localhost:8000
STORAGE_PATH=./data/uploads

# Node.js API
NODEJS_PORT=4000
DATABASE_URL=./data/database/app.db

# Frontend
VITE_API_URL=http://localhost:4000

# Redis Configuration (Required for Async Architecture)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Job Queue Configuration
QUEUE_CONCURRENCY=2
QUEUE_MAX_RETRIES=3
QUEUE_TIMEOUT=300000

# Image Compression
MAX_IMAGE_DIMENSION=2048
IMAGE_QUALITY=85
OUTPUT_FORMAT=webp

# Development
NODE_ENV=development
LOG_LEVEL=info

# Optional: AI Chatbot Configuration
CHATBOT_PROVIDER_PREFERENCE=claude,openai,local
CHATBOT_CLAUDE_MODEL=claude-3-haiku-20240307
OPENAI_API_KEY=your_openai_api_key_here  # Optional
CHATBOT_ENABLE_CONTEXT=true
```

**Important:** Replace `your_anthropic_api_key_here` with your actual API key from Anthropic.

---

## Install Dependencies

### Method 1: Docker (Recommended - No Local Installation Needed)

Dependencies are installed automatically during Docker build. Skip to [Build & Start Services](#build--start-services).

### Method 2: Local Installation (For Development)

#### Backend Dependencies (Node.js)

```bash
cd backend/nodejs

# Install Node.js dependencies
npm install

# This installs:
# - express, cors, dotenv
# - better-sqlite3, multer, axios
# - bull (queue), ioredis (Redis client)
# - sharp (image processing)
# - uuid, winston

cd ../..
```

#### Backend Dependencies (Python)

```bash
cd backend/python

# Activate virtual environment (if using one)
source venv/bin/activate  # macOS/Linux

# Install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt

# This installs:
# - fastapi, uvicorn
# - anthropic[async] (Claude AI)
# - pillow, opencv-python-headless
# - pytesseract (OCR)
# - redis, httpx, PyMuPDF
# - pytest (testing)

cd ../..
```

**Verify Python Package Installation:**

```bash
python -c "import fastapi; import anthropic; import cv2; print('All packages installed!')"
```

#### Frontend Dependencies

```bash
cd frontend

# Install frontend dependencies
npm install

# This installs:
# - react, react-dom, react-router-dom
# - axios, lucide-react
# - framer-motion (animations)
# - tailwindcss, vite

cd ../..
```

---

## Build & Start Services

### Step 1: Verify Docker is Running

```bash
# Check Docker is running
docker --version
docker-compose --version

# Test Docker
docker ps
```

### Step 2: Build Services

```bash
# Build all services (first time)
docker-compose build

# Or build without cache (if issues)
docker-compose build --no-cache
```

**Expected Build Time:** 5-10 minutes (first time)

### Step 3: Start All Services

```bash
# Start all services in background
docker-compose up -d

# Or start with logs visible
docker-compose up
```

**Expected Services:** 5 containers
- `frontend` (React app)
- `nodejs-api` (Express API)
- `python-ai` (FastAPI AI service)
- `ai-chatbot` (Chatbot service)
- `redis` (Queue & caching)

### Step 4: Verify Services Are Running

```bash
# Check service status
docker-compose ps

# Expected output:
# NAME              STATUS          PORTS
# frontend          Up              0.0.0.0:3000->3000/tcp
# nodejs-api        Up              0.0.0.0:4000->4000/tcp
# python-ai         Up              0.0.0.0:8000->8000/tcp
# ai-chatbot        Up              0.0.0.0:9000->9000/tcp
# redis             Up              0.0.0.0:6379->6379/tcp
```

---

## Testing

### Quick Health Check

```bash
# Test all services
curl http://localhost:3000        # Frontend
curl http://localhost:4000/health  # Node.js API
curl http://localhost:8000/health # Python AI
curl http://localhost:9000/health # AI Chatbot

# Test Redis
docker-compose exec redis redis-cli ping
# Expected: PONG
```

### Test 1: Upload Timetable via Web UI

1. **Open browser**: http://localhost:3000
2. **Upload a sample timetable**:
   - Drag and drop from `data/sample_timetables/Teacher Timetable Example 1.1.png`
   - OR click upload and browse to file
3. **Observe real-time progress**:
   - Notification widget appears immediately
   - Progress updates in real-time (0% → 100%)
   - Step-by-step status: Compressing → Preprocessing → OCR → AI → Complete
4. **View results**:
   - Click "View Timetable" when complete
   - See formatted weekly/daily timetable view

### Test 2: Upload via API

```bash
# Upload a document
curl -X POST http://localhost:4000/api/v1/documents/upload \
  -F "file=@data/sample_timetables/Teacher Timetable Example 1.1.png"

# Response includes documentId
# Save the documentId from response

# Get document status
curl http://localhost:4000/api/v1/documents/{documentId}

# Connect to SSE events (real-time updates)
curl -N http://localhost:4000/api/v1/events/{documentId}
```

### Test 3: Test AI Chatbot

1. **Open browser**: http://localhost:3000
2. **Click chatbot button** (bottom-right corner)
3. **Try these questions**:
   - "What's the status of my document?"
   - "Show me my timetable"
   - "What help is available?"

### Test 4: Verify Async Architecture

```bash
# Check Redis queue
docker-compose exec redis redis-cli
> KEYS bull:document-processing:*
> LLEN bull:document-processing:waiting
> LLEN bull:document-processing:active

# Monitor queue processing
docker-compose logs -f nodejs-api | grep "Job"
```

### Run Automated Tests

```bash
# Python tests
cd backend/python
pytest --cov=app --cov-report=html

# Node.js tests
cd backend/nodejs
npm test

# Frontend tests (if configured)
cd frontend
npm test
```

---

## Verification & Troubleshooting

### View Logs

```bash
# Watch all logs in real-time
docker-compose logs -f

# View specific service logs
docker-compose logs -f python-ai      # AI/OCR processing
docker-compose logs -f nodejs-api     # Backend API
docker-compose logs -f frontend       # React frontend
docker-compose logs -f ai-chatbot     # Chatbot service
docker-compose logs -f redis          # Redis queue

# View last 50 lines
docker-compose logs python-ai --tail 50

# Search for errors
docker-compose logs python-ai | grep -i error
docker-compose logs nodejs-api | grep "500"
```

### Common Issues & Solutions

#### Issue: Redis Not Starting

```bash
# Check if port 6379 is in use
lsof -i :6379  # macOS/Linux
netstat -ano | findstr :6379  # Windows

# Restart Redis
docker-compose restart redis

# Check Redis logs
docker-compose logs redis
```

#### Issue: SSE Not Connecting

**Symptoms:** No progress updates, notification doesn't appear

**Solutions:**
1. Check browser console (F12 → Console) for errors
2. Verify CORS settings in Node.js API
3. Check network tab for SSE connection (look for `/api/v1/events/`)
4. Verify document ID is correct
5. Check Node.js API logs: `docker-compose logs nodejs-api`

#### Issue: Processing Not Starting

**Symptoms:** Upload succeeds but no progress

**Solutions:**
1. Check Node.js API logs: `docker-compose logs nodejs-api`
2. Verify Redis is accessible: `docker-compose exec redis redis-cli ping`
3. Check Python API: `curl http://localhost:8000/health`
4. Verify job is queued: Check Redis Bull keys
5. Check queue processor is running (automatically starts)

#### Issue: AI Features Not Working

**Symptoms:** Error 500 on AI extraction, chatbot fails

**Solutions:**
```bash
# Verify API key is set
cat .env | grep ANTHROPIC_API_KEY

# If shows "your_anthropic_api_key_here":
# → Set real API key (see Environment Configuration)

# Restart services after updating .env
docker-compose restart python-ai ai-chatbot

# Check detailed errors
docker-compose logs python-ai | grep -A 10 "500 Internal"
```

#### Issue: Container Keeps Restarting

```bash
# Check which container
docker-compose ps

# View crash logs
docker-compose logs [service-name] --tail 50

# Common fixes:
docker-compose restart [service-name]
# OR
docker-compose down && docker-compose up -d
```

#### Issue: Docker Build Fails

```bash
# Rebuild without cache
docker-compose build --no-cache

# Then restart
docker-compose up -d

# Check build logs
docker-compose build 2>&1 | tee build.log
```

#### Issue: Port Already in Use

```bash
# Find process using port
lsof -i :3000  # Frontend
lsof -i :4000  # API
lsof -i :8000  # Python AI
lsof -i :6379  # Redis

# Stop existing containers
docker-compose down

# Or change ports in docker-compose.yml
```

### Verify System Health

**Complete Health Check:**

```bash
# All services running
docker-compose ps

# All services healthy
curl http://localhost:4000/health  # Should return: {"status":"healthy","queue":"enabled"}
curl http://localhost:8000/health   # Should return: {"status":"healthy"}
curl http://localhost:9000/health   # Should return: {"status":"healthy"}

# Redis connection
docker-compose exec redis redis-cli ping  # Should return: PONG

# Logs showing no critical errors
docker-compose logs python-ai --tail 50 | grep -i error
docker-compose logs nodejs-api --tail 50 | grep -i error
```

---

## Quick Reference

### Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:3000 | Main application UI |
| **Node.js API** | http://localhost:4000 | Backend REST API |
| **Python AI** | http://localhost:8000 | OCR/AI processing |
| **FastAPI Docs** | http://localhost:8000/docs | API documentation |
| **AI Chatbot** | http://localhost:9000 | Chatbot API |
| **Redis** | localhost:6379 | Queue & caching |

### Quick Commands

```bash
# Start everything
docker-compose up -d

# Stop everything
docker-compose down

# Restart specific service
docker-compose restart python-ai

# View all logs
docker-compose logs -f

# Check status
docker-compose ps

# Rebuild after code changes
docker-compose build
docker-compose up -d

# Full reset (⚠️ deletes data)
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Sample Files Location

Test timetables are in:
```
POCImplementations/POCDemoImplementation/data/sample_timetables/
```

Available files:
- ✅ `Teacher Timetable Example 1.1.png` - Image
- ✅ `Teacher Timetable Example 1.2.png` - Image
- ✅ `Teacher Timetable Example 2.pdf` - PDF
- ✅ `Teacher Timetable Example 3.png` - Image
- ✅ `Teacher Timetable Example 4.jpeg` - Image

### Performance Metrics

**Expected Performance:**
- **Upload Response:** <200ms ✅
- **First Progress Update:** <500ms ✅
- **Image Compression:** 50-70% reduction ✅
- **Zero Polling:** Event-driven SSE ✅
- **Perceived Wait:** <5s with progressive updates ✅

### Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| **PDF Upload** | ✅ WORKING | Auto-converts to image |
| **PNG/JPG Upload** | ✅ WORKING | Direct processing |
| **Image Preprocessing** | ✅ WORKING | OpenCV enhancement |
| **OCR Extraction** | ✅ WORKING | Tesseract OCR |
| **Real-time Progress** | ✅ WORKING | SSE updates |
| **Image Compression** | ✅ WORKING | 50-70% reduction |
| **AI Enhancement** | ⚠️ NEEDS API KEY | Requires ANTHROPIC_API_KEY |
| **AI Chatbot** | ⚠️ NEEDS API KEY | Requires ANTHROPIC_API_KEY |

### What's New (Async Architecture)

- ✅ **No more polling** - Real-time updates via SSE
- ✅ **Instant feedback** - Notification appears immediately
- ✅ **Non-blocking** - Stay on page during processing
- ✅ **Smaller images** - 50-70% compression automatically
- ✅ **Better performance** - Background job processing
- ✅ **Progress tracking** - Step-by-step updates with percentages

---

## Next Steps

1. ✅ **Test with your own timetable images**
2. ✅ **Explore API endpoints**: http://localhost:8000/docs
3. ✅ **Monitor performance metrics**
4. ✅ **Adjust queue concurrency** if needed
5. ✅ **Read full documentation**: [docs/ASYNC_ARCHITECTURE_GUIDE.md](docs/ASYNC_ARCHITECTURE_GUIDE.md)

---

## Documentation

- **Full Async Guide**: [docs/ASYNC_ARCHITECTURE_GUIDE.md](docs/ASYNC_ARCHITECTURE_GUIDE.md)
- **Testing Guide**: [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md)
- **Architecture**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **API Reference**: http://localhost:8000/docs
- **Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## Support

**Still having issues?**

1. **Check logs first:**
   ```bash
   docker-compose logs -f
   ```

2. **Verify prerequisites:**
   - Docker running
   - Ports not in use
   - API key set (for AI features)
   - Sufficient disk space

3. **Full system reset:**
   ```bash
   docker-compose down -v
   docker-compose build --no-cache
   docker-compose up -d
   ```

4. **Check troubleshooting guide:**
   ```bash
   cat TROUBLESHOOTING.md
   ```

---

**Total Setup Time:** ~15 minutes  
**Status:** ✅ Production Ready  
**Last Updated:** 2025-01-01  
**Version:** 2.0.0


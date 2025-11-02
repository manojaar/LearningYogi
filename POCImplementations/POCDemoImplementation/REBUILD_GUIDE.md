# Rebuild Guide - After Performance Optimizations

## Do You Need to Rebuild?

**YES** - You need to rebuild because:

1. ✅ **New Dockerfile dependencies** (libvips-dev, poppler-utils for Sharp/PDF support)
2. ✅ **New npm packages** (bull, ioredis, sharp, framer-motion)
3. ✅ **New Python packages** (anthropic[async], redis)
4. ✅ **New Docker services** (Redis container)
5. ✅ **Code changes** (new services, queue system, SSE endpoints)

## Quick Rebuild Steps

### Option 1: Full Rebuild (Recommended - Clean Slate)

```bash
cd POCImplementations/POCDemoImplementation

# Stop all services
docker-compose down

# Remove volumes (optional - only if you want fresh database)
# docker-compose down -v  # ⚠️ This deletes your data!

# Rebuild all services with new dependencies
docker-compose build --no-cache

# Start all services
docker-compose up -d

# Check logs to verify
docker-compose logs -f
```

**Time:** ~10-15 minutes (first build)

### Option 2: Incremental Rebuild (Faster - Only Changed Services)

```bash
cd POCImplementations/POCDemoImplementation

# Rebuild specific services that changed
docker-compose build --no-cache nodejs-api python-ai frontend

# Restart services
docker-compose up -d

# Verify Redis is running (new service)
docker-compose ps redis
```

**Time:** ~5-8 minutes

### Option 3: Development Mode (Fastest - Local Dependencies)

If developing locally without Docker:

```bash
# Backend - Node.js
cd backend/nodejs
npm install  # Installs bull, ioredis, sharp
npm run build

# Backend - Python
cd ../python
pip install -r requirements.txt  # Installs anthropic[async], redis

# Frontend
cd ../../frontend
npm install  # Installs framer-motion

# Then run services locally (requires Redis running)
# Start Redis: docker run -d -p 6379:6379 redis:7-alpine
```

## What Changed That Requires Rebuild?

### 1. Node.js Backend (`backend/nodejs/`)

**New Dependencies:**
- `bull` - Job queue
- `ioredis` - Redis client
- `sharp` - Image processing

**System Dependencies (Dockerfile):**
- `libvips-dev` - For Sharp
- `poppler-utils` - For PDF support

**New Files:**
- `src/services/sseManager.ts`
- `src/services/imageCompressor.ts`
- `src/services/imageFormatConverter.ts`
- `src/queues/documentQueue.ts`
- `src/routes/events.ts`

**Modified Files:**
- `src/index.ts` - Added queue initialization
- `src/services/document.service.ts` - Uses queue
- `src/services/processing.service.ts` - Increased timeout

### 2. Python Backend (`backend/python/`)

**New Dependencies:**
- `anthropic[async]` - Async Claude client
- `redis` - Redis support

**Modified Files:**
- `Dockerfile` - Added timeout settings
- `app/services/claude_service.py` - Async support
- `app/api/ai.py` - Async endpoint

### 3. Frontend (`frontend/`)

**New Dependencies:**
- `framer-motion` - Animations

**New Files:**
- `src/hooks/useSSE.ts`
- `src/components/TimetableTableWidget.tsx`

**Modified Files:**
- `src/components/ProcessingNotification.tsx` - Shows table widget
- `src/pages/HomePage.tsx` - No redirect
- `src/pages/ResultsPage.tsx` - Removed polling

### 4. Infrastructure (`docker-compose.yml`)

**New Service:**
- `redis` - Queue and caching

**Updated Services:**
- `nodejs-api` - Added Redis env vars
- `python-ai` - Added health check

## Verification After Rebuild

### 1. Check All Services Are Running

```bash
docker-compose ps
```

**Expected:** 5 services running
- frontend ✅
- nodejs-api ✅
- python-ai ✅
- ai-chatbot ✅
- redis ✅

### 2. Verify Health Endpoints

```bash
# Node.js API (should show queue: enabled)
curl http://localhost:4000/health

# Python AI
curl http://localhost:8000/health

# Redis
docker-compose exec redis redis-cli ping
# Should return: PONG
```

### 3. Check Redis Queue

```bash
docker-compose exec redis redis-cli
> KEYS bull:*
> INFO
```

### 4. Test the New Features

1. Upload a document at http://localhost:3000
2. Verify notification widget appears
3. Check real-time progress updates
4. Verify table widget appears when complete

## If Rebuild Fails

### Common Issues

**Issue: Port conflicts**
```bash
# Find what's using the ports
lsof -i :3000
lsof -i :4000
lsof -i :6379

# Stop conflicting services
```

**Issue: Docker build fails for Sharp**
```bash
# Ensure you're building with --no-cache
docker-compose build --no-cache nodejs-api

# Check Dockerfile has libvips-dev and poppler-utils
```

**Issue: Redis connection fails**
```bash
# Verify Redis container is running
docker-compose ps redis

# Check Redis logs
docker-compose logs redis

# Restart Redis
docker-compose restart redis
```

**Issue: Node modules not installing**
```bash
# Clean install
cd backend/nodejs
rm -rf node_modules package-lock.json
npm install
```

**Issue: Python packages fail**
```bash
# Upgrade pip first
cd backend/python
pip install --upgrade pip
pip install -r requirements.txt --no-cache-dir
```

## Partial Rebuild (If Only Frontend Changed)

If you only modified frontend code (not dependencies):

```bash
# No rebuild needed! Just restart frontend
docker-compose restart frontend

# Or rebuild just frontend
docker-compose build frontend
docker-compose up -d frontend
```

## Production Deployment

For production, ensure:

1. **Environment variables are set** (`.env` file)
2. **Redis is properly configured** (host, port, password if needed)
3. **All services rebuilt** with production settings
4. **Health checks passing** before traffic routing
5. **Database migrations applied** (automatic on first run)

## Rollback (If Needed)

If new features cause issues:

```bash
# Stop services
docker-compose down

# Revert to previous code (git)
git checkout <previous-commit>

# Rebuild
docker-compose build --no-cache
docker-compose up -d
```

## Summary

**Rebuild Required:** ✅ YES

**What to Rebuild:**
- All Docker images (new dependencies)
- All services (code changes)

**Quickest Method:**
```bash
docker-compose build --no-cache && docker-compose up -d
```

**Estimated Time:** 10-15 minutes (first time)

---

**Last Updated:** 2025-01-01  
**Status:** Ready for Rebuild



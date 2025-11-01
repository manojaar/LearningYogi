# Quick Start - Async Architecture

## 🚀 5-Minute Setup

### 1. Install Dependencies

```bash
cd POCImplementations/POCDemoImplementation

# Backend dependencies
cd backend/nodejs && npm install && cd ../..
cd backend/python && pip install -r requirements.txt && cd ../..

# Frontend dependencies  
cd frontend && npm install && cd ../..
```

### 2. Configure Environment

```bash
# Copy example file
cp env.example .env

# Edit .env and add:
ANTHROPIC_API_KEY=your_key_here
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 3. Start Services

```bash
# Start all services (including Redis)
docker-compose up -d

# Verify all services are running
docker-compose ps

# Check logs
docker-compose logs -f nodejs-api
```

### 4. Test the System

1. **Open browser**: http://localhost:3000
2. **Upload a timetable image**
3. **Watch the notification widget** appear with real-time progress
4. **Click "View Timetable"** when processing completes

## ✅ What's New?

- ✅ **No more polling** - Real-time updates via SSE
- ✅ **Instant feedback** - Notification appears immediately
- ✅ **Non-blocking** - Stay on page during processing
- ✅ **Smaller images** - 50-70% compression automatically
- ✅ **Better performance** - Background job processing

## 🔍 Verify It's Working

### Check Redis Connection

```bash
docker-compose exec redis redis-cli ping
# Should return: PONG
```

### Check SSE Endpoint

```bash
# Replace {documentId} with actual ID
curl -N http://localhost:4000/api/v1/events/{documentId}

# You should see SSE events
```

### Check Queue Status

```bash
docker-compose exec redis redis-cli
> KEYS bull:document-processing:*
> LLEN bull:document-processing:waiting
```

## 📊 Expected Performance

- **Upload response**: <200ms ✅
- **First progress update**: <500ms ✅
- **Image compression**: 50-70% reduction ✅
- **Zero polling requests**: ✅
- **Perceived wait**: <5s with progressive updates ✅

## 🐛 Troubleshooting

### Redis Not Starting

```bash
# Check if port 6379 is in use
lsof -i :6379

# Restart Redis
docker-compose restart redis
```

### SSE Not Connecting

1. Check browser console for errors
2. Verify CORS settings
3. Check network tab for SSE connection
4. Verify document ID is correct

### Processing Not Starting

1. Check Node.js API logs: `docker-compose logs nodejs-api`
2. Verify Redis is accessible
3. Check Python API: `curl http://localhost:8000/health`
4. Verify job is queued: Check Redis Bull keys

## 📚 Documentation

- **Full Guide**: [docs/ASYNC_ARCHITECTURE_GUIDE.md](docs/ASYNC_ARCHITECTURE_GUIDE.md)
- **Testing**: [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md)
- **Architecture**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 🎯 Next Steps

1. ✅ Test with your own timetable images
2. ✅ Monitor performance metrics
3. ✅ Adjust queue concurrency if needed
4. ✅ Scale horizontally for production

---

**Questions?** Check the full documentation or open an issue.


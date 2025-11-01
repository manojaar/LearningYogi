# Quick Start Guide - POCDemoImplementation

## Prerequisites

- **Docker** and **Docker Compose**
- **Claude API Key** from Anthropic
- 15 minutes of setup time

## Setup in 3 Steps

### Step 1: Configure Environment

```bash
cd POCImplementations/POCDemoImplementation

# Copy environment template
cp env.example .env

# Edit .env and add your Claude API key
nano .env  # or use your preferred editor
```

**Required**: Set `ANTHROPIC_API_KEY` in `.env`

### Step 2: Start Services

```bash
# Start all services with Docker Compose
docker-compose up -d

# Check services are running
docker-compose ps
```

**Expected**: All 4 services (frontend, nodejs-api, python-ai, ai-chatbot) should be running

### Step 3: Access Application

Open your browser to: **http://localhost:3000**

You should see:
- Clean, modern landing page
- File upload zone
- Feature highlights
- AI Chatbot floating button (bottom-right)

## Try It Out

### Upload a Sample Timetable

1. Go to http://localhost:3000
2. Drag and drop `data/sample_timetables/Teacher Timetable Example 1.1.png`
3. Wait for processing (watch the progress)
4. View your beautiful timetable!

### Try the AI Chatbot

Click the floating chatbot button in the bottom-right corner and ask:
- "What's the status of my document?"
- "Show me my timetable"
- "What help is available?"

### Using the API Directly

```bash
# Upload via curl
curl -X POST http://localhost:4000/api/v1/documents/upload \
  -F "file=@data/sample_timetables/Teacher Timetable Example 1.1.png"

# Get document status
curl http://localhost:4000/api/v1/documents/{documentId}

# View API docs
open http://localhost:8000/docs
```

## Verify Everything Works

```bash
# Check frontend
curl http://localhost:3000

# Check Node.js API
curl http://localhost:4000/health

# Check Python AI middleware
curl http://localhost:8000/health

# Check AI Chatbot
curl http://localhost:9000/health
```

All should return healthy status.

## Common Issues

### Port Already in Use

```bash
# Stop existing containers
docker-compose down

# Or change ports in docker-compose.yml
```

### Docker Build Fails

```bash
# Rebuild without cache
docker-compose build --no-cache

# Then restart
docker-compose up -d
```

### Claude API Errors

- Verify your API key is correct
- Check your Anthropic account has credits
- Ensure internet connection

## Next Steps

1. **Read Documentation**: [README.md](README.md)
2. **Explore Features**: [docs/FEATURES.md](docs/FEATURES.md)
3. **Review Architecture**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
4. **Plan Migration**: Review POC1/POC2 migration guides

## Shutdown

```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Support

- **Documentation**: See `/docs` folder
- **API Reference**: http://localhost:8000/docs
- **Issues**: Check logs with `docker-compose logs -f`

---

**Total Setup Time**: ~5 minutes  
**Status**: ✅ Ready to use


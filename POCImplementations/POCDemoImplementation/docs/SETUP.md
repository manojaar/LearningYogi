# Setup Guide - POCDemoImplementation

## Prerequisites

Before setting up the POCDemoImplementation, ensure you have:

- **Node.js** 20.x or higher ([download](https://nodejs.org/))
- **Python** 3.11 or higher ([download](https://www.python.org/downloads/))
- **Docker** & **Docker Compose** ([download](https://docs.docker.com/get-docker/))
- **Claude API Key** from Anthropic ([get one](https://console.anthropic.com/))
- **Git** for cloning the repository

### System Requirements

- **OS**: macOS, Linux, or Windows (with WSL2)
- **RAM**: 4GB minimum (8GB recommended)
- **Disk**: 1GB free space
- **Network**: Internet connection for Claude API calls

## Quick Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd LearningYogi/POCImplementations/POCDemoImplementation
```

### 2. Configure Environment

Copy the example environment file and edit:

```bash
cp env.example .env
```

Edit `.env` and add your API keys (at minimum, Claude API key):

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Optional: For AI Chatbot
OPENAI_API_KEY=sk-...  # Optional, for OpenAI provider support
CHATBOT_PROVIDER_PREFERENCE=claude,openai,local
CHATBOT_ENABLE_CONTEXT=true
```

### 3. Start Services

With Docker Compose (recommended):

```bash
docker-compose up -d
```

Or manually (for development):

**Terminal 1 - Python AI Middleware:**
```bash
cd backend/python
pip install -r requirements.txt
python run.py
```

**Terminal 2 - Node.js API:**
```bash
cd backend/nodejs
npm install
npm run dev
```

### 4. Verify Installation

```bash
# Check Python AI middleware
curl http://localhost:8000/health

# Check Node.js API
curl http://localhost:4000/health

# Check AI Chatbot service
curl http://localhost:9000/health

# View FastAPI docs
open http://localhost:8000/docs
```

## Detailed Setup

### Python AI Middleware Setup

1. **Install Python Dependencies**

```bash
cd backend/python
python3.11 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. **Install System Dependencies**

**macOS:**
```bash
brew install tesseract
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install tesseract-ocr libtesseract-dev
```

**Windows:**
Download and install Tesseract from [GitHub](https://github.com/UB-Mannheim/tesseract/wiki)

3. **Run Application**

```bash
python run.py
```

### Node.js API Setup

1. **Install Node.js Dependencies**

```bash
cd backend/nodejs
npm install
```

2. **Initialize Database**

The database is auto-initialized on first start.

3. **Run Application**

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm run build
npm start
```

### Docker Setup (Production-like)

1. **Build Images**

```bash
docker-compose build
```

2. **Start Services**

```bash
docker-compose up -d
```

3. **View Logs**

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f python-ai
docker-compose logs -f nodejs-api
```

4. **Stop Services**

```bash
docker-compose down
```

## Testing Setup

### Python Tests

```bash
cd backend/python

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_ocr_service.py

# Run with verbose output
pytest -v
```

### Node.js Tests

```bash
cd backend/nodejs

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Sample Timetables

Upload sample timetables for testing:

```bash
# Using curl
curl -X POST http://localhost:4000/api/v1/documents/upload \
  -F "file=@data/sample_timetables/Teacher Timetable Example 1.1.png"

# Or use the FastAPI docs UI
open http://localhost:8000/docs
```

## Troubleshooting

### Common Issues

**1. Tesseract Not Found**

```bash
# macOS
brew install tesseract

# Linux
sudo apt-get install tesseract-ocr

# Verify installation
tesseract --version
```

**2. Claude API Errors**

- Verify your API key is correct in `.env`
- Check your Anthropic API credits
- Verify internet connection

**2a. AI Chatbot Not Responding**

- Check chatbot service: `docker-compose logs ai-chatbot`
- Verify API keys are set in `.env`
- Check health endpoint: `curl http://localhost:9000/health`
- Ensure at least one AI provider is configured

**3. Port Already in Use**

```bash
# Change ports in docker-compose.yml or .env
PYTHON_PORT=8001
NODEJS_PORT=4001
CHATBOT_PORT=9001  # AI Chatbot port
```

**4. Database Locked (SQLite)**

```bash
# Stop all services
docker-compose down

# Remove database and restart
rm data/database/app.db
docker-compose up -d
```

**5. Docker Issues**

```bash
# Rebuild without cache
docker-compose build --no-cache

# Clean up volumes
docker-compose down -v
```

## Development Tools

### Recommended VS Code Extensions

- **Python**: Python extension, Pylance
- **TypeScript**: ESLint, Prettier
- **Docker**: Docker extension
- **Testing**: Jest, Pytest extensions

### Recommended Tools

- **Postman** or **Insomnia**: API testing
- **Docker Desktop**: Container management
- **DB Browser for SQLite**: Database inspection

## Next Steps

After setup:

1. **Read Architecture**: [docs/ARCHITECTURE.md](ARCHITECTURE.md)
2. **Test API**: [docs/API_DOCUMENTATION.md](API_DOCUMENTATION.md)
3. **Run Tests**: [docs/TESTING.md](TESTING.md)
4. **Plan Migration**: Review POC1/POC2 migration guides

## Support

For issues or questions:
- Check logs: `docker-compose logs`
- Review troubleshooting section above
- See main README.md for more details


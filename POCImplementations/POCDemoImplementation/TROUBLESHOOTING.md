# Troubleshooting Guide - POC Demo Implementation

## 📋 Quick Log Access Commands

### View All Logs
```bash
# View logs from all services
docker-compose logs -f

# View logs from specific service
docker-compose logs -f python-ai
docker-compose logs -f nodejs-api
docker-compose logs -f frontend
docker-compose logs -f ai-chatbot

# View last 50 lines from all services
docker-compose logs --tail 50

# Follow logs in real-time
docker-compose logs -f --tail 100
```

### Check Container Status
```bash
# List running containers
docker-compose ps

# Check if all containers are healthy
docker-compose ps | grep -E "Up|healthy"

# Restart specific service
docker-compose restart python-ai
```

---

## 🔴 Current Issues and Fixes

### Issue 1: ANTHROPIC_API_KEY Not Configured ❌

**Symptoms:**
- AI extraction fails with 500 error
- AI Chatbot returns error 500
- Logs show: `Claude API key not configured`

**Cause:**
The `.env` file contains a placeholder API key: `your_anthropic_api_key_here`

**Fix:**

1. **Option A: Get a real Anthropic API Key** (Recommended for full functionality)
   ```bash
   # Edit .env file
   nano .env

   # Replace the placeholder with your real API key from https://console.anthropic.com/
   ANTHROPIC_API_KEY=sk-ant-api03-YOUR-ACTUAL-KEY-HERE

   # Restart services
   docker-compose restart python-ai ai-chatbot
   ```

2. **Option B: Test with OCR-only mode** (No AI extraction)

   The system will still work with just OCR! Upload PNG/JPG timetables (not PDFs).

   Expected behavior:
   - ✅ Image preprocessing works
   - ✅ OCR extraction works
   - ❌ AI enhancement (Claude) fails gracefully
   - ❌ AI Chatbot doesn't work

### Issue 2: PDF Files Not Supported ❌

**Symptoms:**
- Error: `Could not read image: /data/uploads/.../file.pdf`
- Status stuck at "Processing..."

**Cause:**
The image preprocessor uses OpenCV's `cv2.imread()` which doesn't support PDF files.

**Current Workaround:**
**Only upload PNG, JPG, or JPEG timetable images** (not PDFs)

**Files that work:**
- ✅ `Teacher Timetable Example 1.1.png`
- ✅ `Teacher Timetable Example 1.2.png`
- ✅ `Teacher Timetable Example 3.png`
- ✅ `Teacher Timetable Example 4.jpeg`

**Files that DON'T work (yet):**
- ❌ `Teacher Timetable Example 2.pdf`
- ❌ Any PDF file

**Permanent Fix** (Added below in code fixes):
We'll add PDF-to-image conversion using PyMuPDF.

---

## 🔧 Code Fixes Applied

### Fix 1: Add PDF Support to Python Service

**File: `backend/python/requirements.txt`**
Add PyMuPDF for PDF handling:
```txt
PyMuPDF==1.23.8
```

**File: `backend/python/app/services/preprocessor.py`**
Add PDF conversion capability (see updated code below).

### Fix 2: Better Error Messages for Missing API Key

**File: `backend/python/app/api/ai.py`**
Add user-friendly error responses when API key is missing.

---

## ✅ Verification Steps

After fixes, verify everything works:

```bash
# 1. Check all services are running
docker-compose ps

# Expected output:
# python-ai    Up
# nodejs-api   Up
# frontend     Up
# ai-chatbot   Up (might be unhealthy if no API key)

# 2. Test API endpoints
curl http://localhost:4000/health
# Expected: {"status":"healthy","service":"nodejs-api"}

curl http://localhost:8000/health
# Expected: {"status":"healthy","service":"ai-middleware"}

# 3. Test with image file (PNG/JPG)
# Upload via frontend: http://localhost:3000
# Select: data/sample_timetables/Teacher Timetable Example 1.1.png

# 4. Check logs for errors
docker-compose logs python-ai | grep ERROR
```

---

## 📊 Service Health Dashboard

| Service | Port | Health Check | Logs Command |
|---------|------|--------------|--------------|
| **Frontend** | 3000 | http://localhost:3000 | `docker-compose logs frontend` |
| **Node.js API** | 4000 | http://localhost:4000/health | `docker-compose logs nodejs-api` |
| **Python AI** | 8000 | http://localhost:8000/health | `docker-compose logs python-ai` |
| **AI Chatbot** | 9000 | http://localhost:9000/health | `docker-compose logs ai-chatbot` |

---

## 🐛 Debug Mode

Enable detailed logging for debugging:

```bash
# Stop services
docker-compose down

# Edit docker-compose.yml and add DEBUG environment variable
# (Or set in .env file)

# Restart with verbose output
docker-compose up --force-recreate
```

---

## 📝 Common Error Messages

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `Could not read image: *.pdf` | PDF file uploaded | Use PNG/JPG or apply PDF fix below |
| `Claude API key not configured` | Missing/invalid API key | Set real ANTHROPIC_API_KEY in .env |
| `500 Internal Server Error` | Various - check logs | Run `docker-compose logs [service]` |
| `Container keeps restarting` | Startup failure | Check `docker-compose logs [service]` |
| `Port already in use` | Port conflict | Stop conflicting service or change ports |

---

## 🔄 Full Reset

If things get completely broken:

```bash
# Stop everything
docker-compose down -v

# Remove all containers and images
docker-compose down --rmi all

# Rebuild from scratch
docker-compose build --no-cache

# Start fresh
docker-compose up -d

# Check logs
docker-compose logs -f
```

---

## 📞 Need Help?

1. Check logs: `docker-compose logs -f`
2. Check container status: `docker-compose ps`
3. Review this troubleshooting guide
4. Check the main README.md for setup instructions

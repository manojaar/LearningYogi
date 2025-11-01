# 🚀 Quick Reference - POC Demo Implementation

## ✅ System Status: READY TO USE!

All core features are now working. AI features require an API key (see below).

---

## 📊 View Logs - Quick Commands

```bash
# Watch ALL logs in real-time
docker-compose logs -f

# View specific service logs
docker-compose logs -f python-ai      # AI/OCR processing
docker-compose logs -f nodejs-api     # Backend API
docker-compose logs -f frontend       # React frontend
docker-compose logs -f ai-chatbot     # Chatbot service

# View last 50 lines
docker-compose logs python-ai --tail 50

# Search for errors
docker-compose logs python-ai | grep -i error
docker-compose logs python-ai | grep "500"

# View logs from specific time
docker-compose logs --since 5m        # Last 5 minutes
docker-compose logs --since 1h        # Last hour
```

---

## 🔍 Where to Find Errors

### Timetable Extraction Errors
```bash
# Check Python AI service (handles OCR + AI extraction)
docker-compose logs python-ai --tail 50

# Common errors:
# - "Could not read image" = File format issue
# - "Claude API key not configured" = Need to set API key
# - "500 Internal Server Error" = Check full stack trace above
```

### AI Chatbot Errors
```bash
# Check AI Chatbot service
docker-compose logs ai-chatbot --tail 50

# Common errors:
# - "500 Internal Server Error" = Usually API key issue
# - Check if ANTHROPIC_API_KEY is set in .env
```

### Frontend Errors
```bash
# Check browser console (F12 → Console tab)
# Check frontend container logs
docker-compose logs frontend --tail 50
```

---

## ⚡ Current Features & Status

| Feature | Status | Notes |
|---------|--------|-------|
| **PDF Upload** | ✅ **WORKING** | Auto-converts to image |
| **PNG/JPG Upload** | ✅ **WORKING** | Direct processing |
| **Image Preprocessing** | ✅ **WORKING** | OpenCV enhancement |
| **OCR Extraction** | ✅ **WORKING** | Tesseract OCR |
| **AI Enhancement** | ⚠️ **NEEDS API KEY** | Requires ANTHROPIC_API_KEY |
| **AI Chatbot** | ⚠️ **NEEDS API KEY** | Requires ANTHROPIC_API_KEY |

---

## 🔑 Fix AI Features (Anthropic API Key)

**Why it's not working:**
Your `.env` file has a placeholder API key: `ANTHROPIC_API_KEY=your_anthropic_api_key_here`

**How to fix:**

### Option 1: Get Free API Key (Recommended)
```bash
# 1. Sign up at https://console.anthropic.com/
# 2. Go to API Keys section
# 3. Create new key (starts with sk-ant-api03-)
# 4. Copy the key

# 5. Edit .env file
cd /Users/manojramakrishnapillai/LearningYogi/POCImplementations/POCDemoImplementation
nano .env

# 6. Replace line:
# FROM: ANTHROPIC_API_KEY=your_anthropic_api_key_here
# TO:   ANTHROPIC_API_KEY=sk-ant-api03-YOUR-REAL-KEY-HERE

# 7. Save (Ctrl+O, Enter, Ctrl+X)

# 8. Restart services
docker-compose restart python-ai ai-chatbot

# 9. Test
curl http://localhost:8000/health
curl http://localhost:9000/health
```

### Option 2: Use Without AI (Limited Mode)
- System works with OCR only
- Upload PNG/JPG/PDF files
- Get basic text extraction
- No AI enhancement or chatbot

---

## 🧪 Test It Now!

### Test 1: Upload PDF Timetable ✅ WORKS NOW!
```bash
# 1. Open http://localhost:3000
# 2. Click "Upload" or drag-and-drop
# 3. Select: data/sample_timetables/Teacher Timetable Example 2.pdf
# 4. Watch it process!

# What happens:
# ✅ PDF converts to image (new!)
# ✅ Image preprocessed
# ✅ OCR extracts text
# ⚠️ AI extraction fails if no API key (that's OK!)
```

### Test 2: Upload Image Timetable ✅
```bash
# 1. Open http://localhost:3000
# 2. Upload: data/sample_timetables/Teacher Timetable Example 1.1.png
# 3. View results

# Works perfectly even without API key!
```

### Test 3: AI Chatbot (Needs API Key) ⚠️
```bash
# 1. Open http://localhost:3000
# 2. Click chatbot button (bottom-right corner)
# 3. Type: "What can you help me with?"

# ✅ With API key: Get AI response
# ❌ Without API key: Error 500
```

---

## 🔧 Quick Troubleshooting

### "Nothing happens when I upload"
```bash
# Check logs
docker-compose logs nodejs-api --tail 20
docker-compose logs python-ai --tail 20

# Check file format
# Must be: PDF, PNG, JPG, JPEG
```

### "Error 500 on AI extraction"
```bash
# Check if API key is set
cat .env | grep ANTHROPIC_API_KEY

# If shows "your_anthropic_api_key_here":
# → You need to set a real API key (see above)

# View detailed error
docker-compose logs python-ai | grep -A 10 "500 Internal"
```

### "Chatbot returns error 500"
```bash
# Same issue - need API key
docker-compose logs ai-chatbot --tail 30

# Fix: Set ANTHROPIC_API_KEY in .env
```

### "Container keeps restarting"
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

---

## 📱 Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:3000 | Main app interface |
| **API** | http://localhost:4000 | Backend API |
| **Python AI** | http://localhost:8000 | OCR/AI service |
| **Chatbot** | http://localhost:9000 | AI chatbot API |

---

## 🎯 Quick Commands Cheat Sheet

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

# Full reset
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

---

## 📂 Sample Files Location

All test timetables are in:
```
POCImplementations/POCDemoImplementation/data/sample_timetables/
```

Files you can test:
- ✅ `Teacher Timetable Example 1.1.png` - Image
- ✅ `Teacher Timetable Example 1.2.png` - Image
- ✅ `Teacher Timetable Example 2.pdf` - PDF (NOW WORKS!)
- ✅ `Teacher Timetable Example 3.png` - Image
- ✅ `Teacher Timetable Example 4.jpeg` - Image

---

## ✅ Success Checklist

Before reporting issues, verify:

- [ ] All containers running: `docker-compose ps`
- [ ] Services healthy: `curl http://localhost:4000/health`
- [ ] Logs showing no errors: `docker-compose logs python-ai --tail 50`
- [ ] Using supported file format: PDF, PNG, JPG, JPEG
- [ ] API key set if testing AI features
- [ ] Browser console clear (F12)

---

## 🆘 Still Having Issues?

1. **Check logs first:**
   ```bash
   docker-compose logs -f
   ```

2. **Read full troubleshooting guide:**
   ```bash
   cat TROUBLESHOOTING.md
   ```

3. **See what was fixed:**
   ```bash
   cat FIXES_APPLIED.md
   ```

4. **Full system reset:**
   ```bash
   docker-compose down -v
   docker-compose build --no-cache
   docker-compose up -d
   ```

---

**TL;DR:**
- ✅ **PDF support is NOW WORKING!**
- ✅ **OCR works without API key**
- ⚠️ **AI features need ANTHROPIC_API_KEY**
- 📊 **View logs:** `docker-compose logs -f python-ai`
- 🔍 **Find errors:** `docker-compose logs python-ai | grep ERROR`

**Updated:** 2025-11-01

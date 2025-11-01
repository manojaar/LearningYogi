#!/bin/bash
echo "🧪 Testing API Key Configuration..."
echo ""
echo "1️⃣ Checking Python AI Service..."
curl -s http://localhost:8000/health
echo ""
echo ""
echo "2️⃣ Checking AI Chatbot Service..."
curl -s http://localhost:9000/health
echo ""
echo ""
echo "3️⃣ Checking API Key in .env..."
if grep -q "ANTHROPIC_API_KEY=sk-ant-api03-" .env; then
    echo "✅ API key format looks correct!"
else
    echo "❌ API key not set or incorrect format"
    echo "   Expected: ANTHROPIC_API_KEY=sk-ant-api03-..."
    echo "   Found: $(grep ANTHROPIC_API_KEY .env)"
fi
echo ""
echo "📊 View detailed logs:"
echo "   docker-compose logs python-ai --tail 20"
echo "   docker-compose logs ai-chatbot --tail 20"

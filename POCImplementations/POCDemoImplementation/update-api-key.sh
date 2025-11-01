#!/bin/bash

# Script to update Anthropic API Key in .env file
# Usage: ./update-api-key.sh YOUR-API-KEY

if [ -z "$1" ]; then
    echo "❌ Error: Please provide your Anthropic API key"
    echo ""
    echo "Usage:"
    echo "  ./update-api-key.sh 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"
    echo ""
    echo "Or manually edit .env file:"
    echo "  nano .env"
    exit 1
fi

API_KEY="$1"

# Validate API key format
if [[ ! $API_KEY == sk-ant-api03-* ]]; then
    echo "⚠️  Warning: API key should start with 'sk-ant-api03-'"
    echo "   Your key starts with: ${API_KEY:0:15}..."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Backup current .env
cp .env .env.backup
echo "✅ Backed up .env to .env.backup"

# Update API key
sed -i '' "s|ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$API_KEY|g" .env
echo "✅ Updated ANTHROPIC_API_KEY in .env"

# Show confirmation
echo ""
echo "📋 Current API key setting:"
grep "ANTHROPIC_API_KEY" .env

echo ""
echo "🔄 Restarting services..."
docker-compose restart python-ai ai-chatbot

echo ""
echo "⏳ Waiting for services to start..."
sleep 5

echo ""
echo "🧪 Testing services..."
echo ""

# Test Python AI service
echo "Testing Python AI service..."
curl -s http://localhost:8000/health | jq . 2>/dev/null || curl -s http://localhost:8000/health

echo ""
echo ""

# Test AI Chatbot service
echo "Testing AI Chatbot service..."
curl -s http://localhost:9000/health | jq . 2>/dev/null || curl -s http://localhost:9000/health

echo ""
echo ""
echo "✅ Done! Your API key has been configured."
echo ""
echo "📝 Next steps:"
echo "   1. Open http://localhost:3000"
echo "   2. Upload a timetable"
echo "   3. Try the AI Chatbot (bottom-right corner)"
echo ""
echo "📊 View logs:"
echo "   docker-compose logs -f python-ai"
echo "   docker-compose logs -f ai-chatbot"

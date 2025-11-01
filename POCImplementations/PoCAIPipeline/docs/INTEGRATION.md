# Integration Guide - POCDemoImplementation

This guide provides step-by-step instructions for integrating PoCAIPipeline with POCDemoImplementation.

## Overview

PoCAIPipeline is designed as a drop-in replacement and enhancement for the existing AI services in POCDemoImplementation. The integration can be done incrementally, allowing you to test and validate each component.

## Integration Approaches

### Approach 1: Full Replacement (Recommended)
Replace existing OCR and Claude services with fine-tuned models.

### Approach 2: Hybrid Approach
Use fine-tuned models with fallback to existing services.

### Approach 3: Feature Store Only
Keep existing services, add feature store for analytics.

## Prerequisites

1. **PoCAIPipeline Setup**
   ```bash
   cd POCImplementations/PoCAIPipeline
   pip install -r requirements.txt
   docker-compose -f infrastructure/docker-compose.yml up -d
   ```

2. **POCDemoImplementation Running**
   ```bash
   cd POCImplementations/POCDemoImplementation
   docker-compose up -d
   ```

3. **Verify Services**
   - PoCAIPipeline inference service: http://localhost:8001
   - Feature store (Feast): http://localhost:6566
   - Redis: localhost:6379

## Step 1: Install PoCAIPipeline Package

### Option A: As a Git Submodule

```bash
cd POCImplementations/POCDemoImplementation
git submodule add ../PoCAIPipeline backend/python/ai_pipeline
```

### Option B: Install as Package

```bash
cd POCImplementations/PoCAIPipeline
pip install -e .
```

### Option C: Direct Integration

Copy or symlink the inference services:
```bash
ln -s ../../PoCAIPipeline/src/inference backend/python/app/inference_pipeline
```

## Step 2: Replace OCR Service

### 2.1 Update Dependencies

Add to `POCDemoImplementation/backend/python/requirements.txt`:
```
torch>=2.0.0
transformers>=4.30.0
peft>=0.5.0
feast>=0.36.0
redis>=4.5.0
```

### 2.2 Modify OCR Service

**Before** (`backend/python/app/services/ocr_service.py`):
```python
from app.models.ocr import OCRResult

class OCRService:
    def process_image(self, image_path: str) -> OCRResult:
        # Tesseract OCR
        ...
```

**After** (`backend/python/app/services/ocr_service.py`):
```python
from app.models.ocr import OCRResult
from inference.ocr_service import FineTunedOCRService as BaseOCRService

class OCRService(BaseOCRService):
    """
    Fine-tuned OCR service with feature store integration
    Falls back to Tesseract if fine-tuned model unavailable
    """
    
    def __init__(self):
        super().__init__(
            model_path=os.getenv('OCR_MODEL_PATH', 'models/ocr_lora'),
            use_feature_store=True,
            fallback_to_tesseract=True
        )
    
    def process_image(self, image_path: str) -> OCRResult:
        # Use fine-tuned model
        result = super().process_image(image_path)
        
        # Store features in Feast
        self._store_features(image_path, result)
        
        return result
```

### 2.3 Update Environment Variables

Add to `POCDemoImplementation/.env`:
```bash
# AI Pipeline Configuration
OCR_MODEL_PATH=models/ocr_lora
DOCUMENT_MODEL_PATH=models/document_lora
FEATURE_STORE_ENABLED=true
FEATURE_STORE_HOST=localhost
FEATURE_STORE_PORT=6566
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Step 3: Replace Document Service

### 3.1 Modify Claude Service

**Before** (`backend/python/app/services/claude_service.py`):
```python
from anthropic import Anthropic

class ClaudeService:
    def extract_timetable(self, image_path: str) -> TimetableData:
        # Claude API call
        ...
```

**After** (`backend/python/app/services/claude_service.py`):
```python
from inference.document_service import FineTunedDocumentService
from app.models.ocr import TimetableData

class ClaudeService:
    """
    Document extraction service with fine-tuned models
    Falls back to Claude API if model unavailable
    """
    
    def __init__(self):
        self.model_service = FineTunedDocumentService(
            model_path=os.getenv('DOCUMENT_MODEL_PATH', 'models/document_lora'),
            use_feature_store=True
        )
        # Keep Claude as fallback
        self.claude_api_key = os.getenv('ANTHROPIC_API_KEY')
    
    def extract_timetable(self, image_path: str) -> TimetableData:
        try:
            # Try fine-tuned model first
            result = self.model_service.extract_timetable(image_path)
            return result
        except Exception as e:
            # Fallback to Claude API
            logger.warning(f"Fine-tuned model failed, using Claude: {e}")
            return self._extract_with_claude(image_path)
```

## Step 4: Add Feature Store Integration

### 4.1 Create Feature Store Client

Create `backend/python/app/services/feature_store_client.py`:
```python
from feast import FeatureStore
import os

class FeatureStoreClient:
    def __init__(self):
        repo_path = os.getenv('FEATURE_STORE_REPO_PATH', 
                            '../../PoCAIPipeline/feature_repo')
        self.store = FeatureStore(repo_path=repo_path)
    
    def get_features(self, entity_id: str, feature_names: list):
        """Get features for a document"""
        return self.store.get_online_features(
            entity_rows=[{"document_id": entity_id}],
            features=feature_names
        ).to_dict()
    
    def store_ocr_features(self, document_id: str, ocr_result):
        """Store OCR features"""
        # Implementation for storing features
        pass
```

### 4.2 Update Processing Pipeline

Modify `backend/python/app/api/ai.py` to use feature store:
```python
from app.services.feature_store_client import FeatureStoreClient

feature_store = FeatureStoreClient()

@app.post("/ai/extract")
async def extract_timetable(file: UploadFile):
    document_id = generate_id()
    
    # Get historical features if available
    features = feature_store.get_features(
        document_id, 
        ["avg_confidence", "layout_score"]
    )
    
    # Process with features
    result = claude_service.extract_timetable(file_path)
    
    # Store new features
    feature_store.store_ocr_features(document_id, ocr_result)
    
    return result
```

## Step 5: Update Configuration

### 5.1 Docker Compose Integration

Update `POCDemoImplementation/docker-compose.yml`:
```yaml
services:
  # Existing services...
  
  ai-pipeline:
    build: ../PoCAIPipeline
    ports:
      - "8001:8000"
    environment:
      - MODEL_PATH=/models
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./models:/models
    depends_on:
      - redis
  
  feast-server:
    image: feastdev/feast-server:latest
    ports:
      - "6566:6566"
    environment:
      - FEAST_CONFIG=./configs/feature_store_config.yaml
    volumes:
      - ../PoCAIPipeline/feature_repo:/feature_repo
```

## Step 6: Testing Integration

### 6.1 Unit Tests

Update tests to use new services:
```python
def test_ocr_service_with_fine_tuned_model():
    service = OCRService()
    result = service.process_image("test_image.png")
    assert result.confidence > 0.8
    assert result.engine == "fine_tuned_ocr"
```

### 6.2 Integration Tests

Test end-to-end flow:
```python
def test_full_pipeline_with_feature_store():
    # Upload document
    response = upload_document("timetable.png")
    document_id = response["id"]
    
    # Process
    result = process_document(document_id)
    
    # Verify features stored
    features = feature_store.get_features(document_id, ["ocr_confidence"])
    assert features is not None
```

## Step 7: Model Deployment

### 7.1 Download Pre-trained Models

If models are not available locally:
```bash
# Download OCR model
python scripts/download_model.py --model-type ocr --version v1.0

# Download Document model
python scripts/download_model.py --model-type document --version v1.0
```

### 7.2 Configure Model Paths

Set environment variables:
```bash
export OCR_MODEL_PATH=models/ocr_lora_v1.0
export DOCUMENT_MODEL_PATH=models/document_lora_v1.0
```

## Step 8: Gradual Rollout

### 8.1 A/B Testing Setup

Route percentage of traffic to new models:
```python
import random

def route_to_model(image_path: str):
    if random.random() < 0.1:  # 10% to new model
        return fine_tuned_ocr_service.process_image(image_path)
    else:
        return tesseract_ocr_service.process_image(image_path)
```

### 8.2 Monitor Performance

Compare metrics:
- Accuracy improvement
- Processing time
- Feature store latency
- Model confidence scores

## Troubleshooting

### Issue: Models Not Found

**Solution**: Check model paths and download models if needed:
```bash
python scripts/download_model.py --model-type ocr
```

### Issue: Feature Store Connection Failed

**Solution**: Ensure Redis and Feast server are running:
```bash
docker-compose -f infrastructure/docker-compose.yml ps
```

### Issue: Performance Degradation

**Solution**: Enable fallback to original services:
```python
use_fine_tuned = os.getenv('USE_FINE_TUNED', 'false').lower() == 'true'
```

## Rollback Plan

If issues occur, revert to original services:

1. Set environment variable:
```bash
USE_FINE_TUNED=false
```

2. Or revert code changes:
```bash
git checkout HEAD -- backend/python/app/services/
```

## Next Steps

After successful integration:

1. Monitor model performance
2. Collect training data for further fine-tuning
3. Iterate on feature definitions
4. Plan migration to cloud (see MIGRATION_POC1.md or MIGRATION_POC2.md)

## AI Chatbot Integration

The AI Chatbot can leverage the fine-tuned models from PoCAIPipeline for enhanced responses:

### Using Fine-Tuned Models in Chatbot

```python
# chatbot configuration
CHATBOT_USE_FINE_TUNED_OCR=true
CHATBOT_USE_FINE_TUNED_DOC=true
OCR_MODEL_ENDPOINT=http://ai-pipeline-inference:8000
DOCUMENT_MODEL_ENDPOINT=http://ai-pipeline-inference:8000
```

**Benefits**:
- More accurate responses about document processing
- Better understanding of timetable structures
- Reduced API costs for chatbot queries
- Consistent AI behavior across services

**See**: [POCDemoImplementation Chatbot Integration](../../AIChatbot/integration/POCDemoImplementation.md)

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-01-01


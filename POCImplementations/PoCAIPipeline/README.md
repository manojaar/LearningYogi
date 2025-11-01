# PoCAIPipeline - MLOps with Fine-tuning and Feature Store

## Overview

PoCAIPipeline is a plug-and-play AI pipeline project designed to enhance the POCDemoImplementation with advanced MLOps capabilities, fine-tuned models, and a feature store. This project provides:

- **Fine-tuned OCR Models**: Knowledge Distillation and LoRA-based fine-tuning for domain-specific OCR
- **Fine-tuned Document Understanding Models**: Custom models optimized for timetable extraction
- **Feature Store**: Feast-based feature store with Redis for online serving
- **MLOps Infrastructure**: Complete training and inference pipelines with experiment tracking
- **Cloud-Ready**: Roadmaps for migration to both microservices (POC1) and serverless (POC2) architectures

## Key Features

✅ **Fine-tuning Support**
- Knowledge Distillation for creating lightweight OCR models
- LoRA (Low-Rank Adaptation) for efficient model fine-tuning
- Support for both OCR and Document Understanding models

✅ **Feature Store**
- Feast-based feature definitions
- Redis online store for low-latency feature serving
- Support for OCR, document, and domain-specific features

✅ **MLOps Pipeline**
- MLflow integration for experiment tracking
- Model registry and versioning
- Automated deployment pipelines
- Model monitoring and drift detection

✅ **Plug-and-Play Integration**
- Seamless integration with POCDemoImplementation
- API-compatible replacements for existing services
- Backward-compatible configuration

## Quick Start

### Prerequisites

- Python 3.11+
- Docker & Docker Compose
- Redis 7+ (for feature store)
- GPU (optional, for training)

### Installation

1. **Clone and navigate to directory**
```bash
cd POCImplementations/PoCAIPipeline
```

2. **Create virtual environment**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Start infrastructure with Docker Compose**
```bash
docker-compose -f infrastructure/docker-compose.yml up -d
```

5. **Initialize Feast feature store**
```bash
feast apply
```

6. **Run inference service**
```bash
python -m src.inference.pipeline
```

## Project Structure

```
PoCAIPipeline/
├── README.md                          # This file
├── docs/                              # Documentation
│   ├── ARCHITECTURE.md                # System architecture
│   ├── INTEGRATION.md                 # POCDemoImplementation integration
│   ├── MLOPS_GUIDE.md                 # MLOps workflows
│   ├── FEATURE_STORE.md               # Feast feature store guide
│   ├── FINE_TUNING.md                 # Fine-tuning strategies
│   ├── MIGRATION_POC1.md              # Cloud migration to POC1
│   ├── MIGRATION_POC2.md              # Cloud migration to POC2
│   └── API_REFERENCE.md               # API documentation
├── src/
│   ├── training/                      # Training pipelines
│   │   ├── ocr_model/                 # OCR model training
│   │   └── document_model/            # Document model training
│   ├── inference/                     # Inference services
│   ├── feature_store/                 # Feast integration
│   └── mlops/                         # MLOps orchestration
├── configs/                          # Configuration files
├── infrastructure/                    # Infrastructure as code
└── tests/                             # Test suite
```

## Usage

### Training a Model

**Fine-tune OCR model with LoRA:**
```bash
python src/training/ocr_model/lora_finetune.py \
    --model_name microsoft/trocr-base-printed \
    --dataset_path data/timetables \
    --output_dir models/ocr_lora
```

**Distill OCR model:**
```bash
python src/training/ocr_model/distill_student.py \
    --teacher_model models/ocr_teacher \
    --student_model microsoft/trocr-small \
    --dataset_path data/timetables \
    --output_dir models/ocr_student
```

### Running Inference

**Start inference API:**
```bash
python -m src.inference.pipeline
```

**Make inference request:**
```bash
curl -X POST http://localhost:8000/infer \
  -H "Content-Type: application/json" \
  -d '{
    "image_path": "path/to/timetable.png",
    "model_type": "ocr",
    "model_version": "v1.0"
  }'
```

### Using Feature Store

**Retrieve features:**
```python
from src.feature_store.feature_serving import FeatureStoreClient

client = FeatureStoreClient()
features = client.get_online_features(
    entity_ids=["doc_123"],
    feature_names=["ocr_confidence", "layout_score"]
)
```

## Integration with POCDemoImplementation

See [docs/INTEGRATION.md](docs/INTEGRATION.md) for detailed integration steps.

**Quick integration:**

1. Replace OCR service:
```python
# Before
from app.services.ocr_service import OCRService

# After
from src.inference.ocr_service import FineTunedOCRService
```

2. Replace Claude service:
```python
# Before
from app.services.claude_service import ClaudeService

# After
from src.inference.document_service import FineTunedDocumentService
```

3. Add feature store:
```python
from src.feature_store.feature_serving import FeatureStoreClient
feature_store = FeatureStoreClient()
```

## Documentation

- **[Architecture](docs/ARCHITECTURE.md)** - System design and component interactions
- **[Integration Guide](docs/INTEGRATION.md)** - Step-by-step integration with POCDemoImplementation
- **[MLOps Guide](docs/MLOPS_GUIDE.md)** - Training and deployment workflows
- **[Feature Store](docs/FEATURE_STORE.md)** - Feast setup and usage
- **[Fine-tuning Guide](docs/FINE_TUNING.md)** - Model fine-tuning strategies
- **[Migration to POC1](docs/MIGRATION_POC1.md)** - Cloud migration roadmap (Microservices)
- **[Migration to POC2](docs/MIGRATION_POC2.md)** - Cloud migration roadmap (Serverless)
- **[API Reference](docs/API_REFERENCE.md)** - Complete API documentation

## Cloud Migration

This project is designed to be cloud-ready with migration paths to:

- **POC1 (Microservices)**: Kubernetes-based deployment
  - See [MIGRATION_POC1.md](docs/MIGRATION_POC1.md)

- **POC2 (Serverless)**: AWS Lambda-based deployment
  - See [MIGRATION_POC2.md](docs/MIGRATION_POC2.md)

## Technology Stack

- **Training**: PyTorch, Transformers, PEFT, Hugging Face Accelerate
- **MLOps**: MLflow, DVC
- **Feature Store**: Feast, Redis
- **Model Serving**: FastAPI, TorchServe
- **Orchestration**: Airflow/Prefect for training, Kubernetes/Step Functions for inference
- **Monitoring**: Prometheus, Grafana, MLflow Tracking

## Development

### Running Tests

```bash
# Unit tests
pytest tests/unit/

# Integration tests
pytest tests/integration/

# E2E tests
pytest tests/e2e/
```

### Code Quality

```bash
# Linting
black src/ tests/
flake8 src/ tests/

# Type checking
mypy src/
```

## Contributing

This is a POC implementation. For production use:
1. Review security configurations
2. Add comprehensive error handling
3. Set up proper monitoring
4. Configure backup and recovery

## License

MIT License

---

**Version**: 1.0.0  
**Status**: ✅ Functional POC  
**Last Updated**: 2025-01-01


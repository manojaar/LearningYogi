# Architecture Documentation - PoCAIPipeline

## System Overview

PoCAIPipeline is a modular AI pipeline system that provides fine-tuned models, feature store capabilities, and MLOps infrastructure. It is designed to integrate seamlessly with POCDemoImplementation while providing a clear path to cloud deployment.

## Design Principles

1. **Modularity**: Components are independently deployable and testable
2. **Pluggability**: Easy integration with existing POCDemoImplementation
3. **Scalability**: Designed for both local development and cloud deployment
4. **MLOps-First**: Built-in experiment tracking, model versioning, and monitoring
5. **Feature-Driven**: Feature store enables data-driven improvements

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   POCDemoImplementation                      │
│                    (Existing System)                         │
└───────────────────────┬─────────────────────────────────────┘
                        │ API Calls
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              PoCAIPipeline - Inference Layer                 │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ OCR Service  │  │ Document     │  │ Feature      │    │
│  │ (Fine-tuned) │  │ Service      │  │ Store        │    │
│  │              │  │ (Fine-tuned) │  │ Client       │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │             │
│         └────────┬────────┴────────┬────────┘             │
│                  │                 │                       │
│                  ▼                 ▼                       │
│         ┌─────────────────────────────────┐                │
│         │     Feature Store (Feast)       │                │
│         │  - Redis (Online Store)         │                │
│         │  - Parquet/S3 (Offline Store)  │                │
│         └─────────────────────────────────┘                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Model Registry & Serving                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ OCR Models   │  │ Document     │  │ Model       │    │
│  │ - Teacher    │  │ Models       │  │ Registry    │    │
│  │ - Student    │  │ - Base       │  │ (MLflow)    │    │
│  │ - LoRA       │  │ - LoRA       │  │             │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              MLOps Pipeline                                  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Training      │  │ Experiment │  │ Deployment  │       │
│  │ Pipeline      │  │ Tracking   │  │ Pipeline    │       │
│  │               │  │ (MLflow)   │  │             │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Inference Layer

**OCR Service** (`src/inference/ocr_service.py`)
- Fine-tuned OCR model inference
- Supports multiple model versions
- Confidence scoring and quality gates
- Feature extraction for feature store

**Document Service** (`src/inference/document_service.py`)
- Fine-tuned document understanding model
- Timetable extraction with structured output
- Feature extraction and caching
- Fallback to base models if needed

**Feature Store Client** (`src/inference/feature_store_client.py`)
- Online feature retrieval from Redis
- Feature engineering helpers
- Caching and performance optimization

### 2. Feature Store (Feast)

**Online Store (Redis)**
- Low-latency feature serving (<10ms)
- Real-time feature updates
- Entity-based feature lookup

**Offline Store (Parquet/S3)**
- Historical feature data
- Training data generation
- Feature backfilling

**Feature Definitions** (`src/feature_store/feature_definitions.py`)
- OCR features: text, confidence, layout
- Document features: embeddings, metadata
- Domain features: timetable patterns, subjects

### 3. Training Pipeline

**OCR Model Training**
- Teacher model training (large model)
- Knowledge Distillation (student model)
- LoRA fine-tuning (parameter-efficient)

**Document Model Training**
- Base model fine-tuning
- LoRA adaptation
- Custom distillation strategies

**Training Infrastructure**
- Distributed training support
- Experiment tracking (MLflow)
- Model checkpointing
- Hyperparameter optimization

### 4. MLOps Infrastructure

**MLflow Integration**
- Experiment tracking
- Model versioning
- Model registry
- Artifact storage

**Deployment Pipeline**
- Model validation
- A/B testing framework
- Rollback capabilities
- Monitoring integration

## Data Flow

### Training Flow

```
Raw Data → Data Validation → Feature Engineering (Feast)
    ↓
Training Pipeline (LoRA/Distillation)
    ↓
Model Evaluation → Model Registry (MLflow)
    ↓
Model Deployment → Inference Service
```

### Inference Flow

```
Request → Inference Service
    ↓
Feature Store (Fetch Features)
    ↓
Model Inference (Fine-tuned Model)
    ↓
Post-processing & Validation
    ↓
Response + Feature Updates (to Feast)
```

## Integration Points

### With POCDemoImplementation

1. **OCR Service Replacement**
   - Same API interface
   - Enhanced with fine-tuned models
   - Feature store integration

2. **Document Service Replacement**
   - Compatible with Claude service interface
   - Fine-tuned models for better accuracy
   - Reduced API costs

3. **Feature Store Addition**
   - Optional integration
   - Enhances existing services
   - No breaking changes

## Model Architecture

### OCR Models

**Teacher Model**
- Architecture: TrOCR-Large or PaddleOCR
- Purpose: High-accuracy reference
- Use case: Knowledge distillation source

**Student Model**
- Architecture: TrOCR-Small or MobileOCR
- Purpose: Lightweight inference
- Method: Knowledge Distillation

**LoRA-Enhanced Model**
- Base: TrOCR-Base
- Adaptation: LoRA layers
- Purpose: Domain-specific fine-tuning

### Document Understanding Models

**Base Model**
- Options: Llama 3, Mistral, or custom transformer
- Purpose: General document understanding

**LoRA-Enhanced Model**
- Base: Pre-trained LLM
- Adaptation: LoRA fine-tuning for timetables
- Purpose: Domain-specific extraction

## Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Training Framework** | PyTorch + Transformers | Industry standard, large model support |
| **Fine-tuning** | PEFT (LoRA) | Parameter-efficient, fast iteration |
| **Knowledge Distillation** | Custom + PyTorch | Model compression |
| **Feature Store** | Feast | Industry-standard feature store |
| **Online Store** | Redis | Low-latency serving |
| **Experiment Tracking** | MLflow | Model lifecycle management |
| **Model Serving** | FastAPI + TorchServe | Fast inference, RESTful API |
| **Orchestration** | Airflow/Prefect | Training pipeline automation |

## Scalability Considerations

### Local Development
- Single instance deployment
- Docker Compose for services
- SQLite for metadata (MLflow)

### Cloud Deployment (POC1)
- Kubernetes for model serving
- Horizontal scaling of inference pods
- Redis cluster for feature store
- S3 for model artifacts

### Cloud Deployment (POC2)
- Lambda functions for inference
- ElastiCache Serverless for features
- Step Functions for training
- S3 for storage

## Security

- Model versioning and access control
- Feature store encryption at rest
- API authentication and authorization
- Secure model artifact storage

## Monitoring

- Model performance metrics
- Feature store latency
- Inference throughput
- Model drift detection

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-01-01


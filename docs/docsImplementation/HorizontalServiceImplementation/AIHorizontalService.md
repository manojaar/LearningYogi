# AI Horizontal Service Architecture

## Executive Summary

This document outlines the architecture for a **reusable AI Horizontal Service** that provides enterprise-grade machine learning infrastructure for the Learning Yogi platform and future products. The service includes Feature Store, online learning capabilities, Responsible AI guardrails, and comprehensive model evaluation tools.

**Key Components**:
- **Feature Store**: Centralized feature management and serving
- **Model Registry**: Versioned model storage and deployment
- **Online Learning**: Reinforcement learning for continuous improvement
- **Responsible AI**: Bias detection, fairness, explainability
- **Evaluation Framework**: Model performance monitoring and A/B testing

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Feature Store](#feature-store)
3. [Model Registry & Serving](#model-registry--serving)
4. [Online Learning & Reinforcement Learning](#online-learning--reinforcement-learning)
5. [Responsible AI Guardrails](#responsible-ai-guardrails)
6. [Model Evaluation & Monitoring](#model-evaluation--monitoring)
7. [Integration Patterns](#integration-patterns)
8. [Implementation Roadmap](#implementation-roadmap)

---

## Architecture Overview

### Why AI Horizontal Service?

**Problems Solved**:
1. **Feature Engineering Duplication**: Teams rebuild same features across projects
2. **Training-Serving Skew**: Features computed differently in training vs production
3. **Model Drift**: Models degrade over time without monitoring
4. **Bias and Fairness**: No systematic approach to detect/mitigate bias
5. **Explainability**: Black-box models without explanation
6. **Experimentation**: Difficult to A/B test models safely

**Benefits**:
- **Reusability**: Share features and models across projects
- **Consistency**: Same features in training and serving
- **Continuous Learning**: Models improve from production feedback
- **Trust & Safety**: Built-in bias detection and explainability
- **Faster Development**: Standardized ML workflows

---

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │
│  │  Learning Yogi   │  │  Future Product  │  │  Future Product  │     │
│  │  (Timetables)    │  │  (Gradebook)     │  │  (Lesson Plans)  │     │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘     │
└───────────┼──────────────────────┼──────────────────────┼───────────────┘
            │                      │                      │
            └──────────────────────┼──────────────────────┘
                                   │
                         API Gateway / SDK
                                   │
┌──────────────────────────────────┼──────────────────────────────────────┐
│                    AI HORIZONTAL SERVICE                                 │
│                                  │                                       │
│  ┌───────────────────────────────▼────────────────────────────────┐    │
│  │                    SERVICE ORCHESTRATION                        │    │
│  │  - Request routing and load balancing                          │    │
│  │  - Authentication and rate limiting                            │    │
│  │  - Logging and distributed tracing                             │    │
│  └───────────────────────────────┬────────────────────────────────┘    │
│                                   │                                      │
│         ┌─────────────────────────┼─────────────────────────┐           │
│         │                         │                         │           │
│         ▼                         ▼                         ▼           │
│  ┌─────────────┐          ┌─────────────┐         ┌─────────────┐     │
│  │  FEATURE    │          │   MODEL     │         │  PREDICTION │     │
│  │  STORE      │          │  REGISTRY   │         │  SERVICE    │     │
│  │             │          │             │         │             │     │
│  │ - Offline   │          │ - Versioning│         │ - Real-time │     │
│  │ - Online    │          │ - Metadata  │         │   inference │     │
│  │ - Transform │          │ - Stage mgmt│         │ - Batch     │     │
│  │             │          │ - A/B test  │         │   inference │     │
│  └─────────────┘          └─────────────┘         └─────────────┘     │
│         │                         │                         │           │
│         └─────────────────────────┼─────────────────────────┘           │
│                                   │                                      │
│  ┌────────────────────────────────┴────────────────────────────────┐   │
│  │              ONLINE LEARNING & FEEDBACK LOOP                     │   │
│  │                                                                   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │   │
│  │  │  Feedback    │  │ Reinforcement│  │   Model      │          │   │
│  │  │  Collector   │→ │  Learning    │→ │  Retraining  │          │   │
│  │  │              │  │  Engine      │  │              │          │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                   │                                      │
│  ┌────────────────────────────────┴────────────────────────────────┐   │
│  │            RESPONSIBLE AI GUARDRAILS                             │   │
│  │                                                                   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │   │
│  │  │    Bias      │  │  Fairness    │  │Explainability│          │   │
│  │  │  Detection   │  │  Checker     │  │   (SHAP/LIME)│          │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                   │                                      │
│  ┌────────────────────────────────┴────────────────────────────────┐   │
│  │         MODEL EVALUATION & MONITORING                            │   │
│  │                                                                   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │   │
│  │  │ Performance  │  │  Drift       │  │   A/B Test   │          │   │
│  │  │ Metrics      │  │  Detection   │  │  Framework   │          │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │   │
│  └───────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
                                   │
┌──────────────────────────────────┴──────────────────────────────────────┐
│                         DATA STORAGE LAYER                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  Feature DB  │  │  Model Store │  │  Feedback DB │  │ Metrics DB │ │
│  │ (PostgreSQL) │  │     (S3)     │  │ (TimescaleDB)│  │(Prometheus)│ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Feature Store

### What is a Feature Store?

A **Feature Store** is a centralized platform for:
1. **Define**: Create and document features
2. **Store**: Persist features (offline for training, online for serving)
3. **Serve**: Retrieve features for real-time predictions
4. **Monitor**: Track feature quality and freshness

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   FEATURE STORE                              │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              FEATURE REGISTRY                          │  │
│  │  - Feature definitions (schema, type, description)    │  │
│  │  - Feature groups (logical grouping)                  │  │
│  │  - Feature lineage (data source tracking)            │  │
│  │  - Feature versioning                                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────┐         ┌──────────────────────┐   │
│  │  OFFLINE STORE     │         │   ONLINE STORE       │   │
│  │                    │         │                      │   │
│  │  - PostgreSQL /    │         │  - Redis             │   │
│  │    Parquet         │         │  - DynamoDB          │   │
│  │  - Historical data │         │  - In-memory cache   │   │
│  │  - Training sets   │         │  - Sub-ms latency    │   │
│  │  - Batch features  │         │  - Real-time lookup  │   │
│  └────────────────────┘         └──────────────────────┘   │
│           │                              ▲                  │
│           │                              │                  │
│           ▼                              │                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │          FEATURE TRANSFORMATION ENGINE                 │  │
│  │  - SQL transformations                                │  │
│  │  - Python UDFs                                        │  │
│  │  - Streaming aggregations                            │  │
│  │  - Time-windowed features                            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │          FEATURE SERVING API                           │  │
│  │  - GET /features/online/{feature_group}               │  │
│  │  - POST /features/batch (for training)                │  │
│  │  - GET /features/metadata                             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Feature Groups for Learning Yogi

#### 1. Document Features

```python
# Feature Group: Document Characteristics
document_features = FeatureGroup(
    name="document_characteristics",
    features=[
        Feature(name="file_type", dtype="string"),
        Feature(name="file_size_kb", dtype="int"),
        Feature(name="image_width", dtype="int"),
        Feature(name="image_height", dtype="int"),
        Feature(name="aspect_ratio", dtype="float"),
        Feature(name="color_mode", dtype="string"),  # grayscale, rgb
        Feature(name="dpi", dtype="int"),
        Feature(name="contrast_score", dtype="float"),
        Feature(name="brightness_score", dtype="float"),
        Feature(name="blur_score", dtype="float"),
    ],
    entity="document_id",
    online=True,
    offline=True,
)
```

#### 2. OCR Confidence Features

```python
# Feature Group: OCR Quality Indicators
ocr_confidence_features = FeatureGroup(
    name="ocr_confidence_indicators",
    features=[
        Feature(name="mean_char_confidence", dtype="float"),
        Feature(name="median_char_confidence", dtype="float"),
        Feature(name="min_char_confidence", dtype="float"),
        Feature(name="word_count", dtype="int"),
        Feature(name="dictionary_match_ratio", dtype="float"),
        Feature(name="layout_detected", dtype="boolean"),
        Feature(name="table_detected", dtype="boolean"),
        Feature(name="text_density", dtype="float"),
    ],
    entity="document_id",
    online=True,
    offline=True,
)
```

#### 3. User Behavior Features

```python
# Feature Group: User Historical Patterns
user_behavior_features = FeatureGroup(
    name="user_behavior_patterns",
    features=[
        Feature(name="total_uploads_count", dtype="int"),
        Feature(name="successful_extractions_count", dtype="int"),
        Feature(name="hitl_requests_count", dtype="int"),
        Feature(name="avg_document_quality_score", dtype="float"),
        Feature(name="preferred_upload_format", dtype="string"),
        Feature(name="avg_correction_rate", dtype="float"),
        Feature(name="user_tenure_days", dtype="int"),
    ],
    entity="user_id",
    online=True,
    offline=True,
)
```

#### 4. Temporal Features

```python
# Feature Group: Time-based Features
temporal_features = FeatureGroup(
    name="temporal_patterns",
    features=[
        Feature(name="hour_of_day", dtype="int"),
        Feature(name="day_of_week", dtype="int"),
        Feature(name="is_weekend", dtype="boolean"),
        Feature(name="is_school_term", dtype="boolean"),
        Feature(name="uploads_last_7_days", dtype="int"),
        Feature(name="uploads_last_30_days", dtype="int"),
    ],
    entity="user_id",
    online=True,
    offline=False,  # Computed on-the-fly
)
```

### Feature Serving Patterns

#### Pattern 1: Real-time Feature Lookup (Online Serving)

```python
# Example: Get features for real-time prediction
from ai_service.feature_store import FeatureStoreClient

client = FeatureStoreClient()

# Fetch online features for a document
features = client.get_online_features(
    feature_groups=["document_characteristics", "ocr_confidence_indicators"],
    entity_ids={"document_id": "doc-123"}
)

# Use features for model prediction
prediction = model.predict(features)
```

#### Pattern 2: Point-in-Time Correct Features (Training)

```python
# Example: Get historical features for training
training_data = client.get_historical_features(
    feature_groups=["document_characteristics", "user_behavior_patterns"],
    entity_df=training_entity_df,  # DataFrame with entity IDs and timestamps
    point_in_time_join=True  # Ensures no data leakage
)

# Train model
model.fit(training_data.features, training_data.labels)
```

### Feature Store Technology Options

| Feature | Open Source (Feast) | AWS SageMaker | Google Vertex AI | Tecton |
|---------|---------------------|---------------|------------------|--------|
| **Cost** | Low (self-hosted) | Medium | Medium | High |
| **Setup** | Medium complexity | Easy | Easy | Easy |
| **Online Store** | Redis, DynamoDB | DynamoDB | Bigtable | DynamoDB |
| **Offline Store** | Parquet, Snowflake | S3 | BigQuery | S3 |
| **Streaming** | Limited | Yes | Yes | Excellent |
| **Integration** | Python SDK | AWS Native | GCP Native | Cloud-agnostic |

**Recommendation for PoC**: Start with **Feast (Open Source)**
**Recommendation for Production**: Migrate to **AWS SageMaker Feature Store** (Implementation 2) or **Feast on Kubernetes** (Implementation 1)

---

## Model Registry & Serving

### Model Registry

**Purpose**: Centralized storage and versioning of ML models

```
┌─────────────────────────────────────────────────────────────┐
│                   MODEL REGISTRY                             │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 MODEL METADATA                         │  │
│  │  {                                                     │  │
│  │    "model_id": "ocr-confidence-classifier-v3",        │  │
│  │    "version": "3.2.1",                                │  │
│  │    "algorithm": "XGBoost",                            │  │
│  │    "framework": "scikit-learn",                       │  │
│  │    "training_date": "2024-10-31",                     │  │
│  │    "metrics": {                                       │  │
│  │      "accuracy": 0.94,                                │  │
│  │      "precision": 0.92,                               │  │
│  │      "recall": 0.96,                                  │  │
│  │      "f1_score": 0.94                                 │  │
│  │    },                                                 │  │
│  │    "features": ["document_characteristics", ...],    │  │
│  │    "stage": "production",                             │  │
│  │    "owner": "ml-team@learningyogi.com"               │  │
│  │  }                                                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │               MODEL STORAGE (S3)                       │  │
│  │  models/                                              │  │
│  │  ├── ocr-confidence-classifier/                       │  │
│  │  │   ├── v1.0.0/                                      │  │
│  │  │   │   ├── model.pkl                                │  │
│  │  │   │   ├── metadata.json                            │  │
│  │  │   │   └── requirements.txt                         │  │
│  │  │   ├── v2.0.0/                                      │  │
│  │  │   └── v3.2.1/  ← current production                │  │
│  │  ├── timetable-extractor/                             │  │
│  │  └── layout-detector/                                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │            STAGE MANAGEMENT                            │  │
│  │  - Development: For experimentation                   │  │
│  │  - Staging: For validation                            │  │
│  │  - Production: Serving live traffic                   │  │
│  │  - Archived: Deprecated models                        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Model Serving Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  MODEL SERVING SERVICE                       │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              PREDICTION API                            │  │
│  │  POST /predict                                        │  │
│  │  {                                                     │  │
│  │    "model_name": "ocr-confidence-classifier",         │  │
│  │    "version": "3.2.1",  // or "latest", "production" │  │
│  │    "features": { ... }                                │  │
│  │  }                                                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                        │                                     │
│                        ▼                                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              MODEL LOADER                              │  │
│  │  - Load model from registry                           │  │
│  │  - Cache in memory (LRU eviction)                     │  │
│  │  - Warm-up on deployment                              │  │
│  └───────────────────────────────────────────────────────┘  │
│                        │                                     │
│                        ▼                                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │          PREDICTION RUNTIME                            │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │  Model A    │  │  Model B    │  │  Model C    │  │  │
│  │  │  (v3.2.1)   │  │  (v2.1.0)   │  │  (v1.5.3)   │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  │  In-memory cache with LRU eviction                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                        │                                     │
│                        ▼                                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           PREDICTION LOGGING                           │  │
│  │  - Log predictions for monitoring                     │  │
│  │  - Store features and predictions for retraining      │  │
│  │  - Track latency and throughput                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Model Lifecycle

```
┌──────────────┐
│ Development  │  ← Train new model, experiment
└──────┬───────┘
       │ Register model
       ▼
┌──────────────┐
│   Staging    │  ← Validate with test data
└──────┬───────┘
       │ Promote (manual or automated)
       ▼
┌──────────────┐
│  Production  │  ← Serve live traffic
└──────┬───────┘
       │ Monitor performance
       │
       ├─ If performance degrades → Rollback or retrain
       │
       └─ If replaced by newer version
          ▼
     ┌──────────────┐
     │   Archived   │  ← Keep for auditing
     └──────────────┘
```

---

## Online Learning & Reinforcement Learning

### Why Online Learning?

**Problem**: Models trained on historical data degrade over time as patterns change.

**Solution**: Continuously update models using production feedback.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│              ONLINE LEARNING & FEEDBACK LOOP                         │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    FEEDBACK COLLECTION                        │  │
│  │                                                               │  │
│  │  User Actions:                                               │  │
│  │  - Manual corrections (HITL)                                 │  │
│  │  - Accept/reject predictions                                │  │
│  │  - Explicit ratings                                          │  │
│  │  - Implicit signals (time spent, re-uploads)                │  │
│  │                                                               │  │
│  │  System Signals:                                             │  │
│  │  - Prediction confidence vs actual accuracy                  │  │
│  │  - Processing time vs predicted time                         │  │
│  │  - Error rates by document type                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                               │                                     │
│                               ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                 FEEDBACK PREPROCESSING                        │  │
│  │  - Validate feedback quality                                 │  │
│  │  - Filter outliers and noise                                │  │
│  │  - Aggregate across similar examples                        │  │
│  │  - Compute reward signals for RL                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                               │                                     │
│                               ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │            REINFORCEMENT LEARNING ENGINE                      │  │
│  │                                                               │  │
│  │  Algorithm: Contextual Bandits (Multi-Armed Bandit)         │  │
│  │                                                               │  │
│  │  State: Document features + user context                     │  │
│  │  Actions: {Use Tesseract, Use LLM, Request HITL}           │  │
│  │  Reward:                                                     │  │
│  │    - Correct extraction: +10                                │  │
│  │    - Fast processing: +5                                    │  │
│  │    - Low cost: +3                                           │  │
│  │    - User correction needed: -5                             │  │
│  │    - Complete failure: -20                                  │  │
│  │                                                               │  │
│  │  Policy: Epsilon-greedy (90% exploit, 10% explore)          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                               │                                     │
│                               ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              MODEL UPDATE STRATEGY                            │  │
│  │                                                               │  │
│  │  Option 1: Incremental Learning                             │  │
│  │    - Update model weights with new data                     │  │
│  │    - Fast, online updates (seconds to minutes)              │  │
│  │    - Risk: Catastrophic forgetting                          │  │
│  │                                                               │  │
│  │  Option 2: Periodic Retraining                              │  │
│  │    - Accumulate feedback over time (e.g., weekly)           │  │
│  │    - Retrain model from scratch with new data              │  │
│  │    - Slower, but more stable                                │  │
│  │                                                               │  │
│  │  Recommended: Hybrid Approach                                │  │
│  │    - Incremental updates for real-time adaptation           │  │
│  │    - Full retraining monthly for stability                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                               │                                     │
│                               ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                MODEL VALIDATION & DEPLOYMENT                  │  │
│  │  - Validate new model on held-out test set                  │  │
│  │  - A/B test against current production model                │  │
│  │  - Deploy if metrics improve by >5%                         │  │
│  │  - Gradual rollout (10% → 50% → 100%)                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Reinforcement Learning: Quality Gate Optimization

**Goal**: Learn optimal routing policy for quality gates

**State** (Document Context):
```python
state = {
    "file_type": "image/jpeg",
    "file_size_kb": 524,
    "image_quality_score": 0.75,
    "contrast_score": 0.82,
    "text_density": 0.65,
    "user_history_success_rate": 0.88,
    "time_of_day": 14,  # 2 PM
    "upload_count_today": 3
}
```

**Actions** (Processing Strategy):
```python
actions = {
    "A1": "Use Tesseract only",
    "A2": "Use Tesseract → LLM if confidence < 95%",
    "A3": "Use Tesseract → LLM if confidence < 90%",
    "A4": "Skip Tesseract, go directly to LLM",
    "A5": "Request immediate HITL review"
}
```

**Reward Function**:
```python
def calculate_reward(action, outcome):
    reward = 0

    # Accuracy reward
    if outcome.extraction_correct:
        reward += 10
    else:
        reward -= 20

    # Cost penalty
    if action == "Use Tesseract only":
        reward += 3  # Free OCR
    elif action in ["Use LLM", "Tesseract → LLM"]:
        reward -= 1  # Paid API
    elif action == "HITL":
        reward -= 5  # Human time is expensive

    # Latency penalty
    if outcome.processing_time > 30:  # seconds
        reward -= 2

    # User satisfaction
    if outcome.user_made_corrections:
        reward -= 3

    return reward
```

**Learning Algorithm**: Thompson Sampling or UCB (Upper Confidence Bound)

```python
from sklearn.ensemble import RandomForestClassifier

class ContextualBandit:
    def __init__(self, actions):
        self.actions = actions
        self.models = {action: RandomForestClassifier() for action in actions}
        self.rewards = {action: [] for action in actions}

    def select_action(self, state, epsilon=0.1):
        # Exploration: random action
        if random.random() < epsilon:
            return random.choice(self.actions)

        # Exploitation: best predicted action
        predictions = {
            action: model.predict_proba([state])[0][1]
            for action, model in self.models.items()
        }
        return max(predictions, key=predictions.get)

    def update(self, state, action, reward):
        # Store reward for this action
        self.rewards[action].append((state, reward))

        # Retrain model periodically (e.g., every 100 samples)
        if len(self.rewards[action]) % 100 == 0:
            X = [s for s, r in self.rewards[action]]
            y = [1 if r > 0 else 0 for s, r in self.rewards[action]]
            self.models[action].fit(X, y)
```

---

## Responsible AI Guardrails

### Overview

Ensure AI systems are **fair, transparent, accountable, and safe**.

```
┌─────────────────────────────────────────────────────────────────────┐
│                   RESPONSIBLE AI FRAMEWORK                           │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────┐ │
│  │    BIAS      │  │  FAIRNESS    │  │EXPLAINABILITY│  │ SAFETY │ │
│  │  DETECTION   │  │   CHECKER    │  │   (SHAP)     │  │ CHECKS │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 1. Bias Detection

**What to Detect**:
- Document type bias (prefer images over PDFs?)
- User demographic bias (favor certain user groups?)
- Temporal bias (better performance at certain times?)

**Implementation**:

```python
from aif360.datasets import BinaryLabelDataset
from aif360.metrics import BinaryLabelDatasetMetric

class BiasDetector:
    def __init__(self):
        self.protected_attributes = [
            'user_region',  # Geographic bias
            'upload_time',  # Temporal bias
            'document_type' # Format bias
        ]

    def measure_bias(self, dataset, predictions, protected_attr):
        """
        Measure statistical parity and equal opportunity
        """
        # Create AIF360 dataset
        aif_dataset = BinaryLabelDataset(
            df=dataset,
            label_names=['prediction'],
            protected_attribute_names=[protected_attr]
        )

        # Calculate metrics
        metric = BinaryLabelDatasetMetric(
            aif_dataset,
            unprivileged_groups=[{protected_attr: 0}],
            privileged_groups=[{protected_attr: 1}]
        )

        return {
            'statistical_parity_difference': metric.statistical_parity_difference(),
            'disparate_impact': metric.disparate_impact(),
            'equal_opportunity_difference': metric.equal_opportunity_difference(),
        }

    def detect_and_alert(self, dataset, predictions):
        """
        Detect bias and alert if threshold exceeded
        """
        for attr in self.protected_attributes:
            metrics = self.measure_bias(dataset, predictions, attr)

            # Alert if disparate impact < 0.8 (80% rule)
            if metrics['disparate_impact'] < 0.8:
                alert = {
                    'severity': 'HIGH',
                    'attribute': attr,
                    'metric': 'disparate_impact',
                    'value': metrics['disparate_impact'],
                    'message': f'Potential bias detected for {attr}'
                }
                send_alert(alert)
```

---

### 2. Fairness Checker

**Fairness Metrics**:
- **Demographic Parity**: P(ŷ=1|A=0) = P(ŷ=1|A=1)
- **Equal Opportunity**: TPR(A=0) = TPR(A=1)
- **Equalized Odds**: TPR(A=0) = TPR(A=1) and FPR(A=0) = FPR(A=1)

**Implementation**:

```python
class FairnessChecker:
    def __init__(self, threshold=0.8):
        self.threshold = threshold  # 80% rule

    def check_demographic_parity(self, y_pred, sensitive_attr):
        """
        Check if positive prediction rate is similar across groups
        """
        groups = np.unique(sensitive_attr)
        rates = {}

        for group in groups:
            mask = sensitive_attr == group
            rates[group] = np.mean(y_pred[mask])

        # Calculate ratio (should be close to 1.0 for fairness)
        ratio = min(rates.values()) / max(rates.values())

        return {
            'passes': ratio >= self.threshold,
            'ratio': ratio,
            'rates_by_group': rates,
            'metric': 'demographic_parity'
        }

    def check_equal_opportunity(self, y_true, y_pred, sensitive_attr):
        """
        Check if true positive rate is similar across groups
        """
        groups = np.unique(sensitive_attr)
        tpr = {}

        for group in groups:
            mask = (sensitive_attr == group) & (y_true == 1)
            if mask.sum() > 0:
                tpr[group] = np.mean(y_pred[mask])

        ratio = min(tpr.values()) / max(tpr.values())

        return {
            'passes': ratio >= self.threshold,
            'ratio': ratio,
            'tpr_by_group': tpr,
            'metric': 'equal_opportunity'
        }
```

---

### 3. Explainability (SHAP)

**Purpose**: Explain why a model made a specific prediction

**SHAP (SHapley Additive exPlanations)**:
- Game-theoretic approach to explain model outputs
- Shows contribution of each feature to prediction

**Implementation**:

```python
import shap

class ModelExplainer:
    def __init__(self, model, feature_names):
        self.model = model
        self.feature_names = feature_names
        self.explainer = shap.TreeExplainer(model)  # For tree-based models

    def explain_prediction(self, features):
        """
        Explain a single prediction
        """
        shap_values = self.explainer.shap_values(features)

        # Return top 5 most influential features
        feature_importance = sorted(
            zip(self.feature_names, shap_values[0]),
            key=lambda x: abs(x[1]),
            reverse=True
        )[:5]

        return {
            'prediction': self.model.predict(features)[0],
            'base_value': self.explainer.expected_value,
            'feature_contributions': [
                {'feature': name, 'contribution': float(value)}
                for name, value in feature_importance
            ]
        }

    def generate_explanation_text(self, features):
        """
        Generate human-readable explanation
        """
        explanation = self.explain_prediction(features)

        text = f"Predicted confidence: {explanation['prediction']:.1%}\n\n"
        text += "Top factors influencing this prediction:\n"

        for fc in explanation['feature_contributions']:
            direction = "increased" if fc['contribution'] > 0 else "decreased"
            text += f"  • {fc['feature']}: {direction} confidence by {abs(fc['contribution']):.2f}\n"

        return text
```

**Example Output**:

```
Predicted confidence: 92.5%

Top factors influencing this prediction:
  • image_quality_score: increased confidence by 0.15
  • contrast_score: increased confidence by 0.12
  • text_density: increased confidence by 0.08
  • file_size_kb: decreased confidence by 0.05
  • user_history_success_rate: increased confidence by 0.03
```

---

### 4. Safety Checks

**Pre-deployment Checks**:

```python
class SafetyChecker:
    def __init__(self):
        self.checks = [
            self.check_data_quality,
            self.check_model_performance,
            self.check_bias_metrics,
            self.check_adversarial_robustness,
        ]

    def run_all_checks(self, model, test_data):
        """
        Run all safety checks before deployment
        """
        results = {}
        all_passed = True

        for check in self.checks:
            result = check(model, test_data)
            results[result['check_name']] = result
            if not result['passed']:
                all_passed = False

        return {
            'deployment_approved': all_passed,
            'checks': results,
            'timestamp': datetime.now().isoformat()
        }

    def check_data_quality(self, model, test_data):
        """
        Ensure test data quality
        """
        checks = {
            'no_missing_values': test_data.isnull().sum().sum() == 0,
            'sufficient_samples': len(test_data) >= 1000,
            'balanced_labels': (test_data['label'].value_counts() / len(test_data)).min() >= 0.3
        }

        return {
            'check_name': 'data_quality',
            'passed': all(checks.values()),
            'details': checks
        }

    def check_model_performance(self, model, test_data):
        """
        Ensure model meets performance thresholds
        """
        y_true = test_data['label']
        y_pred = model.predict(test_data.drop('label', axis=1))

        accuracy = accuracy_score(y_true, y_pred)
        precision = precision_score(y_true, y_pred)
        recall = recall_score(y_true, y_pred)

        checks = {
            'accuracy >= 0.90': accuracy >= 0.90,
            'precision >= 0.85': precision >= 0.85,
            'recall >= 0.85': recall >= 0.85,
        }

        return {
            'check_name': 'model_performance',
            'passed': all(checks.values()),
            'details': checks,
            'metrics': {'accuracy': accuracy, 'precision': precision, 'recall': recall}
        }
```

---

## Model Evaluation & Monitoring

### Continuous Monitoring Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│                   MODEL MONITORING DASHBOARD                         │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  PERFORMANCE METRICS (Real-time)                             │  │
│  │  ┌────────────────┬────────────────┬────────────────┐        │  │
│  │  │   Accuracy     │   Precision    │     Recall     │        │  │
│  │  │     94.2%      │     92.5%      │     96.1%      │        │  │
│  │  │   ↑ 0.3%       │   ↓ 0.5%       │   ↑ 1.2%       │        │  │
│  │  └────────────────┴────────────────┴────────────────┘        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  DRIFT DETECTION                                             │  │
│  │  ┌────────────────────────────────────────────────────────┐ │  │
│  │  │  Feature Drift Score: 0.12  (Threshold: 0.2)  ✅       │ │  │
│  │  │  Prediction Drift Score: 0.08  (Threshold: 0.15)  ✅   │ │  │
│  │  │                                                          │ │  │
│  │  │  Top Drifting Features:                                 │ │  │
│  │  │    1. image_quality_score: 0.18 ⚠️                     │ │  │
│  │  │    2. text_density: 0.11                                │ │  │
│  │  │    3. contrast_score: 0.09                              │ │  │
│  │  └────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  LATENCY & THROUGHPUT                                        │  │
│  │  ┌────────────────┬────────────────┬────────────────┐        │  │
│  │  │   P50 Latency  │   P95 Latency  │   Throughput   │        │  │
│  │  │     120ms      │     450ms      │   500 req/min  │        │  │
│  │  └────────────────┴────────────────┴────────────────┘        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  FAIRNESS METRICS                                            │  │
│  │  Demographic Parity Ratio: 0.92  ✅                          │  │
│  │  Equal Opportunity Ratio: 0.88  ✅                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Drift Detection

**Types of Drift**:
1. **Feature Drift**: Distribution of input features changes
2. **Prediction Drift**: Distribution of model predictions changes
3. **Concept Drift**: Relationship between features and target changes

**Implementation**:

```python
from scipy.stats import ks_2samp
from alibi_detect.cd import KSDrift

class DriftDetector:
    def __init__(self, reference_data, threshold=0.05):
        self.reference_data = reference_data
        self.threshold = threshold

    def detect_feature_drift(self, new_data, feature_name):
        """
        Kolmogorov-Smirnov test for feature drift
        """
        reference = self.reference_data[feature_name]
        current = new_data[feature_name]

        statistic, p_value = ks_2samp(reference, current)

        return {
            'feature': feature_name,
            'drifted': p_value < self.threshold,
            'p_value': p_value,
            'statistic': statistic
        }

    def detect_prediction_drift(self, model, new_data):
        """
        Compare prediction distributions
        """
        reference_preds = model.predict(self.reference_data)
        current_preds = model.predict(new_data)

        statistic, p_value = ks_2samp(reference_preds, current_preds)

        return {
            'drifted': p_value < self.threshold,
            'p_value': p_value,
            'statistic': statistic
        }

    def detect_concept_drift(self, model, new_data_with_labels):
        """
        Compare model performance on new data vs reference
        """
        from sklearn.metrics import accuracy_score

        ref_accuracy = accuracy_score(
            self.reference_data['label'],
            model.predict(self.reference_data.drop('label', axis=1))
        )

        current_accuracy = accuracy_score(
            new_data_with_labels['label'],
            model.predict(new_data_with_labels.drop('label', axis=1))
        )

        performance_drop = ref_accuracy - current_accuracy

        return {
            'drifted': performance_drop > 0.05,  # 5% threshold
            'reference_accuracy': ref_accuracy,
            'current_accuracy': current_accuracy,
            'performance_drop': performance_drop
        }
```

### A/B Testing Framework

**Purpose**: Safely test new models in production

```python
class ABTestFramework:
    def __init__(self, model_a, model_b, split_ratio=0.5):
        self.model_a = model_a  # Control (current production)
        self.model_b = model_b  # Treatment (new model)
        self.split_ratio = split_ratio
        self.results = {'a': [], 'b': []}

    def assign_variant(self, user_id):
        """
        Assign user to variant A or B (sticky)
        """
        hash_value = hash(user_id) % 100
        return 'b' if hash_value < (self.split_ratio * 100) else 'a'

    def predict(self, user_id, features):
        """
        Make prediction using assigned variant
        """
        variant = self.assign_variant(user_id)
        model = self.model_b if variant == 'b' else self.model_a

        prediction = model.predict(features)

        # Log for analysis
        self.log_prediction(variant, user_id, features, prediction)

        return prediction

    def log_prediction(self, variant, user_id, features, prediction):
        """
        Log prediction for later analysis
        """
        self.results[variant].append({
            'user_id': user_id,
            'features': features,
            'prediction': prediction,
            'timestamp': datetime.now()
        })

    def analyze_results(self, metric='accuracy'):
        """
        Statistical analysis of A/B test results
        """
        from scipy.stats import ttest_ind

        metric_a = [r[metric] for r in self.results['a']]
        metric_b = [r[metric] for r in self.results['b']]

        t_stat, p_value = ttest_ind(metric_a, metric_b)

        # Calculate effect size (Cohen's d)
        mean_diff = np.mean(metric_b) - np.mean(metric_a)
        pooled_std = np.sqrt((np.var(metric_a) + np.var(metric_b)) / 2)
        cohens_d = mean_diff / pooled_std

        return {
            'variant_a_mean': np.mean(metric_a),
            'variant_b_mean': np.mean(metric_b),
            'difference': mean_diff,
            'p_value': p_value,
            'significant': p_value < 0.05,
            'effect_size': cohens_d,
            'recommendation': 'Deploy B' if (p_value < 0.05 and mean_diff > 0) else 'Keep A'
        }
```

---

## Integration Patterns

### Pattern 1: Integration with Application (Learning Yogi)

```python
# Application code
from ai_service_sdk import AIServiceClient

client = AIServiceClient(api_key=API_KEY)

# Upload document
document_id = "doc-123"

# Get features from Feature Store
features = client.feature_store.get_online_features(
    feature_groups=["document_characteristics", "user_behavior_patterns"],
    entity_ids={"document_id": document_id, "user_id": user_id}
)

# Predict best processing strategy using RL-optimized model
action = client.predict(
    model_name="quality-gate-policy",
    features=features
)

# Execute action
if action == "use_tesseract":
    result = ocr_service.process(document_id)
elif action == "use_llm":
    result = llm_service.process(document_id)

# Provide feedback for online learning
outcome = {
    "extraction_correct": True,
    "processing_time": 5.2,
    "user_corrections": False
}

client.feedback.submit(
    model_name="quality-gate-policy",
    prediction_id=prediction_id,
    outcome=outcome
)
```

### Pattern 2: Model Training Pipeline

```python
# Training script
from ai_service_sdk import FeatureStoreClient, ModelRegistryClient

# 1. Get training data from Feature Store
fs_client = FeatureStoreClient()

training_data = fs_client.get_historical_features(
    feature_groups=["document_characteristics", "ocr_confidence_indicators"],
    entity_df=training_entity_df,  # IDs and timestamps
    point_in_time_join=True
)

# 2. Train model
from sklearn.ensemble import RandomForestClassifier

model = RandomForestClassifier()
model.fit(training_data.features, training_data.labels)

# 3. Evaluate model
from sklearn.metrics import accuracy_score, classification_report

predictions = model.predict(test_data.features)
accuracy = accuracy_score(test_data.labels, predictions)

# 4. Check Responsible AI guardrails
from ai_service_sdk import BiasDetector, FairnessChecker

bias_detector = BiasDetector()
bias_metrics = bias_detector.measure_bias(test_data, predictions, 'user_region')

fairness_checker = FairnessChecker()
fairness_result = fairness_checker.check_demographic_parity(predictions, test_data['user_region'])

# 5. Register model if passes checks
if accuracy > 0.90 and fairness_result['passes']:
    registry_client = ModelRegistryClient()

    model_version = registry_client.register_model(
        model_name="ocr-confidence-classifier",
        model=model,
        metrics={'accuracy': accuracy, **bias_metrics},
        stage="staging",
        tags=["production-candidate", "v3.0.0"]
    )

    print(f"Model registered: {model_version}")
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4, Post-PoC)

**Objectives**: Basic Feature Store and Model Registry

**Tasks**:
- [ ] Setup Feast Feature Store (open source)
- [ ] Define initial feature groups (3-4 groups)
- [ ] Implement offline feature store (Parquet files)
- [ ] Implement online feature store (Redis)
- [ ] Setup MLflow Model Registry
- [ ] Create model versioning system
- [ ] Basic model serving API

**Deliverables**:
- Working Feature Store with 4 feature groups
- Model Registry with version control
- Simple model serving endpoint

**Team**: 2 ML Engineers

---

### Phase 2: Online Learning (Weeks 5-8)

**Objectives**: Feedback collection and RL-based optimization

**Tasks**:
- [ ] Implement feedback collection system
- [ ] Build feedback preprocessing pipeline
- [ ] Implement contextual bandit algorithm
- [ ] Create reward function for quality gates
- [ ] Integrate RL policy with processing pipeline
- [ ] Setup periodic model retraining

**Deliverables**:
- Feedback loop operational
- RL-based quality gate routing
- 10% improvement in cost efficiency

**Team**: 2 ML Engineers + 1 Backend Developer

---

### Phase 3: Responsible AI (Weeks 9-12)

**Objectives**: Bias detection, fairness, and explainability

**Tasks**:
- [ ] Integrate AIF360 for bias detection
- [ ] Implement fairness checking pipeline
- [ ] Add SHAP explainability to predictions
- [ ] Create Responsible AI dashboard
- [ ] Setup pre-deployment safety checks
- [ ] Document Responsible AI policies

**Deliverables**:
- Bias detection running on all predictions
- Explainability API endpoint
- Responsible AI dashboard
- Safety check automation

**Team**: 2 ML Engineers + 1 Frontend Developer

---

### Phase 4: Advanced Monitoring (Weeks 13-16)

**Objectives**: Drift detection and A/B testing

**Tasks**:
- [ ] Implement drift detection (Alibi Detect)
- [ ] Setup automated drift alerts
- [ ] Build A/B testing framework
- [ ] Create model comparison dashboard
- [ ] Automated model rollback on drift
- [ ] Performance degradation alerts

**Deliverables**:
- Drift detection operational
- A/B testing framework
- Automated alerting system

**Team**: 2 ML Engineers

---

## Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Feature Store** | Feast (OSS) or SageMaker | OSS for flexibility, SageMaker for AWS integration |
| **Model Registry** | MLflow or SageMaker | Industry standard, open source |
| **Model Serving** | FastAPI + Docker or Lambda | Flexible, scalable |
| **Reinforcement Learning** | Custom (scikit-learn) | Simple contextual bandits sufficient |
| **Bias Detection** | AIF360 (IBM) | Comprehensive bias metrics |
| **Explainability** | SHAP | Most popular, well-maintained |
| **Drift Detection** | Alibi Detect | Production-ready, comprehensive |
| **Experiment Tracking** | MLflow or W&B | Track experiments, compare models |
| **Orchestration** | Apache Airflow or Prefect | Schedule training, feature pipelines |

---

## Cost Estimate

### Infrastructure (Monthly)

| Component | Cost (PoC) | Cost (Production) |
|-----------|------------|-------------------|
| **Feature Store (Feast + Redis)** | $20 | $200 |
| **Model Storage (S3)** | $5 | $50 |
| **Model Serving (Lambda or ECS)** | $10 | $150 |
| **Monitoring (CloudWatch)** | $10 | $50 |
| **Orchestration (Airflow)** | $0 (local) | $100 |
| **Experiment Tracking (MLflow)** | $0 (local) | $50 |
| **Total** | **$45** | **$600** |

### Team (Monthly)

| Role | Allocation | Cost (US) |
|------|------------|-----------|
| ML Engineer | 2 FTE | $40K/month |
| Data Engineer | 0.5 FTE | $10K/month |
| Backend Developer | 0.5 FTE | $10K/month |
| **Total** | **3 FTE** | **$60K/month** |

**Total Program Cost**: $60K + $600 = **$60.6K/month** for 4 months = **$242K** for full AI horizontal service implementation

---

## Conclusion

The AI Horizontal Service provides a **scalable, reusable ML infrastructure** that:

1. **Accelerates Development**: Feature Store eliminates feature engineering duplication
2. **Ensures Consistency**: Same features in training and serving
3. **Improves Over Time**: Online learning and RL optimize performance
4. **Builds Trust**: Responsible AI guardrails ensure fairness and explainability
5. **Enables Safe Experimentation**: A/B testing and drift detection
6. **Supports Multiple Products**: Reusable across Learning Yogi and future products

**Recommended Approach**:
- **Start Simple**: Implement Phase 1 (Feature Store + Model Registry) post-PoC
- **Add Intelligence**: Phase 2 (Online Learning) after 3 months production
- **Build Trust**: Phase 3 (Responsible AI) for enterprise customers
- **Mature Platform**: Phase 4 (Advanced Monitoring) for scale

This horizontal service will become the **foundation for all AI/ML capabilities** across the Learning Yogi platform and future products, providing consistent, high-quality, and trustworthy AI experiences.

---

**Next Steps**: Integrate AI Horizontal Service into chosen implementation (1 or 2) starting with Phase 1 (Feature Store + Model Registry) after PoC completion.

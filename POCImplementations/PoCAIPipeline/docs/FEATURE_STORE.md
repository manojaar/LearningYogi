# Feature Store Guide - Feast with Redis

This guide covers setting up and using the Feast feature store with Redis as the online store.

## Overview

Feast is used for feature management, serving, and storage:
- **Feature Definitions**: Declarative feature definitions
- **Online Store (Redis)**: Low-latency feature serving
- **Offline Store (Parquet/S3)**: Historical data for training
- **Feature Serving API**: RESTful API for feature retrieval

## Architecture

```
┌─────────────────────────────────────────┐
│         Feature Definitions             │
│         (feature_repo/)                 │
└──────────────────┬──────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌──────────────┐      ┌──────────────┐
│ Online Store │      │ Offline Store│
│   (Redis)    │      │ (Parquet/S3) │
│              │      │              │
│ Real-time    │      │ Historical   │
│ Features     │      │ Training Data│
└──────────────┘      └──────────────┘
```

## Setup

### Installation

```bash
pip install feast[redis]
```

### Initialize Feature Repository

```bash
feast init feature_repo
cd feature_repo
```

### Start Redis

```bash
# Using Docker
docker run -d -p 6379:6379 redis:7-alpine

# Or using docker-compose
docker-compose -f infrastructure/docker-compose.yml up -d redis
```

## Feature Definitions

### OCR Features

Create `feature_repo/features/ocr_features.py`:
```python
from datetime import timedelta
from feast import Entity, Feature, FeatureView, ValueType
from feast.data_source import FileSource

# Entity definition
document = Entity(
    name="document",
    value_type=ValueType.STRING,
    description="Document identifier"
)

# Data source
ocr_data_source = FileSource(
    name="ocr_data",
    path="data/features/ocr_features.parquet",
    timestamp_field="event_timestamp"
)

# Feature view
ocr_features = FeatureView(
    name="ocr_features",
    entities=[document],
    ttl=timedelta(days=365),
    features=[
        Feature(name="text", dtype=ValueType.STRING),
        Feature(name="confidence", dtype=ValueType.FLOAT),
        Feature(name="word_count", dtype=ValueType.INT64),
        Feature(name="layout_score", dtype=ValueType.FLOAT),
        Feature(name="time_pattern_count", dtype=ValueType.INT64),
    ],
    source=ocr_data_source,
    online=True
)
```

### Document Features

Create `feature_repo/features/document_features.py`:
```python
from feast import Entity, Feature, FeatureView, ValueType
from feast.data_source import FileSource

document = Entity(
    name="document",
    value_type=ValueType.STRING
)

document_data_source = FileSource(
    name="document_data",
    path="data/features/document_features.parquet",
    timestamp_field="event_timestamp"
)

document_features = FeatureView(
    name="document_features",
    entities=[document],
    ttl=timedelta(days=365),
    features=[
        Feature(name="image_embedding", dtype=ValueType.BYTES),
        Feature(name="document_type", dtype=ValueType.STRING),
        Feature(name="preprocessing_applied", dtype=ValueType.BOOL),
        Feature(name="extraction_confidence", dtype=ValueType.FLOAT),
    ],
    source=document_data_source,
    online=True
)
```

### Domain Features

Create `feature_repo/features/domain_features.py`:
```python
from feast import Entity, Feature, FeatureView, ValueType

timetable_features = FeatureView(
    name="timetable_features",
    entities=[document],
    ttl=timedelta(days=180),
    features=[
        Feature(name="timetable_pattern_score", dtype=ValueType.FLOAT),
        Feature(name="subject_classification", dtype=ValueType.STRING),
        Feature(name="time_extraction_confidence", dtype=ValueType.FLOAT),
        Feature(name="day_pattern_detected", dtype=ValueType.BOOL),
    ],
    source=domain_data_source,
    online=True
)
```

## Feature Store Configuration

Create `feature_repo/feature_store.yaml`:
```yaml
project: timetable_extraction
registry: feature_repo/data/registry.db
provider: local
online_store:
  type: redis
  connection_string: "localhost:6379"
offline_store:
  type: file
```

## Using Feature Store

### Python Client

```python
from feast import FeatureStore

# Initialize store
store = FeatureStore(repo_path="feature_repo")

# Get online features
features = store.get_online_features(
    entity_rows=[
        {"document": "doc_123"},
        {"document": "doc_456"}
    ],
    features=[
        "ocr_features:confidence",
        "ocr_features:layout_score",
        "document_features:extraction_confidence"
    ]
)

# Convert to dict
feature_dict = features.to_dict()
```

### Feature Serving API

Start the feature server:
```bash
feast serve --host 0.0.0.0 --port 6566
```

Query features via API:
```python
import requests

response = requests.post(
    "http://localhost:6566/get-online-features",
    json={
        "entities": {"document": ["doc_123"]},
        "features": [
            "ocr_features:confidence",
            "ocr_features:layout_score"
        ]
    }
)

features = response.json()
```

## Storing Features

### From Inference Pipeline

```python
from src.feature_store.feature_serving import FeatureStoreWriter

writer = FeatureStoreWriter()

# Store OCR features
writer.store_ocr_features(
    document_id="doc_123",
    text="Monday 9:00 Mathematics",
    confidence=0.95,
    word_count=10,
    layout_score=0.88,
    time_pattern_count=2
)

# Store document features
writer.store_document_features(
    document_id="doc_123",
    image_embedding=embedding_bytes,
    document_type="timetable",
    extraction_confidence=0.92
)
```

### Batch Feature Ingestion

```python
# Generate features for training
features_df = generate_training_features(
    dataset_path="data/training",
    start_date="2024-01-01",
    end_date="2024-12-31"
)

# Materialize to online store
store.materialize(
    start_date=datetime(2024, 1, 1),
    end_date=datetime(2024, 12, 31)
)
```

## Feature Engineering

### Creating Features from Raw Data

```python
from src.feature_store.feature_definitions import FeatureEngineer

engineer = FeatureEngineer()

# Extract OCR features
ocr_features = engineer.extract_ocr_features(
    ocr_result=ocr_result,
    image_path=image_path
)

# Extract document features
doc_features = engineer.extract_document_features(
    image_path=image_path,
    metadata=metadata
)

# Extract domain features
domain_features = engineer.extract_domain_features(
    extracted_data=timetable_data,
    ocr_result=ocr_result
)
```

## Best Practices

1. **Feature Naming**: Use consistent naming conventions
2. **Version Control**: Track feature changes in Git
3. **Documentation**: Document feature definitions clearly
4. **Testing**: Test feature extraction functions
5. **Monitoring**: Monitor feature serving latency
6. **TTL Management**: Set appropriate TTL for features

## Monitoring

### Feature Store Metrics

```python
from src.feature_store.monitoring import FeatureStoreMonitor

monitor = FeatureStoreMonitor()

# Track feature retrieval
monitor.track_retrieval(
    feature_names=["ocr_features:confidence"],
    latency=0.005,
    timestamp=datetime.now()
)

# Check feature freshness
freshness = monitor.check_feature_freshness(
    feature_view="ocr_features",
    entity_id="doc_123"
)
```

## Troubleshooting

### Redis Connection Issues

```python
# Test Redis connection
import redis
r = redis.Redis(host='localhost', port=6379)
r.ping()  # Should return True
```

### Feature Not Found

- Check feature view name
- Verify entity ID exists
- Check TTL hasn't expired
- Verify materialization completed

### Slow Feature Retrieval

- Optimize Redis configuration
- Use connection pooling
- Cache frequently accessed features
- Consider Redis cluster for scale

## Migration to Cloud

### POC1 (Kubernetes)

- Use Redis cluster for high availability
- S3 for offline store
- Redis Sentinel for failover

### POC2 (Serverless)

- ElastiCache Serverless for online store
- S3 for offline store
- Lambda for feature serving

See migration guides for details.

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-01-01


# MLOps Guide - Training and Deployment Workflows

This guide covers the complete MLOps lifecycle for PoCAIPipeline, from training to production deployment.

## Overview

The MLOps pipeline includes:
- **Experiment Tracking**: MLflow for tracking experiments and models
- **Training Pipelines**: Automated training with hyperparameter tuning
- **Model Registry**: Versioned model storage and management
- **Deployment**: Automated deployment with validation
- **Monitoring**: Model performance and drift detection

## Experiment Tracking with MLflow

### Setup

```python
from src.mlops.mlflow_tracking import MLflowTracker

tracker = MLflowTracker(
    tracking_uri="http://localhost:5000",
    experiment_name="timetable-extraction"
)
```

### Logging Training Metrics

```python
with tracker.start_run(run_name="ocr_lora_v1") as run:
    # Training code
    for epoch in range(num_epochs):
        loss = train_epoch(model, dataloader)
        tracker.log_metric("train_loss", loss, step=epoch)
    
    # Log model
    tracker.log_model(model, "ocr_model")
    
    # Log artifacts
    tracker.log_artifact("training_config.yaml")
```

### Viewing Experiments

```bash
# Start MLflow UI
mlflow ui --backend-store-uri sqlite:///mlflow.db

# Access at http://localhost:5000
```

## Training Pipeline

### OCR Model Training

#### Teacher Model Training

```bash
python src/training/ocr_model/train_teacher.py \
    --model_name microsoft/trocr-large-printed \
    --dataset_path data/training/timetables \
    --output_dir models/ocr_teacher \
    --epochs 10 \
    --batch_size 8 \
    --learning_rate 5e-5
```

#### Knowledge Distillation

```bash
python src/training/ocr_model/distill_student.py \
    --teacher_model models/ocr_teacher \
    --student_model microsoft/trocr-small-printed \
    --dataset_path data/training/timetables \
    --output_dir models/ocr_student \
    --temperature 5.0 \
    --alpha 0.5
```

#### LoRA Fine-tuning

```bash
python src/training/ocr_model/lora_finetune.py \
    --model_name microsoft/trocr-base-printed \
    --dataset_path data/training/timetables \
    --output_dir models/ocr_lora \
    --rank 16 \
    --alpha 32 \
    --target_modules query key value
```

### Document Model Training

#### Base Model Fine-tuning

```bash
python src/training/document_model/train_base.py \
    --model_name meta-llama/Llama-3-8B \
    --dataset_path data/training/timetables_annotated \
    --output_dir models/document_base \
    --epochs 5 \
    --batch_size 4
```

#### LoRA Fine-tuning

```bash
python src/training/document_model/lora_finetune.py \
    --model_name models/document_base \
    --dataset_path data/training/timetables_annotated \
    --output_dir models/document_lora \
    --rank 32 \
    --alpha 64
```

## Model Evaluation

### Evaluation Metrics

```python
from src.mlops.model_registry import ModelEvaluator

evaluator = ModelEvaluator()

metrics = evaluator.evaluate(
    model_path="models/ocr_lora",
    test_dataset="data/test/timetables",
    metrics=["accuracy", "f1_score", "inference_time"]
)

print(f"Accuracy: {metrics['accuracy']:.2%}")
print(f"F1 Score: {metrics['f1_score']:.2%}")
print(f"Inference Time: {metrics['inference_time']:.3f}s")
```

### Model Comparison

```python
# Compare multiple models
comparison = evaluator.compare_models(
    models=[
        "models/ocr_tesseract",
        "models/ocr_lora",
        "models/ocr_student"
    ],
    test_dataset="data/test/timetables"
)

print(comparison.to_string())
```

## Model Registry

### Registering Models

```python
from src.mlops.model_registry import ModelRegistry

registry = ModelRegistry(mlflow_tracking_uri="http://localhost:5000")

# Register model
model_version = registry.register_model(
    model_path="models/ocr_lora",
    model_name="ocr_lora",
    description="LoRA fine-tuned OCR model",
    metadata={"accuracy": 0.95, "inference_time": 0.15}
)
```

### Model Versioning

```python
# List model versions
versions = registry.list_model_versions("ocr_lora")
for version in versions:
    print(f"Version {version.version}: {version.description}")

# Get specific version
model = registry.get_model("ocr_lora", version=3)

# Set production version
registry.set_production("ocr_lora", version=3)
```

## Deployment Pipeline

### Automated Deployment

```python
from src.mlops.deployment_pipeline import DeploymentPipeline

pipeline = DeploymentPipeline()

# Deploy model
deployment = pipeline.deploy(
    model_name="ocr_lora",
    model_version=3,
    environment="production",
    validation_tests=True
)
```

### Validation Tests

Create `tests/model_validation.py`:
```python
def test_model_accuracy():
    model = load_model("models/ocr_lora")
    test_data = load_test_data()
    
    accuracy = evaluate(model, test_data)
    assert accuracy > 0.90, "Model accuracy below threshold"

def test_inference_latency():
    model = load_model("models/ocr_lora")
    latency = measure_inference_time(model)
    assert latency < 0.5, "Inference too slow"
```

## A/B Testing

### Setting Up A/B Test

```python
from src.mlops.ab_testing import ABTesting

ab_test = ABTesting()

# Configure A/B test
ab_test.configure(
    model_a="ocr_tesseract",
    model_b="ocr_lora",
    split_ratio=0.5,  # 50/50 split
    metrics=["accuracy", "latency"]
)

# Route requests
def process_with_ab_test(image_path):
    if ab_test.should_use_b():
        return model_b.process(image_path)
    else:
        return model_a.process(image_path)
```

### Analyzing Results

```python
results = ab_test.get_results()
print(f"Model A Accuracy: {results['model_a']['accuracy']:.2%}")
print(f"Model B Accuracy: {results['model_b']['accuracy']:.2%}")
print(f"Improvement: {results['improvement']:.2%}")
```

## Monitoring

### Model Performance Monitoring

```python
from src.mlops.monitoring import ModelMonitor

monitor = ModelMonitor()

# Track inference
monitor.track_inference(
    model_name="ocr_lora",
    latency=0.15,
    accuracy=0.95,
    timestamp=datetime.now()
)

# Check for drift
drift_detected = monitor.check_drift(
    model_name="ocr_lora",
    recent_data=sample_data
)
```

### Alerts

Configure alerts in `configs/monitoring_config.yaml`:
```yaml
alerts:
  - name: accuracy_drop
    metric: accuracy
    threshold: 0.90
    condition: below
    
  - name: latency_increase
    metric: latency
    threshold: 0.5
    condition: above
    
  - name: drift_detected
    metric: data_drift
    threshold: 0.1
    condition: above
```

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/ml_pipeline.yml`:
```yaml
name: ML Pipeline

on:
  push:
    branches: [main]
    paths:
      - 'src/training/**'
      - 'configs/**'

jobs:
  train:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: pip install -r requirements.txt
      
      - name: Run training
        run: python src/training/ocr_model/lora_finetune.py
      
      - name: Evaluate model
        run: python scripts/evaluate_model.py
      
      - name: Register model
        run: python scripts/register_model.py
```

## Best Practices

1. **Version Everything**: Models, datasets, code
2. **Reproducibility**: Use fixed seeds, track dependencies
3. **Automated Testing**: Unit, integration, validation tests
4. **Gradual Rollout**: A/B testing before full deployment
5. **Monitor Continuously**: Track performance and drift
6. **Document Changes**: Log all experiments and decisions

## Troubleshooting

### Training Fails

- Check GPU availability
- Verify dataset paths
- Check memory usage
- Review logs in MLflow

### Model Performance Issues

- Review evaluation metrics
- Check for data drift
- Validate preprocessing
- Compare with baseline

### Deployment Issues

- Verify model compatibility
- Check environment dependencies
- Validate configuration files
- Review deployment logs

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-01-01


# Cloud Migration Roadmap - PoC1 (Microservices Architecture)

This document provides a roadmap for migrating PoCAIPipeline to the microservices architecture (POC1).

## Overview

**Target Architecture**: Kubernetes-based microservices  
**Migration Timeline**: 6-8 weeks  
**Key Changes**: Container orchestration, distributed model serving, scalable feature store

## Architecture Comparison

| Component | Local (PoCAIPipeline) | POC1 (Microservices) |
|-----------|----------------------|---------------------|
| **Model Serving** | FastAPI single instance | Kubernetes pods with HPA |
| **Feature Store** | Redis standalone | Redis cluster + Sentinel |
| **Model Registry** | MLflow local | MLflow on Kubernetes |
| **Training** | Local/Python scripts | Kubernetes Jobs |
| **Storage** | Local filesystem | S3 for models/artifacts |
| **Monitoring** | Local Prometheus | Prometheus + Grafana cluster |

## Migration Phases

### Phase 1: Containerization (Week 1-2)

#### 1.1 Dockerize Services

**Inference Service Dockerfile**:
```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY src/ ./src/
COPY configs/ ./configs/

# Expose port
EXPOSE 8000

# Run service
CMD ["python", "-m", "src.inference.pipeline"]
```

**Build and Test**:
```bash
docker build -t ai-pipeline-inference:latest .
docker run -p 8000:8000 ai-pipeline-inference:latest
```

#### 1.2 Model Storage in S3

Migrate models to S3:
```bash
# Upload models
aws s3 sync models/ s3://learningyogi-models/production/

# Update config
MODEL_STORAGE_TYPE=s3
MODEL_S3_BUCKET=learningyogi-models
MODEL_S3_PREFIX=production/
```

### Phase 2: Kubernetes Deployment (Week 3-4)

#### 2.1 Kubernetes Manifests

**Inference Service Deployment**:
```yaml
# infrastructure/kubernetes/inference-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-pipeline-inference
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-pipeline-inference
  template:
    metadata:
      labels:
        app: ai-pipeline-inference
    spec:
      containers:
      - name: inference
        image: ai-pipeline-inference:latest
        ports:
        - containerPort: 8000
        env:
        - name: MODEL_S3_BUCKET
          value: learningyogi-models
        - name: REDIS_HOST
          value: redis-cluster
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
        volumeMounts:
        - name: model-cache
          mountPath: /models
      volumes:
      - name: model-cache
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: ai-pipeline-inference
spec:
  selector:
    app: ai-pipeline-inference
  ports:
  - port: 80
    targetPort: 8000
  type: LoadBalancer
```

**Horizontal Pod Autoscaler**:
```yaml
# infrastructure/kubernetes/inference-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ai-pipeline-inference-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ai-pipeline-inference
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

#### 2.2 Redis Cluster Setup

**Redis Cluster StatefulSet**:
```yaml
# infrastructure/kubernetes/redis-cluster.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis-cluster
spec:
  serviceName: redis-cluster
  replicas: 3
  selector:
    matchLabels:
      app: redis-cluster
  template:
    metadata:
      labels:
        app: redis-cluster
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: redis-data
          mountPath: /data
  volumeClaimTemplates:
  - metadata:
      name: redis-data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 10Gi
```

### Phase 3: MLflow Integration (Week 5)

#### 3.1 MLflow on Kubernetes

**MLflow Deployment**:
```yaml
# infrastructure/kubernetes/mlflow-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mlflow
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mlflow
  template:
    metadata:
      labels:
        app: mlflow
    spec:
      containers:
      - name: mlflow
        image: python:3.11-slim
        command: ["mlflow", "server", "--host", "0.0.0.0"]
        env:
        - name: MLFLOW_BACKEND_STORE_URI
          value: "postgresql://mlflow:password@postgres:5432/mlflow"
        - name: MLFLOW_DEFAULT_ARTIFACT_ROOT
          value: "s3://learningyogi-mlflow/artifacts"
        ports:
        - containerPort: 5000
```

#### 3.2 Model Registry Integration

Update model serving to pull from MLflow:
```python
# src/inference/model_loader.py
import mlflow
import boto3

class ModelLoader:
    def __init__(self):
        mlflow.set_tracking_uri("http://mlflow:5000")
        self.s3_client = boto3.client('s3')
    
    def load_production_model(self, model_name):
        model_version = mlflow.get_latest_versions(
            model_name, 
            stages=["Production"]
        )[0]
        
        model_uri = f"models:/{model_name}/{model_version.version}"
        model = mlflow.pyfunc.load_model(model_uri)
        
        return model
```

### Phase 4: Training Pipeline (Week 6)

#### 4.1 Kubernetes Jobs for Training

**Training Job Template**:
```yaml
# infrastructure/kubernetes/training-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: ocr-training-{{ timestamp }}
spec:
  template:
    spec:
      containers:
      - name: training
        image: ai-pipeline-training:latest
        command: ["python", "src/training/ocr_model/lora_finetune.py"]
        env:
        - name: MLFLOW_TRACKING_URI
          value: "http://mlflow:5000"
        - name: S3_BUCKET
          value: learningyogi-training
        resources:
          requests:
            nvidia.com/gpu: 1
          limits:
            nvidia.com/gpu: 1
      restartPolicy: Never
```

#### 4.2 Training Orchestration with Argo Workflows

```yaml
# infrastructure/kubernetes/argo-training-workflow.yaml
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: ocr-training-pipeline
spec:
  entrypoint: train-ocr-model
  templates:
  - name: train-ocr-model
    steps:
    - - name: prepare-data
        template: prepare-data-job
    - - name: train-model
        template: train-model-job
    - - name: evaluate-model
        template: evaluate-model-job
    - - name: register-model
        template: register-model-job
```

### Phase 5: Monitoring and Observability (Week 7)

#### 5.1 Prometheus Metrics

Instrument services with Prometheus:
```python
# src/inference/metrics.py
from prometheus_client import Counter, Histogram, Gauge

inference_requests = Counter(
    'inference_requests_total',
    'Total inference requests'
)

inference_latency = Histogram(
    'inference_latency_seconds',
    'Inference latency'
)

model_confidence = Gauge(
    'model_confidence',
    'Model confidence score'
)
```

#### 5.2 Grafana Dashboards

Create dashboards for:
- Inference throughput
- Model performance
- Feature store latency
- Training job status

### Phase 6: Testing and Validation (Week 8)

#### 6.1 Integration Tests

Test in staging environment:
```bash
# Deploy to staging
kubectl apply -f infrastructure/kubernetes/ -n staging

# Run integration tests
pytest tests/integration/k8s/
```

#### 6.2 Performance Testing

Load testing:
```bash
# Run load tests
kubectl run load-test --image=locustio/locust \
  --command -- locust -f tests/load/locustfile.py \
  --host=http://ai-pipeline-inference
```

## Cost Analysis

### Infrastructure Costs (Monthly)

| Component | Resource | Cost |
|-----------|----------|------|
| **Kubernetes Cluster** | 3 nodes (m5.xlarge) | $700 |
| **Model Serving** | 3-10 pods (2 CPU, 4GB) | $200 |
| **Redis Cluster** | 3 nodes (cache.t3.medium) | $120 |
| **MLflow** | 2 pods (1 CPU, 2GB) | $50 |
| **S3 Storage** | 500GB models + artifacts | $15 |
| **Load Balancer** | ALB | $25 |
| **Monitoring** | Prometheus + Grafana | $50 |
| **Total** | | **~$1,160/month** |

### Cost Optimization

1. **Use Spot Instances**: 70% savings on compute
2. **Right-size Pods**: Monitor and adjust resources
3. **Model Caching**: Reduce S3 API calls
4. **Autoscaling**: Scale down during low traffic

## Migration Checklist

- [ ] Containerize all services
- [ ] Migrate models to S3
- [ ] Set up Kubernetes cluster
- [ ] Deploy inference services
- [ ] Configure Redis cluster
- [ ] Set up MLflow on K8s
- [ ] Migrate training pipelines
- [ ] Configure monitoring
- [ ] Set up CI/CD
- [ ] Load testing
- [ ] Documentation updates
- [ ] Team training

## Rollback Plan

If issues occur:

1. **Immediate Rollback**: Revert to local deployment
2. **Partial Rollback**: Keep K8s but use local models
3. **Gradual Migration**: Migrate one service at a time

## Post-Migration

1. **Monitor Performance**: Track metrics for 2 weeks
2. **Optimize Resources**: Adjust based on actual usage
3. **Scale Gradually**: Increase replicas as needed
4. **Update Documentation**: Document K8s-specific procedures

## AI Chatbot Integration (Optional)

The AI Chatbot can be deployed alongside the PoCAIPipeline in the same Kubernetes cluster:

**Key Considerations**:
- **Shared Resources**: Can share PostgreSQL database with AI pipeline
- **Independent Scaling**: Chatbot scales separately based on chat traffic
- **Resource Management**: Reserve capacity for both services
- **Cost Impact**: ~$40/month additional for chatbot compute

**Integration Steps**:
1. Deploy chatbot as separate microservice (see [POC1 Chatbot Guide](../../PoCImplementation1/docs/AICHATBOT_INTEGRATION.md))
2. Configure service discovery for chatbot ↔ pipeline communication
3. Enable context sharing between chatbot and pipeline
4. Set up unified monitoring dashboard

**Benefits**:
- Chatbot can query pipeline status and metrics
- Shared knowledge base for AI responses
- Unified authentication and authorization
- Consolidated logging and monitoring

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-01-01


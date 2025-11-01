# Cloud Migration Roadmap - PoC2 (Serverless Architecture)

This document provides a roadmap for migrating PoCAIPipeline to the serverless architecture (POC2).

## Overview

**Target Architecture**: AWS Lambda + Serverless Services  
**Migration Timeline**: 4-6 weeks  
**Key Changes**: Function-based serving, managed services, pay-per-use model

## Architecture Comparison

| Component | Local (PoCAIPipeline) | POC2 (Serverless) |
|-----------|----------------------|------------------|
| **Model Serving** | FastAPI single instance | Lambda functions |
| **Feature Store** | Redis standalone | ElastiCache Serverless |
| **Model Registry** | MLflow local | MLflow on Lambda/ECS |
| **Training** | Local/Python scripts | Step Functions + Lambda |
| **Storage** | Local filesystem | S3 for models/artifacts |
| **Monitoring** | Local Prometheus | CloudWatch + X-Ray |

## Migration Phases

### Phase 1: Lambda Function Setup (Week 1-2)

#### 1.1 Inference Lambda Functions

**OCR Inference Lambda**:
```python
# src/inference/lambda_handlers/ocr_handler.py
import json
import boto3
from src.inference.ocr_service import FineTunedOCRService

s3_client = boto3.client('s3')
ocr_service = FineTunedOCRService()

def lambda_handler(event, context):
    """
    Lambda handler for OCR inference
    """
    # Get S3 object from event
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']
    
    # Download image
    image_path = f'/tmp/{key}'
    s3_client.download_file(bucket, key, image_path)
    
    # Process with OCR model
    result = ocr_service.process_image(image_path)
    
    # Return result
    return {
        'statusCode': 200,
        'body': json.dumps({
            'text': result.text,
            'confidence': result.confidence,
            'words': [w.dict() for w in result.words]
        })
    }
```

**Document Inference Lambda**:
```python
# src/inference/lambda_handlers/document_handler.py
import json
from src.inference.document_service import FineTunedDocumentService

document_service = FineTunedDocumentService()

def lambda_handler(event, context):
    """
    Lambda handler for document extraction
    """
    body = json.loads(event['body'])
    image_s3_uri = body['image_s3_uri']
    
    # Download and process
    result = document_service.extract_timetable(image_s3_uri)
    
    return {
        'statusCode': 200,
        'body': json.dumps(result.dict())
    }
```

#### 1.2 SAM Template

```yaml
# infrastructure/template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  OCRInferenceFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: ai-pipeline-ocr-inference
      Runtime: python3.11
      Handler: src.inference.lambda_handlers.ocr_handler.lambda_handler
      CodeUri: .
      MemorySize: 3008  # Max for Lambda
      Timeout: 900  # 15 minutes max
      Environment:
        Variables:
          MODEL_S3_BUCKET: !Ref ModelBucket
          REDIS_ENDPOINT: !GetAtt RedisCache.RedisEndpoint
      Policies:
        - S3ReadPolicy:
            BucketName: !Ref ModelBucket
        - SecretsManagerReadWrite:
            SecretArn: !Ref ModelSecret
      Layers:
        - !Ref PyTorchLayer
      Events:
        S3Upload:
          Type: S3
          Properties:
            Bucket: !Ref InputBucket
            Events: s3:ObjectCreated:*
            Filter:
              S3Key:
                Rules:
                  - Name: prefix
                    Value: uploads/
  
  DocumentInferenceFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: ai-pipeline-document-inference
      Runtime: python3.11
      Handler: src.inference.lambda_handlers.document_handler.lambda_handler
      CodeUri: .
      MemorySize: 3008
      Timeout: 300
      Environment:
        Variables:
          MODEL_S3_BUCKET: !Ref ModelBucket
          FEATURE_STORE_ENDPOINT: !GetAtt RedisCache.RedisEndpoint
      Policies:
        - S3ReadPolicy:
            BucketName: !Ref ModelBucket
        - SecretsManagerReadWrite:
            SecretArn: !Ref ModelSecret
  
  InferenceAPI:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod
      Cors:
        AllowMethods: "'*'"
        AllowHeaders: "'*'"
        AllowOrigin: "'*'"
      DefinitionBody:
        swagger: '2.0'
        paths:
          /infer/ocr:
            post:
              x-amazon-apigateway-integration:
                uri: !Sub arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${OCRInferenceFunction.Arn}/invocations
                httpMethod: POST
                type: aws_proxy
  
  ModelBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: learningyogi-models-${AWS::AccountId}
  
  InputBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: learningyogi-input-${AWS::AccountId}
  
  PyTorchLayer:
    Type: AWS::Serverless::LayerVersion
    Properties:
      LayerName: pytorch-layer
      ContentUri: layers/pytorch/
      CompatibleRuntimes:
        - python3.11

Outputs:
  InferenceAPIEndpoint:
    Description: API Gateway endpoint URL
    Value: !Sub https://${InferenceAPI}.execute-api.${AWS::Region}.amazonaws.com/prod/
```

### Phase 2: Feature Store Migration (Week 2-3)

#### 2.1 ElastiCache Serverless

**ElastiCache Configuration**:
```yaml
# infrastructure/template.yaml
  RedisCache:
    Type: AWS::ElastiCache::ServerlessCache
    Properties:
      ServerlessCacheName: ai-pipeline-features
      Engine: redis
      MajorEngineVersion: '7'
      ServerlessCacheLimits:
        DataStorageInMB: 5000
        ECPUPerSecond: 5000
      SecurityGroupIds:
        - !Ref LambdaSecurityGroup
      SubnetIds:
        - !Ref Subnet1
        - !Ref Subnet2
```

**Update Feature Store Config**:
```python
# src/feature_store/redis_online_store.py
import redis
import os

class ElastiCacheOnlineStore:
    def __init__(self):
        self.client = redis.Redis(
            host=os.getenv('REDIS_ENDPOINT'),
            port=6379,
            ssl=True,
            decode_responses=True
        )
    
    def get_features(self, entity_id, feature_names):
        return self.client.mget([f"{entity_id}:{name}" for name in feature_names])
```

### Phase 3: Training Pipeline (Week 3-4)

#### 3.1 Step Functions for Training

**Training State Machine**:
```yaml
# infrastructure/template.yaml
  TrainingStateMachine:
    Type: AWS::StepFunctions::StateMachine
    Properties:
      DefinitionString: !Sub |
        {
          "Comment": "OCR Model Training Pipeline",
          "StartAt": "PrepareData",
          "States": {
            "PrepareData": {
              "Type": "Task",
              "Resource": "${PrepareDataFunction.Arn}",
              "Next": "TrainModel"
            },
            "TrainModel": {
              "Type": "Task",
              "Resource": "${TrainModelFunction.Arn}",
              "TimeoutSeconds": 28800,
              "Next": "EvaluateModel"
            },
            "EvaluateModel": {
              "Type": "Task",
              "Resource": "${EvaluateModelFunction.Arn}",
              "Next": "CheckMetrics"
            },
            "CheckMetrics": {
              "Type": "Choice",
              "Choices": [
                {
                  "Variable": "$.accuracy",
                  "NumericGreaterThan": 0.90,
                  "Next": "RegisterModel"
                }
              ],
              "Default": "TrainingFailed"
            },
            "RegisterModel": {
              "Type": "Task",
              "Resource": "${RegisterModelFunction.Arn}",
              "End": true
            },
            "TrainingFailed": {
              "Type": "Fail",
              "Error": "ModelMetricsBelowThreshold"
            }
          }
        }
```

#### 3.2 Training Lambda with ECS/Fargate

For long-running training, use ECS Fargate:
```yaml
  TrainingTask:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: ocr-training
      Cpu: 4096
      Memory: 16384
      RequiresCompatibilities:
        - FARGATE
      ContainerDefinitions:
        - Name: training
          Image: ai-pipeline-training:latest
          Environment:
            - Name: MLFLOW_TRACKING_URI
              Value: !GetAtt MLflowEndpoint.Url
```

### Phase 4: MLflow on AWS (Week 4-5)

#### 4.1 MLflow on ECS/Fargate

```yaml
  MLflowService:
    Type: AWS::ECS::Service
    Properties:
      Cluster: !Ref ECSCluster
      TaskDefinition: !Ref MLflowTask
      DesiredCount: 2
      LaunchType: FARGATE
      NetworkConfiguration:
        AwsvpcConfiguration:
          Subnets:
            - !Ref Subnet1
            - !Ref Subnet2
          SecurityGroups:
            - !Ref MLflowSecurityGroup
```

#### 4.2 MLflow with RDS and S3

```python
# Update MLflow tracking URI
MLFLOW_TRACKING_URI = "postgresql://user:pass@rds-endpoint:5432/mlflow"
MLFLOW_S3_ENDPOINT = "s3://learningyogi-mlflow-artifacts"
```

### Phase 5: Monitoring (Week 5-6)

#### 5.1 CloudWatch Dashboards

**Metrics to Track**:
- Lambda invocations and errors
- Inference latency (p50, p95, p99)
- Model confidence scores
- Feature store latency
- Training job duration

#### 5.2 X-Ray Tracing

Enable X-Ray in Lambda:
```yaml
Tracing:
  Mode: Active
```

Trace propagation in code:
```python
from aws_xray_sdk.core import xray_recorder

@xray_recorder.capture('ocr_inference')
def process_image(image_path):
    # Your inference code
    pass
```

### Phase 6: Cost Optimization (Week 6)

#### 6.1 Lambda Optimizations

1. **Right-size Memory**: Profile and optimize
2. **Provisioned Concurrency**: For critical paths
3. **Reserved Concurrency**: Limit costs
4. **Layer Caching**: Reduce cold starts

#### 6.2 Feature Store Optimization

- Use ElastiCache Serverless data tiering
- Implement feature caching in Lambda
- Batch feature requests

## Cost Analysis

### Infrastructure Costs (Monthly)

| Service | Usage | Cost |
|---------|-------|------|
| **Lambda (OCR)** | 1000 invocations/day, 15s avg | $45 |
| **Lambda (Document)** | 500 invocations/day, 10s avg | $15 |
| **ElastiCache Serverless** | 5GB storage, moderate usage | $100 |
| **S3 Storage** | 100GB models + artifacts | $3 |
| **API Gateway** | 1500 requests/day | $1 |
| **Step Functions** | 10 training jobs/month | $5 |
| **MLflow (ECS Fargate)** | 2 tasks, 50% utilization | $40 |
| **CloudWatch** | Logs + metrics | $10 |
| **Total** | | **~$219/month** |

### Cost Comparison

- **Local**: ~$0 (development only)
- **POC1 (K8s)**: ~$1,160/month
- **POC2 (Serverless)**: ~$219/month

**Savings**: 81% compared to POC1

## Migration Checklist

- [ ] Set up AWS account and permissions
- [ ] Create SAM template
- [ ] Package and deploy Lambda functions
- [ ] Set up ElastiCache Serverless
- [ ] Configure Step Functions for training
- [ ] Deploy MLflow on ECS
- [ ] Set up CloudWatch dashboards
- [ ] Configure X-Ray tracing
- [ ] Load testing
- [ ] Cost optimization
- [ ] Documentation updates

## Cold Start Mitigation

### Strategies

1. **Provisioned Concurrency**:
```yaml
ProvisionedConcurrencyConfig:
  ProvisionedConcurrentExecutions: 5
```

2. **Layer Optimization**: Minimize dependencies
3. **Model Caching**: Cache models in /tmp
4. **Warm-up Lambda**: Scheduled events every 5 minutes

### Model Loading Strategy

```python
# Cache model in Lambda container
import os

# Load model once per container
MODEL_CACHE = {}

def get_model(model_name):
    if model_name not in MODEL_CACHE:
        # Download from S3 to /tmp (persists across invocations)
        model_path = f'/tmp/{model_name}'
        if not os.path.exists(model_path):
            download_from_s3(model_name, model_path)
        
        MODEL_CACHE[model_name] = load_model(model_path)
    
    return MODEL_CACHE[model_name]
```

## Deployment

### Deploy with SAM

```bash
# Build
sam build

# Deploy
sam deploy --guided

# Or use stack name
sam deploy --stack-name ai-pipeline-prod
```

### CI/CD with GitHub Actions

```yaml
# .github/workflows/deploy-poc2.yml
name: Deploy to POC2

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
      - run: pip install aws-sam-cli
      - run: sam build
      - run: sam deploy --stack-name ai-pipeline-prod
```

## Rollback Plan

1. **Lambda Version Aliases**: Use aliases for instant rollback
2. **CloudFormation Stack**: Rollback to previous version
3. **Traffic Shifting**: Gradual migration with weighted routing

## Post-Migration

1. **Monitor Costs**: Track spending for 2 weeks
2. **Optimize Functions**: Right-size based on metrics
3. **Feature Store Tuning**: Optimize ElastiCache usage
4. **Documentation**: Update runbooks and procedures

## AI Chatbot Integration (Optional)

The AI Chatbot can be deployed as Lambda functions in the same serverless stack:

**Key Considerations**:
- **Shared Aurora**: Can query same Aurora Serverless database
- **EventBridge Integration**: Chat events routed to same event bus
- **API Gateway**: Add chatbot endpoints to existing API
- **Cost Impact**: ~$7/month additional for Lambda execution and API costs

**Integration Steps**:
1. Deploy chatbot Lambda functions (see [POC2 Chatbot Guide](../../PoCImplementation2/docs/AICHATBOT_INTEGRATION.md))
2. Configure API Gateway routes for chat endpoints
3. Set up EventBridge rules for chat analytics
4. Enable X-Ray tracing across all functions

**Benefits**:
- Unified authentication via Cognito
- Shared Parameter Store/Secrets Manager
- Consistent monitoring with CloudWatch
- Lower latency through VPC endpoints

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-01-01


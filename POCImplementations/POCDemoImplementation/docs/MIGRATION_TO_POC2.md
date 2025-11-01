# Migration Guide: POCDemo → POC2 (Serverless)

This guide provides step-by-step instructions for migrating the POCDemoImplementation to the POC2 serverless architecture.

## Overview

**POCDemo** → **POC2**
- **Architecture**: Monolithic → Serverless
- **Database**: SQLite → Aurora Serverless
- **Storage**: Local filesystem → S3
- **Queue**: In-process → Step Functions + EventBridge
- **Deployment**: Docker Compose → AWS SAM/Lambda

## High-Level Comparison

| Aspect | POCDemo | POC2 |
|--------|---------|------|
| **Deployment** | Docker Compose | AWS Lambda |
| **Database** | SQLite | Aurora Serverless |
| **Storage** | Local FS | S3 |
| **Orchestration** | In-process | Step Functions |
| **Scaling** | Manual | Automatic |
| **Cost** | $0 (local) | $226/month |

## Migration Steps

### 1. Convert Node.js API to Lambda Functions

#### 1.1 Create Lambda Handlers

**Before** (POCDemo):
```typescript
// src/index.ts
import express from 'express';

const app = express();

app.post('/api/v1/documents/upload', async (req, res) => {
  const result = await documentService.uploadDocument(...);
  res.json(result);
});
```

**After** (POC2):
```typescript
// src/handlers/documents.handler.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3 } from 'aws-sdk';

export const uploadDocument = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const file = event.body; // Base64 encoded
  
  const result = await documentService.uploadDocument(file, ...);
  
  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
};
```

#### 1.2 Update API Gateway Configuration

```yaml
# template.yaml
Resources:
  DocumentsAPI:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/handlers/
      Handler: documents.uploadDocument
      Runtime: nodejs20.x
      Events:
        ApiEvent:
          Type: Api
          Properties:
            Path: /api/v1/documents/upload
            Method: post
```

#### 1.3 Convert All Routes

Each Express route becomes a separate Lambda function:

```typescript
// src/handlers/documents.handler.ts
export const uploadDocument = async (event) => { ... };
export const getDocument = async (event) => { ... };
export const deleteDocument = async (event) => { ... };
```

### 2. Convert Python Services to Lambda Functions

#### 2.1 Create OCR Lambda Handler

**Before** (POCDemo):
```python
# app/main.py
@app.post("/ocr/process")
async def process_ocr(request: OCRRequest):
    result = ocr_service.process_image(request.image_path)
    return result
```

**After** (POC2):
```python
# src/handlers/ocr_handler.py
import json
from app.services.ocr_service import OCRService

def handler(event, context):
    """
    Lambda handler for OCR processing
    """
    data = json.loads(event['body'])
    image_path = data['image_path']
    
    ocr_service = OCRService()
    result = ocr_service.process_image(image_path)
    
    return {
        'statusCode': 200,
        'body': json.dumps(result.dict())
    }
```

#### 2.2 Create AI Lambda Handler

**Option A: Using Claude API (Original)**
```python
# src/handlers/ai_handler.py
import json
from app.services.claude_service import ClaudeService

def handler(event, context):
    data = json.loads(event['body'])
    image_path = data['image_path']
    
    claude_service = ClaudeService()
    result = claude_service.extract_timetable(image_path)
    
    return {
        'statusCode': 200,
        'body': json.dumps(result.dict())
    }
```

**Option B: Using PoCAIPipeline Fine-tuned Models (Recommended)**
```python
# src/handlers/ai_handler.py
import json
from inference.document_service import FineTunedDocumentService

# Load model from S3 (cached in Lambda container)
document_service = FineTunedDocumentService(
    model_path=os.getenv('DOCUMENT_MODEL_S3_URI', 's3://models/document_lora')
)

def handler(event, context):
    data = json.loads(event['body'])
    image_path = data['image_path']
    
    # Use fine-tuned model instead of Claude API
    result = document_service.extract_timetable(image_path)
    
    return {
        'statusCode': 200,
        'body': json.dumps(result.dict())
    }
```

**Benefits of PoCAIPipeline Integration**:
- Reduced API costs (no Claude API calls)
- Better accuracy (domain-specific fine-tuning)
- Lower latency (local inference vs API calls)
- Feature store for analytics and improvements

**See**: [PoCAIPipeline Integration Guide](../../PoCAIPipeline/docs/INTEGRATION.md) and [PoCAIPipeline POC2 Migration](../../PoCAIPipeline/docs/MIGRATION_POC2.md)

#### 2.3 Package Python Dependencies

```bash
# Create Lambda layer for dependencies
mkdir -p layer/python
pip install -r requirements.txt -t layer/python
cd layer && zip -r ../layer.zip python/
```

### 3. Replace SQLite with Aurora Serverless

#### 3.1 Update Database Connection

**Before** (POCDemo):
```typescript
import Database from 'better-sqlite3';
const db = new Database('app.db');
```

**After** (POC2):
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.RDS_PROXY_ENDPOINT,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: true,
});
```

#### 3.2 Create RDS Proxy

```yaml
# template.yaml
Resources:
  DatabaseProxy:
    Type: AWS::RDS::DBProxy
    Properties:
      DBProxyName: learning-yogi-proxy
      EngineFamily: POSTGRESQL
      Auth:
        - AuthScheme: SECRETS
          SecretArn: !Ref DatabaseSecret
      VpcSubnetIds:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2
      TargetGroups:
        - DBClusterIdentifiers:
            - !Ref DatabaseCluster
```

#### 3.3 Setup Aurora Serverless

```yaml
# template.yaml
Resources:
  DatabaseCluster:
    Type: AWS::RDS::DBCluster
    Properties:
      Engine: aurora-postgresql
      EngineVersion: '14.6'
      ServerlessV2ScalingConfiguration:
        MinCapacity: 0.5
        MaxCapacity: 16
      DatabaseName: learningyogi
      MasterUsername: postgres
      MasterUserPassword: !Ref DatabasePassword
      VpcSecurityGroupIds:
        - !Ref DatabaseSecurityGroup
      DBSubnetGroupName: !Ref DBSubnetGroup
```

### 4. Replace Local Storage with S3

#### 4.1 Update Storage Service

**Before** (POCDemo):
```typescript
async saveFile(buffer: Buffer, filename: string): Promise<string> {
  const filePath = path.join(this.basePath, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}
```

**After** (POC2):
```typescript
import S3 from 'aws-sdk/clients/s3';

const s3 = new S3({ region: process.env.AWS_REGION });

async saveFile(buffer: Buffer, filename: string): Promise<string> {
  const key = `uploads/${filename}`;
  
  await s3.putObject({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: buffer,
  }).promise();
  
  return key;
}
```

#### 4.2 Create S3 Bucket

```yaml
# template.yaml
Resources:
  DocumentsBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: learning-yogi-documents
      VersioningConfiguration:
        Status: Enabled
      LifecycleConfiguration:
        Rules:
          - Id: TransitionOldVersions
            Status: Enabled
            NoncurrentVersionTransitions:
              - TransitionInDays: 90
                StorageClass: GLACIER
```

### 5. Add Step Functions Workflow

#### 5.1 Define State Machine

```yaml
# template.yaml
Resources:
  DocumentProcessingWorkflow:
    Type: AWS::Serverless::StateMachine
    Properties:
      Definition:
        StartAt: PreprocessImage
        States:
          PreprocessImage:
            Type: Task
            Resource: !GetAtt PreprocessImageFunction.Arn
            Next: RunOCR
          
          RunOCR:
            Type: Task
            Resource: !GetAtt OCRProcessorFunction.Arn
            Next: CheckConfidence
          
          CheckConfidence:
            Type: Choice
            Choices:
              - Variable: $.confidence
                NumericGreaterThanEquals: 0.80
                Next: ValidateData
              - Variable: $.confidence
                NumericLessThan: 0.80
                Next: RunAIProcessing
          
          RunAIProcessing:
            Type: Task
            Resource: !GetAtt AIProcessorFunction.Arn
            Next: ValidateData
          
          ValidateData:
            Type: Task
            Resource: !GetAtt ValidatorFunction.Arn
            Next: SaveToDatabase
          
          SaveToDatabase:
            Type: Task
            Resource: !GetAtt DatabaseWriterFunction.Arn
            End: true
```

#### 5.2 Update Upload Handler

```typescript
// src/handlers/documents.handler.ts
import { SFN } from 'aws-sdk';

const sfn = new SFN();

export const uploadDocument = async (event) => {
  // Save to S3
  const s3Key = await saveToS3(file);
  
  // Start Step Function execution
  await sfn.startExecution({
    stateMachineArn: process.env.STATE_MACHINE_ARN,
    input: JSON.stringify({ documentId, s3Key }),
  }).promise();
  
  return {
    statusCode: 200,
    body: JSON.stringify({ documentId }),
  };
};
```

### 6. Create SAM Template

#### 6.1 Complete SAM Template

```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Globals:
  Function:
    Timeout: 30
    MemorySize: 512

Resources:
  # API Gateway
  ApiGateway:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod
      Cors:
        AllowMethods: "'*'"
        AllowHeaders: "'*'"
        AllowOrigin: "'*'"
  
  # Lambda Functions
  UploadDocumentFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/handlers/
      Handler: documents.uploadDocument
      Runtime: nodejs20.x
      Events:
        ApiEvent:
          Type: Api
          Properties:
            RestApiId: !Ref ApiGateway
            Path: /api/v1/documents/upload
            Method: post
      Environment:
        Variables:
          STATE_MACHINE_ARN: !Ref DocumentProcessingWorkflow
          S3_BUCKET: !Ref DocumentsBucket
      
  OCRProcessorFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/handlers/
      Handler: ocr_handler.handler
      Runtime: python3.11
      Layers:
        - !Ref PythonLayer
      Timeout: 300
      MemorySize: 2048
      Environment:
        Variables:
          ANTHROPIC_API_KEY: !Ref AnthropicApiKey
      
  AIProcessorFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/handlers/
      Handler: ai_handler.handler
      Runtime: python3.11
      Layers:
        - !Ref PythonLayer
      Timeout: 120
      
  # Step Functions
  DocumentProcessingWorkflow:
    Type: AWS::Serverless::StateMachine
    Properties:
      # ... state machine definition from above
      
  # Database
  DatabaseCluster:
    # ... Aurora Serverless configuration
  
  # S3 Bucket
  DocumentsBucket:
    # ... S3 configuration
  
  # Secrets
  AnthropicApiKey:
    Type: AWS::SecretsManager::Secret
    Properties:
      Description: Claude API Key
      
  # Lambda Layer for Python dependencies
  PythonLayer:
    Type: AWS::Serverless::LayerVersion
    Properties:
      LayerName: python-dependencies
      ContentUri: layer/
      CompatibleRuntimes:
        - python3.11
```

### 7. Deploy with SAM

#### 7.1 Install SAM CLI

```bash
# macOS
brew install aws-sam-cli

# Linux
pip install aws-sam-cli

# Windows
# Download from AWS website
```

#### 7.2 Configure AWS

```bash
# Configure AWS credentials
aws configure

# Set region
export AWS_REGION=us-east-1
```

#### 7.3 Build and Deploy

```bash
# Build
sam build

# Deploy
sam deploy --guided

# First time will prompt for:
# - Stack name
# - AWS Region
# - Parameter values
# - Capabilities

# Subsequent deployments
sam deploy
```

#### 7.4 View Deployed Resources

```bash
# List stacks
aws cloudformation list-stacks

# Get API endpoint
aws cloudformation describe-stacks \
  --stack-name learning-yogi-poc2 \
  --query 'Stacks[0].Outputs'
```

### 8. Migrate Data

#### 8.1 Migrate Database

```bash
# Export from SQLite
sqlite3 app.db .dump > backup.sql

# Convert format
# (manual conversion or use migration script)

# Import to Aurora Serverless
psql -h <rds-proxy-endpoint> \
     -U postgres \
     -d learningyogi \
     -f backup.sql
```

#### 8.2 Migrate Files to S3

```bash
# Sync local files to S3
aws s3 sync ./data/uploads s3://learning-yogi-documents/uploads

# Verify
aws s3 ls s3://learning-yogi-documents/uploads/
```

## Testing Migration

### 1. Test Lambda Functions Locally

```bash
# Invoke function locally
sam local invoke UploadDocumentFunction \
  --event events/test-upload.json

# Start local API
sam local start-api
```

### 2. Test Step Functions Workflow

```bash
# Execute workflow
aws stepfunctions start-execution \
  --state-machine-arn <arn> \
  --input file://test-input.json

# Check execution status
aws stepfunctions describe-execution \
  --execution-arn <execution-arn>
```

### 3. Test API Endpoints

```bash
# Get API endpoint
API_URL=$(aws cloudformation describe-stacks \
  --stack-name learning-yogi-poc2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

# Test upload
curl -X POST $API_URL/api/v1/documents/upload \
  -F "file=@timetable.png"
```

## Configuration

### Environment Variables

```bash
# .env or AWS Systems Manager Parameter Store
ANTHROPIC_API_KEY=sk-ant-...
AWS_REGION=us-east-1
STATE_MACHINE_ARN=arn:aws:states:...
S3_BUCKET=learning-yogi-documents
RDS_PROXY_ENDPOINT=proxy.endpoint.rds.amazonaws.com
```

### IAM Permissions

Lambda functions need these permissions:

```yaml
Policies:
  - S3ReadPolicy:
      BucketName: !Ref DocumentsBucket
  - S3WritePolicy:
      BucketName: !Ref DocumentsBucket
  - SecretsManagerReadWrite:
      SecretArn: !Ref AnthropicApiKey
  - SNSDynamoDBPolicy:
      TableName: !Ref StateTable
```

## Cost Optimization

### Configuration

1. **Lambda Memory**: Start with 512MB, optimize based on usage
2. **Provisioned Concurrency**: Only for critical functions
3. **Aurora Min ACU**: Set to 0.5 to avoid cold starts
4. **S3 Lifecycle**: Transition old versions to Glacier

### Monitoring

```bash
# View costs
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-02-01 \
  --granularity MONTHLY \
  --metrics BlendedCost
```

## Rollback Plan

If issues occur:

1. Keep POCDemo running during migration
2. Point DNS to old endpoint
3. Export data from Aurora
4. Import back to SQLite
5. Sync files from S3 back to local

## Optional: AI Pipeline Integration

For enhanced AI capabilities, consider integrating **PoCAIPipeline** during migration:

### Benefits
- **Fine-tuned OCR Models**: Replace Tesseract with Lambda-based domain-specific models
- **Fine-tuned Document Models**: Replace Claude API with Lambda-based models
- **Feature Store**: Feast with ElastiCache Serverless for analytics
- **Cost Savings**: 80-90% reduction in Claude API costs

### Integration Steps

1. **Deploy PoCAIPipeline Models to Lambda**:
   - Package fine-tuned models as Lambda Layers
   - Follow [PoCAIPipeline POC2 Migration Guide](../../PoCAIPipeline/docs/MIGRATION_POC2.md)
   - Set up ElastiCache Serverless for feature store

2. **Update Lambda Handlers**:
   - Replace OCR handler with PoCAIPipeline OCR service
   - Replace AI handler with PoCAIPipeline document service
   - Configure model loading from Lambda Layers or S3

3. **Configure Feature Store**:
   - Set up ElastiCache Serverless
   - Deploy Feast server (optional) or use direct Redis
   - Update Lambda environment variables

**See**: [PoCAIPipeline Integration Guide](../../PoCAIPipeline/docs/INTEGRATION.md) and [PoCAIPipeline POC2 Migration](../../PoCAIPipeline/docs/MIGRATION_POC2.md)

## Timeline

**Estimated Duration**: 1-2 weeks (2-3 weeks with PoCAIPipeline integration)

- Week 1: Lambda conversion, Step Functions setup
- Week 2: Deployment, testing, optimization
- Week 3 (Optional): PoCAIPipeline integration, fine-tuned model deployment

## Support

For migration issues:
- Check CloudWatch logs: `aws logs tail /aws/lambda/...`
- Review Step Functions executions in console
- Check Lambda metrics in CloudWatch

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-01-01


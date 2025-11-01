# PoC Implementation 2 - Deployment Guide

## Executive Summary

This document provides comprehensive deployment instructions for the **serverless event-driven implementation** of Learning Yogi. It covers local development, staging deployment, production deployment, and operational procedures.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [AWS Account Setup](#aws-account-setup)
4. [Infrastructure Deployment](#infrastructure-deployment)
5. [Application Deployment](#application-deployment)
6. [Configuration Management](#configuration-management)
7. [CI/CD Pipeline](#cicd-pipeline)
8. [Monitoring Setup](#monitoring-setup)
9. [Rollback Procedures](#rollback-procedures)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

```bash
# AWS CLI (version 2.x)
aws --version
# Expected: aws-cli/2.13.0 or higher

# SAM CLI (Serverless Application Model)
sam --version
# Expected: SAM CLI, version 1.100.0 or higher

# Node.js
node --version
# Expected: v20.x

# Python
python --version
# Expected: Python 3.11.x

# Docker (for local testing)
docker --version
# Expected: Docker version 24.x or higher

# Git
git --version
```

### Installation

**macOS**:
```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install tools
brew install awscli
brew install aws-sam-cli
brew install node@20
brew install python@3.11
brew install docker
```

**Linux (Ubuntu/Debian)**:
```bash
# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# SAM CLI
pip install aws-sam-cli

# Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Python
sudo apt-get install python3.11 python3.11-venv

# Docker
sudo apt-get install docker.io
```

**Windows**:
```powershell
# Use Chocolatey
choco install awscli
choco install aws-sam-cli
choco install nodejs-lts
choco install python311
choco install docker-desktop
```

### AWS Account Requirements

- **AWS Account** with admin access (or IAM permissions for Lambda, API Gateway, S3, RDS, etc.)
- **AWS Region**: us-east-1 (recommended, or choose preferred region)
- **Billing Alerts** configured (recommended)

---

## Local Development Setup

### Step 1: Clone Repository

```bash
cd ~/projects
git clone https://github.com/learning-yogi/platform.git
cd platform/PoCImplementation2
```

### Step 2: Install Dependencies

**Backend - Node.js Lambda**:
```bash
cd backend/lambda-nodejs
npm install

# Run tests
npm test

# Type check
npm run type-check
```

**Backend - Python Lambda**:
```bash
cd backend/lambda-python
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run tests
pytest

# Type check
mypy src/
```

**Frontend - React**:
```bash
cd frontend/react
npm install

# Run dev server
npm run dev
```

### Step 3: Configure Environment Variables

Create `.env.local` file:

```bash
# Copy template
cp .env.example .env.local

# Edit with your values
vim .env.local
```

**`.env.local`**:
```bash
# AWS Configuration (for local development)
AWS_REGION=us-east-1
AWS_PROFILE=learningyogi-dev

# Database (local PostgreSQL or RDS)
DATABASE_URL=postgresql://learningyogi:devpassword@localhost:5432/learningyogi_dev

# Redis (local or ElastiCache)
REDIS_URL=redis://localhost:6379

# S3 Bucket (use LocalStack or real S3)
S3_BUCKET=learningyogi-dev-documents

# External APIs (development keys)
ANTHROPIC_API_KEY=sk-ant-api03-...
GOOGLE_APPLICATION_CREDENTIALS=./credentials/google-vision-dev.json

# JWT
JWT_SECRET=dev_jwt_secret_change_in_production
JWT_EXPIRY=900

# Frontend
REACT_APP_API_URL=http://localhost:3000/api/v1
REACT_APP_WS_URL=ws://localhost:3000
```

### Step 4: Run Local Services

**Option A: Using SAM Local (Recommended)**

```bash
# Start local API Gateway + Lambda
sam local start-api --docker-network host --env-vars env.json

# In another terminal, start local DynamoDB (for sessions)
docker run -p 8000:8000 amazon/dynamodb-local

# Start local PostgreSQL
docker run -p 5432:5432 -e POSTGRES_PASSWORD=devpassword postgres:14

# Start local Redis
docker run -p 6379:6379 redis:7-alpine
```

**Access**:
- API: http://localhost:3000/api/v1
- DynamoDB Admin: http://localhost:8000

**Option B: Using LocalStack (All AWS services locally)**

```bash
# Install LocalStack
pip install localstack

# Start LocalStack
localstack start -d

# Deploy to LocalStack
samlocal deploy --guided
```

### Step 5: Run Frontend

```bash
cd frontend/react
npm run dev
```

**Access**: http://localhost:5173

### Step 6: Test End-to-End Flow

**Upload a document**:

```bash
curl -X POST http://localhost:3000/api/v1/documents/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@sample_timetable.pdf"
```

**Expected response**:
```json
{
  "documentId": "uuid-123",
  "status": "processing",
  "uploadedAt": "2025-01-01T12:00:00Z"
}
```

**Check processing status**:
```bash
curl http://localhost:3000/api/v1/documents/uuid-123/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## AWS Account Setup

### Step 1: Configure AWS CLI

```bash
# Configure credentials
aws configure --profile learningyogi-dev

# Inputs:
# AWS Access Key ID: AKIA...
# AWS Secret Access Key: ...
# Default region name: us-east-1
# Default output format: json

# Verify
aws sts get-caller-identity --profile learningyogi-dev
```

### Step 2: Create S3 Bucket for Deployments

```bash
# SAM requires an S3 bucket to store deployment artifacts
aws s3 mb s3://learningyogi-sam-deployments-dev --profile learningyogi-dev
```

### Step 3: Create Parameter Store Secrets

```bash
# JWT Secret
aws ssm put-parameter \
  --name /learningyogi/dev/jwt-secret \
  --value "your-random-256-bit-secret" \
  --type SecureString \
  --profile learningyogi-dev

# Anthropic API Key
aws ssm put-parameter \
  --name /learningyogi/dev/anthropic-api-key \
  --value "sk-ant-api03-..." \
  --type SecureString \
  --profile learningyogi-dev

# Database Password
aws ssm put-parameter \
  --name /learningyogi/dev/database-password \
  --value "your-secure-password" \
  --type SecureString \
  --profile learningyogi-dev
```

### Step 4: Create VPC (Optional, if not using default)

```bash
# Create VPC with SAM template
sam deploy \
  --template-file infrastructure/vpc-template.yaml \
  --stack-name learningyogi-vpc-dev \
  --capabilities CAPABILITY_IAM \
  --profile learningyogi-dev
```

**Or use existing VPC**:
- Note VPC ID, subnet IDs, and security group IDs for SAM configuration

---

## Infrastructure Deployment

### Step 1: Configure SAM

Create `samconfig.toml`:

```toml
version = 0.1

[default]
[default.global.parameters]
stack_name = "learningyogi-dev"

[default.deploy.parameters]
capabilities = "CAPABILITY_IAM"
confirm_changeset = true
resolve_s3 = true
region = "us-east-1"
profile = "learningyogi-dev"
parameter_overrides = [
    "Environment=dev",
    "AllowedOrigins=http://localhost:5173",
    "DatabasePassword={{resolve:ssm:/learningyogi/dev/database-password}}",
    "JWTSecret={{resolve:ssm:/learningyogi/dev/jwt-secret}}",
    "AnthropicAPIKey={{resolve:ssm:/learningyogi/dev/anthropic-api-key}}"
]

[staging]
[staging.deploy.parameters]
stack_name = "learningyogi-staging"
parameter_overrides = [
    "Environment=staging",
    "AllowedOrigins=https://staging.learningyogi.com"
]

[production]
[production.deploy.parameters]
stack_name = "learningyogi-prod"
confirm_changeset = true
parameter_overrides = [
    "Environment=production",
    "AllowedOrigins=https://app.learningyogi.com",
    "ProvisionedConcurrency=5"
]
```

### Step 2: Deploy Infrastructure (SAM)

**Development Environment**:

```bash
# Validate template
sam validate

# Build
sam build

# Deploy (guided first time)
sam deploy --guided --config-env default

# Subsequent deploys
sam deploy
```

**Expected output**:
```
CloudFormation outputs from deployed stack
------------------------------------------------------------------------
Outputs
------------------------------------------------------------------------
Key                 ApiGatewayUrl
Description         API Gateway endpoint URL
Value               https://abc123.execute-api.us-east-1.amazonaws.com/dev

Key                 WebSocketUrl
Description         WebSocket API endpoint
Value               wss://xyz789.execute-api.us-east-1.amazonaws.com/dev

Key                 UserPoolId
Description         Cognito User Pool ID
Value               us-east-1_ABC123
------------------------------------------------------------------------
```

### Step 3: Verify Infrastructure

```bash
# List Lambda functions
aws lambda list-functions --profile learningyogi-dev | grep learningyogi

# Check API Gateway
aws apigatewayv2 get-apis --profile learningyogi-dev

# Verify Aurora cluster
aws rds describe-db-clusters --db-cluster-identifier learningyogi-dev --profile learningyogi-dev

# Test API endpoint
curl https://abc123.execute-api.us-east-1.amazonaws.com/dev/health
```

**Expected response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T12:00:00Z",
  "version": "1.0.0"
}
```

---

## Application Deployment

### Backend Lambda Deployment

**Using SAM (Recommended)**:

```bash
# Build (compiles TypeScript, packages dependencies)
sam build

# Deploy
sam deploy --config-env default

# Tail logs
sam logs -n DocumentsAPI --stack-name learningyogi-dev --tail
```

**Using Serverless Framework (Alternative)**:

```bash
# Install Serverless Framework
npm install -g serverless

# Deploy
cd backend/lambda-nodejs
serverless deploy --stage dev --region us-east-1

# Deploy single function (faster)
serverless deploy function --function DocumentsAPI --stage dev
```

### Frontend Deployment

**Build for Production**:

```bash
cd frontend/react
npm run build

# Output: dist/ folder with optimized static files
```

**Deploy to S3 + CloudFront**:

```bash
# Sync to S3
aws s3 sync dist/ s3://learningyogi-frontend-dev \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html" \
  --profile learningyogi-dev

# Upload index.html with short cache
aws s3 cp dist/index.html s3://learningyogi-frontend-dev/ \
  --cache-control "public, max-age=300" \
  --profile learningyogi-dev

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id E123ABC456DEF \
  --paths "/*" \
  --profile learningyogi-dev
```

**Expected output**:
```
upload: dist/assets/index-a1b2c3d4.js to s3://learningyogi-frontend-dev/assets/index-a1b2c3d4.js
...
Completed 15 file(s)
```

### Database Migrations

**Using Prisma (Node.js)**:

```bash
cd backend/lambda-nodejs

# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name add_user_preferences

# Apply to production (via CI/CD or manually)
npx prisma migrate deploy --schema=./prisma/schema.prisma
```

**Using Alembic (Python - alternative)**:

```bash
cd backend/lambda-python

# Create migration
alembic revision --autogenerate -m "Add user preferences"

# Apply migration
alembic upgrade head
```

---

## Configuration Management

### Environment-Specific Configuration

**Development (`samconfig.toml`):**
```toml
[default.deploy.parameters]
parameter_overrides = [
    "Environment=dev",
    "LambdaMemorySize=512",
    "AuroraMinACU=0.5",
    "AuroraMaxACU=2",
    "ProvisionedConcurrency=0"
]
```

**Staging:**
```toml
[staging.deploy.parameters]
parameter_overrides = [
    "Environment=staging",
    "LambdaMemorySize=1024",
    "AuroraMinACU=1",
    "AuroraMaxACU=8",
    "ProvisionedConcurrency=2"
]
```

**Production:**
```toml
[production.deploy.parameters]
parameter_overrides = [
    "Environment=production",
    "LambdaMemorySize=1024",
    "AuroraMinACU=2",
    "AuroraMaxACU=16",
    "ProvisionedConcurrency=5",
    "EnableXRayTracing=true",
    "EnableDetailedMonitoring=true"
]
```

### Feature Flags

**Using AWS AppConfig**:

```bash
# Create application
aws appconfig create-application \
  --name "learningyogi" \
  --profile learningyogi-dev

# Create environment
aws appconfig create-environment \
  --application-id abc123 \
  --name "production" \
  --profile learningyogi-dev

# Create configuration profile
aws appconfig create-configuration-profile \
  --application-id abc123 \
  --name "feature-flags" \
  --location-uri "hosted" \
  --profile learningyogi-dev
```

**Feature flags configuration**:
```json
{
  "features": {
    "cloudVisionOCR": {
      "enabled": false,
      "description": "Use Google Cloud Vision instead of Tesseract"
    },
    "multiPageDocuments": {
      "enabled": true,
      "description": "Support multi-page PDF uploads"
    },
    "collaborativeEditing": {
      "enabled": false,
      "description": "Allow multiple users to edit timetables"
    }
  }
}
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

**`.github/workflows/deploy.yml`**:

```yaml
name: Deploy to AWS

on:
  push:
    branches:
      - main
      - develop
  pull_request:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies (Node.js)
        run: |
          cd backend/lambda-nodejs
          npm ci

      - name: Install dependencies (Python)
        run: |
          cd backend/lambda-python
          pip install -r requirements.txt

      - name: Run tests (Node.js)
        run: |
          cd backend/lambda-nodejs
          npm test -- --coverage

      - name: Run tests (Python)
        run: |
          cd backend/lambda-python
          pytest --cov=src --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: Run Bandit (Python security)
        run: |
          pip install bandit
          bandit -r backend/lambda-python/src/

  deploy-dev:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID_DEV }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY_DEV }}
          aws-region: us-east-1

      - name: Setup SAM
        uses: aws-actions/setup-sam@v2

      - name: SAM build
        run: sam build

      - name: SAM deploy
        run: sam deploy --no-confirm-changeset --no-fail-on-empty-changeset --config-env default

  deploy-staging:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID_STAGING }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY_STAGING }}
          aws-region: us-east-1

      - name: SAM build
        run: sam build

      - name: SAM deploy
        run: sam deploy --no-confirm-changeset --config-env staging

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://app.learningyogi.com
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID_PROD }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY_PROD }}
          aws-region: us-east-1

      - name: SAM build
        run: sam build

      - name: SAM deploy (requires approval)
        run: sam deploy --config-env production

      - name: Run smoke tests
        run: |
          npm run test:smoke -- --url https://app.learningyogi.com

      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deployment completed!'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### AWS CodePipeline (Alternative to GitHub Actions)

**Create pipeline**:

```bash
aws codepipeline create-pipeline \
  --cli-input-json file://pipeline-config.json \
  --profile learningyogi-dev
```

**`pipeline-config.json`**:
```json
{
  "pipeline": {
    "name": "learningyogi-pipeline",
    "roleArn": "arn:aws:iam::123456789012:role/CodePipelineServiceRole",
    "artifactStore": {
      "type": "S3",
      "location": "learningyogi-pipeline-artifacts"
    },
    "stages": [
      {
        "name": "Source",
        "actions": [{
          "name": "SourceAction",
          "actionTypeId": {
            "category": "Source",
            "owner": "ThirdParty",
            "provider": "GitHub",
            "version": "1"
          },
          "configuration": {
            "Owner": "learning-yogi",
            "Repo": "platform",
            "Branch": "main",
            "OAuthToken": "{{resolve:secretsmanager:github-token}}"
          },
          "outputArtifacts": [{"name": "SourceOutput"}]
        }]
      },
      {
        "name": "Build",
        "actions": [{
          "name": "BuildAction",
          "actionTypeId": {
            "category": "Build",
            "owner": "AWS",
            "provider": "CodeBuild",
            "version": "1"
          },
          "configuration": {
            "ProjectName": "learningyogi-build"
          },
          "inputArtifacts": [{"name": "SourceOutput"}],
          "outputArtifacts": [{"name": "BuildOutput"}]
        }]
      },
      {
        "name": "Deploy",
        "actions": [{
          "name": "DeployAction",
          "actionTypeId": {
            "category": "Deploy",
            "owner": "AWS",
            "provider": "CloudFormation",
            "version": "1"
          },
          "configuration": {
            "ActionMode": "CREATE_UPDATE",
            "StackName": "learningyogi-prod",
            "TemplatePath": "BuildOutput::packaged.yaml",
            "Capabilities": "CAPABILITY_IAM",
            "RoleArn": "arn:aws:iam::123456789012:role/CloudFormationServiceRole"
          },
          "inputArtifacts": [{"name": "BuildOutput"}]
        }]
      }
    ]
  }
}
```

---

## Monitoring Setup

### CloudWatch Dashboard

**Create dashboard**:

```bash
aws cloudwatch put-dashboard \
  --dashboard-name learningyogi-production \
  --dashboard-body file://dashboard-config.json \
  --profile learningyogi-dev
```

**`dashboard-config.json`** (see ARCHITECTURE.md for full dashboard)

### Set Up Alarms

```bash
# Lambda error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name learningyogi-lambda-errors-high \
  --alarm-description "Lambda error rate > 5%" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:alerts \
  --profile learningyogi-dev
```

### Enable X-Ray Tracing

**In SAM template**:
```yaml
Globals:
  Function:
    Tracing: Active
    Environment:
      Variables:
        AWS_XRAY_CONTEXT_MISSING: LOG_ERROR
```

---

## Rollback Procedures

### Lambda Function Rollback

```bash
# List versions
aws lambda list-versions-by-function \
  --function-name learningyogi-DocumentsAPI \
  --profile learningyogi-dev

# Update alias to previous version
aws lambda update-alias \
  --function-name learningyogi-DocumentsAPI \
  --name prod \
  --function-version 12 \
  --profile learningyogi-dev
```

### CloudFormation Stack Rollback

```bash
# Automatic rollback on failure (enabled by default with SAM)
sam deploy --no-fail-on-empty-changeset

# Manual rollback
aws cloudformation rollback-stack \
  --stack-name learningyogi-prod \
  --profile learningyogi-dev
```

### Database Rollback

```bash
# Restore from snapshot
aws rds restore-db-cluster-from-snapshot \
  --db-cluster-identifier learningyogi-prod-restored \
  --snapshot-identifier learningyogi-prod-snapshot-2025-01-01 \
  --engine aurora-postgresql \
  --profile learningyogi-dev
```

---

## Troubleshooting

### Common Issues

**Issue 1: Lambda Cold Start Timeouts**

```bash
# Check timeout configuration
aws lambda get-function-configuration \
  --function-name learningyogi-OCRProcessor \
  --profile learningyogi-dev

# Increase timeout
aws lambda update-function-configuration \
  --function-name learningyogi-OCRProcessor \
  --timeout 300 \
  --profile learningyogi-dev
```

**Issue 2: Database Connection Exhaustion**

```bash
# Check RDS Proxy connections
aws rds describe-db-proxy-targets \
  --db-proxy-name learningyogi-proxy \
  --profile learningyogi-dev

# Solution: Increase max connections or use connection pooling
```

**Issue 3: S3 Permission Errors**

```bash
# Verify Lambda execution role has S3 permissions
aws iam get-role-policy \
  --role-name learningyogi-lambda-role \
  --policy-name S3Access \
  --profile learningyogi-dev
```

### Debugging Lambda Functions

**View logs**:
```bash
# Tail logs in real-time
sam logs -n DocumentsAPI --stack-name learningyogi-prod --tail

# Search logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/learningyogi-DocumentsAPI \
  --filter-pattern "ERROR" \
  --start-time 1672531200000 \
  --profile learningyogi-dev
```

**Invoke function locally**:
```bash
sam local invoke DocumentsAPI \
  --event events/upload-document.json \
  --env-vars env.json
```

---

## Production Checklist

Before deploying to production, ensure:

- [ ] All tests passing (unit + integration)
- [ ] Security scan completed (Snyk, Bandit)
- [ ] Database migrations tested in staging
- [ ] CloudWatch alarms configured
- [ ] Backup strategy verified
- [ ] Secrets rotated and stored in Secrets Manager
- [ ] CloudFront CDN configured and tested
- [ ] Load testing completed (expected peak load + 2x)
- [ ] Rollback procedure documented and tested
- [ ] Team trained on monitoring and incident response
- [ ] Disaster recovery plan reviewed
- [ ] Compliance requirements met (GDPR, COPPA if applicable)

---

**Document Version**: 1.0.0
**Last Updated**: 2025-01-01
**Status**: Production-Ready Guide

# AI Chatbot Integration Guide - PoC2 (Serverless)

This guide shows how to integrate the AI Chatbot into the PoC2 serverless architecture using AWS Lambda.

## Overview

The AI Chatbot provides context-aware conversational assistance for users. In the serverless architecture, it's implemented as Lambda functions behind API Gateway, leveraging AWS managed services for scalability and cost efficiency.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Frontend (React) + Chatbot UI              │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
        ┌─────────────────┐
        │   API Gateway   │
        │  (REST API)     │
        └────────┬─────────┘
                 │
                 ▼
        ┌──────────────────┐
        │  Chatbot Lambda  │
        │   Function       │
        │  (Python/Node.js)│
        └────────┬──────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
    ▼                         ▼
┌──────────────┐      ┌──────────────────┐
│ Aurora       │      │  EventBridge     │
│ Serverless   │      │  (Analytics)     │
│  (Database)  │      └──────────────────┘
└──────────────┘
    │
    ▼
┌──────────────┐
│ Parameter    │
│ Store /      │
│ Secrets      │
│ Manager      │
│  (Config)    │
└──────────────┘
```

## Prerequisites

- AWS Account with admin access
- AWS CLI configured
- SAM CLI or Serverless Framework installed
- At least one AI provider API key (Claude, OpenAI)

## Deployment Methods

### Method 1: AWS SAM Template

#### 1. Create Lambda Function

Create `backend/lambda-python/chatbot/handler.py`:

```python
import json
import os
import boto3
from typing import Dict, Any

# AI provider imports
from anthropic import Anthropic
import openai

# Initialize clients
dynamodb = boto3.client('dynamodb')
anthropic_client = Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY'))
openai_client = openai.OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))

def lambda_handler(event, context):
    """Handle chat requests from API Gateway"""
    
    # Parse request
    body = json.loads(event['body'])
    message = body.get('message')
    session_id = body.get('session_id')
    context_data = body.get('context', {})
    
    # Determine provider
    provider = body.get('provider', 'claude')
    
    # Generate response
    if provider == 'claude':
        response = get_claude_response(message, context_data)
    elif provider == 'openai':
        response = get_openai_response(message, context_data)
    else:
        response = {"error": "Invalid provider"}
    
    # Store message history (async)
    if session_id:
        store_message(session_id, message, response)
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'response': response['text'],
            'session_id': session_id or context.aws_request_id,
            'provider': provider
        })
    }

def get_claude_response(message: str, context: Dict[str, Any]) -> Dict[str, str]:
    """Get response from Claude API"""
    # Implement context-aware logic
    system_prompt = build_system_prompt(context)
    
    try:
        response = anthropic_client.messages.create(
            model=os.environ.get('CHATBOT_CLAUDE_MODEL', 'claude-3-haiku-20240307'),
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": message}]
        )
        return {"text": response.content[0].text}
    except Exception as e:
        return {"text": f"Error: {str(e)}"}

def get_openai_response(message: str, context: Dict[str, Any]) -> Dict[str, str]:
    """Get response from OpenAI API"""
    system_prompt = build_system_prompt(context)
    
    try:
        response = openai_client.chat.completions.create(
            model=os.environ.get('CHATBOT_OPENAI_MODEL', 'gpt-3.5-turbo'),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ]
        )
        return {"text": response.choices[0].message.content}
    except Exception as e:
        return {"text": f"Error: {str(e)}"}

def build_system_prompt(context: Dict[str, Any]) -> str:
    """Build context-aware system prompt"""
    base_prompt = """You are a helpful assistant for Learning Yogi timetable management."""
    
    if context.get('document_id'):
        base_prompt += f"\nCurrent document: {context['document_id']}"
    
    return base_prompt

def store_message(session_id: str, user_message: str, response: Dict[str, str]):
    """Store chat message in DynamoDB (async)"""
    # Send to EventBridge for async processing
    eventbridge = boto3.client('events')
    eventbridge.put_events(
        Entries=[{
            'Source': 'learning-yogi.chatbot',
            'DetailType': 'Chat Message',
            'Detail': json.dumps({
                'session_id': session_id,
                'user_message': user_message,
                'response': response['text']
            })
        }]
    )
```

#### 2. SAM Template Configuration

Add to `infrastructure/template.yaml`:

```yaml
Resources:
  ChatbotFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: backend/lambda-python/chatbot
      Handler: handler.lambda_handler
      Runtime: python3.11
      MemorySize: 512
      Timeout: 30
      Environment:
        Variables:
          CHATBOT_PROVIDER_PREFERENCE: claude,openai
          CHATBOT_CLAUDE_MODEL: claude-3-haiku-20240307
          CHATBOT_ENABLE_CONTEXT: "true"
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref ChatbotSessions
        - EventBridgePutEventsPolicy
        - SecretsManagerReadWrite:
            SecretArn: !Ref ApiKeysSecret
      VpcConfig:
        SecurityGroupIds:
          - !Ref DatabaseSecurityGroup
        SubnetIds: !Ref PrivateSubnets
      Events:
        ChatApi:
          Type: Api
          Properties:
            Path: /chat
            Method: post
            RestApiId: !Ref ApiGateway
    
  ChatbotSessions:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: chatbot-sessions
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: session_id
          AttributeType: S
      KeySchema:
        - AttributeName: session_id
          KeyType: HASH
      TimeToLiveSpecification:
        AttributeName: expires_at
        Enabled: true

  ApiKeysSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: chatbot-api-keys
      SecretString: !Sub |
        {
          "ANTHROPIC_API_KEY": "${AnthropicApiKey}",
          "OPENAI_API_KEY": "${OpenAiApiKey}"
        }

Parameters:
  AnthropicApiKey:
    Type: String
    NoEcho: true
  OpenAiApiKey:
    Type: String
    NoEcho: true
    Default: ""

Outputs:
  ChatbotApiUrl:
    Description: "Chatbot API Gateway URL"
    Value: !Sub "https://${ApiGateway}.execute-api.${AWS::Region}.amazonaws.com/Prod/chat"
```

#### 3. Deploy with SAM

```bash
# Build
sam build --template-file infrastructure/template.yaml

# Deploy with guided prompts
sam deploy --guided

# Or deploy directly
sam deploy \
  --stack-name learning-yogi-chatbot \
  --parameter-overrides AnthropicApiKey=sk-ant-... OpenAiApiKey=sk-... \
  --capabilities CAPABILITY_IAM \
  --region us-east-1
```

### Method 2: Serverless Framework

#### 1. Create Function

Add to `infrastructure/serverless.yml`:

```yaml
service: learning-yogi-chatbot

provider:
  name: aws
  runtime: python3.11
  region: us-east-1
  environment:
    CHATBOT_PROVIDER_PREFERENCE: claude,openai
    CHATBOT_ENABLE_CONTEXT: true
  iamRoleStatements:
    - Effect: Allow
      Action:
        - dynamodb:PutItem
        - dynamodb:GetItem
        - dynamodb:Query
        - dynamodb:UpdateItem
      Resource: "arn:aws:dynamodb:*:*:table/chatbot-sessions"
    - Effect: Allow
      Action:
        - events:PutEvents
      Resource: "*"
    - Effect: Allow
      Action:
        - secretsmanager:GetSecretValue
      Resource: "arn:aws:secretsmanager:*:*:secret:chatbot-api-keys-*"
  vpc:
    securityGroupIds:
      - ${env:DB_SECURITY_GROUP}
    subnetIds:
      - ${env:PRIVATE_SUBNET_1}
      - ${env:PRIVATE_SUBNET_2}

functions:
  chatbot:
    handler: handler.lambda_handler
    timeout: 30
    memorySize: 512
    events:
      - http:
          path: /chat
          method: post
          cors: true
    layers:
      - arn:aws:lambda:${aws:region}:123456789012:layer:python-deps:1

resources:
  Resources:
    ChatbotSessions:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: chatbot-sessions
        BillingMode: PAY_PER_REQUEST
        AttributeDefinitions:
          - AttributeName: session_id
            AttributeType: S
        KeySchema:
          - AttributeName: session_id
            KeyType: HASH
```

#### 2. Deploy

```bash
# Install dependencies
npm install -g serverless

# Deploy
serverless deploy --stage prod

# Set secrets
aws secretsmanager create-secret \
  --name chatbot-api-keys \
  --secret-string '{"ANTHROPIC_API_KEY":"sk-ant-...","OPENAI_API_KEY":"sk-..."}'
```

### Method 3: Terraform

Create `infrastructure/terraform/chatbot.tf`:

```hcl
resource "aws_lambda_function" "chatbot" {
  filename         = "chatbot.zip"
  function_name    = "learning-yogi-chatbot"
  role            = aws_iam_role.chatbot_lambda.arn
  handler         = "handler.lambda_handler"
  source_code_hash = data.archive_file.chatbot_zip.output_base64sha256
  runtime         = "python3.11"
  memory_size     = 512
  timeout         = 30

  environment {
    variables = {
      CHATBOT_PROVIDER_PREFERENCE = "claude,openai"
      CHATBOT_CLAUDE_MODEL        = "claude-3-haiku-20240307"
      CHATBOT_ENABLE_CONTEXT      = "true"
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.chatbot.id]
  }
}

resource "aws_api_gateway_resource" "chat" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "chat"
}

resource "aws_api_gateway_method" "chat" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.chat.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "chatbot" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.chat.id
  http_method = aws_api_gateway_method.chat.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.chatbot.invoke_arn
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chatbot.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

resource "aws_dynamodb_table" "chatbot_sessions" {
  name         = "chatbot-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "session_id"

  attribute {
    name = "session_id"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }
}
```

Deploy:

```bash
cd infrastructure/terraform
terraform init
terraform plan
terraform apply
```

## Database Integration

### Aurora Serverless Integration

Connect to existing Aurora Serverless cluster:

```python
import boto3

def get_document_context(document_id: str) -> Dict[str, Any]:
    """Query Aurora for document context"""
    rds_data = boto3.client('rds-data')
    
    response = rds_data.execute_statement(
        resourceArn=os.environ['AURORA_CLUSTER_ARN'],
        secretArn=os.environ['AURORA_SECRET_ARN'],
        database='learningyogi',
        sql='SELECT * FROM documents WHERE id = :id',
        parameters=[
            {'name': 'id', 'value': {'stringValue': document_id}}
        ]
    )
    
    return response['records']
```

### DynamoDB for Sessions

Store chat sessions in DynamoDB:

```python
def store_session(session_id: str, messages: list):
    """Store chat session in DynamoDB"""
    dynamodb.put_item(
        TableName='chatbot-sessions',
        Item={
            'session_id': {'S': session_id},
            'messages': {'L': messages},
            'created_at': {'S': datetime.now().isoformat()},
            'expires_at': {'N': str(int(time.time()) + 86400)}  # 24h TTL
        }
    )
```

## EventBridge Integration

### Chat Analytics

Send chat events to EventBridge for analytics:

```python
import boto3

eventbridge = boto3.client('events')

def log_chat_event(session_id: str, message: str, response: str):
    """Send chat event to EventBridge"""
    eventbridge.put_events(
        Entries=[{
            'Source': 'learning-yogi.chatbot',
            'DetailType': 'Chat Message',
            Detail=json.dumps({
                'session_id': session_id,
                'message_length': len(message),
                'response_length': len(response),
                'timestamp': datetime.now().isoformat()
            })
        }]
    )
```

### Scheduled Session Cleanup

```yaml
# SAM template
ChatbotSessionCleanup:
  Type: AWS::Serverless::Function
  Properties:
    CodeUri: backend/lambda-python/chatbot
    Handler: cleanup_sessions.lambda_handler
    Runtime: python3.11
    Timeout: 60
    Events:
      ScheduledEvent:
        Type: Schedule
        Properties:
          Schedule: rate(6 hours)
```

## Frontend Integration

### API Gateway Configuration

Use the API Gateway URL:

```tsx
// frontend/react/src/components/Chatbot.tsx
import { Chatbot } from '@learning-yogi/ai-chatbot';

export function AppChatbot() {
  const apiUrl = import.meta.env.VITE_CHATBOT_API_URL || 
    'https://abcdef123.execute-api.us-east-1.amazonaws.com/prod';
  
  return (
    <Chatbot 
      apiUrl={apiUrl}
      position="bottom-right"
    />
  );
}
```

### CORS Configuration

Enable CORS in API Gateway:

```yaml
# SAM template
ChatbotFunction:
  Properties:
    Events:
      ChatApi:
        Properties:
          Cors:
            AllowMethods: "'POST,OPTIONS'"
            AllowHeaders: "'content-type'"
            AllowOrigin: "'*'"
```

## Configuration

### Environment Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `ANTHROPIC_API_KEY` | Claude API key | Secrets Manager |
| `OPENAI_API_KEY` | OpenAI API key | Secrets Manager |
| `CHATBOT_PROVIDER_PREFERENCE` | Provider order | Environment |
| `CHATBOT_CLAUDE_MODEL` | Claude model | Environment |
| `AURORA_CLUSTER_ARN` | Aurora ARN | Parameter Store |
| `AURORA_SECRET_ARN` | Aurora secret | Parameter Store |

### Parameter Store / Secrets Manager

Store sensitive configuration:

```bash
# Store secrets
aws secretsmanager create-secret \
  --name /learning-yogi/chatbot/api-keys \
  --secret-string '{"ANTHROPIC_API_KEY":"sk-ant-..."}'

# Store parameters
aws ssm put-parameter \
  --name /learning-yogi/chatbot/provider-preference \
  --value "claude,openai" \
  --type String
```

Retrieve in Lambda:

```python
import boto3
import json

secrets_client = boto3.client('secretsmanager')
ssm_client = boto3.client('ssm')

def get_secret(secret_name: str) -> dict:
    response = secrets_client.get_secret_value(SecretId=secret_name)
    return json.loads(response['SecretString'])

def get_parameter(param_name: str) -> str:
    response = ssm_client.get_parameter(Name=param_name)
    return response['Parameter']['Value']
```

## Monitoring and Observability

### CloudWatch Logs

View logs:

```bash
aws logs tail /aws/lambda/learning-yogi-chatbot --follow
```

### CloudWatch Metrics

Monitor invocation count, duration, errors:

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=learning-yogi-chatbot \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-01T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

### CloudWatch Dashboards

Create a dashboard:

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Invocations", {"stat": "Sum"}],
          ["AWS/Lambda", "Errors", {"stat": "Sum"}],
          ["AWS/Lambda", "Duration", {"stat": "Average"}]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "Chatbot Lambda Metrics"
      }
    }
  ]
}
```

### X-Ray Tracing

Enable tracing:

```yaml
# SAM template
ChatbotFunction:
  Properties:
    Tracing: Active  # Enable X-Ray
```

## Cold Start Mitigation

### Provisioned Concurrency

Keep functions warm:

```yaml
AutoPublishAlias: live
ProvisionedConcurrencyConfig:
  AutoProvisionedConcurrencyConfig:
    TargetValue: 5
```

### Function Optimization

- Minimize dependencies
- Use Lambda Layers for shared libraries
- Reduce package size
- Optimize imports

### Scheduled Warming

```yaml
ChatbotWarmer:
  Type: AWS::Serverless::Function
  Properties:
    Handler: warmer.lambda_handler
    Runtime: python3.11
    Events:
      ScheduledWarmer:
        Type: Schedule
        Properties:
          Schedule: rate(5 minutes)
```

## Cost Analysis

### Monthly Costs (1,000 docs/day)

| Component | Cost | Calculation |
|-----------|------|-------------|
| **Lambda** | $1 | 30K invocations × 1s × 512MB × $0.00001667/GB-s |
| **API Gateway** | $0.10 | 30K requests × $0.0000035/request |
| **DynamoDB** | $0.25 | ~1000 sessions stored, minimal read/write |
| **AI API (Claude)** | $5 | ~500 chats/day × $3/1K |
| **CloudWatch Logs** | $0.50 | 1GB logs/month |
| **Total** | **$6.85/month** | ~3% of PoC2 base cost |

### Scaling Costs

| Traffic | Lambda Cost | API Gateway | AI API | Total/Month |
|---------|-------------|-------------|--------|-------------|
| 1,000 chats/day | $1 | $0.10 | $5 | $7 |
| 5,000 chats/day | $5 | $0.50 | $25 | $31 |
| 10,000 chats/day | $10 | $1 | $50 | $61 |

### Cost Optimization Tips

1. **Use provisioned concurrency sparingly** (~$15/month per function)
2. **Enable SNS/FIFO for async processing** instead of synchronous calls
3. **Cache responses** in ElastiCache
4. **Use smaller memory allocations** where possible
5. **Implement request batching**

## Testing

### Unit Tests

```bash
cd backend/lambda-python/chatbot
pytest tests/unit/
```

### Integration Tests

```bash
# Test with SAM local
sam local invoke ChatbotFunction --event tests/events/chat-request.json
```

Example event:

```json
{
  "body": "{\"message\":\"Hello\",\"session_id\":\"test-123\"}",
  "headers": {
    "Content-Type": "application/json"
  }
}
```

### Load Testing

```bash
# Use Artillery or k6
artillery quick \
  --count 100 \
  --num 1000 \
  https://abcdef123.execute-api.us-east-1.amazonaws.com/prod/chat
```

## Security

### Network Security

- Deploy Lambda in private subnets
- Use VPC endpoints for AWS services
- Implement WAF rules on API Gateway

### Access Control

```yaml
# SAM template
ChatbotFunction:
  Properties:
    Events:
      ChatApi:
        Properties:
          Auth:
            Authorizer: AWS_IAM
```

### Secrets Management

- Use Secrets Manager, not environment variables
- Rotate API keys regularly
- Implement least-privilege IAM roles

## Troubleshooting

### Cold Starts

**Problem**: First request takes 2-5 seconds

**Solutions**:
- Enable provisioned concurrency
- Optimize package size
- Use ARM-based Lambdas (cheaper)

### Timeouts

**Problem**: Function times out

**Solutions**:
- Increase timeout
- Optimize database queries
- Use async processing

### API Key Errors

**Problem**: AI provider authentication fails

**Solutions**:
- Verify secret in Secrets Manager
- Check IAM permissions
- Validate key format

## Next Steps

1. **Deploy to staging**: Test with SAM or Serverless Framework
2. **Configure monitoring**: Set up CloudWatch dashboards
3. **Enable tracing**: Use X-Ray for debugging
4. **Load testing**: Validate performance
5. **Security audit**: Review IAM roles and policies
6. **Cost optimization**: Monitor and adjust configuration

## References

- [AIChatbot Documentation](../../AIChatbot/README.md)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [Serverless Framework](https://www.serverless.com/framework/docs/)

---

**Version**: 1.0.0  
**Last Updated**: 2025-01-01  
**Status**: Production-Ready


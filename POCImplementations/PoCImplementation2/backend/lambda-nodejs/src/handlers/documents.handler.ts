/**
 * Documents API Lambda Handler
 *
 * Handles HTTP requests for document management:
 * - GET /documents - List user's documents
 * - GET /documents/{id} - Get specific document
 * - POST /documents/upload - Create presigned upload URL
 * - DELETE /documents/{id} - Delete document
 *
 * TDD Implementation: Tests written first, see documents.handler.spec.ts
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { z } from 'zod';
import * as DocumentService from '../services/document.service';

/**
 * Validation schemas
 */
const UploadRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().positive().max(50 * 1024 * 1024), // 50 MB max
  contentType: z.enum([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
  ]),
});

/**
 * Main Lambda handler
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Request:', JSON.stringify({ ...event, body: '[REDACTED]' }, null, 2));

  try {
    // Extract user from authorizer context
    const userId = event.requestContext?.authorizer?.userId as string;

    if (!userId) {
      return createResponse(401, { error: 'Unauthorized' });
    }

    // Handle OPTIONS for CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return createResponse(200, {});
    }

    // Route based on HTTP method and path
    const method = event.httpMethod;
    const path = event.path;

    if (method === 'GET' && path === '/api/v1/documents') {
      return await handleListDocuments(event, userId);
    }

    if (method === 'GET' && event.pathParameters?.documentId) {
      return await handleGetDocument(event, userId);
    }

    if (method === 'POST' && path === '/api/v1/documents/upload') {
      return await handleCreateUpload(event, userId);
    }

    if (method === 'DELETE' && event.pathParameters?.documentId) {
      return await handleDeleteDocument(event, userId);
    }

    // Method not allowed
    return createResponse(405, {
      error: 'Method not allowed',
      allowedMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    });
  } catch (error) {
    console.error('Handler error:', error);

    return createErrorResponse(error, context.requestId);
  }
};

/**
 * Handler: GET /documents
 */
async function handleListDocuments(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  const page = parseInt(event.queryStringParameters?.page || '1', 10);
  const limit = parseInt(event.queryStringParameters?.limit || '20', 10);

  const result = await DocumentService.listDocuments(userId, page, limit);

  return createResponse(200, result);
}

/**
 * Handler: GET /documents/{documentId}
 */
async function handleGetDocument(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  const documentId = event.pathParameters!.documentId!;

  try {
    const document = await DocumentService.getDocument(documentId, userId);

    return createResponse(200, document);
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return createResponse(404, { error: error.message });
    }

    if (error.message?.includes('Forbidden')) {
      return createResponse(403, { error: error.message });
    }

    throw error;
  }
}

/**
 * Handler: POST /documents/upload
 */
async function handleCreateUpload(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  // Parse and validate request body
  let body: unknown;

  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return createResponse(400, { error: 'Invalid JSON in request body' });
  }

  // Validate with Zod
  const validation = UploadRequestSchema.safeParse(body);

  if (!validation.success) {
    return createResponse(400, {
      error: 'Validation error',
      details: validation.error.errors,
    });
  }

  const { fileName, fileSize, contentType } = validation.data;

  try {
    const result = await DocumentService.createUploadUrl(
      userId,
      fileName,
      fileSize,
      contentType
    );

    return createResponse(200, result);
  } catch (error: any) {
    if (error.message?.includes('Invalid file type')) {
      return createResponse(400, { error: error.message });
    }

    if (error.message?.includes('exceeds limit')) {
      return createResponse(400, { error: error.message });
    }

    throw error;
  }
}

/**
 * Handler: DELETE /documents/{documentId}
 */
async function handleDeleteDocument(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  const documentId = event.pathParameters!.documentId!;

  try {
    await DocumentService.deleteDocument(documentId, userId);

    return createResponse(204, '');
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return createResponse(404, { error: error.message });
    }

    throw error;
  }
}

/**
 * Create standardized API Gateway response
 */
function createResponse(
  statusCode: number,
  body: any
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

/**
 * Create error response with proper status code
 */
function createErrorResponse(
  error: unknown,
  requestId: string
): APIGatewayProxyResult {
  console.error('Error details:', error);

  const message = error instanceof Error ? error.message : 'Unknown error';

  return createResponse(500, {
    error: 'Internal server error',
    message: message,
    requestId,
  });
}

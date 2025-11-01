/**
 * Documents API Lambda Handler - Test Suite (TDD)
 *
 * Test-Driven Development:
 * 1. Write test first (defines expected behavior)
 * 2. Implement minimal code to pass
 * 3. Refactor for quality
 *
 * Coverage Target: 85%+
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { handler } from './documents.handler';
import * as DocumentService from '../services/document.service';

// Mock dependencies
jest.mock('../services/document.service');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-eventbridge');

describe('Documents Lambda Handler', () => {
  let mockEvent: Partial<APIGatewayProxyEvent>;
  let mockContext: Partial<Context>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock context
    mockContext = {
      requestId: 'test-request-id',
      functionName: 'DocumentsAPI',
      awsRequestId: 'aws-request-id',
    } as Context;

    // Default mock event
    mockEvent = {
      httpMethod: 'GET',
      path: '/api/v1/documents',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-jwt-token',
      },
      requestContext: {
        requestId: 'request-123',
        authorizer: {
          userId: 'user-123',
          email: 'teacher@school.com',
        },
      } as any,
      body: null,
      queryStringParameters: null,
      pathParameters: null,
    };
  });

  describe('GET /documents', () => {
    it('should return list of documents with pagination', async () => {
      // Arrange
      const mockDocuments = [
        {
          id: 'doc-1',
          userId: 'user-123',
          fileName: 'timetable.pdf',
          status: 'completed',
          uploadedAt: '2025-01-01T10:00:00Z',
        },
        {
          id: 'doc-2',
          userId: 'user-123',
          fileName: 'schedule.png',
          status: 'processing',
          uploadedAt: '2025-01-01T11:00:00Z',
        },
      ];

      mockEvent.queryStringParameters = { page: '1', limit: '10' };

      jest.spyOn(DocumentService, 'listDocuments').mockResolvedValue({
        documents: mockDocuments,
        total: 2,
        page: 1,
        totalPages: 1,
      });

      // Act
      const result = await handler(mockEvent as APIGatewayProxyEvent, mockContext as Context);

      // Assert
      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.documents).toHaveLength(2);
      expect(body.total).toBe(2);
      expect(body.page).toBe(1);

      expect(DocumentService.listDocuments).toHaveBeenCalledWith('user-123', 1, 10);
    });

    it('should handle missing pagination parameters with defaults', async () => {
      // Arrange
      jest.spyOn(DocumentService, 'listDocuments').mockResolvedValue({
        documents: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });

      // Act
      await handler(mockEvent as APIGatewayProxyEvent, mockContext as Context);

      // Assert
      expect(DocumentService.listDocuments).toHaveBeenCalledWith('user-123', 1, 20); // Default limit
    });

    it('should return 401 if user not authenticated', async () => {
      // Arrange
      mockEvent.requestContext = {
        requestId: 'request-123',
        authorizer: undefined, // No user context
      } as any;

      // Act
      const result = await handler(mockEvent as APIGatewayProxyEvent, mockContext as Context);

      // Assert
      expect(result.statusCode).toBe(401);

      const body = JSON.parse(result.body);
      expect(body.error).toBe('Unauthorized');
    });
  });

  describe('GET /documents/{documentId}', () => {
    it('should return document by ID', async () => {
      // Arrange
      const mockDocument = {
        id: 'doc-123',
        userId: 'user-123',
        fileName: 'timetable.pdf',
        status: 'completed',
        s3Key: 'uploads/user-123/doc-123/original.pdf',
        confidence: 0.95,
        uploadedAt: '2025-01-01T10:00:00Z',
        completedAt: '2025-01-01T10:05:00Z',
      };

      mockEvent.httpMethod = 'GET';
      mockEvent.pathParameters = { documentId: 'doc-123' };

      jest.spyOn(DocumentService, 'getDocument').mockResolvedValue(mockDocument);

      // Act
      const result = await handler(mockEvent as APIGatewayProxyEvent, mockContext as Context);

      // Assert
      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.id).toBe('doc-123');
      expect(body.fileName).toBe('timetable.pdf');
      expect(body.status).toBe('completed');

      expect(DocumentService.getDocument).toHaveBeenCalledWith('doc-123', 'user-123');
    });

    it('should return 404 if document not found', async () => {
      // Arrange
      mockEvent.httpMethod = 'GET';
      mockEvent.pathParameters = { documentId: 'non-existent' };

      jest.spyOn(DocumentService, 'getDocument').mockRejectedValue(
        new Error('Document not found')
      );

      // Act
      const result = await handler(mockEvent as APIGatewayProxyEvent, mockContext as Context);

      // Assert
      expect(result.statusCode).toBe(404);

      const body = JSON.parse(result.body);
      expect(body.error).toContain('not found');
    });

    it('should return 403 if user does not own document', async () => {
      // Arrange
      mockEvent.pathParameters = { documentId: 'doc-456' };

      jest.spyOn(DocumentService, 'getDocument').mockRejectedValue(
        new Error('Forbidden: Document belongs to another user')
      );

      // Act
      const result = await handler(mockEvent as APIGatewayProxyEvent, mockContext as Context);

      // Assert
      expect(result.statusCode).toBe(403);
    });
  });

  describe('POST /documents/upload', () => {
    it('should create presigned URL for upload', async () => {
      // Arrange
      mockEvent.httpMethod = 'POST';
      mockEvent.path = '/api/v1/documents/upload';
      mockEvent.body = JSON.stringify({
        fileName: 'timetable.pdf',
        fileSize: 1024000,
        contentType: 'application/pdf',
      });

      const mockUploadResponse = {
        documentId: 'doc-new-123',
        uploadUrl: 'https://s3.amazonaws.com/presigned-url',
        expiresIn: 900,
      };

      jest.spyOn(DocumentService, 'createUploadUrl').mockResolvedValue(mockUploadResponse);

      // Act
      const result = await handler(mockEvent as APIGatewayProxyEvent, mockContext as Context);

      // Assert
      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.documentId).toBe('doc-new-123');
      expect(body.uploadUrl).toContain('https://s3.amazonaws.com');
      expect(body.expiresIn).toBe(900);

      expect(DocumentService.createUploadUrl).toHaveBeenCalledWith(
        'user-123',
        'timetable.pdf',
        1024000,
        'application/pdf'
      );
    });

    it('should reject invalid file types', async () => {
      // Arrange
      mockEvent.httpMethod = 'POST';
      mockEvent.path = '/api/v1/documents/upload';
      mockEvent.body = JSON.stringify({
        fileName: 'malware.exe',
        fileSize: 1024,
        contentType: 'application/x-msdownload',
      });

      jest.spyOn(DocumentService, 'createUploadUrl').mockRejectedValue(
        new Error('Invalid file type. Allowed: PDF, PNG, JPG, JPEG')
      );

      // Act
      const result = await handler(mockEvent as APIGatewayProxyEvent, mockContext as Context);

      // Assert
      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid file type');
    });

    it('should reject files exceeding size limit', async () => {
      // Arrange
      mockEvent.httpMethod = 'POST';
      mockEvent.path = '/api/v1/documents/upload';
      mockEvent.body = JSON.stringify({
        fileName: 'large.pdf',
        fileSize: 100 * 1024 * 1024, // 100 MB
        contentType: 'application/pdf',
      });

      jest.spyOn(DocumentService, 'createUploadUrl').mockRejectedValue(
        new Error('File size exceeds limit of 50 MB')
      );

      // Act
      const result = await handler(mockEvent as APIGatewayProxyEvent, mockContext as Context);

      // Assert
      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);
      expect(body.error).toContain('exceeds limit');
    });

    it('should validate required fields', async () => {
      // Arrange
      mockEvent.httpMethod = 'POST';
      mockEvent.path = '/api/v1/documents/upload';
      mockEvent.body = JSON.stringify({
        fileName: 'test.pdf',
        // Missing fileSize and contentType
      });

      // Act
      const result = await handler(mockEvent as APIGatewayProxyEvent, mockContext as Context);

      // Assert
      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);
      expect(body.error).toContain('validation');
    });
  });

  describe('DELETE /documents/{documentId}', () => {
    it('should delete document successfully', async () => {
      // Arrange
      mockEvent.httpMethod = 'DELETE';
      mockEvent.pathParameters = { documentId: 'doc-delete-123' };

      jest.spyOn(DocumentService, 'deleteDocument').mockResolvedValue(undefined);

      // Act
      const result = await handler(mockEvent as APIGatewayProxyEvent, mockContext as Context);

      // Assert
      expect(result.statusCode).toBe(204);
      expect(result.body).toBe('');

      expect(DocumentService.deleteDocument).toHaveBeenCalledWith('doc-delete-123', 'user-123');
    });

    it('should return 404 if document to delete not found', async () => {
      // Arrange
      mockEvent.httpMethod = 'DELETE';
      mockEvent.pathParameters = { documentId: 'non-existent' };

      jest.spyOn(DocumentService, 'deleteDocument').mockRejectedValue(
        new Error('Document not found')
      );

      // Act
      const result = await handler(mockEvent as APIGatewayProxyEvent, mockContext as Context);

      // Assert
      expect(result.statusCode).toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      jest.spyOn(DocumentService, 'listDocuments').mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act
      const result = await handler(mockEvent as APIGatewayProxyEvent, mockContext as Context);

      // Assert
      expect(result.statusCode).toBe(500);

      const body = JSON.parse(result.body);
      expect(body.error).toContain('Internal server error');
      expect(body.requestId).toBe('test-request-id');
    });

    it('should return 405 for unsupported HTTP methods', async () => {
      // Arrange
      mockEvent.httpMethod = 'PATCH';

      // Act
      const result = await handler(mockEvent as APIGatewayProxyEvent, mockContext as Context);

      // Assert
      expect(result.statusCode).toBe(405);

      const body = JSON.parse(result.body);
      expect(body.error).toContain('Method not allowed');
    });

    it('should validate malformed JSON in request body', async () => {
      // Arrange
      mockEvent.httpMethod = 'POST';
      mockEvent.path = '/api/v1/documents/upload';
      mockEvent.body = 'invalid-json{';

      // Act
      const result = await handler(mockEvent as APIGatewayProxyEvent, mockContext as Context);

      // Assert
      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid JSON');
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in response', async () => {
      // Arrange
      jest.spyOn(DocumentService, 'listDocuments').mockResolvedValue({
        documents: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });

      // Act
      const result = await handler(mockEvent as APIGatewayProxyEvent, mockContext as Context);

      // Assert
      expect(result.headers).toMatchObject({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      });
    });

    it('should handle OPTIONS preflight request', async () => {
      // Arrange
      mockEvent.httpMethod = 'OPTIONS';

      // Act
      const result = await handler(mockEvent as APIGatewayProxyEvent, mockContext as Context);

      // Assert
      expect(result.statusCode).toBe(200);
      expect(result.headers!['Access-Control-Allow-Methods']).toContain('GET');
    });
  });
});

// Run tests with coverage:
// npm test -- --coverage
//
// Run specific test:
// npm test -- documents.handler.spec.ts
//
// Run with watch mode:
// npm run test:watch

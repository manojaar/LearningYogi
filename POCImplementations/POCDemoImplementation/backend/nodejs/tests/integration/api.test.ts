// Import supertest dynamically to avoid issues
const request = require('supertest');
import express from 'express';
import { createDatabase } from '../../src/database/init';
import { DocumentModel } from '../../src/models/Document';
import { TimetableModel } from '../../src/models/Timetable';
import { StorageService } from '../../src/services/storage.service';
import { ProcessingService } from '../../src/services/processing.service';
import { ValidationService } from '../../src/services/validation.service';
import { DocumentService } from '../../src/services/document.service';
import { createDocumentsRouter } from '../../src/routes/documents';

describe('API Integration Tests', () => {
  let app: express.Application;
  let db: any;
  let documentService: DocumentService;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    
    // Initialize database
    db = createDatabase(':memory:');
    
    // Initialize models and services
    const documentModel = new DocumentModel(db);
    const timetableModel = new TimetableModel(db);
    const storage = new StorageService('./data/uploads/test');
    const processing = new ProcessingService('http://localhost:8000');
    const validation = new ValidationService();
    
    documentService = new DocumentService(
      documentModel,
      timetableModel,
      storage,
      processing,
      validation
    );
    
    // Setup routes
    app.use('/api/v1/documents', createDocumentsRouter(documentService));
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', service: 'nodejs-api' });
    });
  });

  afterAll(() => {
    db.close();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('nodejs-api');
    });
  });

  describe('Document Upload', () => {
    it('should handle file upload', async () => {
      const response = await request(app)
        .post('/api/v1/documents/upload')
        .attach('file', Buffer.from('test content'), 'test.png');
      
      expect(response.status).toBe(200);
      expect(response.body.documentId).toBeDefined();
      expect(response.body.status).toBe('uploaded');
    });

    it('should reject upload without file', async () => {
      const response = await request(app)
        .post('/api/v1/documents/upload');
      
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Document Retrieval', () => {
    it('should retrieve document by ID', async () => {
      // First upload a document
      const uploadResponse = await request(app)
        .post('/api/v1/documents/upload')
        .attach('file', Buffer.from('test'), 'test.png');
      
      const documentId = uploadResponse.body.documentId;
      
      // Retrieve it
      const response = await request(app)
        .get(`/api/v1/documents/${documentId}`)
        .expect(200);
      
      expect(response.body.id).toBe(documentId);
      expect(response.body.filename).toBe('test.png');
    });

    it('should return 404 for non-existent document', async () => {
      const response = await request(app)
        .get('/api/v1/documents/non-existent-id')
        .expect(404);
      
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Document Listing', () => {
    it('should return all documents with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/documents')
        .expect(200);
      
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});


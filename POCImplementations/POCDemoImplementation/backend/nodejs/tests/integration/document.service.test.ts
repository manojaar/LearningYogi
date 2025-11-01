import { DocumentService } from '../../src/services/document.service';
import { DocumentModel } from '../../src/models/Document';
import { TimetableModel } from '../../src/models/Timetable';
import { StorageService } from '../../src/services/storage.service';
import { ProcessingService } from '../../src/services/processing.service';
import { ValidationService } from '../../src/services/validation.service';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

describe('DocumentService Integration Tests', () => {
  let db: Database.Database;
  let documentService: DocumentService;
  let storageDir: string;

  beforeAll(() => {
    // Create test database
    const dbPath = ':memory:';
    db = new Database(dbPath);
    
    // Initialize schema
    const schema = fs.readFileSync(
      path.join(__dirname, '../../src/database/schema.sql'),
      'utf-8'
    );
    db.exec(schema);

    // Create temp storage directory
    storageDir = path.join(__dirname, '../../../../data/uploads/test');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
  });

  afterAll(() => {
    db.close();
    // Cleanup test directory
    if (fs.existsSync(storageDir)) {
      fs.rmSync(storageDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clear database
    db.exec('DELETE FROM documents');
    db.exec('DELETE FROM timetables');
    db.exec('DELETE FROM processing_jobs');

    // Create fresh service instances
    const documentModel = new DocumentModel(db);
    const timetableModel = new TimetableModel(db);
    const storage = new StorageService(storageDir);
    const processing = new ProcessingService('http://localhost:8000');
    const validation = new ValidationService();

    documentService = new DocumentService(
      documentModel,
      timetableModel,
      storage,
      processing,
      validation
    );
  });

  describe('Document Upload and Storage', () => {
    it('should upload document and create database record', async () => {
      const testFile = Buffer.from('Test image content');
      const filename = 'test-timetable.png';
      const mimetype = 'image/png';

      const result = await documentService.uploadDocument(
        testFile,
        filename,
        mimetype
      );

      expect(result.documentId).toBeDefined();
      expect(result.status).toBe('uploaded');

      // Verify database record
      const document = documentService.getDocument(result.documentId);
      expect(document).toBeDefined();
      expect(document.filename).toBe(filename);
      expect(document.file_type).toBe('image');
      expect(document.status).toBe('uploaded');
    });

    it('should validate file types correctly', async () => {
      const testFile = Buffer.from('Test content');
      
      // Valid types
      const validTypes = ['image/png', 'image/jpeg', 'application/pdf'];
      for (const type of validTypes) {
        await expect(
          documentService.uploadDocument(testFile, 'test.png', type)
        ).resolves.toBeDefined();
      }
    });
  });

  describe('Document Retrieval', () => {
    it('should retrieve document by ID', async () => {
      const testFile = Buffer.from('Test content');
      const result = await documentService.uploadDocument(
        testFile,
        'test.png',
        'image/png'
      );

      const document = documentService.getDocument(result.documentId);
      expect(document).toBeDefined();
      expect(document.id).toBe(result.documentId);
      expect(document.filename).toBe('test.png');
    });

    it('should return all documents with pagination', async () => {
      // Upload multiple documents
      const testFile = Buffer.from('Test content');
      for (let i = 0; i < 5; i++) {
        await documentService.uploadDocument(
          testFile,
          `test-${i}.png`,
          'image/png'
        );
      }

      const { documents, total } = documentService.getAllDocuments(3, 0);
      expect(documents).toHaveLength(3);
      expect(total).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Document Deletion', () => {
    it('should delete document and associated file', async () => {
      const testFile = Buffer.from('Test content');
      const result = await documentService.uploadDocument(
        testFile,
        'test.png',
        'image/png'
      );

      const documentId = result.documentId;
      await documentService.deleteDocument(documentId);

      // Verify deletion
      const document = documentService.getDocument(documentId);
      expect(document).toBeUndefined();
    });
  });
});


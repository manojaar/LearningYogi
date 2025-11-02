import express from 'express';
import multer from 'multer';
import { DocumentService } from '../services/document.service';
import { SessionManager } from '../services/sessionManager';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Session manager will be injected via factory function
let sessionManager: SessionManager | undefined;

/**
 * Create routes with service instance
 */
export function createDocumentsRouter(
  documentService: DocumentService,
  sessionMgr?: SessionManager
) {
  sessionManager = sessionMgr;
  /**
   * Upload document
   */
  router.post('/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      // Get session ID from header or body
      const sessionId = req.headers['x-session-id'] as string || req.body.sessionId;

      // Extend session on document upload (user activity)
      if (sessionId && sessionManager) {
        try {
          await sessionManager.extendSession(sessionId);
        } catch (error) {
          // Log but don't fail upload if session extension fails
          console.warn('Failed to extend session on upload:', error);
        }
      }

      const result = await documentService.uploadDocument(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        sessionId
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Get document by ID
   */
  router.get('/:id', async (req, res) => {
    try {
      const doc = documentService.getDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
      }
      res.json(doc);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Get all documents
   */
  router.get('/', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const docs = documentService.getAllDocuments(limit, offset);
      res.json(docs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Delete document
   */
  router.delete('/:id', async (req, res) => {
    try {
      await documentService.deleteDocument(req.params.id);
      res.json({ message: 'Document deleted' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}


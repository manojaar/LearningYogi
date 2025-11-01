import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createDatabase } from './database/init';
import { DocumentModel } from './models/Document';
import { TimetableModel } from './models/Timetable';
import { StorageService } from './services/storage.service';
import { ProcessingService } from './services/processing.service';
import { ValidationService } from './services/validation.service';
import { DocumentService } from './services/document.service';
import { createDocumentsRouter } from './routes/documents';
import { createTimetablesRouter } from './routes/timetables';
import { createEventsRouter } from './routes/events';
import { createDocumentQueue } from './queues/documentQueue';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
const db = createDatabase(process.env.DATABASE_URL);

// Initialize models
const documentModel = new DocumentModel(db);
const timetableModel = new TimetableModel(db);

// Initialize services
const storage = new StorageService(process.env.STORAGE_PATH || './data/uploads');
const processing = new ProcessingService(
  process.env.PYTHON_API_URL || 'http://localhost:8000'
);
const validation = new ValidationService();

// Initialize document queue (if Redis is available)
let documentQueue;
try {
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379');
  documentQueue = createDocumentQueue(
    {
      documentModel,
      timetableModel,
      storage,
      processing,
      validation,
    },
    redisHost,
    redisPort
  );
  console.log('Document processing queue initialized');
} catch (error) {
  console.warn('Redis not available, queue processing disabled:', error);
  documentQueue = undefined;
}

// Initialize document service
const documentService = new DocumentService(
  documentModel,
  timetableModel,
  storage,
  processing,
  validation,
  documentQueue
);

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'nodejs-api',
    queue: documentQueue ? 'enabled' : 'disabled'
  });
});

app.use('/api/v1/documents', createDocumentsRouter(documentService));
app.use('/api/v1/timetables', createTimetablesRouter(documentService, timetableModel));
app.use('/api/v1/events', createEventsRouter());

// Start server
app.listen(PORT, () => {
  console.log(`Node.js API server running on port ${PORT}`);
  if (documentQueue) {
    console.log('Real-time processing with SSE enabled');
  } else {
    console.log('Queue processing disabled (fallback to sync mode)');
  }
});


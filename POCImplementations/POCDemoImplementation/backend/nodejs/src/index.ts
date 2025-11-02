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
import { CacheService } from './services/cache.service';
import { createDocumentsRouter } from './routes/documents';
import { createTimetablesRouter } from './routes/timetables';
import { createEventsRouter } from './routes/events';
import { createLLMSettingsRouter } from './routes/llmSettings';
import { createDocumentQueue } from './queues/documentQueue';
import { SessionManager } from './services/sessionManager';

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

// Initialize Redis cache service
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379');
const cacheTTL = parseInt(process.env.REDIS_CACHE_TTL || '120'); // Default 2 minutes
let cacheService: CacheService | undefined;
try {
  cacheService = new CacheService(redisHost, redisPort, cacheTTL);
  console.log(`Redis cache service initialized with TTL: ${cacheTTL}s`);
} catch (error) {
  console.warn('Redis cache initialization failed:', error);
  cacheService = undefined;
}

// Initialize session manager for LLM settings
let sessionManager: SessionManager | undefined;
try {
  sessionManager = new SessionManager(cacheService);
  console.log('Session manager initialized');
} catch (error) {
  console.warn('Session manager initialization failed:', error);
  sessionManager = undefined;
}

// Initialize document queue (if Redis is available)
let documentQueue;
try {
  documentQueue = createDocumentQueue(
    {
      documentModel,
      timetableModel,
      storage,
      processing,
      validation,
      cacheService,
      sessionManager,
    },
    redisHost,
    redisPort,
    cacheService
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

app.use('/api/v1/documents', createDocumentsRouter(documentService, sessionManager));
app.use('/api/v1/timetables', createTimetablesRouter(documentService, timetableModel, cacheService));
app.use('/api/v1/events', createEventsRouter());
app.use('/api/v1/llm', createLLMSettingsRouter(sessionManager!));

// Start server
app.listen(PORT, () => {
  console.log(`Node.js API server running on port ${PORT}`);
  if (documentQueue) {
    console.log('Real-time processing with SSE enabled');
  } else {
    console.log('Queue processing disabled (fallback to sync mode)');
  }
});


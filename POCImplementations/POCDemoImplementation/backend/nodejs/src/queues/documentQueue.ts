import Bull, { Queue, Job } from 'bull';
import { DocumentModel } from '../models/Document';
import { TimetableModel } from '../models/Timetable';
import { StorageService } from '../services/storage.service';
import { ProcessingService } from '../services/processing.service';
import { ValidationService } from '../services/validation.service';
import { ImageCompressor } from '../services/imageCompressor';
import { ImageFormatConverter } from '../services/imageFormatConverter';
import { CacheService } from '../services/cache.service';
import { SessionManager } from '../services/sessionManager';
import { formatError } from '../services/errorFormatter';
import { sseManager, ProcessingEvent } from '../services/sseManager';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

interface DocumentJobData {
  documentId: string;
  filePath: string;
  sessionId?: string;
}

interface DocumentQueueDependencies {
  documentModel: DocumentModel;
  timetableModel: TimetableModel;
  storage: StorageService;
  processing: ProcessingService;
  validation: ValidationService;
  cacheService?: CacheService;
  sessionManager?: SessionManager;
}

/**
 * Create and configure document processing queue
 */
export function createDocumentQueue(
  dependencies: DocumentQueueDependencies,
  redisHost: string = 'localhost',
  redisPort: number = 6379,
  cacheService?: CacheService
): Queue<DocumentJobData> {
  const { documentModel, timetableModel, storage, processing, validation } = dependencies;
  const queue = new Bull<DocumentJobData>('document-processing', {
    redis: {
      host: redisHost,
      port: redisPort,
    },
    defaultJobOptions: {
      attempts: parseInt(process.env.QUEUE_MAX_RETRIES || '3'),
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      timeout: parseInt(process.env.QUEUE_TIMEOUT || '600000'), // 10 minutes (increased for format conversion + AI processing)
    },
  });

  // Process jobs
  const concurrency = parseInt(process.env.QUEUE_CONCURRENCY || '2');
  
  queue.process(concurrency, async (job: Job<DocumentJobData>) => {
    const { documentId, filePath, sessionId } = job.data;
    
    // Get LLM settings from session if available
    let llmSettings = null;
    if (dependencies.sessionManager && sessionId) {
      try {
        llmSettings = await dependencies.sessionManager.getLLMSettings(sessionId);
        
        // Extend session before processing starts (prevents expiry during processing)
        if (llmSettings) {
          await dependencies.sessionManager.checkAndExtendIfProcessing(sessionId);
        }
      } catch (error) {
        console.warn(`Failed to get LLM settings for session ${sessionId}:`, error);
      }
    }

    try {
      // Emit initial progress
      sseManager.emit(documentId, {
        type: 'progress',
        step: 'Starting processing',
        percentage: 0,
        documentId,
      });

      // Update status to processing
      documentModel.updateStatus(documentId, 'processing');

      // Step 1: Convert to standard format (JPEG/PNG) - 5%
      sseManager.emit(documentId, {
        type: 'progress',
        step: 'Converting to standard format',
        percentage: 5,
        documentId,
      });

      let processedPath = filePath;
      try {
        const doc = documentModel.getById(documentId);
        if (doc) {
          // Always convert to ensure uniform format (JPEG or PNG)
          const formatConverter = new ImageFormatConverter();
          const outputFormat = ImageFormatConverter.determineOutputFormat(
            doc.file_type === 'image' ? 'image/jpeg' : 'application/pdf',
            doc.filename
          );
          
          const conversionResult = await formatConverter.convertToStandardFormat(
            filePath,
            outputFormat,
            90 // quality
          );
          
          processedPath = conversionResult.path;
          
          sseManager.emit(documentId, {
            type: 'progress',
            step: `Converted to ${conversionResult.convertedFormat.toUpperCase()}`,
            percentage: 10,
            documentId,
          });
        }
      } catch (error) {
        // If conversion fails, continue with original file
        console.warn(`Format conversion failed for ${documentId}, using original:`, error);
        processedPath = filePath;
      }

      // Step 2: Compress image if applicable (15%)
      sseManager.emit(documentId, {
        type: 'progress',
        step: 'Compressing image',
        percentage: 15,
        documentId,
      });
      try {
        const doc = documentModel.getById(documentId);
        if (doc && ImageCompressor.isCompressible(`image/${doc.file_type === 'image' ? 'jpeg' : 'png'}`)) {
          const compressor = new ImageCompressor(
            parseInt(process.env.MAX_IMAGE_DIMENSION || '2048'),
            parseInt(process.env.IMAGE_QUALITY || '85'),
            (process.env.OUTPUT_FORMAT || 'webp') as 'webp' | 'jpeg' | 'png'
          );
          const compressionResult = await compressor.compress(processedPath);
          processedPath = compressionResult.path;
          
          sseManager.emit(documentId, {
            type: 'progress',
            step: `Image compressed (${compressionResult.compressionRatio.toFixed(1)}% reduction)`,
            percentage: 20,
            documentId,
          });
        }
      } catch (error) {
        // If compression fails, continue with converted image
        console.warn(`Image compression failed for ${documentId}, using converted image:`, error);
      }

      // Step 3: Preprocess image (25%)
      sseManager.emit(documentId, {
        type: 'progress',
        step: 'Preprocessing image',
        percentage: 25,
        documentId,
      });

      const preprocessedPath = await processing.preprocessImage(
        processedPath,
        filePath.substring(0, filePath.lastIndexOf('/'))
      );

      // Step 4: Run OCR (45%)
      sseManager.emit(documentId, {
        type: 'progress',
        step: 'Running OCR',
        percentage: 45,
        documentId,
      });

      const ocrResult = await processing.processOCR(preprocessedPath);

      // Step 5: Quality gate decision (55%)
      sseManager.emit(documentId, {
        type: 'progress',
        step: 'Evaluating quality',
        percentage: 55,
        documentId,
      });

      const qualityGate = await processing.getQualityGate(ocrResult);
      
      // Check if user wants Tesseract only or has LLM configured
      const useAI = llmSettings && llmSettings.provider !== 'tesseract' && qualityGate.route === 'ai';

      if (useAI && llmSettings) {
        // Step 6: AI extraction with user's LLM provider (60-90%)
        documentModel.updateStatus(documentId, 'processing_ai');

        sseManager.emit(documentId, {
          type: 'progress',
          step: `Analyzing with ${llmSettings.provider === 'claude' ? 'Claude' : llmSettings.provider === 'google' ? 'Google' : 'OpenAI'} AI`,
          percentage: 60,
          documentId,
        });

        const timetableData = await processing.extractWithAI(
          preprocessedPath,
          llmSettings.provider,
          llmSettings.model,
          llmSettings.apiKey
        );

        // Step 7: Validation (90-95%)
        sseManager.emit(documentId, {
          type: 'progress',
          step: 'Validating results',
          percentage: 90,
          documentId,
        });

        const validationResult = validation.validateTimetable(timetableData);

        // Step 8: Save results (95-100%)
        sseManager.emit(documentId, {
          type: 'progress',
          step: 'Saving results',
          percentage: 95,
          documentId,
        });

        const timetableId = uuidv4();
        const createdTimetable = await timetableModel.create({
          id: timetableId,
          document_id: documentId,
          teacher_name: timetableData.teacher ?? null,
          class_name: timetableData.className ?? null,
          term: timetableData.term ?? null,
          year: timetableData.year ?? null,
          saved_name: null,
          timeblocks: JSON.stringify(timetableData.timeblocks),
          confidence: ocrResult.confidence,
          validated: validationResult.valid,
        });

        documentModel.updateStatus(documentId, validationResult.valid ? 'completed' : 'validation_failed');

        // Write-Through: Cache the timetable data after saving to DB
        // Silently handle cache errors - don't fail the job if caching fails
        if (cacheService?.isAvailable()) {
          try {
            const cacheKey = `timetable:${documentId}`;
            const cacheData = {
              ...createdTimetable,
              timeblocks: timetableData.timeblocks,
            };
            await cacheService.set(cacheKey, cacheData);
          } catch (cacheError) {
            // Log but don't throw - caching is not critical for job success
            console.warn(`Cache write failed for document ${documentId}:`, cacheError);
          }
        }

        // Extend session after processing completes (if still active)
        if (dependencies.sessionManager && sessionId) {
          try {
            await dependencies.sessionManager.checkAndExtendIfProcessing(sessionId);
          } catch (error) {
            console.warn(`Failed to extend session after processing:`, error);
          }
        }

        // Step 9: Complete - Include full timetable data in SSE event
        sseManager.emit(documentId, {
          type: 'complete',
          step: 'Processing complete',
          percentage: 100,
          documentId,
          result: {
            documentId,
            timetableId,
            validated: validationResult.valid,
          },
          timetableData: {
            teacher: timetableData.teacher ?? null,
            className: timetableData.className ?? null,
            term: timetableData.term ?? null,
            year: timetableData.year ?? null,
            timeblocks: timetableData.timeblocks,
            confidence: ocrResult.confidence,
            validated: validationResult.valid,
          },
        });
      } else {
        // Tesseract-only or quality gate says OCR is sufficient
        // For now, we'll mark as completed with OCR results
        // TODO: In future, parse OCR results into timetable structure
        documentModel.updateStatus(documentId, 'completed');
        
        sseManager.emit(documentId, {
          type: 'complete',
          step: 'Processing complete (OCR only)',
          percentage: 100,
          documentId,
          result: {
            documentId,
            validated: true,
            message: 'Processing completed using Tesseract OCR only.',
          },
        });
      }

      return { success: true, documentId };
    } catch (error: any) {
      // Enhanced error logging with more context
      console.error('='.repeat(80));
      console.error(`PROCESSING ERROR for document ${documentId}`);
      console.error('='.repeat(80));
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        code: error.code,
        response: error.response?.data,
        stack: error.stack,
        sessionId: sessionId || 'none',
        llmSettings: llmSettings ? {
          provider: llmSettings.provider,
          model: llmSettings.model,
          hasApiKey: !!llmSettings.apiKey,
        } : 'none',
      });
      console.error('='.repeat(80));

      // Format error for human-readable display
      const formattedError = formatError(error);

      // Update status
      documentModel.updateStatus(documentId, 'failed');

      // Emit error event with detailed information
      sseManager.emit(documentId, {
        type: 'error',
        error: formattedError.message,
        errorDetails: {
          provider: llmSettings?.provider || 'unknown',
          model: llmSettings?.model || 'unknown',
          step: 'AI extraction',
          hint: 'Check your API key, model selection, and ensure you have sufficient quota'
        },
        documentId,
      });

      throw error;
    }
  });

  // Handle job events
  queue.on('completed', (job) => {
    console.log(`Job ${job.id} completed for document ${job.data.documentId}`);
  });

  queue.on('failed', (job, error) => {
    console.error(`Job ${job?.id} failed for document ${job?.data.documentId}:`, error);
  });

  return queue;
}


import { v4 as uuidv4 } from 'uuid';
import { Queue } from 'bull';
import { DocumentModel } from '../models/Document';
import { TimetableModel } from '../models/Timetable';
import { StorageService } from './storage.service';
import { ProcessingService } from './processing.service';
import { ValidationService } from './validation.service';

/**
 * Document service for handling document operations
 */
export class DocumentService {
  constructor(
    private documentModel: DocumentModel,
    private timetableModel: TimetableModel,
    private storage: StorageService,
    private processing: ProcessingService,
    private validation: ValidationService,
    private documentQueue?: Queue
  ) {}

  /**
   * Upload and process document
   */
  async uploadDocument(
    buffer: Buffer,
    filename: string,
    mimetype: string
  ): Promise<{ documentId: string; status: string }> {
    const documentId = uuidv4();
    const uniqueFilename = this.storage.generateUniqueFilename(filename);

    // Save file
    const filePath = await this.storage.saveFile(
      buffer,
      uniqueFilename,
      documentId
    );

    // Determine file type
    const fileType = this.getFileType(mimetype);

    // Create database record
    await this.documentModel.create({
      id: documentId,
      filename,
      file_path: filePath,
      file_type: fileType,
      file_size: buffer.length,
      status: 'uploaded',
    });

    // Queue job for processing (async)
    if (this.documentQueue) {
      await this.documentQueue.add({
        documentId,
        filePath,
      });
    } else {
      // Fallback to synchronous processing if queue not available
      this.processDocument(documentId).catch(err => {
        console.error(`Processing failed for document ${documentId}:`, err);
      });
    }

    return {
      documentId,
      status: 'uploaded',
    };
  }

  /**
   * Get document by ID
   */
  getDocument(id: string) {
    return this.documentModel.getById(id);
  }

  /**
   * Get all documents
   */
  getAllDocuments(limit?: number, offset?: number) {
    return this.documentModel.getAll(limit, offset);
  }

  /**
   * Delete document
   */
  async deleteDocument(id: string): Promise<void> {
    const doc = this.documentModel.getById(id);
    
    if (doc) {
      // Delete file
      await this.storage.deleteFile(doc.file_path);

      // Delete database record
      this.documentModel.delete(id);
    }
  }

  /**
   * Process document through pipeline
   */
  private async processDocument(documentId: string): Promise<void> {
    const doc = this.documentModel.getById(documentId);
    
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    try {
      this.documentModel.updateStatus(documentId, 'processing');

      // Preprocess image
      const preprocessedPath = await this.processing.preprocessImage(
        doc.file_path,
        doc.file_path.substring(0, doc.file_path.lastIndexOf('/'))
      );

      // Run OCR
      const ocrResult = await this.processing.processOCR(preprocessedPath);
      
      // Get quality gate decision
      const qualityGate = await this.processing.getQualityGate(ocrResult);

      if (qualityGate.route === 'ai') {
        // Low confidence, use AI
        this.documentModel.updateStatus(documentId, 'processing_ai');
        
        const timetableData = await this.processing.extractWithAI(preprocessedPath);
        
        // Validate
        const validation = this.validation.validateTimetable(timetableData);
        
        const timetableId = uuidv4();
        await this.timetableModel.create({
          id: timetableId,
          document_id: documentId,
          teacher_name: timetableData.teacher ?? null,
          class_name: timetableData.className ?? null,
          term: timetableData.term ?? null,
          year: timetableData.year ?? null,
          timeblocks: JSON.stringify(timetableData.timeblocks),
          confidence: ocrResult.confidence,
          validated: validation.valid,
        });

        this.documentModel.updateStatus(documentId, validation.valid ? 'completed' : 'validation_failed');
      } else {
        // High confidence, validate directly
        this.documentModel.updateStatus(documentId, 'completed');
      }
    } catch (error) {
      console.error(`Processing error for document ${documentId}:`, error);
      this.documentModel.updateStatus(documentId, 'failed');
      throw error;
    }
  }

  /**
   * Get document type from MIME type
   */
  private getFileType(mimetype: string): string {
    if (mimetype.startsWith('image/')) {
      return 'image';
    } else if (mimetype === 'application/pdf') {
      return 'pdf';
    } else {
      return 'unknown';
    }
  }
}


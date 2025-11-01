import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { S3 } from 'aws-sdk';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { Logger } from 'winston';

/**
 * Documents Service - TDD Implementation
 *
 * Handles document upload, processing, and retrieval
 * Following Test-Driven Development approach
 */

export interface UploadDocumentDto {
  file: Express.Multer.File;
  userId: string;
}

export interface DocumentResponse {
  id: string;
  userId: string;
  filename: string;
  fileType: string;
  fileSize: number;
  status: string;
  s3Key: string;
  createdAt: Date;
}

export interface ProcessingStatus {
  documentId: string;
  status: string;
  stage?: string;
  progress?: number;
  error?: string;
}

@Injectable()
export class DocumentsService {
  private readonly s3: S3;
  private readonly classificationQueue: Queue;
  private readonly prisma: PrismaClient;
  private readonly logger: Logger;

  constructor(
    s3: S3,
    classificationQueue: Queue,
    prisma: PrismaClient,
    logger: Logger
  ) {
    this.s3 = s3;
    this.classificationQueue = classificationQueue;
    this.prisma = prisma;
    this.logger = logger;
  }

  /**
   * Upload document and initiate processing
   * Test: should upload file to S3, create DB record, and enqueue job
   */
  async uploadDocument(dto: UploadDocumentDto): Promise<DocumentResponse> {
    const { file, userId } = dto;

    // Validate file
    this.validateFile(file);

    // Generate unique ID and S3 key
    const documentId = uuidv4();
    const s3Key = `uploads/${userId}/${documentId}/${file.originalname}`;

    this.logger.info('Uploading document', {
      documentId,
      userId,
      filename: file.originalname,
      size: file.size
    });

    try {
      // 1. Upload to S3
      await this.uploadToS3(s3Key, file.buffer, file.mimetype);

      // 2. Create database record
      const document = await this.createDocumentRecord({
        id: documentId,
        userId,
        filename: file.originalname,
        fileType: this.getFileType(file.mimetype),
        fileSize: file.size,
        s3Key,
        status: 'uploaded'
      });

      // 3. Enqueue classification job
      await this.enqueueClassificationJob({
        documentId,
        userId,
        s3Key,
        filename: file.originalname
      });

      this.logger.info('Document uploaded successfully', { documentId });

      return document;
    } catch (error) {
      this.logger.error('Document upload failed', {
        documentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get document by ID
   * Test: should return document if exists, throw NotFoundException if not
   */
  async getDocument(documentId: string, userId: string): Promise<DocumentResponse> {
    const document = await this.prisma.documents.findFirst({
      where: {
        id: documentId,
        userId
      }
    });

    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    return this.mapToDocumentResponse(document);
  }

  /**
   * Get all documents for user
   * Test: should return all user documents with pagination
   */
  async getDocuments(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ documents: DocumentResponse[]; total: number }> {
    const skip = (page - 1) * limit;

    const [documents, total] = await Promise.all([
      this.prisma.documents.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.documents.count({ where: { userId } })
    ]);

    return {
      documents: documents.map(this.mapToDocumentResponse),
      total
    };
  }

  /**
   * Delete document
   * Test: should delete from DB and S3
   */
  async deleteDocument(documentId: string, userId: string): Promise<void> {
    const document = await this.getDocument(documentId, userId);

    // Delete from S3
    await this.deleteFromS3(document.s3Key);

    // Delete from database
    await this.prisma.documents.delete({
      where: { id: documentId }
    });

    this.logger.info('Document deleted', { documentId });
  }

  /**
   * Get processing status
   * Test: should return current processing status
   */
  async getProcessingStatus(documentId: string, userId: string): Promise<ProcessingStatus> {
    const document = await this.getDocument(documentId, userId);

    // Get latest processing job
    const job = await this.prisma.processingJobs.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' }
    });

    return {
      documentId,
      status: document.status,
      stage: job?.jobType,
      progress: this.calculateProgress(document.status),
      error: job?.errorMessage
    };
  }

  // Private helper methods

  private validateFile(file: Express.Multer.File): void {
    const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
      );
    }

    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 50MB limit');
    }
  }

  private async uploadToS3(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.s3.putObject({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: 'AES256'
    }).promise();
  }

  private async deleteFromS3(key: string): Promise<void> {
    await this.s3.deleteObject({
      Bucket: process.env.S3_BUCKET!,
      Key: key
    }).promise();
  }

  private async createDocumentRecord(data: any): Promise<DocumentResponse> {
    const document = await this.prisma.documents.create({
      data: {
        id: data.id,
        userId: data.userId,
        filename: data.filename,
        fileType: data.fileType,
        fileSize: data.fileSize,
        s3Key: data.s3Key,
        status: data.status
      }
    });

    return this.mapToDocumentResponse(document);
  }

  private async enqueueClassificationJob(data: any): Promise<void> {
    await this.classificationQueue.add('classify-document', data, {
      priority: 10,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      }
    });

    // Create processing job record
    await this.prisma.processingJobs.create({
      data: {
        documentId: data.documentId,
        jobType: 'classification',
        status: 'pending',
        attempts: 0,
        maxAttempts: 3
      }
    });
  }

  private getFileType(mimetype: string): string {
    const typeMap: { [key: string]: string } = {
      'image/png': 'image',
      'image/jpeg': 'image',
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
    };

    return typeMap[mimetype] || 'unknown';
  }

  private calculateProgress(status: string): number {
    const progressMap: { [key: string]: number } = {
      'uploaded': 20,
      'classified': 40,
      'preprocessed': 60,
      'ocr_completed': 80,
      'llm_completed': 90,
      'completed': 100,
      'failed': 0
    };

    return progressMap[status] || 0;
  }

  private mapToDocumentResponse(document: any): DocumentResponse {
    return {
      id: document.id,
      userId: document.userId,
      filename: document.filename,
      fileType: document.fileType,
      fileSize: document.fileSize,
      status: document.status,
      s3Key: document.s3Key,
      createdAt: document.createdAt
    };
  }
}

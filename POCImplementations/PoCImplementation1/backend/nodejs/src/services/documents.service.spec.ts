import { DocumentsService, UploadDocumentDto } from './documents.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

/**
 * Documents Service Test Suite - TDD Approach
 *
 * Test-Driven Development:
 * 1. Write test (RED)
 * 2. Implement minimal code to pass (GREEN)
 * 3. Refactor
 *
 * Coverage Target: 85%+
 */

describe('DocumentsService', () => {
  let service: DocumentsService;
  let mockS3: any;
  let mockQueue: any;
  let mockPrisma: any;
  let mockLogger: any;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockDocumentId = '880e8400-e29b-41d4-a716-446655440003';

  beforeEach(() => {
    // Mock S3
    mockS3 = {
      putObject: jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
      }),
      deleteObject: jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
      })
    };

    // Mock BullMQ Queue
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' })
    };

    // Mock Prisma
    mockPrisma = {
      documents: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        delete: jest.fn()
      },
      processingJobs: {
        create: jest.fn(),
        findFirst: jest.fn()
      }
    };

    // Mock Logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    service = new DocumentsService(mockS3, mockQueue, mockPrisma, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadDocument', () => {
    const createMockFile = (overrides = {}): Express.Multer.File => ({
      fieldname: 'file',
      originalname: 'timetable.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: 1024000, // 1MB
      buffer: Buffer.from('fake file content'),
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
      ...overrides
    });

    it('should successfully upload a valid document', async () => {
      // Arrange
      const mockFile = createMockFile();
      const dto: UploadDocumentDto = {
        file: mockFile,
        userId: mockUserId
      };

      const mockDocument = {
        id: mockDocumentId,
        userId: mockUserId,
        filename: mockFile.originalname,
        fileType: 'image',
        fileSize: mockFile.size,
        s3Key: `uploads/${mockUserId}/${mockDocumentId}/${mockFile.originalname}`,
        status: 'uploaded',
        createdAt: new Date()
      };

      mockPrisma.documents.create.mockResolvedValue(mockDocument);

      // Act
      const result = await service.uploadDocument(dto);

      // Assert
      expect(result).toEqual({
        id: expect.any(String),
        userId: mockUserId,
        filename: mockFile.originalname,
        fileType: 'image',
        fileSize: mockFile.size,
        s3Key: expect.stringContaining('uploads/'),
        status: 'uploaded',
        createdAt: expect.any(Date)
      });

      // Verify S3 upload was called
      expect(mockS3.putObject).toHaveBeenCalledWith({
        Bucket: process.env.S3_BUCKET,
        Key: expect.stringContaining('uploads/'),
        Body: mockFile.buffer,
        ContentType: mockFile.mimetype,
        ServerSideEncryption: 'AES256'
      });

      // Verify database record was created
      expect(mockPrisma.documents.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          filename: mockFile.originalname,
          fileType: 'image',
          status: 'uploaded'
        })
      });

      // Verify classification job was enqueued
      expect(mockQueue.add).toHaveBeenCalledWith(
        'classify-document',
        expect.objectContaining({
          userId: mockUserId,
          filename: mockFile.originalname
        }),
        expect.objectContaining({
          priority: 10,
          attempts: 3
        })
      );

      // Verify logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Uploading document',
        expect.any(Object)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Document uploaded successfully',
        expect.any(Object)
      );
    });

    it('should reject file with invalid type', async () => {
      // Arrange
      const mockFile = createMockFile({
        mimetype: 'application/exe', // Invalid type
        originalname: 'virus.exe'
      });
      const dto: UploadDocumentDto = {
        file: mockFile,
        userId: mockUserId
      };

      // Act & Assert
      await expect(service.uploadDocument(dto)).rejects.toThrow(BadRequestException);
      await expect(service.uploadDocument(dto)).rejects.toThrow(/Invalid file type/);

      // Verify S3 was NOT called
      expect(mockS3.putObject).not.toHaveBeenCalled();
      expect(mockPrisma.documents.create).not.toHaveBeenCalled();
    });

    it('should reject file exceeding size limit', async () => {
      // Arrange
      const mockFile = createMockFile({
        size: 51 * 1024 * 1024 // 51MB (exceeds 50MB limit)
      });
      const dto: UploadDocumentDto = {
        file: mockFile,
        userId: mockUserId
      };

      // Act & Assert
      await expect(service.uploadDocument(dto)).rejects.toThrow(BadRequestException);
      await expect(service.uploadDocument(dto)).rejects.toThrow(/exceeds 50MB limit/);

      expect(mockS3.putObject).not.toHaveBeenCalled();
    });

    it('should handle S3 upload failure', async () => {
      // Arrange
      const mockFile = createMockFile();
      const dto: UploadDocumentDto = {
        file: mockFile,
        userId: mockUserId
      };

      mockS3.putObject.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('S3 upload failed'))
      });

      // Act & Assert
      await expect(service.uploadDocument(dto)).rejects.toThrow('S3 upload failed');

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Document upload failed',
        expect.any(Object)
      );

      // Verify database was NOT called (upload failed before DB)
      expect(mockPrisma.documents.create).not.toHaveBeenCalled();
    });

    it('should accept PDF files', async () => {
      // Arrange
      const mockFile = createMockFile({
        mimetype: 'application/pdf',
        originalname: 'timetable.pdf'
      });
      const dto: UploadDocumentDto = {
        file: mockFile,
        userId: mockUserId
      };

      mockPrisma.documents.create.mockResolvedValue({
        id: mockDocumentId,
        userId: mockUserId,
        filename: mockFile.originalname,
        fileType: 'pdf',
        fileSize: mockFile.size,
        s3Key: expect.any(String),
        status: 'uploaded',
        createdAt: new Date()
      });

      // Act
      const result = await service.uploadDocument(dto);

      // Assert
      expect(result.fileType).toBe('pdf');
      expect(mockS3.putObject).toHaveBeenCalled();
    });

    it('should accept DOCX files', async () => {
      // Arrange
      const mockFile = createMockFile({
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        originalname: 'timetable.docx'
      });
      const dto: UploadDocumentDto = {
        file: mockFile,
        userId: mockUserId
      };

      mockPrisma.documents.create.mockResolvedValue({
        id: mockDocumentId,
        userId: mockUserId,
        filename: mockFile.originalname,
        fileType: 'docx',
        fileSize: mockFile.size,
        s3Key: expect.any(String),
        status: 'uploaded',
        createdAt: new Date()
      });

      // Act
      const result = await service.uploadDocument(dto);

      // Assert
      expect(result.fileType).toBe('docx');
    });
  });

  describe('getDocument', () => {
    it('should return document if it exists and belongs to user', async () => {
      // Arrange
      const mockDocument = {
        id: mockDocumentId,
        userId: mockUserId,
        filename: 'timetable.png',
        fileType: 'image',
        fileSize: 1024000,
        s3Key: 'uploads/user/doc.png',
        status: 'uploaded',
        createdAt: new Date()
      };

      mockPrisma.documents.findFirst.mockResolvedValue(mockDocument);

      // Act
      const result = await service.getDocument(mockDocumentId, mockUserId);

      // Assert
      expect(result).toEqual(mockDocument);
      expect(mockPrisma.documents.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockDocumentId,
          userId: mockUserId
        }
      });
    });

    it('should throw NotFoundException if document does not exist', async () => {
      // Arrange
      mockPrisma.documents.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getDocument(mockDocumentId, mockUserId)
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.getDocument(mockDocumentId, mockUserId)
      ).rejects.toThrow(`Document ${mockDocumentId} not found`);
    });

    it('should not return document belonging to different user', async () => {
      // Arrange
      const differentUserId = 'different-user-id';
      mockPrisma.documents.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getDocument(mockDocumentId, differentUserId)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDocuments', () => {
    it('should return paginated documents for user', async () => {
      // Arrange
      const mockDocuments = [
        {
          id: 'doc-1',
          userId: mockUserId,
          filename: 'timetable1.png',
          fileType: 'image',
          fileSize: 1024000,
          s3Key: 'uploads/user/doc1.png',
          status: 'completed',
          createdAt: new Date()
        },
        {
          id: 'doc-2',
          userId: mockUserId,
          filename: 'timetable2.pdf',
          fileType: 'pdf',
          fileSize: 2048000,
          s3Key: 'uploads/user/doc2.pdf',
          status: 'uploaded',
          createdAt: new Date()
        }
      ];

      mockPrisma.documents.findMany.mockResolvedValue(mockDocuments);
      mockPrisma.documents.count.mockResolvedValue(25);

      // Act
      const result = await service.getDocuments(mockUserId, 1, 20);

      // Assert
      expect(result.documents).toHaveLength(2);
      expect(result.total).toBe(25);
      expect(mockPrisma.documents.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' }
      });
    });

    it('should handle pagination correctly', async () => {
      // Arrange
      mockPrisma.documents.findMany.mockResolvedValue([]);
      mockPrisma.documents.count.mockResolvedValue(100);

      // Act - Request page 3 with 20 items per page
      const result = await service.getDocuments(mockUserId, 3, 20);

      // Assert
      expect(mockPrisma.documents.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        skip: 40, // (page 3 - 1) * 20 = 40
        take: 20,
        orderBy: { createdAt: 'desc' }
      });
      expect(result.total).toBe(100);
    });
  });

  describe('deleteDocument', () => {
    it('should delete document from both S3 and database', async () => {
      // Arrange
      const mockDocument = {
        id: mockDocumentId,
        userId: mockUserId,
        filename: 'timetable.png',
        fileType: 'image',
        fileSize: 1024000,
        s3Key: 'uploads/user/doc.png',
        status: 'uploaded',
        createdAt: new Date()
      };

      mockPrisma.documents.findFirst.mockResolvedValue(mockDocument);
      mockPrisma.documents.delete.mockResolvedValue(mockDocument);

      // Act
      await service.deleteDocument(mockDocumentId, mockUserId);

      // Assert
      expect(mockS3.deleteObject).toHaveBeenCalledWith({
        Bucket: process.env.S3_BUCKET,
        Key: mockDocument.s3Key
      });

      expect(mockPrisma.documents.delete).toHaveBeenCalledWith({
        where: { id: mockDocumentId }
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Document deleted',
        { documentId: mockDocumentId }
      );
    });

    it('should throw NotFoundException if document does not exist', async () => {
      // Arrange
      mockPrisma.documents.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.deleteDocument(mockDocumentId, mockUserId)
      ).rejects.toThrow(NotFoundException);

      // Verify S3 and DB delete were NOT called
      expect(mockS3.deleteObject).not.toHaveBeenCalled();
      expect(mockPrisma.documents.delete).not.toHaveBeenCalled();
    });
  });

  describe('getProcessingStatus', () => {
    it('should return processing status with progress', async () => {
      // Arrange
      const mockDocument = {
        id: mockDocumentId,
        userId: mockUserId,
        filename: 'timetable.png',
        fileType: 'image',
        fileSize: 1024000,
        s3Key: 'uploads/user/doc.png',
        status: 'ocr_completed',
        createdAt: new Date()
      };

      const mockJob = {
        documentId: mockDocumentId,
        jobType: 'ocr',
        status: 'completed',
        errorMessage: null
      };

      mockPrisma.documents.findFirst.mockResolvedValue(mockDocument);
      mockPrisma.processingJobs.findFirst.mockResolvedValue(mockJob);

      // Act
      const result = await service.getProcessingStatus(mockDocumentId, mockUserId);

      // Assert
      expect(result).toEqual({
        documentId: mockDocumentId,
        status: 'ocr_completed',
        stage: 'ocr',
        progress: 80, // ocr_completed is 80%
        error: null
      });
    });

    it('should include error message if processing failed', async () => {
      // Arrange
      const mockDocument = {
        id: mockDocumentId,
        userId: mockUserId,
        filename: 'timetable.png',
        fileType: 'image',
        fileSize: 1024000,
        s3Key: 'uploads/user/doc.png',
        status: 'failed',
        createdAt: new Date()
      };

      const mockJob = {
        documentId: mockDocumentId,
        jobType: 'ocr',
        status: 'failed',
        errorMessage: 'OCR processing failed: Could not extract text'
      };

      mockPrisma.documents.findFirst.mockResolvedValue(mockDocument);
      mockPrisma.processingJobs.findFirst.mockResolvedValue(mockJob);

      // Act
      const result = await service.getProcessingStatus(mockDocumentId, mockUserId);

      // Assert
      expect(result).toEqual({
        documentId: mockDocumentId,
        status: 'failed',
        stage: 'ocr',
        progress: 0,
        error: 'OCR processing failed: Could not extract text'
      });
    });
  });
});

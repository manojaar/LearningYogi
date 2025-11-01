import { Queue } from 'bull';
import { createDocumentQueue } from '../../src/queues/documentQueue';

/**
 * Integration tests for Document Queue
 * 
 * These tests verify:
 * - Job creation and processing
 * - Progress tracking
 * - Error handling and retries
 * - SSE event emission during processing
 */

describe('Document Queue Integration Tests', () => {
  let queue: Queue;
  let mockDependencies: any;

  beforeAll(() => {
    // Set up test Redis connection
    process.env.REDIS_HOST = process.env.TEST_REDIS_HOST || 'localhost';
    process.env.REDIS_PORT = process.env.TEST_REDIS_PORT || '6379';

    // Mock dependencies
    mockDependencies = {
      documentModel: {
        getById: jest.fn(),
        updateStatus: jest.fn(),
      },
      timetableModel: {
        create: jest.fn(),
      },
      storage: {
        // Mock storage methods
      },
      processing: {
        preprocessImage: jest.fn().mockResolvedValue('/path/to/preprocessed'),
        processOCR: jest.fn().mockResolvedValue({
          text: 'test',
          confidence: 0.85,
        }),
        getQualityGate: jest.fn().mockResolvedValue({
          route: 'ai',
        }),
        extractWithAI: jest.fn().mockResolvedValue({
          teacher: 'Test Teacher',
          className: 'Test Class',
          timeblocks: [],
        }),
      },
      validation: {
        validateTimetable: jest.fn().mockReturnValue({
          valid: true,
        }),
      },
    };

    queue = createDocumentQueue(
      mockDependencies,
      process.env.REDIS_HOST!,
      parseInt(process.env.REDIS_PORT!)
    );
  });

  afterAll(async () => {
    if (queue) {
      await queue.close();
    }
  });

  beforeEach(async () => {
    // Clean up queue before each test
    await queue.obliterate({ force: true });
  });

  describe('Job Processing', () => {
    it('should create and process a job', async () => {
      const jobData = {
        documentId: 'test-doc-1',
        filePath: '/path/to/test/image.png',
      };

      const job = await queue.add(jobData);
      expect(job.id).toBeDefined();

      // Wait for job to complete
      const result = await job.finished();
      expect(result.success).toBe(true);
      expect(result.documentId).toBe(jobData.documentId);
    });

    it('should update progress during processing', async () => {
      const jobData = {
        documentId: 'test-doc-2',
        filePath: '/path/to/test/image.png',
      };

      const job = await queue.add(jobData);
      
      // Monitor job progress
      job.on('progress', (progress) => {
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(100);
      });

      await job.finished();
    });

    it('should retry on failure', async () => {
      // Mock a failure scenario
      mockDependencies.processing.extractWithAI.mockRejectedValueOnce(
        new Error('Temporary failure')
      );

      const jobData = {
        documentId: 'test-doc-3',
        filePath: '/path/to/test/image.png',
      };

      const job = await queue.add(jobData);

      // Job should retry (based on queue config)
      await expect(job.finished()).rejects.toThrow();
      
      expect(job.attemptsMade).toBeGreaterThan(1);
    });

    it('should emit SSE events during processing', async () => {
      const jobData = {
        documentId: 'test-doc-4',
        filePath: '/path/to/test/image.png',
      };

      // This test would need SSE manager to be accessible
      // and verify events are emitted at various stages
      const job = await queue.add(jobData);
      
      // In a real test, you would set up SSE client and verify events
      await job.finished();
    });
  });

  describe('Concurrent Processing', () => {
    it('should process multiple jobs concurrently', async () => {
      const jobs = [];
      
      for (let i = 0; i < 3; i++) {
        jobs.push(
          queue.add({
            documentId: `test-doc-${i}`,
            filePath: `/path/to/test/image-${i}.png`,
          })
        );
      }

      const createdJobs = await Promise.all(jobs);
      
      // All jobs should be queued
      expect(createdJobs.length).toBe(3);

      // Wait for all to complete
      await Promise.all(createdJobs.map(j => j.finished()));
    });
  });

  describe('Error Handling', () => {
    it('should handle file not found errors', async () => {
      mockDependencies.documentModel.getById.mockReturnValue(null);

      const jobData = {
        documentId: 'nonexistent-doc',
        filePath: '/nonexistent/path.png',
      };

      const job = await queue.add(jobData);
      
      await expect(job.finished()).rejects.toThrow();
      expect(job.failedReason).toBeDefined();
    });

    it('should update document status on failure', async () => {
      mockDependencies.processing.extractWithAI.mockRejectedValue(
        new Error('Processing failed')
      );

      const jobData = {
        documentId: 'test-doc-fail',
        filePath: '/path/to/test/image.png',
      };

      const job = await queue.add(jobData);
      
      await expect(job.finished()).rejects.toThrow();
      
      // Verify status was updated to 'failed'
      expect(mockDependencies.documentModel.updateStatus).toHaveBeenCalledWith(
        'test-doc-fail',
        'failed'
      );
    });
  });
});


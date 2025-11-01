/**
 * Document Service - Business Logic Layer
 *
 * Handles document management operations:
 * - List user documents with pagination
 * - Get document by ID with authorization
 * - Create presigned upload URLs
 * - Delete documents
 *
 * Integrates with:
 * - S3 for file storage
 * - Aurora PostgreSQL for metadata
 * - EventBridge for triggering processing pipeline
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// AWS Clients
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const eventBridgeClient = new EventBridgeClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2, // Lambda: Keep connections low
  idleTimeoutMillis: 30000,
});

// Configuration
const S3_BUCKET = process.env.S3_BUCKET || 'learningyogi-documents-dev';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

/**
 * Types
 */
export interface Document {
  id: string;
  userId: string;
  fileName: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  s3Key: string;
  fileSize?: number;
  contentType?: string;
  confidence?: number;
  uploadedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface ListDocumentsResult {
  documents: Document[];
  total: number;
  page: number;
  totalPages: number;
}

export interface UploadUrlResult {
  documentId: string;
  uploadUrl: string;
  expiresIn: number;
}

/**
 * List user's documents with pagination
 */
export async function listDocuments(
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<ListDocumentsResult> {
  const offset = (page - 1) * limit;

  // Query documents
  const query = `
    SELECT
      id,
      user_id,
      file_name,
      status,
      s3_key,
      file_size,
      content_type,
      confidence,
      uploaded_at,
      completed_at,
      error_message
    FROM documents
    WHERE user_id = $1
    ORDER BY uploaded_at DESC
    LIMIT $2 OFFSET $3
  `;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM documents
    WHERE user_id = $1
  `;

  const [documentsResult, countResult] = await Promise.all([
    pool.query(query, [userId, limit, offset]),
    pool.query(countQuery, [userId]),
  ]);

  const documents = documentsResult.rows.map(mapRowToDocument);
  const total = parseInt(countResult.rows[0].total, 10);
  const totalPages = Math.ceil(total / limit);

  return {
    documents,
    total,
    page,
    totalPages,
  };
}

/**
 * Get document by ID with authorization check
 */
export async function getDocument(
  documentId: string,
  userId: string
): Promise<Document> {
  const query = `
    SELECT
      id,
      user_id,
      file_name,
      status,
      s3_key,
      file_size,
      content_type,
      confidence,
      uploaded_at,
      completed_at,
      error_message
    FROM documents
    WHERE id = $1
  `;

  const result = await pool.query(query, [documentId]);

  if (result.rows.length === 0) {
    throw new Error('Document not found');
  }

  const document = mapRowToDocument(result.rows[0]);

  // Authorization check
  if (document.userId !== userId) {
    throw new Error('Forbidden: Document belongs to another user');
  }

  return document;
}

/**
 * Create presigned upload URL for S3
 */
export async function createUploadUrl(
  userId: string,
  fileName: string,
  fileSize: number,
  contentType: string
): Promise<UploadUrlResult> {
  // Validate file type
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new Error(
      `Invalid file type. Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}`
    );
  }

  // Validate file size
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024} MB`);
  }

  // Generate document ID and S3 key
  const documentId = uuidv4();
  const s3Key = `uploads/${userId}/${documentId}/original${getFileExtension(fileName)}`;

  // Create database record
  const insertQuery = `
    INSERT INTO documents (
      id,
      user_id,
      file_name,
      status,
      s3_key,
      file_size,
      content_type,
      uploaded_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    RETURNING id
  `;

  await pool.query(insertQuery, [
    documentId,
    userId,
    fileName,
    'uploaded',
    s3Key,
    fileSize,
    contentType,
  ]);

  // Generate presigned URL
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    ContentType: contentType,
    Metadata: {
      userId,
      documentId,
      fileName,
    },
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 minutes

  console.log('Created upload URL', { documentId, userId, fileName });

  return {
    documentId,
    uploadUrl,
    expiresIn: 900,
  };
}

/**
 * Delete document (soft delete or hard delete based on config)
 */
export async function deleteDocument(
  documentId: string,
  userId: string
): Promise<void> {
  // First, verify ownership
  const document = await getDocument(documentId, userId);

  // Delete from S3
  try {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: document.s3Key,
    });

    await s3Client.send(deleteCommand);
  } catch (error) {
    console.error('S3 delete error:', error);
    // Continue with database deletion even if S3 fails
  }

  // Delete from database (hard delete)
  const deleteQuery = `
    DELETE FROM documents
    WHERE id = $1 AND user_id = $2
  `;

  const result = await pool.query(deleteQuery, [documentId, userId]);

  if (result.rowCount === 0) {
    throw new Error('Document not found');
  }

  console.log('Deleted document', { documentId, userId });
}

/**
 * Trigger document processing via EventBridge
 * (Called by S3 upload completion trigger or manually)
 */
export async function triggerProcessing(documentId: string): Promise<void> {
  const event = {
    Source: 'custom.learningyogi',
    DetailType: 'Document Uploaded',
    Detail: JSON.stringify({
      documentId,
      timestamp: new Date().toISOString(),
    }),
  };

  const command = new PutEventsCommand({
    Entries: [event],
  });

  await eventBridgeClient.send(command);

  console.log('Triggered processing', { documentId });
}

/**
 * Helper: Map database row to Document type
 */
function mapRowToDocument(row: any): Document {
  return {
    id: row.id,
    userId: row.user_id,
    fileName: row.file_name,
    status: row.status,
    s3Key: row.s3_key,
    fileSize: row.file_size,
    contentType: row.content_type,
    confidence: row.confidence ? parseFloat(row.confidence) : undefined,
    uploadedAt: row.uploaded_at,
    completedAt: row.completed_at,
    errorMessage: row.error_message,
  };
}

/**
 * Helper: Get file extension from filename
 */
function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? `.${parts.pop()}` : '';
}

/**
 * Cleanup: Close database connections (for Lambda warm shutdown)
 */
export async function closeConnections(): Promise<void> {
  await pool.end();
}

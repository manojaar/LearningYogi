import axios from 'axios';
import type { UploadResponse, Document, TimetableRow, ProcessingStatus } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Upload a document for processing
 */
export async function uploadDocument(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<UploadResponse>('/api/v1/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

/**
 * Get document by ID
 */
export async function getDocument(id: string): Promise<Document> {
  const response = await api.get<Document>(`/api/v1/documents/${id}`);
  return response.data;
}

/**
 * Get all documents
 */
export async function getAllDocuments(limit: number = 20, offset: number = 0): Promise<Document[]> {
  const response = await api.get<Document[]>('/api/v1/documents', {
    params: { limit, offset },
  });
  return response.data;
}

/**
 * Get processing status for a document
 */
export async function getProcessingStatus(documentId: string): Promise<ProcessingStatus> {
  const doc = await getDocument(documentId);
  
  // Calculate progress based on status
  const progressMap: Record<string, number> = {
    uploaded: 20,
    processing: 50,
    processing_ai: 75,
    completed: 100,
    validation_failed: 100,
    failed: 100,
  };

  return {
    documentId,
    status: doc.status,
    stage: doc.status,
    progress: progressMap[doc.status] || 0,
  };
}

/**
 * Delete a document
 */
export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/api/v1/documents/${id}`);
}

/**
 * Get timetable data (mocked for now - will be implemented with actual endpoint)
 */
export async function getTimetable(documentId: string): Promise<TimetableRow | null> {
  try {
    const response = await api.get<TimetableRow>(`/api/v1/timetables/${documentId}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export default api;


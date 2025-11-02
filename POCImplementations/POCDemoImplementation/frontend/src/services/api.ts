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
export async function uploadDocument(file: File, sessionId?: string): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const headers: Record<string, string> = {
    'Content-Type': 'multipart/form-data',
  };

  if (sessionId) {
    headers['x-session-id'] = sessionId;
  }

  const response = await api.post<UploadResponse>('/api/v1/documents/upload', formData, {
    headers,
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
 * Get timetable data
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

/**
 * Update timetable data
 */
export async function updateTimetable(documentId: string, timetableData: {
  teacher_name?: string | null;
  class_name?: string | null;
  term?: string | null;
  year?: number | null;
  saved_name?: string | null;
  timeblocks: Array<{
    day: string;
    name: string;
    startTime?: string | null;
    endTime?: string | null;
    notes?: string | null;
  }>;
}): Promise<TimetableRow & { timeblocks: any }> {
  const response = await api.put<TimetableRow & { timeblocks: any }>(`/api/v1/timetables/${documentId}`, timetableData);
  return response.data;
}

/**
 * Get all timetables
 */
export async function getAllTimetables(limit: number = 50, offset: number = 0): Promise<(TimetableRow & { timeblocks: any })[]> {
  const response = await api.get<(TimetableRow & { timeblocks: any })[]>('/api/v1/timetables', {
    params: { limit, offset },
  });
  return response.data;
}

/**
 * Save timetable as a new entry with a user-defined name
 */
export async function saveTimetableAs(timetableData: {
  document_id?: string | null;
  teacher_name?: string | null;
  class_name?: string | null;
  term?: string | null;
  year?: number | null;
  saved_name: string;
  timeblocks: Array<{
    day: string;
    name: string;
    startTime?: string | null;
    endTime?: string | null;
    notes?: string | null;
  }>;
  confidence?: number;
}): Promise<TimetableRow & { timeblocks: any }> {
  const response = await api.post<TimetableRow & { timeblocks: any }>('/api/v1/timetables/save-as', timetableData);
  return response.data;
}

/**
 * Get available LLM providers
 */
export async function getLLMProviders(): Promise<{ providers: any[] }> {
  const response = await api.get('/api/v1/llm/providers');
  return response.data;
}

/**
 * Get current LLM settings for session
 */
export async function getLLMSettings(sessionId: string): Promise<any> {
  const response = await api.get('/api/v1/llm/settings', {
    headers: { 'x-session-id': sessionId },
  });
  return response.data;
}

/**
 * Set LLM settings for session
 */
export async function setLLMSettings(
  sessionId: string,
  provider: string,
  model?: string,
  apiKey?: string,
  timeout?: number
): Promise<any> {
  const response = await api.post(
    '/api/v1/llm/settings',
    { provider, model, apiKey, timeout, sessionId },
    {
      headers: { 'x-session-id': sessionId },
    }
  );
  return response.data;
}

/**
 * Validate API key
 */
export async function validateAPIKey(
  provider: string,
  apiKey: string,
  model?: string
): Promise<{ valid: boolean; error?: string }> {
  const response = await api.post('/api/v1/llm/validate', {
    provider,
    apiKey,
    model,
  });
  return response.data;
}

/**
 * Extend session TTL (activity-based)
 */
export async function extendSession(sessionId: string, timeout?: number): Promise<any> {
  const response = await api.post(
    '/api/v1/llm/extend-session',
    { timeout },
    {
      headers: { 'x-session-id': sessionId },
    }
  );
  return response.data;
}

/**
 * Check session status
 */
export async function checkSessionStatus(sessionId: string): Promise<{
  exists: boolean;
  provider?: string;
  model?: string;
  hasApiKey?: boolean;
  timeout?: number;
  message?: string;
}> {
  try {
    const response = await api.get('/api/v1/llm/session-status', {
      headers: { 'x-session-id': sessionId },
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return { exists: false, message: 'Session expired or not found' };
    }
    throw error;
  }
}

export default api;


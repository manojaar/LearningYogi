/**
 * Shared types for models and API
 */

export interface TimeBlock {
  day: string;
  name: string;
  startTime: string;  // HH:MM format
  endTime: string;    // HH:MM format
  notes?: string | null;
}

export interface TimetableData {
  teacher?: string | null;
  className?: string | null;
  term?: string | null;
  year?: number | null;
  timeblocks: TimeBlock[];
}

export interface ProcessingJob {
  id: string;
  documentId: string;
  jobType: 'ocr' | 'ai' | 'validation';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  confidence?: number;
  resultData?: any;
  errorMessage?: string;
  createdAt: string;
}


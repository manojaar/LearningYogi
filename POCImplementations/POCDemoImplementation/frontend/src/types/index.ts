/**
 * TypeScript types for the Learning Yogi frontend
 */

export interface TimeBlock {
  day: string;
  name: string;
  startTime?: string | null;  // HH:MM format (optional - AI may not extract)
  endTime?: string | null;    // HH:MM format (optional - AI may not extract)
  notes?: string | null;
}

export interface TimetableData {
  teacher?: string | null;
  className?: string | null;
  term?: string | null;
  year?: number | null;
  savedName?: string | null;  // User-defined name for saving timetable
  timeblocks: TimeBlock[];
}

export interface Document {
  id: string;
  filename: string;
  file_path: string;
  file_type: string;
  file_size: number;
  status: DocumentStatus;
  created_at: string;
}

export type DocumentStatus =
  | 'uploaded'
  | 'processing'
  | 'processing_ai'
  | 'completed'
  | 'validation_failed'
  | 'failed';

export interface ProcessingStatus {
  documentId: string;
  status: DocumentStatus;
  stage?: string;
  progress?: number;
  error?: string;
}

export interface TimetableRow {
  id: string;
  document_id: string;
  teacher_name: string | null;
  class_name: string | null;
  term: string | null;
  year: number | null;
  saved_name: string | null;  // User-defined name for saving timetable
  timeblocks: string | any[];  // JSON string or parsed array
  confidence: number;
  validated: boolean;
  created_at: string;
}

export interface UploadResponse {
  documentId: string;
  status: string;
}

export type ViewMode = 'weekly' | 'daily';

export interface SubjectColors {
  [key: string]: string;
}


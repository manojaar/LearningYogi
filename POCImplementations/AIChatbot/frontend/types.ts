/**
 * TypeScript types for chatbot
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ChatContext {
  document_id?: string;
  project?: string;
  user_id?: string;
  custom_data?: Record<string, any>;
}

export interface ChatRequest {
  message: string;
  session_id?: string;
  context?: ChatContext;
  provider?: 'claude' | 'openai' | 'local';
  stream?: boolean;
}

export interface ChatResponse {
  response: string;
  session_id: string;
  timestamp: string;
  provider: string;
  context_used?: Record<string, any>;
}

export interface ChatbotProps {
  apiUrl?: string;
  context?: ChatContext;
  defaultProvider?: 'claude' | 'openai' | 'local';
  onMessage?: (message: ChatMessage) => void;
  className?: string;
}


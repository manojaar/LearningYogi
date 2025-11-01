/**
 * Chatbot API service
 */

import axios from 'axios';

// Types for chatbot API
interface ChatContext {
  document_id?: string;
  project?: string;
  user_id?: string;
  custom_data?: Record<string, any>;
}

interface ChatRequest {
  message: string;
  session_id?: string;
  context?: ChatContext;
  provider?: 'claude' | 'openai' | 'local';
  stream?: boolean;
}

interface ChatResponse {
  response: string;
  session_id: string;
  timestamp: string;
  provider: string;
  context_used?: Record<string, any>;
}

const CHATBOT_API_URL = import.meta.env.VITE_CHATBOT_API_URL || 'http://localhost:9000';

const chatbotApi = axios.create({
  baseURL: CHATBOT_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Send a chat message
 */
export async function sendChatMessage(
  message: string,
  sessionId?: string,
  documentId?: string
): Promise<ChatResponse> {
  const request: ChatRequest = {
    message,
    session_id: sessionId,
    context: documentId ? { document_id: documentId } : undefined,
  };

  const response = await chatbotApi.post<ChatResponse>('/api/v1/chat', request);
  return response.data;
}

/**
 * Get chat session history
 */
export async function getChatHistory(sessionId: string) {
  const response = await chatbotApi.get(`/api/v1/chat/session/${sessionId}`);
  return response.data;
}

export default chatbotApi;
export type { ChatResponse };


import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, ChatRequest, ChatResponse, ChatContext } from '../types';

interface UseChatbotOptions {
  apiUrl?: string;
  context?: ChatContext;
  defaultProvider?: 'claude' | 'openai' | 'local';
}

export const useChatbot = (options: UseChatbotOptions = {}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const sessionIdRef = useRef<string | undefined>();

  const apiUrl = options.apiUrl || 'http://localhost:9000';
  const context = options.context;
  const defaultProvider = options.defaultProvider;

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isLoading) return;

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const request: ChatRequest = {
        message,
        session_id: sessionIdRef.current,
        context,
        provider: defaultProvider,
        stream: false
      };

      const response = await fetch(`${apiUrl}/api/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ChatResponse = await response.json();

      // Update session ID
      if (data.session_id) {
        sessionIdRef.current = data.session_id;
        setSessionId(data.session_id);
      }

      // Add assistant message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: data.timestamp
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, context, defaultProvider, isLoading]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    sessionIdRef.current = undefined;
    setSessionId(undefined);
  }, []);

  return {
    messages,
    isLoading,
    sessionId,
    sendMessage,
    clearMessages
  };
};


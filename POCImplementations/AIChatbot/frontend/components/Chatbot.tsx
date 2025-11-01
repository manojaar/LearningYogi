import React from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { useChatbot } from '../hooks/useChatbot';
import type { ChatbotProps } from '../types';

export const Chatbot: React.FC<ChatbotProps> = ({
  apiUrl = 'http://localhost:9000',
  context,
  defaultProvider,
  onMessage,
  className = ''
}) => {
  const { messages, isLoading, sendMessage, clearMessages } = useChatbot({
    apiUrl,
    context,
    defaultProvider
  });

  const handleSend = async (message: string) => {
    await sendMessage(message);
    
    // Call onMessage callback if provided
    if (onMessage && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        onMessage(lastMessage);
      }
    }
  };

  return (
    <div
      className={`flex flex-col bg-white rounded-lg shadow-lg border border-gray-200 ${className}`}
      style={{ height: '600px', maxHeight: '90vh' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-primary-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">AI</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">AI Assistant</h3>
            <p className="text-xs text-gray-500">Ask me anything about timetables</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <MessageList messages={messages} />

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
};


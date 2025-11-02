import React, { useState } from 'react';
import { Upload, Sparkles, CheckCircle2, MessageCircle, X } from 'lucide-react';
import { UploadZone } from '@/components/UploadZone';
import { Chatbot } from '@/components/Chatbot';
import { ProcessingNotification } from '@/components/ProcessingNotification';
import { LLMSelector } from '@/components/LLMSelector';
import { uploadDocument } from '@/services/api';
import { useLLM } from '@/context/LLMContext';

export const HomePage: React.FC = () => {
  const { sessionId, showSelector, setShowSelector } = useLLM();
  const [isUploading, setIsUploading] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [showChatbot, setShowChatbot] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  const handleFileSelect = async (file: File) => {
    setIsUploading(true);

    try {
      const result = await uploadDocument(file, sessionId);
      setDocumentId(result.documentId);
      setShowNotification(true);
      setIsUploading(false);
      
      // No redirect - user stays on page with notification
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file. Please try again.');
      setIsUploading(false);
    }
  };

  const handleNotificationClose = () => {
    setShowNotification(false);
    setDocumentId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50">
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center mb-12 space-y-6">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary-300 blur-3xl opacity-20 rounded-full" />
              <Sparkles className="w-16 h-16 text-primary-600 relative z-10" />
            </div>
          </div>

          <div className="space-y-4 animate-fade-in">
            <h1 className="text-5xl font-bold text-gray-900">
              Learning Yogi
            </h1>
            <p className="text-2xl text-gray-600 font-medium">
              Timetable Extraction Platform
            </p>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Transform your timetable images into structured, digital schedules with AI-powered OCR
            </p>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="animate-slide-up">
          <UploadZone onFileSelect={handleFileSelect} isUploading={isUploading} />
        </div>

        {/* Features */}
        <div className="max-w-4xl mx-auto mt-16 grid md:grid-cols-3 gap-6">
          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <Upload className="w-10 h-10 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Easy Upload</h3>
            <p className="text-gray-600 text-sm">
              Drag and drop your timetable or browse to upload. Supports PNG, JPG, and PDF.
            </p>
          </div>

          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <Sparkles className="w-10 h-10 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered</h3>
            <p className="text-gray-600 text-sm">
              Advanced OCR combined with Claude AI for accurate timetable extraction.
            </p>
          </div>

          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Instant Results</h3>
            <p className="text-gray-600 text-sm">
              Get structured, color-coded timetables in seconds. View weekly or daily.
            </p>
          </div>
        </div>

        {/* Chatbot Floating Button */}
        <button
          onClick={() => setShowChatbot(!showChatbot)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-all flex items-center justify-center z-50"
          aria-label="Toggle chatbot"
        >
          {showChatbot ? (
            <X className="w-6 h-6" />
          ) : (
            <MessageCircle className="w-6 h-6" />
          )}
        </button>

        {/* Chatbot Panel */}
        {showChatbot && (
          <div className="fixed bottom-24 right-6 w-96 z-40 shadow-2xl rounded-lg overflow-hidden">
            <Chatbot documentId={documentId || undefined} />
          </div>
        )}

        {/* Processing Notification */}
        {showNotification && documentId && (
          <ProcessingNotification
            documentId={documentId}
            onClose={handleNotificationClose}
          />
        )}

        {/* LLM Selector Modal */}
        {showSelector && (
          <LLMSelector onClose={() => setShowSelector(false)} />
        )}
      </div>
    </div>
  );
};


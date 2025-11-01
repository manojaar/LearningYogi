import React from 'react';
import { CheckCircle2, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import type { ProcessingStatus as ProcessingStatusType } from '@/types';

interface ProcessingStatusProps {
  status: ProcessingStatusType;
}

const STAGES = [
  { key: 'uploaded', label: 'Document Uploaded', icon: CheckCircle2 },
  { key: 'processing', label: 'OCR Processing', icon: Loader2 },
  { key: 'processing_ai', label: 'AI Extraction', icon: Sparkles },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
  { key: 'validation_failed', label: 'Validation Failed', icon: AlertCircle },
  { key: 'failed', label: 'Processing Failed', icon: AlertCircle },
];

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ status }) => {
  const getStageIndex = (stage: string): number => {
    return STAGES.findIndex(s => s.key === stage);
  };

  const currentStageIndex = getStageIndex(status.status);

  return (
    <div className="w-full max-w-4xl mx-auto card">
      <div className="space-y-6">
        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Processing Status</span>
            <span className="text-sm font-semibold text-primary-600">
              {status.progress}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-primary-500 to-primary-600 h-full transition-all duration-500 ease-out rounded-full"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        </div>

        {/* Stage Timeline */}
        <div className="relative">
          {/* Connection Line */}
          <div className="absolute top-6 left-0 right-0 h-0.5 bg-gray-200" />
          
          {/* Stages */}
          <div className="relative flex items-center justify-between">
            {STAGES.map((stage, index) => {
              const isCompleted = index < currentStageIndex;
              const isCurrent = index === currentStageIndex;
              const IconComponent = stage.icon;
              
              return (
                <div key={stage.key} className="flex flex-col items-center flex-1">
                  <div
                    className={`
                      relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-4 transition-all duration-300
                      ${isCompleted || isCurrent
                        ? 'bg-primary-600 border-primary-600'
                        : 'bg-white border-gray-300'
                      }
                    `}
                  >
                    <IconComponent
                      className={`
                        w-6 h-6 transition-colors duration-300
                        ${isCompleted || isCurrent ? 'text-white' : 'text-gray-400'}
                        ${isCurrent ? 'animate-pulse' : ''}
                      `}
                    />
                  </div>
                  <span
                    className={`
                      mt-2 text-xs font-medium text-center max-w-full truncate
                      ${isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-500'}
                    `}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Display */}
        {status.error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">Processing Error</p>
              <p className="text-sm text-red-700 mt-1">{status.error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


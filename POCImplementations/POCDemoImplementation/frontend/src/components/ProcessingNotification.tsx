import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X, Loader2 } from 'lucide-react';
import { useSSE } from '@/hooks/useSSE';
import { useNavigate } from 'react-router-dom';
import { TimetableTableWidget } from './TimetableTableWidget';
import type { TimetableData } from '@/types';

interface ProcessingNotificationProps {
  documentId: string;
  onClose?: () => void;
}

export const ProcessingNotification: React.FC<ProcessingNotificationProps> = ({
  documentId,
  onClose,
}) => {
  const navigate = useNavigate();
  const { event, isConnected, error: connectionError } = useSSE(documentId);
  const [show, setShow] = useState(true);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [timetableData, setTimetableData] = useState<TimetableData | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    if (event?.type === 'complete') {
      setHasCompleted(true);

      // Extract timetable data from SSE event
      if (event.timetableData) {
        const data: TimetableData = {
          teacher: event.timetableData.teacher ?? undefined,
          className: event.timetableData.className ?? undefined,
          term: event.timetableData.term ?? undefined,
          year: event.timetableData.year ?? undefined,
          timeblocks: event.timetableData.timeblocks || [],
        };
        setTimetableData(data);
        setShowTable(true);

        // Don't auto-dismiss when showing table - let user interact with it
      } else {
        // Auto-dismiss after 3 seconds if no timetable data
        const timer = setTimeout(() => {
          setShow(false);
          if (onClose) {
            onClose();
          }
        }, 3000);
        return () => clearTimeout(timer);
      }
    } else if (event?.type === 'error') {
      // Log error details to console for debugging
      console.error('Processing error received:', {
        documentId,
        error: event.error,
        event: event,
      });

      // On error, close notification and redirect to results page
      // Error details will be shown on ResultsPage only
      setShow(false);
      navigate(`/results/${documentId}`);
      if (onClose) {
        onClose();
      }
    } else if (event?.type === 'progress') {
      // Processing is in progress
      setHasCompleted(false);
    }
  }, [event, onClose, documentId, navigate]);

  // Determine status text based on event state (no error states)
  const getStatusText = () => {
    if (hasCompleted && event?.type === 'complete') return 'Completed';
    
    // Show progress states
    if (event?.type === 'progress') {
      return event.percentage === 100 ? 'Finalizing...' : 'In Progress...';
    }
    
    // Connection states
    if (!isConnected && !event) {
      return 'Connecting...';
    }
    if (!isConnected && event) {
      return 'Reconnecting...';
    }
    
    // Default: processing started but waiting for first progress event
    if (isConnected && !event) {
      return 'In Progress...';
    }
    
    // Connected and waiting
    return 'In Progress...';
  };

  const handleViewResults = () => {
    navigate(`/results/${documentId}`);
    setShow(false);
    if (onClose) {
      onClose();
    }
  };

  const handleClose = () => {
    setShow(false);
    if (onClose) {
      onClose();
    }
  };

  if (!show) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={`fixed bottom-6 right-6 bg-white shadow-xl rounded-lg z-50 border border-gray-200 transition-all duration-300 ${
          showTable 
            ? 'max-w-5xl w-[calc(100vw-3rem)] max-w-[1200px] p-4 md:p-6' 
            : 'max-w-md p-6'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                hasCompleted 
                  ? 'bg-green-500' 
                  : isConnected 
                  ? 'bg-green-500' 
                  : 'bg-red-500 animate-pulse'
              }`}
            />
            <span className="text-sm font-medium text-gray-700">
              {getStatusText()}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Connection Warning - Only show when not completed */}
        {connectionError && !hasCompleted && (
          <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            {connectionError}
            <span className="ml-2 text-xs text-yellow-700">(Processing continues in background)</span>
          </div>
        )}

        {/* Progress State */}
        {event?.type === 'progress' && (
          <>
            <div className="mb-2">
              <p className="text-sm font-medium text-gray-900">
                {event.step || 'Processing'}
              </p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <motion.div
                className="bg-blue-600 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${event.percentage || 0}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
            <p className="text-xs text-gray-500">
              {Math.round(event.percentage || 0)}% complete
            </p>
          </>
        )}

        {/* Success State */}
        {event?.type === 'complete' && hasCompleted && (
          <div className="space-y-4">
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="flex justify-center mb-3"
              >
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </motion.div>
              <p className="text-lg font-semibold text-gray-900 mb-3">
                Processing Complete!
              </p>
            </div>

            {/* Timetable Table Widget */}
            {showTable && timetableData && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="overflow-y-auto"
              >
                <TimetableTableWidget
                  timetable={timetableData}
                  confidence={event.timetableData?.confidence || 1.0}
                  onViewDetails={handleViewResults}
                />
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleViewResults}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                View Full Details →
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Loading/Initial State - Show when waiting for first event */}
        {!event && !hasCompleted && (
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <p className="text-sm text-gray-600">
              {isConnected ? 'Waiting for processing to start...' : 'Connecting to server...'}
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};


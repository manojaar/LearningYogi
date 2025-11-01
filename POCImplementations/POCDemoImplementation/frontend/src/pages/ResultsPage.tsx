import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Download } from 'lucide-react';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { TimetableViewer } from '@/components/TimetableViewer';
import { getDocument, getProcessingStatus, getTimetable } from '@/services/api';
import { useSSE } from '@/hooks/useSSE';
import type { Document, TimetableData, ProcessingStatus as ProcessingStatusType } from '@/types';

export const ResultsPage: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<Document | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatusType | null>(null);
  const [timetableData, setTimetableData] = useState<TimetableData | null>(null);
  const [confidence, setConfidence] = useState<number>(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use SSE for real-time updates
  const { event: sseEvent } = useSSE(documentId || null);

  useEffect(() => {
    if (!documentId) {
      setError('No document ID provided');
      setIsLoading(false);
      return;
    }

    loadDocument();
  }, [documentId]);

  // Handle SSE events
  useEffect(() => {
    if (!sseEvent || !documentId) return;

    if (sseEvent.type === 'complete') {
      // Reload document and timetable
      loadDocument().then(() => {
        loadTimetable();
      });
    } else if (sseEvent.type === 'error') {
      setError(sseEvent.error || 'Processing failed');
      setIsLoading(false);
    } else if (sseEvent.type === 'progress') {
      // Update processing status display
      const currentStatus = doc?.status || 'processing';
      const updatedStatus: ProcessingStatusType = {
        documentId,
        status: currentStatus as any,
        stage: sseEvent.step,
        progress: sseEvent.percentage || 0,
      };
      setProcessingStatus(updatedStatus);
    }
  }, [sseEvent, documentId, doc]);

  const loadDocument = async () => {
    if (!documentId) return;

    try {
      const docData = await getDocument(documentId);
      setDoc(docData);

      const status = await getProcessingStatus(documentId);
      setProcessingStatus(status);

      // No polling needed - SSE will handle updates
      if (docData.status === 'completed') {
        // Load timetable data
        await loadTimetable();
        setIsLoading(false);
      } else if (docData.status === 'failed' || docData.status === 'validation_failed') {
        setIsLoading(false);
      } else {
        // Still processing - SSE will handle updates
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Failed to load document:', err);
      setError('Failed to load document');
      setIsLoading(false);
    }
  };

  const loadTimetable = async () => {
    if (!documentId) return;

    try {
      const timetableRow = await getTimetable(documentId);
      if (timetableRow) {
        // Parse timeblocks JSON
        const timeblocks = JSON.parse(timetableRow.timeblocks);
        
        const data: TimetableData = {
          teacher: timetableRow.teacher_name,
          className: timetableRow.class_name,
          term: timetableRow.term,
          year: timetableRow.year,
          timeblocks
        };
        
        setTimetableData(data);
        setConfidence(timetableRow.confidence);
      }
    } catch (err) {
      console.error('Failed to load timetable:', err);
    }
  };


  const handleExportCSV = () => {
    if (!timetableData) return;

    const csvContent = [
      'Day,Subject,Start Time,End Time,Notes',
      ...timetableData.timeblocks.map(block => 
        `"${block.day}","${block.name}","${block.startTime}","${block.endTime}","${block.notes || ''}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timetable-${documentId}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    if (!timetableData) return;

    const jsonContent = JSON.stringify(timetableData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timetable-${documentId}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-16 h-16 text-primary-600 animate-spin mx-auto" />
          <p className="text-gray-600">Loading your timetable...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full card">
          <div className="flex flex-col items-center text-center space-y-4">
            <AlertCircle className="w-16 h-16 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900">{error}</h2>
            <button
              onClick={() => navigate('/')}
              className="btn-primary"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!doc || !processingStatus) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Upload</span>
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Timetable Results
              </h1>
              <p className="text-gray-600 mt-1">
                {doc.filename}
              </p>
            </div>

            {timetableData && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportCSV}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                <button
                  onClick={handleExportJSON}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export JSON
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Processing Status or Results */}
        {doc.status !== 'completed' ? (
          <ProcessingStatus status={processingStatus} />
        ) : timetableData ? (
          <div className="space-y-8">
            <TimetableViewer timetable={timetableData} confidence={confidence} />
          </div>
        ) : (
          <div className="card text-center py-12">
            <p className="text-gray-600">
              Timetable data will appear here once processing is complete.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};


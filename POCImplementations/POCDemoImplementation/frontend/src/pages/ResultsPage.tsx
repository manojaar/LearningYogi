import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Download, BookOpen } from 'lucide-react';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { TimetableViewer } from '@/components/TimetableViewer';
import { getDocument, getProcessingStatus, getTimetable, getAllTimetables } from '@/services/api';
import { useSSE } from '@/hooks/useSSE';
import type { Document, TimetableData, ProcessingStatus as ProcessingStatusType, TimetableRow } from '@/types';

export const ResultsPage: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<Document | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatusType | null>(null);
  const [timetableData, setTimetableData] = useState<TimetableData | null>(null);
  const [confidence, setConfidence] = useState<number>(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'saved'>('current');
  const [savedTimetables, setSavedTimetables] = useState<(TimetableRow & { timeblocks: any })[]>([]);
  const [selectedSavedTimetable, setSelectedSavedTimetable] = useState<(TimetableRow & { timeblocks: any }) | null>(null);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);

  // Use SSE for real-time updates
  const { event: sseEvent } = useSSE(documentId || null);

  const loadSavedTimetables = useCallback(async () => {
    setIsLoadingSaved(true);
    try {
      const timetables = await getAllTimetables(50, 0);
      // Filter out timetables that have saved_name (saved timetables) or show all
      setSavedTimetables(timetables);
    } catch (err) {
      console.error('Failed to load saved timetables:', err);
    } finally {
      setIsLoadingSaved(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'saved') {
      loadSavedTimetables();
    }
  }, [activeTab, loadSavedTimetables]);

  const loadTimetable = useCallback(async () => {
    if (!documentId) {
      console.warn('loadTimetable: No documentId provided');
      return;
    }

    try {
      console.log(`📥 Loading timetable for document: ${documentId}`);
      const timetableRow = await getTimetable(documentId);

      console.log('📥 getTimetable API response:', timetableRow);

      if (timetableRow) {
        console.log('✅ Timetable data received:', timetableRow);
        console.log('   - teacher_name:', timetableRow.teacher_name);
        console.log('   - class_name:', timetableRow.class_name);
        console.log('   - timeblocks (raw):', timetableRow.timeblocks);
        console.log('   - timeblocks type:', typeof timetableRow.timeblocks);

        // Parse timeblocks JSON (if it's a string, otherwise use as-is)
        const timeblocks = typeof timetableRow.timeblocks === 'string'
          ? JSON.parse(timetableRow.timeblocks)
          : timetableRow.timeblocks;
        console.log('   - timeblocks (parsed):', timeblocks);
        console.log('   - timeblocks length:', timeblocks.length);

        const data: TimetableData = {
          teacher: timetableRow.teacher_name,
          className: timetableRow.class_name,
          term: timetableRow.term,
          year: timetableRow.year,
          savedName: timetableRow.saved_name,
          timeblocks
        };

        console.log('✅ Setting timetable data:', data);
        setTimetableData(data);
        setConfidence(timetableRow.confidence);
        console.log('✅ Timetable data and confidence set successfully');
      } else {
        console.warn('⚠️ No timetable data found for document:', documentId);
        console.warn('   getTimetable returned:', timetableRow);
      }
    } catch (err) {
      console.error('❌ Failed to load timetable:', err);
      console.error('   Error details:', {
        name: (err as Error).name,
        message: (err as Error).message,
        stack: (err as Error).stack,
      });
    }
  }, [documentId]);

  const loadDocument = useCallback(async () => {
    if (!documentId) return;

    try {
      console.log(`Loading document: ${documentId}`);
      const docData = await getDocument(documentId);
      setDoc(docData);
      console.log(`Document status: ${docData.status}`);

      const status = await getProcessingStatus(documentId);
      setProcessingStatus(status);

      // No polling needed - SSE will handle updates
      if (docData.status === 'completed') {
        console.log('Document is completed, loading timetable...');
        // Load timetable data - this is critical when navigating directly to a completed document
        await loadTimetable();
        setIsLoading(false);
        console.log('Timetable loaded successfully');
      } else if (docData.status === 'failed' || docData.status === 'validation_failed') {
        console.log(`Document processing failed with status: ${docData.status}`);
        setIsLoading(false);
      } else {
        // Still processing - SSE will handle updates
        // Set loading to false to show processing status
        console.log('Document still processing, waiting for SSE updates...');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Failed to load document:', err);
      setError('Failed to load document');
      setIsLoading(false);
    }
  }, [documentId, loadTimetable]);

  useEffect(() => {
    if (!documentId) {
      setError('No document ID provided');
      setIsLoading(false);
      return;
    }

    loadDocument();
  }, [documentId, loadDocument]);

  // Handle SSE events
  useEffect(() => {
    if (!sseEvent || !documentId) return;

    console.log('SSE event received:', sseEvent.type);

    if (sseEvent.type === 'complete') {
      console.log('Processing complete event received');
      // Use timetableData from SSE event immediately if available
      // This ensures data shows up right away when navigating from notification
      if (sseEvent.timetableData) {
        console.log('Setting timetable data from SSE event');
        const data: TimetableData = {
          teacher: sseEvent.timetableData.teacher ?? undefined,
          className: sseEvent.timetableData.className ?? undefined,
          term: sseEvent.timetableData.term ?? undefined,
          year: sseEvent.timetableData.year ?? undefined,
          savedName: sseEvent.timetableData.savedName ?? undefined,
          timeblocks: sseEvent.timetableData.timeblocks || [],
        };
        setTimetableData(data);
        if (sseEvent.timetableData.confidence) {
          setConfidence(sseEvent.timetableData.confidence);
        }
        setIsLoading(false);
      }

      // Reload document and timetable from API to get latest state
      // This ensures consistency and handles any edits that may have occurred
      console.log('Reloading document and timetable from API...');
      loadDocument().then(() => {
        // Always reload timetable to get authoritative data from DB
        // This overwrites SSE data if there are differences (e.g., after edits)
        loadTimetable();
      });
    } else if (sseEvent.type === 'error') {
      // Log error details to console for debugging
      console.error('Processing error received:', {
        documentId,
        error: sseEvent.error,
        errorDetails: sseEvent.errorDetails,
        event: sseEvent,
      });

      // Save error message and details for display
      if (sseEvent.error) {
        let fullError = sseEvent.error;

        // Append error details if available
        if (sseEvent.errorDetails) {
          const details = sseEvent.errorDetails;
          fullError += `\n\n📋 Details:\n`;
          if (details.provider) fullError += `Provider: ${details.provider}\n`;
          if (details.model) fullError += `Model: ${details.model}\n`;
          if (details.step) fullError += `Failed at: ${details.step}\n`;
          if (details.hint) fullError += `\n💡 Hint: ${details.hint}`;
        }

        setProcessingError(fullError);
      }

      // On error, reload document to get latest status
      // This will show the error on the ResultsPage
      loadDocument().then(() => {
        setIsLoading(false);
      });
    } else if (sseEvent.type === 'progress') {
      // Update processing status display
      const updatedStatus: ProcessingStatusType = {
        documentId,
        status: 'processing' as any,
        stage: sseEvent.step,
        progress: sseEvent.percentage || 0,
      };
      setProcessingStatus(updatedStatus);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sseEvent, documentId]);


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
        {doc.status === 'failed' || doc.status === 'validation_failed' ? (
          <div className="card">
            <div className="flex flex-col items-center text-center space-y-4 py-8">
              <AlertCircle className="w-16 h-16 text-red-500" />
              <h2 className="text-2xl font-bold text-gray-900">
                {doc.status === 'validation_failed' ? 'Validation Failed' : 'Processing Failed'}
              </h2>
              <p className="text-gray-600 max-w-md">
                {doc.status === 'validation_failed'
                  ? 'The timetable data extracted from the document did not pass validation checks. Please check the document and try again.'
                  : 'An error occurred while processing the timetable. Please try uploading the document again.'}
              </p>
              {processingError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg max-w-2xl">
                  <p className="text-sm font-semibold text-red-900 mb-2">Error Details:</p>
                  <p className="text-sm text-red-800 font-mono text-left whitespace-pre-wrap break-words">
                    {processingError}
                  </p>
                </div>
              )}
              <button
                onClick={() => navigate('/')}
                className="btn-primary mt-4"
              >
                Upload New Document
              </button>
            </div>
          </div>
        ) : doc.status !== 'completed' ? (
          <ProcessingStatus status={processingStatus} />
        ) : timetableData ? (
          <div className="space-y-8">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
              <nav className="flex gap-4">
                <button
                  onClick={() => setActiveTab('current')}
                  className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === 'current'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Current Timetable
                </button>
                <button
                  onClick={() => setActiveTab('saved')}
                  className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'saved'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  Saved Timetables
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'current' ? (
              <TimetableViewer 
                timetable={timetableData} 
                confidence={confidence}
                documentId={documentId}
                onUpdate={(updated) => {
                  setTimetableData(updated);
                  // Reload timetable to get latest from server
                  loadTimetable();
                }}
              />
            ) : (
              <div className="space-y-4">
                {isLoadingSaved ? (
                  <div className="card text-center py-12">
                    <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Loading saved timetables...</p>
                  </div>
                ) : savedTimetables.length === 0 ? (
                  <div className="card text-center py-12">
                    <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No saved timetables found.</p>
                    <p className="text-sm text-gray-500 mt-2">Use "Save As" to save timetables with a custom name.</p>
                  </div>
                ) : selectedSavedTimetable ? (
                  <div className="space-y-4">
                    <button
                      onClick={() => setSelectedSavedTimetable(null)}
                      className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span className="font-medium">Back to Saved Timetables</span>
                    </button>
                    <TimetableViewer 
                      timetable={{
                        teacher: selectedSavedTimetable.teacher_name ?? undefined,
                        className: selectedSavedTimetable.class_name ?? undefined,
                        term: selectedSavedTimetable.term ?? undefined,
                        year: selectedSavedTimetable.year ?? undefined,
                        savedName: selectedSavedTimetable.saved_name ?? undefined,
                        timeblocks: Array.isArray(selectedSavedTimetable.timeblocks) 
                          ? selectedSavedTimetable.timeblocks 
                          : [],
                      }}
                      confidence={selectedSavedTimetable.confidence}
                      documentId={selectedSavedTimetable.document_id}
                      isSavedTimetable={true}
                      onUpdate={async () => {
                        // Reload saved timetables after update
                        await loadSavedTimetables();
                      }}
                    />
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {savedTimetables.map((timetable) => {
                      const timeblocks = Array.isArray(timetable.timeblocks) 
                        ? timetable.timeblocks 
                        : [];
                      
                      return (
                        <div
                          key={timetable.id}
                          onClick={() => setSelectedSavedTimetable(timetable)}
                          className="card cursor-pointer hover:shadow-lg transition-shadow"
                        >
                          <div className="space-y-3">
                            <div>
                              <h3 className="font-semibold text-lg text-gray-900">
                                {timetable.saved_name || 'Unnamed Timetable'}
                              </h3>
                              {timetable.teacher_name && (
                                <p className="text-sm text-gray-600 mt-1">
                                  Teacher: {timetable.teacher_name}
                                </p>
                              )}
                              {timetable.class_name && (
                                <p className="text-sm text-gray-600">
                                  Class: {timetable.class_name}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>{timeblocks.length} timeblocks</span>
                              <span>
                                {new Date(timetable.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
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


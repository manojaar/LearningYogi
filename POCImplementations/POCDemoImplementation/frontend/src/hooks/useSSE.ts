import { useEffect, useState, useRef } from 'react';

export interface ProcessingEvent {
  type: 'progress' | 'complete' | 'error' | 'connected';
  step?: string;
  percentage?: number;
  result?: any;
  timetableData?: {
    teacher?: string | null;
    className?: string | null;
    term?: string | null;
    year?: number | null;
    timeblocks: Array<{
      day: string;
      name: string;
      startTime: string;
      endTime: string;
      notes?: string | null;
    }>;
    confidence?: number;
    validated?: boolean;
  };
  error?: string;
  documentId?: string;
}

interface UseSSEReturn {
  event: ProcessingEvent | null;
  isConnected: boolean;
  error: string | null;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * React hook for connecting to Server-Sent Events
 * @param documentId - Document ID to listen for events
 * @returns SSE event data, connection status, and error
 */
export function useSSE(documentId: string | null): UseSSEReturn {
  const [event, setEvent] = useState<ProcessingEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!documentId) {
      return;
    }

    // Create EventSource connection
    const eventSource = new EventSource(
      `${API_BASE_URL}/api/v1/events/${documentId}`
    );
    eventSourceRef.current = eventSource;

    // Handle connection open
    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    // Handle incoming messages
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as ProcessingEvent;
        setEvent(data);
        
        // Update connection status based on event type
        if (data.type === 'connected') {
          setIsConnected(true);
        }
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
        setError('Failed to parse event data');
      }
    };

    // Handle errors
    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      setIsConnected(false);
      setError('Connection error. Attempting to reconnect...');
      
      // EventSource will automatically attempt to reconnect
    };

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
      setEvent(null);
    };
  }, [documentId]);

  return { event, isConnected, error };
}


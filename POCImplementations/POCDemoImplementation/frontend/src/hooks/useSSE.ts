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
    savedName?: string | null;
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
  errorDetails?: {
    provider?: string;
    model?: string;
    step?: string;
    hint?: string;
  };
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
  const eventRef = useRef<ProcessingEvent | null>(null);
  const connectedRef = useRef<boolean>(false);

  // Keep refs in sync with state
  useEffect(() => {
    eventRef.current = event;
    connectedRef.current = isConnected;
  }, [event, isConnected]);

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
      connectedRef.current = true;
    };

    // Handle incoming messages
    eventSource.onmessage = (e) => {
      try {
        // Ignore heartbeat messages
        if (e.data.trim() === ': heartbeat' || e.data.trim().startsWith(': ')) {
          return;
        }

        const data = JSON.parse(e.data) as ProcessingEvent;
        setEvent(data);
        eventRef.current = data;
        setError(null); // Clear any connection errors when we receive an event

        // Update connection status based on event type
        if (data.type === 'connected') {
          setIsConnected(true);
          connectedRef.current = true;
        } else if (data.type === 'error') {
          // This is an actual processing error from the server
          setIsConnected(true); // Connection is fine, but processing failed
          connectedRef.current = true;

          // Close connection after receiving error (terminal state)
          console.log('Processing error received, closing SSE connection');
          setTimeout(() => {
            if (eventSourceRef.current) {
              eventSourceRef.current.close();
              eventSourceRef.current = null;
              setIsConnected(false);
              connectedRef.current = false;
            }
          }, 500); // Small delay to ensure state updates
        } else if (data.type === 'complete') {
          setIsConnected(true);
          connectedRef.current = true;

          // Close connection after receiving completion (terminal state)
          console.log('Processing complete, closing SSE connection');
          setTimeout(() => {
            if (eventSourceRef.current) {
              eventSourceRef.current.close();
              eventSourceRef.current = null;
              setIsConnected(false);
              connectedRef.current = false;
            }
          }, 500); // Small delay to ensure state updates
        } else if (data.type === 'progress') {
          setIsConnected(true);
          connectedRef.current = true;
        }
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
        // Only set error if we can't parse - but don't treat as fatal processing error
        // This is a connection/parsing issue, not a processing failure
        if (!eventRef.current) {
          setError('Failed to parse event data');
        }
      }
    };

    // Handle errors
    eventSource.onerror = () => {
      const currentEvent = eventRef.current;
      const currentConnected = connectedRef.current;
      
      // EventSource.onerror fires during various states - we need to be careful
      // It's NOT a processing error - only server-sent 'error' events indicate that
      
      if (eventSource.readyState === EventSource.CLOSED) {
        // Connection closed - might be temporary
        setIsConnected(false);
        connectedRef.current = false;
        // Only show error if we had a connection and were receiving events
        if (currentConnected && currentEvent && currentEvent.type !== 'error' && currentEvent.type !== 'complete') {
          setError('Connection lost. Attempting to reconnect...');
        }
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        // Reconnecting - this is normal, don't set error
        setIsConnected(false);
        connectedRef.current = false;
        // Only set error if this is initial connection attempt and we have no events
        if (!currentConnected && !currentEvent) {
          setError('Connection error. Attempting to reconnect...');
        } else {
          setError(null); // Clear any previous errors during reconnect
        }
      }
      
      // Note: We don't treat EventSource.onerror as a processing failure
      // Only actual error events from the server (type: 'error') indicate processing failure
      // Connection errors are temporary and EventSource will auto-reconnect
    };

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
      setEvent(null);
      connectedRef.current = false;
      eventRef.current = null;
    };
  }, [documentId]);

  return { event, isConnected, error };
}


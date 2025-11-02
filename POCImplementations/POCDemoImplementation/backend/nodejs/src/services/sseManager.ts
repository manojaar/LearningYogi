import { Response } from 'express';

export interface ProcessingEvent {
  type: 'progress' | 'complete' | 'error' | 'connected';
  step?: string;
  percentage?: number;
  result?: any;
  timetableData?: any; // Full timetable data for complete events
  error?: string;
  errorDetails?: {
    provider?: string;
    model?: string;
    step?: string;
    hint?: string;
  };
  documentId?: string;
}

/**
 * Server-Sent Events Manager
 * Manages SSE connections for real-time progress updates
 */
export class SSEManager {
  private clients: Map<string, Set<Response>> = new Map();

  /**
   * Add a client connection for a document
   */
  addClient(documentId: string, res: Response): void {
    if (!this.clients.has(documentId)) {
      this.clients.set(documentId, new Set());
    }
    this.clients.get(documentId)!.add(res);
  }

  /**
   * Remove a client connection
   */
  removeClient(documentId: string, res: Response): void {
    const clients = this.clients.get(documentId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        this.clients.delete(documentId);
      }
    }
  }

  /**
   * Emit an event to all clients for a document
   */
  emit(documentId: string, event: ProcessingEvent): void {
    const clients = this.clients.get(documentId);
    if (!clients || clients.size === 0) {
      return;
    }

    const data = JSON.stringify(event);
    const message = `data: ${data}\n\n`;

    // Send to all clients, remove dead connections
    const deadConnections: Response[] = [];

    clients.forEach((client) => {
      try {
        client.write(message);
      } catch (error) {
        // Connection is dead, mark for removal
        deadConnections.push(client);
      }
    });

    // Remove dead connections
    deadConnections.forEach((deadClient) => {
      this.removeClient(documentId, deadClient);
    });

    // Close all connections after terminal events (complete or error)
    if (event.type === 'complete' || event.type === 'error') {
      // Schedule connection closure after a brief delay to ensure event delivery
      setTimeout(() => {
        this.closeAllConnections(documentId);
      }, 1000); // 1 second delay
    }
  }

  /**
   * Close all connections for a document
   */
  closeAllConnections(documentId: string): void {
    const clients = this.clients.get(documentId);
    if (!clients || clients.size === 0) {
      return;
    }

    console.log(`Closing ${clients.size} SSE connection(s) for document ${documentId}`);

    // Close all client connections
    clients.forEach((client) => {
      try {
        client.end();
      } catch (error) {
        console.warn(`Failed to close SSE connection for document ${documentId}:`, error);
      }
    });

    // Clear the clients set
    this.clients.delete(documentId);
  }

  /**
   * Get number of active clients for a document
   */
  getClientCount(documentId: string): number {
    return this.clients.get(documentId)?.size || 0;
  }

  /**
   * Get total number of active connections
   */
  getTotalConnections(): number {
    let total = 0;
    this.clients.forEach((clients) => {
      total += clients.size;
    });
    return total;
  }
}

// Singleton instance
export const sseManager = new SSEManager();


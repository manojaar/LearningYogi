import { Response } from 'express';

export interface ProcessingEvent {
  type: 'progress' | 'complete' | 'error' | 'connected';
  step?: string;
  percentage?: number;
  result?: any;
  timetableData?: any; // Full timetable data for complete events
  error?: string;
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


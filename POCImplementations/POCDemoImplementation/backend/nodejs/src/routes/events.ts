import express, { Router, Request, Response } from 'express';
import { sseManager } from '../services/sseManager';

/**
 * Create SSE events router
 */
export function createEventsRouter(): Router {
  const router = Router();

  /**
   * Server-Sent Events endpoint for real-time progress updates
   * GET /api/v1/events/:documentId
   */
  router.get('/:documentId', (req: Request, res: Response) => {
    const { documentId } = req.params;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Register client
    sseManager.addClient(documentId, res);

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ 
      type: 'connected',
      documentId 
    })}\n\n`);

    // Handle client disconnect
    req.on('close', () => {
      sseManager.removeClient(documentId, res);
      res.end();
    });

    // Keep connection alive with heartbeat
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch (error) {
        clearInterval(heartbeatInterval);
        sseManager.removeClient(documentId, res);
        res.end();
      }
    }, 30000); // Every 30 seconds

    // Cleanup on close
    req.on('close', () => {
      clearInterval(heartbeatInterval);
    });
  });

  return router;
}


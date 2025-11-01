import express from 'express';
import { DocumentService } from '../services/document.service';
import { TimetableModel } from '../models/Timetable';

/**
 * Create routes with service instances
 */
export function createTimetablesRouter(documentService: DocumentService, timetableModel: TimetableModel) {
  const router = express.Router();

  /**
   * Get timetable by document ID
   */
  router.get('/:documentId', async (req, res) => {
    try {
      const timetable = timetableModel.getByDocumentId(req.params.documentId);
      if (!timetable) {
        return res.status(404).json({ error: 'Timetable not found' });
      }

      // Parse timeblocks JSON
      const timeblocks = JSON.parse(timetable.timeblocks);

      res.json({
        ...timetable,
        timeblocks
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Get all timetables
   */
  router.get('/', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const timetables = timetableModel.getAll(limit, offset);
      
      // Parse timeblocks JSON for each timetable
      const parsedTimetables = timetables.map(t => ({
        ...t,
        timeblocks: JSON.parse(t.timeblocks)
      }));

      res.json(parsedTimetables);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}


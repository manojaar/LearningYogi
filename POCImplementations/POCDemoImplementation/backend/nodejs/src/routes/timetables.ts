import express from 'express';
import { DocumentService } from '../services/document.service';
import { TimetableModel } from '../models/Timetable';
import { CacheService } from '../services/cache.service';
import { formatApiError } from '../services/errorFormatter';

/**
 * Create routes with service instances
 */
export function createTimetablesRouter(
  documentService: DocumentService,
  timetableModel: TimetableModel,
  cacheService?: CacheService
) {
  const router = express.Router();

  /**
   * Get timetable by document ID (Cache Read-Through)
   */
  router.get('/:documentId', async (req, res) => {
    try {
      const documentId = req.params.documentId;
      const cacheKey = `timetable:${documentId}`;

      // Read-Through: Check cache first
      if (cacheService?.isAvailable()) {
        const cachedData = await cacheService.get<any>(cacheKey);
        if (cachedData) {
          return res.json(cachedData);
        }
      }

      // Cache miss: Read from database
      const timetable = timetableModel.getByDocumentId(documentId);
      if (!timetable) {
        return res.status(404).json(formatApiError({ message: 'Timetable not found' }, 404));
      }

      // Parse timeblocks JSON
      const timeblocks = JSON.parse(timetable.timeblocks);
      const responseData = {
        ...timetable,
        timeblocks
      };

      // Write-Through: Populate cache
      if (cacheService?.isAvailable()) {
        await cacheService.set(cacheKey, responseData);
      }

      res.json(responseData);
    } catch (error: any) {
      res.status(500).json(formatApiError(error, 500));
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
      res.status(500).json(formatApiError(error, 500));
    }
  });

  /**
   * Update timetable by document ID (Cache Write-Through)
   */
  router.put('/:documentId', async (req, res) => {
    try {
      const documentId = req.params.documentId;
      const { teacher_name, class_name, term, year, saved_name, timeblocks } = req.body;

      // Validate required fields
      if (!timeblocks || !Array.isArray(timeblocks)) {
        return res.status(400).json(formatApiError({ 
          message: 'timeblocks is required and must be an array' 
        }, 400));
      }

      // Write-Through: Update database first
      const updated = timetableModel.update(documentId, {
        teacher_name: teacher_name ?? null,
        class_name: class_name ?? null,
        term: term ?? null,
        year: year ?? null,
        saved_name: saved_name ?? null,
        timeblocks: JSON.stringify(timeblocks),
      });

      if (!updated) {
        return res.status(404).json(formatApiError({ 
          message: 'Timetable not found' 
        }, 404));
      }

      // Prepare response data
      const responseData = {
        ...updated,
        timeblocks: JSON.parse(updated.timeblocks)
      };

      // Write-Through: Invalidate old cache and write new data
      const cacheKey = `timetable:${documentId}`;
      if (cacheService?.isAvailable()) {
        // Delete old cache entry
        await cacheService.delete(cacheKey);
        // Write new data to cache
        await cacheService.set(cacheKey, responseData);
      }

      res.json(responseData);
    } catch (error: any) {
      res.status(500).json(formatApiError(error, 500));
    }
  });

  /**
   * Save timetable as a new entry (Save As functionality)
   * Creates a copy of an existing timetable with a new saved_name
   */
  router.post('/save-as', async (req, res) => {
    try {
      const { document_id, teacher_name, class_name, term, year, saved_name, timeblocks, confidence } = req.body;

      // Validate required fields
      if (!saved_name || !saved_name.trim()) {
        return res.status(400).json(formatApiError({ 
          message: 'saved_name is required' 
        }, 400));
      }

      if (!timeblocks || !Array.isArray(timeblocks)) {
        return res.status(400).json(formatApiError({ 
          message: 'timeblocks is required and must be an array' 
        }, 400));
      }

      // Generate new ID for the saved timetable
      const { randomUUID } = require('crypto');
      const newId = randomUUID();

      // Create new timetable entry
      const newTimetable = await timetableModel.create({
        id: newId,
        document_id: document_id || null,
        teacher_name: teacher_name ?? null,
        class_name: class_name ?? null,
        term: term ?? null,
        year: year ?? null,
        saved_name: saved_name.trim(),
        timeblocks: JSON.stringify(timeblocks),
        confidence: confidence ?? 1.0,
        validated: false,
      });

      // Parse timeblocks for response
      const responseData = {
        ...newTimetable,
        timeblocks: JSON.parse(newTimetable.timeblocks)
      };

      res.status(201).json(responseData);
    } catch (error: any) {
      res.status(500).json(formatApiError(error, 500));
    }
  });

  return router;
}


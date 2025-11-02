import Database from 'better-sqlite3';
import { TimeBlock } from './types';

export interface TimetableRow {
  id: string;
  document_id: string;
  teacher_name: string | null;
  class_name: string | null;
  term: string | null;
  year: number | null;
  saved_name: string | null;  // User-defined name for saving timetable
  timeblocks: string;  // JSON string
  confidence: number;
  validated: boolean;
  created_at: string;
}

export class TimetableModel {
  constructor(private db: Database.Database) {}

  async create(timetable: Omit<TimetableRow, 'created_at'>): Promise<TimetableRow> {
    const stmt = this.db.prepare(`
      INSERT INTO timetables 
      (id, document_id, teacher_name, class_name, term, year, saved_name, timeblocks, confidence, validated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      timetable.id,
      timetable.document_id,
      timetable.teacher_name,
      timetable.class_name,
      timetable.term,
      timetable.year,
      timetable.saved_name ?? null,
      timetable.timeblocks,
      timetable.confidence,
      timetable.validated ? 1 : 0
    );

    return this.getById(timetable.id);
  }

  getById(id: string): TimetableRow {
    const stmt = this.db.prepare('SELECT * FROM timetables WHERE id = ?');
    return stmt.get(id) as TimetableRow;
  }

  getByDocumentId(documentId: string): TimetableRow | null {
    const stmt = this.db.prepare('SELECT * FROM timetables WHERE document_id = ? LIMIT 1');
    const result = stmt.get(documentId);
    return result ? (result as TimetableRow) : null;
  }

  getAll(limit: number = 20, offset: number = 0): TimetableRow[] {
    const stmt = this.db.prepare('SELECT * FROM timetables ORDER BY created_at DESC LIMIT ? OFFSET ?');
    return stmt.all(limit, offset) as TimetableRow[];
  }

  updateValidated(id: string, validated: boolean): void {
    const stmt = this.db.prepare('UPDATE timetables SET validated = ? WHERE id = ?');
    stmt.run(validated ? 1 : 0, id);
  }

  /**
   * Update timetable data
   */
  update(documentId: string, updates: {
    teacher_name?: string | null;
    class_name?: string | null;
    term?: string | null;
    year?: number | null;
    saved_name?: string | null;
    timeblocks?: string;
  }): TimetableRow | null {
    const timetable = this.getByDocumentId(documentId);
    if (!timetable) return null;

    const updatesList: string[] = [];
    const values: any[] = [];

    if (updates.teacher_name !== undefined) {
      updatesList.push('teacher_name = ?');
      values.push(updates.teacher_name);
    }
    if (updates.class_name !== undefined) {
      updatesList.push('class_name = ?');
      values.push(updates.class_name);
    }
    if (updates.term !== undefined) {
      updatesList.push('term = ?');
      values.push(updates.term);
    }
    if (updates.year !== undefined) {
      updatesList.push('year = ?');
      values.push(updates.year);
    }
    if (updates.saved_name !== undefined) {
      updatesList.push('saved_name = ?');
      values.push(updates.saved_name);
    }
    if (updates.timeblocks !== undefined) {
      updatesList.push('timeblocks = ?');
      values.push(updates.timeblocks);
    }

    if (updatesList.length === 0) {
      return timetable;
    }

    values.push(documentId);
    const sql = `UPDATE timetables SET ${updatesList.join(', ')} WHERE document_id = ?`;
    const stmt = this.db.prepare(sql);
    stmt.run(...values);

    return this.getByDocumentId(documentId);
  }
}


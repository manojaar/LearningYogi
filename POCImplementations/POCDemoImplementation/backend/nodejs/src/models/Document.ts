import Database from 'better-sqlite3';

export interface DocumentRow {
  id: string;
  filename: string;
  file_path: string;
  file_type: string;
  file_size: number;
  status: string;
  created_at: string;
}

export class DocumentModel {
  constructor(private db: Database.Database) {}

  async create(doc: Omit<DocumentRow, 'created_at'>): Promise<DocumentRow> {
    const stmt = this.db.prepare(`
      INSERT INTO documents (id, filename, file_path, file_type, file_size, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      doc.id,
      doc.filename,
      doc.file_path,
      doc.file_type,
      doc.file_size,
      doc.status
    );

    return this.getById(doc.id);
  }

  getById(id: string): DocumentRow {
    const stmt = this.db.prepare('SELECT * FROM documents WHERE id = ?');
    return stmt.get(id) as DocumentRow;
  }

  getAll(limit: number = 20, offset: number = 0): DocumentRow[] {
    const stmt = this.db.prepare('SELECT * FROM documents ORDER BY created_at DESC LIMIT ? OFFSET ?');
    return stmt.all(limit, offset) as DocumentRow[];
  }

  updateStatus(id: string, status: string): void {
    const stmt = this.db.prepare('UPDATE documents SET status = ? WHERE id = ?');
    stmt.run(status, id);
  }

  delete(id: string): void {
    const stmt = this.db.prepare('DELETE FROM documents WHERE id = ?');
    stmt.run(id);
  }
}


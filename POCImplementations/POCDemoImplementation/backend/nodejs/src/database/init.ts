import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Initialize SQLite database with schema
 */
export function initializeDatabase(dbPath: string): Database.Database {
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Open database
  const db = new Database(dbPath);

  // Read and execute schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  
  db.exec(schema);

  return db;
}

/**
 * Create database instance
 */
export function createDatabase(dbPath?: string): Database.Database {
  const defaultPath = dbPath || path.join(
    __dirname, 
    '../../../../data/database/app.db'
  );
  
  return initializeDatabase(defaultPath);
}


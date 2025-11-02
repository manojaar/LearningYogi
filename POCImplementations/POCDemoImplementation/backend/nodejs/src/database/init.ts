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

  // Run migrations for existing databases
  migrateDatabase(db);

  return db;
}

/**
 * Run database migrations
 */
function migrateDatabase(db: Database.Database): void {
  try {
    // Check if saved_name column exists in timetables table
    const tableInfo = db.prepare(`PRAGMA table_info(timetables)`).all() as Array<{ name: string }>;
    const hasSavedName = tableInfo.some(col => col.name === 'saved_name');
    
    if (!hasSavedName) {
      console.log('Adding saved_name column to timetables table...');
      db.exec(`ALTER TABLE timetables ADD COLUMN saved_name TEXT`);
      console.log('Migration completed: saved_name column added');
    }
  } catch (error) {
    console.error('Migration error:', error);
    // Continue execution even if migration fails
  }
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


import { DatabaseSync } from 'node:sqlite';

// Uses Node's built-in SQLite so the MVP needs no database install.
// Swap for PostgreSQL + PostGIS when real geographic queries are needed.
export function openDb(path = process.env.DB_PATH || 'data.db') {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT NOT NULL CHECK (role IN ('farmer', 'buyer', 'admin')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS otps (
      phone TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS plots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      state TEXT NOT NULL,
      district TEXT NOT NULL,
      village TEXT,
      survey_number TEXT,
      area_acres REAL NOT NULL,
      soil_type TEXT,
      water_source TEXT,
      crops TEXT NOT NULL,
      expected_harvest TEXT,
      expected_quantity_qtl REAL,
      boundary TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plot_id INTEGER NOT NULL REFERENCES plots(id),
      buyer_id INTEGER NOT NULL REFERENCES users(id),
      message TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

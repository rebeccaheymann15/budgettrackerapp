const Database = require('better-sqlite3');
const path = require('path');

let db = null;

function getDb() {
  if (db) return db;

  try {
    // Use /tmp for Vercel's ephemeral storage
    const dbPath = '/tmp/dev.db';
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');

    // Initialize tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS weeklySnapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week TEXT UNIQUE NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshotId INTEGER NOT NULL,
        oppId TEXT NOT NULL,
        account TEXT,
        opportunityName TEXT,
        projectName TEXT,
        projectManager TEXT,
        coa TEXT,
        status TEXT,
        financialStatus TEXT,
        scopeStatus TEXT,
        qualityStatus TEXT,
        resourcesStatus TEXT,
        scheduleStatus TEXT,
        clientStatus TEXT,
        eacMarginPercent REAL,
        odeMarginPercent REAL,
        varianceMarginPt REAL,
        eacRevenue REAL,
        odeRevenue REAL,
        eacCost REAL,
        pmStatusSummary TEXT,
        leadCommentary TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (snapshotId) REFERENCES weeklySnapshots(id) ON DELETE CASCADE,
        UNIQUE(snapshotId, oppId)
      );

      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshotId INTEGER UNIQUE NOT NULL,
        totalProjects INTEGER,
        greenCount INTEGER,
        yellowCount INTEGER,
        redCount INTEGER,
        noStatusCount INTEGER,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (snapshotId) REFERENCES weeklySnapshots(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_projects_snapshot ON projects(snapshotId);
      CREATE INDEX IF NOT EXISTS idx_projects_account ON projects(account);
      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    `);
  } catch (err) {
    console.error('Database init error:', err);
  }

  return db;
}

module.exports = { getDb };

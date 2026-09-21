const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (pool) return pool;

  // Get connection string from Vercel environment
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable not set');
  }

  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  return pool;
}

async function initDb() {
  const client = await getPool().connect();
  try {
    // Legacy tables (keep for existing functionality)
    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_snapshots (
        id SERIAL PRIMARY KEY,
        week DATE NOT NULL,
        is_final BOOLEAN DEFAULT false,
        uploaded_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE weekly_snapshots
      ADD COLUMN IF NOT EXISTS is_final BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP DEFAULT NOW();
    `);

    await client.query(`
      ALTER TABLE weekly_snapshots
      DROP CONSTRAINT IF EXISTS weekly_snapshots_week_key;
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_final_per_week ON weekly_snapshots(week) WHERE is_final = true;

      CREATE TABLE IF NOT EXISTS projects_legacy (
        id SERIAL PRIMARY KEY,
        snapshot_id INTEGER NOT NULL REFERENCES weekly_snapshots(id) ON DELETE CASCADE,
        opp_id TEXT NOT NULL,
        account TEXT,
        opportunity_name TEXT,
        project_name TEXT,
        project_manager TEXT,
        coa TEXT,
        status TEXT,
        financial_status TEXT,
        scope_status TEXT,
        quality_status TEXT,
        resources_status TEXT,
        schedule_status TEXT,
        client_status TEXT,
        eac_margin_percent FLOAT,
        ode_margin_percent FLOAT,
        variance_margin_pt FLOAT,
        eac_revenue FLOAT,
        ode_revenue FLOAT,
        eac_cost FLOAT,
        pm_status_summary TEXT,
        lead_commentary TEXT,
        column_ah TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(snapshot_id, opp_id)
      );

      CREATE TABLE IF NOT EXISTS metrics (
        id SERIAL PRIMARY KEY,
        snapshot_id INTEGER UNIQUE NOT NULL REFERENCES weekly_snapshots(id) ON DELETE CASCADE,
        total_projects INTEGER,
        green_count INTEGER,
        yellow_count INTEGER,
        red_count INTEGER,
        no_status_count INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_projects_snapshot ON projects_legacy(snapshot_id);
      CREATE INDEX IF NOT EXISTS idx_projects_account ON projects_legacy(account);
      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects_legacy(status);
    `);

    // New MVP tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS pm_projects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        client TEXT,
        project_manager TEXT NOT NULL,
        sow_value NUMERIC(12,2),
        billing_type TEXT DEFAULT 'Fixed Price',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS project_members (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
        pm_email TEXT NOT NULL,
        role TEXT DEFAULT 'editor',
        added_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(project_id, pm_email)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS excel_files (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL UNIQUE REFERENCES pm_projects(id) ON DELETE CASCADE,
        file_content BYTEA NOT NULL,
        last_updated_by TEXT,
        last_updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_project_members_email ON project_members(pm_email);
      CREATE INDEX IF NOT EXISTS idx_excel_files_project ON excel_files(project_id);
    `);

    console.log('Database tables initialized');
  } catch (err) {
    console.error('Database init error:', err);
  } finally {
    client.release();
  }
}

module.exports = { getPool, initDb };

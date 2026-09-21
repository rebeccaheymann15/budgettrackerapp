const { getPool, initDb } = require('./_pgdb');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { slug } = req.query;
  const pathname = Array.isArray(slug) ? slug.join('/') : slug || '';

  try {
    await initDb();

    // Route: POST /api/auth/verify
    if (pathname === 'auth/verify' && req.method === 'POST') {
      return handleAuthVerify(req, res);
    }

    // Route: GET /api/snapshots or POST
    if (pathname === 'snapshots' && (req.method === 'GET' || req.method === 'POST')) {
      return handleSnapshots(req, res, req.method);
    }

    // Route: GET /api/snapshots/list
    if (pathname === 'snapshots/list' && req.method === 'GET') {
      return handleSnapshotsList(req, res);
    }

    // Route: GET /api/project/[oppId]
    if (pathname.startsWith('project/') && req.method === 'GET') {
      const oppId = pathname.split('/')[1];
      return handleGetProject(req, res, oppId);
    }

    // Route: POST /api/upload
    if (pathname === 'upload' && req.method === 'POST') {
      return handleUpload(req, res);
    }

    // Route: GET /api/summary/current
    if (pathname === 'summary/current' && req.method === 'GET') {
      return handleSummaryCurrent(req, res);
    }

    // Route: GET /api/trends
    if (pathname === 'trends' && req.method === 'GET') {
      return handleTrends(req, res);
    }

    // Route: POST /api/lock-snapshot
    if (pathname === 'lock-snapshot' && req.method === 'POST') {
      return handleLockSnapshot(req, res);
    }

    return res.status(404).json({ error: 'Endpoint not found' });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: err.message });
  }
};

async function handleAuthVerify(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  return res.status(200).json({
    success: true,
    email,
    verified: true,
  });
}

async function handleSnapshots(req, res, method) {
  let client;

  try {
    client = await getPool().connect();

    if (method === 'GET') {
      const result = await client.query(`
        SELECT id, week, is_final, uploaded_at, created_at
        FROM weekly_snapshots
        ORDER BY week DESC
        LIMIT 50
      `);

      return res.status(200).json({
        success: true,
        snapshots: result.rows,
      });
    }

    if (method === 'POST') {
      const { week, is_final } = req.body;

      if (!week) {
        return res.status(400).json({ error: 'Week is required' });
      }

      const result = await client.query(`
        INSERT INTO weekly_snapshots (week, is_final)
        VALUES ($1, $2)
        ON CONFLICT (week) DO UPDATE SET is_final = $2
        RETURNING id, week, is_final, uploaded_at
      `, [week, is_final || false]);

      return res.status(201).json({
        success: true,
        snapshot: result.rows[0],
      });
    }
  } catch (err) {
    console.error('Snapshots error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
}

async function handleSnapshotsList(req, res) {
  let client;

  try {
    client = await getPool().connect();

    const result = await client.query(`
      SELECT id, week, is_final, uploaded_at, created_at
      FROM weekly_snapshots
      WHERE is_final = true
      ORDER BY week DESC
    `);

    return res.status(200).json({
      success: true,
      snapshots: result.rows,
    });
  } catch (err) {
    console.error('Snapshots list error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
}

async function handleGetProject(req, res, oppId) {
  let client;

  try {
    client = await getPool().connect();

    const result = await client.query(`
      SELECT * FROM projects_legacy
      WHERE opp_id = $1
      LIMIT 1
    `, [oppId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.status(200).json({
      success: true,
      project: result.rows[0],
    });
  } catch (err) {
    console.error('Get project error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
}

async function handleUpload(req, res) {
  let client;

  try {
    // TODO: Implement Excel upload handler
    return res.status(200).json({
      success: true,
      message: 'Upload endpoint - to be implemented',
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
}

async function handleSummaryCurrent(req, res) {
  let client;

  try {
    client = await getPool().connect();

    const result = await client.query(`
      SELECT
        ws.id,
        ws.week,
        ws.is_final,
        m.total_projects,
        m.green_count,
        m.yellow_count,
        m.red_count,
        m.no_status_count
      FROM weekly_snapshots ws
      LEFT JOIN metrics m ON ws.id = m.snapshot_id
      WHERE ws.is_final = true
      ORDER BY ws.week DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No current summary available' });
    }

    return res.status(200).json({
      success: true,
      summary: result.rows[0],
    });
  } catch (err) {
    console.error('Summary current error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
}

async function handleTrends(req, res) {
  let client;

  try {
    client = await getPool().connect();

    const result = await client.query(`
      SELECT
        ws.week,
        m.total_projects,
        m.green_count,
        m.yellow_count,
        m.red_count,
        m.no_status_count
      FROM weekly_snapshots ws
      LEFT JOIN metrics m ON ws.id = m.snapshot_id
      WHERE ws.is_final = true
      ORDER BY ws.week DESC
      LIMIT 52
    `);

    return res.status(200).json({
      success: true,
      trends: result.rows,
    });
  } catch (err) {
    console.error('Trends error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
}

async function handleLockSnapshot(req, res) {
  let client;

  try {
    const { snapshotId } = req.body;

    if (!snapshotId) {
      return res.status(400).json({ error: 'Snapshot ID is required' });
    }

    client = await getPool().connect();

    const result = await client.query(`
      UPDATE weekly_snapshots
      SET is_final = true
      WHERE id = $1
      RETURNING id, week, is_final
    `, [snapshotId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    return res.status(200).json({
      success: true,
      snapshot: result.rows[0],
    });
  } catch (err) {
    console.error('Lock snapshot error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
}

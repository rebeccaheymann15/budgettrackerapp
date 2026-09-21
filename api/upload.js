const Busboy = require('busboy');
const { writeFileSync, unlinkSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');
const { parseExcelFile, calculateMetrics } = require('./_utils');
const { getPool, initDb } = require('./_pgdb');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  try {
    // Initialize DB
    await initDb();

    const bb = Busboy({ headers: req.headers });
    let fileBuffer = null;

    await new Promise((resolve, reject) => {
      bb.on('file', (fieldname, file, info) => {
        const chunks = [];
        file.on('data', data => chunks.push(data));
        file.on('end', () => {
          fileBuffer = Buffer.concat(chunks);
        });
      });

      bb.on('close', resolve);
      bb.on('error', reject);

      req.pipe(bb);
    });

    if (!fileBuffer) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Write to temp file
    const tempFile = join(tmpdir(), `upload_${Date.now()}.xlsx`);
    writeFileSync(tempFile, fileBuffer);

    const projects = parseExcelFile(tempFile);
    const week = new Date();
    week.setHours(0, 0, 0, 0);
    const weekStr = week.toISOString().split('T')[0];

    client = await getPool().connect();
    await client.query('BEGIN');

    try {
      // Delete any existing data for this week to allow re-uploads
      const existingSnapshot = await client.query(
        'SELECT id FROM weekly_snapshots WHERE week = $1',
        [weekStr]
      );

      console.log(`[DEBUG] Checking week ${weekStr}, found ${existingSnapshot.rows.length} snapshots`);

      if (existingSnapshot.rows.length > 0) {
        const oldSnapshotId = existingSnapshot.rows[0].id;
        console.log(`[DEBUG] Deleting old snapshot ${oldSnapshotId}`);
        // Delete related data first
        const metricsDelete = await client.query('DELETE FROM metrics WHERE snapshot_id = $1', [oldSnapshotId]);
        console.log(`[DEBUG] Deleted ${metricsDelete.rowCount} metrics rows`);
        const projectsDelete = await client.query('DELETE FROM projects WHERE snapshot_id = $1', [oldSnapshotId]);
        console.log(`[DEBUG] Deleted ${projectsDelete.rowCount} project rows`);
        const snapshotDelete = await client.query('DELETE FROM weekly_snapshots WHERE id = $1', [oldSnapshotId]);
        console.log(`[DEBUG] Deleted ${snapshotDelete.rowCount} snapshot rows`);
      }

      // Create new snapshot for this upload
      const result = await client.query(
        'INSERT INTO weekly_snapshots (week, is_final) VALUES ($1, false) RETURNING id',
        [weekStr]
      );
      const snapshotId = result.rows[0].id;

      // Insert projects
      for (const p of projects) {
        await client.query(
          `INSERT INTO projects (
            snapshot_id, opp_id, account, opportunity_name, project_name, project_manager, coa,
            status, financial_status, scope_status, quality_status, resources_status, schedule_status, client_status,
            eac_margin_percent, ode_margin_percent, variance_margin_pt, eac_revenue, ode_revenue, eac_cost,
            pm_status_summary, lead_commentary, column_ah
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
          [
            snapshotId, p.oppId, p.account, p.opportunityName, p.projectName, p.projectManager, p.coa,
            p.status, p.financialStatus, p.scopeStatus, p.qualityStatus, p.resourcesStatus, p.scheduleStatus, p.clientStatus,
            p.eacMarginPercent, p.odeMarginPercent, p.varianceMarginPt, p.eacRevenue, p.odeRevenue, p.eacCost,
            p.pmStatusSummary, p.leadCommentary, p.columnAH,
          ]
        );
      }

      // Calculate and store metrics
      const metrics = calculateMetrics(projects);
      await client.query(
        `INSERT INTO metrics (snapshot_id, total_projects, green_count, yellow_count, red_count, no_status_count)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (snapshot_id) DO UPDATE SET
         total_projects = $2, green_count = $3, yellow_count = $4, red_count = $5, no_status_count = $6`,
        [snapshotId, metrics.totalProjects, metrics.greenCount, metrics.yellowCount, metrics.redCount, metrics.noStatusCount]
      );

      await client.query('COMMIT');

      // Cleanup
      unlinkSync(tempFile);

      return res.status(200).json({
        success: true,
        message: 'Upload successful',
        week: weekStr,
        metrics,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
};

const { getPool, initDb } = require('../_pgdb');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { oppId } = req.query;

  let client;
  try {
    await initDb();
    client = await getPool().connect();

    const projects = await client.query(
      `SELECT p.*, w.week FROM projects p
       JOIN weekly_snapshots w ON p.snapshot_id = w.id
       WHERE p.opp_id = $1
       ORDER BY w.week ASC`,
      [oppId]
    );

    const projectsData = projects.rows.map(p => ({
      ...p,
      eacMarginPercent: p.eac_margin_percent,
      odeMarginPercent: p.ode_margin_percent,
      projectName: p.project_name,
      projectManager: p.project_manager,
      financialStatus: p.financial_status,
      scopeStatus: p.scope_status,
      qualityStatus: p.quality_status,
      resourcesStatus: p.resources_status,
      scheduleStatus: p.schedule_status,
      clientStatus: p.client_status,
      pmStatusSummary: p.pm_status_summary,
      columnAH: p.column_ah,
    }));

    return res.status(200).json(projectsData);
  } catch (err) {
    console.error('Project history error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
};

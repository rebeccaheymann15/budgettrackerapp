const { getPool, initDb } = require('../_pgdb');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let client;
  try {
    await initDb();
    client = await getPool().connect();

    const snapshot = await client.query(
      'SELECT * FROM weekly_snapshots ORDER BY uploaded_at DESC LIMIT 1'
    );

    if (snapshot.rows.length === 0) {
      return res.status(200).json(null);
    }

    const snapshotId = snapshot.rows[0].id;

    const [projects, metric] = await Promise.all([
      client.query('SELECT * FROM projects WHERE snapshot_id = $1', [snapshotId]),
      client.query('SELECT * FROM metrics WHERE snapshot_id = $1', [snapshotId]),
    ]);

    const projectsData = projects.rows.map(p => {
      const eacMargin = p.eac_margin_percent;
      const odeMargin = p.ode_margin_percent;
      const variance = (eacMargin !== null && odeMargin !== null) ? (eacMargin - odeMargin) : null;

      return {
        ...p,
        eacMarginPercent: eacMargin,
        odeMarginPercent: odeMargin,
        marginVariance: variance,
        eacRevenue: p.eac_revenue,
        odeRevenue: p.ode_revenue,
        eacCost: p.eac_cost,
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
      };
    });

    const metricData = metric.rows[0] ? {
      greenCount: metric.rows[0].green_count,
      yellowCount: metric.rows[0].yellow_count,
      redCount: metric.rows[0].red_count,
      totalProjects: metric.rows[0].total_projects,
      noStatusCount: metric.rows[0].no_status_count,
    } : null;

    return res.status(200).json({
      week: snapshot.rows[0].week,
      metrics: metricData,
      redProjects: projectsData.filter(p => p.status === 'Red'),
      yellowProjects: projectsData.filter(p => p.status === 'Yellow'),
      greenProjects: projectsData.filter(p => p.status === 'Green'),
      allProjects: projectsData,
    });
  } catch (err) {
    console.error('Summary error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
};

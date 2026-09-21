const { getPool, initDb } = require('./_pgdb');

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

    // Get all final snapshots ordered by week
    const finalSnapshots = await client.query(
      'SELECT * FROM weekly_snapshots WHERE is_final = true ORDER BY week ASC'
    );

    // Also get the most recent snapshot (even if not final) for trend comparison
    const latestSnapshot = await client.query(
      'SELECT * FROM weekly_snapshots ORDER BY uploaded_at DESC LIMIT 1'
    );

    // Combine: final snapshots + latest if it's not already in final list
    let snapshots = { rows: finalSnapshots.rows };
    if (latestSnapshot.rows.length > 0) {
      const latest = latestSnapshot.rows[0];
      const alreadyIncluded = finalSnapshots.rows.some(s => s.id === latest.id);
      if (!alreadyIncluded) {
        snapshots.rows.push(latest);
      }
      // Sort by week (treating latest specially if needed)
      snapshots.rows.sort((a, b) => new Date(a.week) - new Date(b.week));
    }

    const trends = [];

    for (const snapshot of snapshots.rows) {
      const [projects, metric] = await Promise.all([
        client.query('SELECT * FROM projects WHERE snapshot_id = $1', [snapshot.id]),
        client.query('SELECT * FROM metrics WHERE snapshot_id = $1', [snapshot.id]),
      ]);

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

      const metricData = metric.rows[0];

      trends.push({
        week: snapshot.week,
        metrics: metricData,
        statusCounts: {
          green: metricData?.green_count || 0,
          yellow: metricData?.yellow_count || 0,
          red: metricData?.red_count || 0,
          total: metricData?.total_projects || 0,
        },
        redProjects: projectsData.filter(p => p.status === 'Red'),
        yellowProjects: projectsData.filter(p => p.status === 'Yellow'),
      });
    }

    return res.status(200).json(trends);
  } catch (err) {
    console.error('Trends error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
};

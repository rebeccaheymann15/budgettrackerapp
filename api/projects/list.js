const { getPool, initDb } = require('../_pgdb');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  try {
    await initDb();

    const pmEmail = req.headers['x-pm-email'];
    if (!pmEmail) {
      return res.status(400).json({ error: 'Missing x-pm-email header' });
    }

    client = await getPool().connect();

    const result = await client.query(`
      SELECT
        p.id,
        p.name,
        p.client,
        p.project_manager,
        p.sow_value,
        p.billing_type,
        p.created_at,
        p.updated_at
      FROM pm_projects p
      INNER JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.pm_email = $1
      ORDER BY p.created_at DESC
    `, [pmEmail]);

    return res.status(200).json({
      success: true,
      projects: result.rows,
    });
  } catch (err) {
    console.error('List projects error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
};

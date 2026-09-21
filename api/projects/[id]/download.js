const { getPool, initDb } = require('../../_pgdb');

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

    const { id: projectId } = req.query;
    const pmEmail = req.headers['x-pm-email'];

    if (!projectId || !pmEmail) {
      return res.status(400).json({ error: 'Missing projectId or pm_email' });
    }

    client = await getPool().connect();

    const result = await client.query(`
      SELECT p.name, e.file_content
      FROM excel_files e
      INNER JOIN pm_projects p ON e.project_id = p.id
      INNER JOIN project_members pm ON p.id = pm.project_id
      WHERE e.project_id = $1 AND pm.pm_email = $2
    `, [projectId, pmEmail]);

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Project not found or access denied' });
    }

    const { name, file_content } = result.rows[0];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${name}_${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.setHeader('Content-Length', file_content.length);

    return res.status(200).end(file_content);
  } catch (err) {
    console.error('Download error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
};

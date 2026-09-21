const { getPool, initDb } = require('../../_pgdb');
const { extractSummaryData } = require('../../_excel-utils');
const { writeFileSync, unlinkSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

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
  let tempFile;
  try {
    await initDb();

    const { id: projectId } = req.query;
    const pmEmail = req.headers['x-pm-email'];

    if (!projectId || !pmEmail) {
      return res.status(400).json({ error: 'Missing projectId or pm_email' });
    }

    client = await getPool().connect();

    // Verify access
    const projectResult = await client.query(`
      SELECT p.name, p.client, e.file_content
      FROM pm_projects p
      INNER JOIN excel_files e ON p.id = e.project_id
      INNER JOIN project_members pm ON p.id = pm.project_id
      WHERE p.id = $1 AND pm.pm_email = $2
    `, [projectId, pmEmail]);

    if (projectResult.rows.length === 0) {
      return res.status(403).json({ error: 'Project not found or access denied' });
    }

    const { name, client: clientName, file_content } = projectResult.rows[0];

    // Write Excel to temp file
    tempFile = join(tmpdir(), `summary_${projectId}_${Date.now()}.xlsx`);
    writeFileSync(tempFile, file_content);

    // Extract summary
    const summary = extractSummaryData(tempFile);

    return res.status(200).json({
      success: true,
      projectName: name,
      clientName,
      summary,
    });
  } catch (err) {
    console.error('Summary error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (tempFile && require('fs').existsSync(tempFile)) unlinkSync(tempFile);
    if (client) client.release();
  }
};

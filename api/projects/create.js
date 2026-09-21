const Busboy = require('busboy');
const { getPool, initDb } = require('../_pgdb');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  try {
    await initDb();

    const pmEmail = req.headers['x-pm-email'];
    if (!pmEmail) {
      return res.status(400).json({ error: 'Missing x-pm-email header' });
    }

    // Parse multipart form
    const bb = Busboy({ headers: req.headers });
    let projectName, clientName, sowValue, billingType;
    let excelBuffer = null;

    await new Promise((resolve, reject) => {
      bb.on('field', (fieldname, val) => {
        if (fieldname === 'projectName') projectName = val;
        if (fieldname === 'clientName') clientName = val;
        if (fieldname === 'sowValue') sowValue = parseFloat(val);
        if (fieldname === 'billingType') billingType = val || 'Fixed Price';
      });

      bb.on('file', (fieldname, file) => {
        if (fieldname === 'excelFile') {
          const chunks = [];
          file.on('data', data => chunks.push(data));
          file.on('end', () => {
            excelBuffer = Buffer.concat(chunks);
          });
        }
      });

      bb.on('close', resolve);
      bb.on('error', reject);
      req.pipe(bb);
    });

    if (!projectName || !excelBuffer) {
      return res.status(400).json({ error: 'Missing projectName or Excel file' });
    }

    client = await getPool().connect();
    await client.query('BEGIN');

    try {
      // Create project
      const projectResult = await client.query(`
        INSERT INTO pm_projects (name, client, project_manager, sow_value, billing_type)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [projectName, clientName, pmEmail, sowValue, billingType]);

      const projectId = projectResult.rows[0].id;

      // Add PM as member
      await client.query(`
        INSERT INTO project_members (project_id, pm_email, role)
        VALUES ($1, $2, 'editor')
      `, [projectId, pmEmail]);

      // Store Excel file
      await client.query(`
        INSERT INTO excel_files (project_id, file_content, last_updated_by)
        VALUES ($1, $2, $3)
      `, [projectId, excelBuffer, pmEmail]);

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        projectId,
        message: 'Project created successfully',
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('Create project error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
};

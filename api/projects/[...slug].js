const Busboy = require('busboy');
const XLSX = require('xlsx');
const { getPool, initDb } = require('../_pgdb');
const { extractSummaryData, injectCsvData } = require('../_excel-utils');
const { writeFileSync, unlinkSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { slug } = req.query;
  const path = Array.isArray(slug) ? slug.join('/') : slug || '';
  const pmEmail = req.headers['x-pm-email'];

  let client;
  let tempFile;

  try {
    await initDb();

    // Route: GET /api/projects or GET /api/projects/list (list all projects for PM)
    if ((path === '' || path === 'list') && req.method === 'GET') {
      return handleListProjects(req, res, pmEmail, client);
    }

    // Route: POST /api/projects (create new project)
    if (path === '' && req.method === 'POST') {
      return handleCreateProject(req, res, pmEmail, client);
    }

    // Route: POST /api/projects/generate (generate new Excel workbook)
    if (path === 'generate' && req.method === 'POST') {
      return handleGenerateProject(req, res, pmEmail, client);
    }

    // Route: GET /api/projects/[id]/summary (get project summary)
    if (path.match(/^\d+\/summary$/) && req.method === 'GET') {
      const projectId = path.split('/')[0];
      return handleGetSummary(req, res, pmEmail, projectId, client);
    }

    // Route: GET /api/projects/[id]/download (download Excel)
    if (path.match(/^\d+\/download$/) && req.method === 'GET') {
      const projectId = path.split('/')[0];
      return handleDownloadExcel(req, res, pmEmail, projectId, client);
    }

    // Route: POST /api/projects/[id]/csv-upload (upload CSV)
    if (path.match(/^\d+\/csv-upload$/) && req.method === 'POST') {
      const projectId = path.split('/')[0];
      return handleCsvUpload(req, res, pmEmail, projectId, client);
    }

    // Route: POST /api/projects/[id]/workplan-update (update workplan via chat)
    if (path.match(/^\d+\/workplan-update$/) && req.method === 'POST') {
      const projectId = path.split('/')[0];
      return handleWorkplanUpdate(req, res, pmEmail, projectId, client);
    }

    return res.status(404).json({ error: 'Endpoint not found' });
  } catch (err) {
    console.error('Projects API error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (tempFile) {
      try { unlinkSync(tempFile); } catch (e) {}
    }
    if (client) client.release();
  }
};

async function handleListProjects(req, res, pmEmail, client) {
  if (!pmEmail) {
    return res.status(400).json({ error: 'Missing x-pm-email header' });
  }

  let dbClient;
  try {
    dbClient = await getPool().connect();
    const result = await dbClient.query(`
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
    if (dbClient) dbClient.release();
  }
}

async function handleCreateProject(req, res, pmEmail, client) {
  if (!pmEmail) {
    return res.status(400).json({ error: 'Missing x-pm-email header' });
  }

  if (typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const { name, client: clientName, sow_value, billing_type } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  let dbClient;
  try {
    dbClient = await getPool().connect();
    const result = await dbClient.query(`
      INSERT INTO pm_projects (name, client, project_manager, sow_value, billing_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, client, project_manager, sow_value, billing_type, created_at
    `, [name, clientName || null, pmEmail, sow_value || null, billing_type || 'Fixed Price']);

    const project = result.rows[0];

    // Add PM as member
    await dbClient.query(`
      INSERT INTO project_members (project_id, pm_email, role)
      VALUES ($1, $2, 'editor')
    `, [project.id, pmEmail]);

    return res.status(201).json({
      success: true,
      project,
    });
  } catch (err) {
    console.error('Create project error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (dbClient) dbClient.release();
  }
}

async function handleGenerateProject(req, res, pmEmail, client) {
  if (!pmEmail) {
    return res.status(400).json({ error: 'Missing x-pm-email header' });
  }

  let dbClient;
  let tempFile;

  try {
    const bb = Busboy({ headers: req.headers });
    let dataJson = null;
    let baselineBuffer = null;

    await new Promise((resolve, reject) => {
      bb.on('field', (fieldname, val) => {
        if (fieldname === 'data') {
          try {
            dataJson = JSON.parse(val);
          } catch (e) {
            reject(e);
          }
        }
      });

      bb.on('file', (fieldname, file) => {
        if (fieldname === 'baseline') {
          const chunks = [];
          file.on('data', data => chunks.push(data));
          file.on('end', () => {
            baselineBuffer = Buffer.concat(chunks);
          });
        }
      });

      bb.on('close', resolve);
      bb.on('error', reject);
    });

    req.pipe(bb);

    if (!dataJson) {
      return res.status(400).json({ error: 'Missing project data' });
    }

    // Create Excel workbook
    const workbook = XLSX.utils.book_new();

    // ND Setup sheet
    const setupData = [
      ['Field', 'Value'],
      ['Project Name', dataJson.projectName || ''],
      ['Client', dataJson.client || ''],
      ['Start Date', dataJson.startDate || ''],
      ['End Date', dataJson.endDate || ''],
      ['SOW Value', dataJson.sowValue || ''],
      ['Billing Type', dataJson.billingType || 'Fixed Price'],
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(setupData), 'ND Setup');

    // ND Rate Master sheet
    const rateData = [['Resource', 'Cost/Hour', 'Bill/Hour']];
    if (Array.isArray(dataJson.resources)) {
      dataJson.resources.forEach(r => {
        rateData.push([r.name || '', r.costPerHour || '', r.billPerHour || '']);
      });
    }
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rateData), 'ND Rate Master');

    // ND Timesheet sheet (for CSV imports)
    const timesheetData = [['Week Ending', 'Resource', 'Hours', 'Status']];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(timesheetData), 'ND Timesheet');

    // ND Resources sheet
    const resourcesData = [['Resource', 'Total Allocated Hours', 'Status']];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(resourcesData), 'ND Resources');

    // ND Summary sheet (dashboard)
    const summaryData = [
      ['Metric', 'Value'],
      ['EAC Revenue', ''],
      ['ETC Revenue', ''],
      ['EAC Cost', ''],
      ['ETC Cost', ''],
      ['Margin %', ''],
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryData), 'ND Summary');

    // ND Workplan sheet
    const workplanData = [['Week', 'Resource', 'Planned Hours', 'Actual Hours']];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(workplanData), 'ND Workplan');

    // Write and store in database
    tempFile = join(tmpdir(), `project_${Date.now()}.xlsx`);
    XLSX.writeFile(workbook, tempFile);
    const fileContent = require('fs').readFileSync(tempFile);

    dbClient = await getPool().connect();

    // Create project
    const projectResult = await dbClient.query(`
      INSERT INTO pm_projects (name, client, project_manager, sow_value, billing_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [dataJson.projectName, dataJson.client, pmEmail, dataJson.sowValue, dataJson.billingType]);

    const projectId = projectResult.rows[0].id;

    // Store Excel file
    await dbClient.query(`
      INSERT INTO excel_files (project_id, file_content, last_updated_by)
      VALUES ($1, $2, $3)
    `, [projectId, fileContent, pmEmail]);

    // Add PM as member
    await dbClient.query(`
      INSERT INTO project_members (project_id, pm_email, role)
      VALUES ($1, $2, 'editor')
    `, [projectId, pmEmail]);

    return res.status(201).json({
      success: true,
      projectId,
      projectName: dataJson.projectName,
    });
  } catch (err) {
    console.error('Generate project error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (tempFile) {
      try { unlinkSync(tempFile); } catch (e) {}
    }
    if (dbClient) dbClient.release();
  }
}

async function handleGetSummary(req, res, pmEmail, projectId, client) {
  if (!pmEmail) {
    return res.status(400).json({ error: 'Missing x-pm-email header' });
  }

  let dbClient;
  let tempFile;

  try {
    dbClient = await getPool().connect();

    const projectResult = await dbClient.query(`
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

    tempFile = join(tmpdir(), `summary_${projectId}_${Date.now()}.xlsx`);
    writeFileSync(tempFile, file_content);

    const summary = extractSummaryData(tempFile);

    return res.status(200).json({
      success: true,
      projectName: name,
      clientName,
      summary,
    });
  } catch (err) {
    console.error('Get summary error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (tempFile) {
      try { unlinkSync(tempFile); } catch (e) {}
    }
    if (dbClient) dbClient.release();
  }
}

async function handleDownloadExcel(req, res, pmEmail, projectId, client) {
  if (!pmEmail) {
    return res.status(400).json({ error: 'Missing x-pm-email header' });
  }

  let dbClient;

  try {
    dbClient = await getPool().connect();

    const result = await dbClient.query(`
      SELECT p.name, e.file_content
      FROM pm_projects p
      INNER JOIN excel_files e ON p.id = e.project_id
      INNER JOIN project_members pm ON p.id = pm.project_id
      WHERE p.id = $1 AND pm.pm_email = $2
    `, [projectId, pmEmail]);

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Project not found or access denied' });
    }

    const { name, file_content } = result.rows[0];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${name}_${projectId}.xlsx"`);
    res.send(file_content);
  } catch (err) {
    console.error('Download error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (dbClient) dbClient.release();
  }
}

async function handleCsvUpload(req, res, pmEmail, projectId, client) {
  if (!pmEmail) {
    return res.status(400).json({ error: 'Missing x-pm-email header' });
  }

  let dbClient;
  let tempFile;

  try {
    dbClient = await getPool().connect();

    // Verify access
    const projectCheck = await dbClient.query(`
      SELECT p.id FROM pm_projects p
      INNER JOIN project_members pm ON p.id = pm.project_id
      WHERE p.id = $1 AND pm.pm_email = $2
    `, [projectId, pmEmail]);

    if (projectCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Parse CSV and inject into Excel
    const bb = Busboy({ headers: req.headers });
    let csvBuffer = null;

    await new Promise((resolve, reject) => {
      bb.on('file', (fieldname, file) => {
        if (fieldname === 'csv') {
          const chunks = [];
          file.on('data', data => chunks.push(data));
          file.on('end', () => {
            csvBuffer = Buffer.concat(chunks).toString('utf-8');
          });
        }
      });

      bb.on('close', resolve);
      bb.on('error', reject);
    });

    req.pipe(bb);

    if (!csvBuffer) {
      return res.status(400).json({ error: 'No CSV file provided' });
    }

    // Get Excel file
    const excelResult = await dbClient.query(`
      SELECT file_content FROM excel_files WHERE project_id = $1
    `, [projectId]);

    tempFile = join(tmpdir(), `upload_${projectId}_${Date.now()}.xlsx`);
    writeFileSync(tempFile, excelResult.rows[0].file_content);

    // Inject CSV data
    const updatedBuffer = injectCsvData(tempFile, csvBuffer);

    // Store updated Excel
    await dbClient.query(`
      UPDATE excel_files
      SET file_content = $1, last_updated_by = $2, last_updated_at = NOW()
      WHERE project_id = $3
    `, [updatedBuffer, pmEmail, projectId]);

    return res.status(200).json({
      success: true,
      message: 'CSV uploaded and processed',
    });
  } catch (err) {
    console.error('CSV upload error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (tempFile) {
      try { unlinkSync(tempFile); } catch (e) {}
    }
    if (dbClient) dbClient.release();
  }
}

async function handleWorkplanUpdate(req, res, pmEmail, projectId, client) {
  if (!pmEmail) {
    return res.status(400).json({ error: 'Missing x-pm-email header' });
  }

  let dbClient;

  try {
    dbClient = await getPool().connect();

    // Verify access
    const projectCheck = await dbClient.query(`
      SELECT p.id FROM pm_projects p
      INNER JOIN project_members pm ON p.id = pm.project_id
      WHERE p.id = $1 AND pm.pm_email = $2
    `, [projectId, pmEmail]);

    if (projectCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { update } = req.body;

    // TODO: Integrate with Haiku chat model for intelligent workplan updates
    // For now, just acknowledge the request

    return res.status(200).json({
      success: true,
      message: 'Workplan update received',
      update,
    });
  } catch (err) {
    console.error('Workplan update error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (dbClient) dbClient.release();
  }
}

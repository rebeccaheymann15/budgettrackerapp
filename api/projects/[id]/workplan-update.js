const { getPool, initDb } = require('../../_pgdb');
const XLSX = require('xlsx');
const { writeFileSync, unlinkSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

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
  let tempFile;
  try {
    await initDb();

    const { id: projectId } = req.query;
    const pmEmail = req.headers['x-pm-email'];
    const { resourceKey, weekNumber, fieldName, value } = req.body;

    if (!projectId || !pmEmail) {
      return res.status(400).json({ error: 'Missing projectId or pm_email' });
    }

    if (!resourceKey || weekNumber === undefined || !fieldName || value === undefined) {
      return res.status(400).json({ error: 'Missing required fields: resourceKey, weekNumber, fieldName, value' });
    }

    client = await getPool().connect();

    // Verify access and get Excel file
    const projectResult = await client.query(`
      SELECT e.id, e.file_content
      FROM excel_files e
      INNER JOIN pm_projects p ON e.project_id = p.id
      INNER JOIN project_members pm ON p.id = pm.project_id
      WHERE e.project_id = $1 AND pm.pm_email = $2
    `, [projectId, pmEmail]);

    if (projectResult.rows.length === 0) {
      return res.status(403).json({ error: 'Project not found or access denied' });
    }

    const { file_content } = projectResult.rows[0];

    // Write Excel to temp file
    tempFile = join(tmpdir(), `workplan_${projectId}_${Date.now()}.xlsx`);
    writeFileSync(tempFile, file_content);

    // Load and update workbook
    const workbook = XLSX.readFile(tempFile);
    const sheet = workbook.Sheets['ND Workplan'];

    if (!sheet) {
      return res.status(400).json({ error: 'ND Workplan tab not found' });
    }

    // Find resource row by matching resource key in column A
    let targetRow = null;
    for (let row = 9; row < 50; row++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: 0 });
      const cell = sheet[cellRef];
      if (cell && cell.v && cell.v.toString() === resourceKey.toString()) {
        targetRow = row;
        break;
      }
    }

    if (targetRow === null) {
      return res.status(400).json({ error: `Resource key ${resourceKey} not found in Workplan` });
    }

    // Map fieldName to column
    // Workplan structure: columns K-onwards are weeks (K-L = week 1, M-N = week 2, etc.)
    // Each week has Plan and Actual columns
    const columnMap = {
      'plan': weekNumber * 2 - 2 + 10, // K=10 for week 1 plan
      'actual': weekNumber * 2 - 1 + 10, // L=11 for week 1 actual
    };

    const colIndex = columnMap[fieldName];
    if (colIndex === undefined) {
      return res.status(400).json({ error: `Invalid fieldName: ${fieldName}. Must be 'plan' or 'actual'` });
    }

    // Update cell
    const cellRef = XLSX.utils.encode_cell({ r: targetRow, c: colIndex });
    sheet[cellRef] = { v: parseFloat(value) };

    // Save workbook
    XLSX.writeFile(workbook, tempFile);

    // Read updated content
    const fs = require('fs');
    const updatedFileContent = fs.readFileSync(tempFile);

    // Update database
    await client.query(`
      UPDATE excel_files
      SET file_content = $1, last_updated_by = $2, last_updated_at = NOW()
      WHERE project_id = $3
    `, [updatedFileContent, pmEmail, projectId]);

    return res.status(200).json({
      success: true,
      message: `Updated ${fieldName} for resource ${resourceKey} in week ${weekNumber}`,
      note: 'Formulas are not automatically recalculated. Please download the Excel file to recalculate.',
    });
  } catch (err) {
    console.error('Workplan update error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (tempFile && require('fs').existsSync(tempFile)) unlinkSync(tempFile);
    if (client) client.release();
  }
};

const Busboy = require('busboy');
const { getPool, initDb } = require('../../_pgdb');
const { parseCSVExport, injectTimeseriesIntoExcel, extractSummaryData } = require('../../_excel-utils');
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
  let csvTempFile, excelTempFile;
  try {
    await initDb();

    const { id: projectId } = req.query;
    const pmEmail = req.headers['x-pm-email'];

    if (!projectId || !pmEmail) {
      return res.status(400).json({ error: 'Missing projectId or pm_email' });
    }

    // Parse multipart form
    const bb = Busboy({ headers: req.headers });
    let csvBuffer = null;

    await new Promise((resolve, reject) => {
      bb.on('file', (fieldname, file) => {
        const chunks = [];
        file.on('data', data => chunks.push(data));
        file.on('end', () => {
          csvBuffer = Buffer.concat(chunks);
        });
      });
      bb.on('close', resolve);
      bb.on('error', reject);
      req.pipe(bb);
    });

    if (!csvBuffer) {
      return res.status(400).json({ error: 'No CSV file provided' });
    }

    // Parse CSV
    const timeseries = parseCSVExport(csvBuffer);

    if (timeseries.length === 0) {
      return res.status(400).json({ error: 'No valid data found in CSV' });
    }

    client = await getPool().connect();

    // Verify project access
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

    const excelFileContent = projectResult.rows[0].file_content;

    // Write Excel to temp file
    excelTempFile = join(tmpdir(), `excel_${projectId}_${Date.now()}.xlsx`);
    writeFileSync(excelTempFile, excelFileContent);

    // Load Excel workbook
    const workbook = XLSX.readFile(excelTempFile);

    // Inject timeseries into ND Timesheet
    const updatedWorkbook = injectTimeseriesIntoExcel(workbook, timeseries);

    // Save updated workbook
    XLSX.writeFile(updatedWorkbook, excelTempFile);

    // Read back the updated file
    const fs = require('fs');
    const updatedFileContent = fs.readFileSync(excelTempFile);

    // Update database
    await client.query(`
      UPDATE excel_files
      SET file_content = $1, last_updated_by = $2, last_updated_at = NOW()
      WHERE project_id = $3
    `, [updatedFileContent, pmEmail, projectId]);

    // Extract summary data
    let summary = {};
    try {
      summary = extractSummaryData(excelTempFile);
    } catch (err) {
      console.warn('Could not extract summary (formulas may not be recalculated):', err.message);
    }

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'CSV uploaded successfully',
      rowsImported: timeseries.length,
      summary,
      note: 'Please download the Excel file to recalculate formulas in Excel',
    });
  } catch (err) {
    console.error('CSV upload error:', err);
    if (client) await client.query('ROLLBACK');
    return res.status(500).json({ error: err.message });
  } finally {
    if (csvTempFile && require('fs').existsSync(csvTempFile)) unlinkSync(csvTempFile);
    if (excelTempFile && require('fs').existsSync(excelTempFile)) unlinkSync(excelTempFile);
    if (client) client.release();
  }
};

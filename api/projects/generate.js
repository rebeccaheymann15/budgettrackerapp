const Busboy = require('busboy');
const XLSX = require('xlsx');
const { getPool, initDb } = require('../_pgdb');
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

    const pmEmail = req.headers['x-pm-email'];
    if (!pmEmail) {
      return res.status(400).json({ error: 'Missing x-pm-email header' });
    }

    // Parse multipart form
    const bb = Busboy({ headers: req.headers });
    let dataJson = null;
    let baselineBuffer = null;

    await new Promise((resolve, reject) => {
      bb.on('field', (fieldname, val) => {
        if (fieldname === 'data') {
          dataJson = JSON.parse(val);
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
      req.pipe(bb);
    });

    if (!dataJson) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const { setup, resources } = dataJson;

    // Create new workbook
    const wb = XLSX.utils.book_new();

    // Build ND Setup sheet
    const setupSheet = XLSX.utils.aoa_to_sheet([
      ['PROJECT SETUP'],
      [],
      ['Project Number', setup.projectNumber],
      ['Project Name', setup.projectName],
      ['Client', setup.client],
      ['Workstream', setup.workstream],
      ['Project Manager', setup.projectManager],
      [],
      ['CALENDAR'],
      ['Week 1 ending (Saturday)', new Date(setup.week1Ending)],
      ['Number of weeks in grid', setup.numWeeks],
      ['Status date (actuals complete through)', new Date(setup.statusDate)],
      [],
      ['CONTRACT'],
      ['Baseline SOW value ($) - per signed SOW', setup.sowValue],
      ['Billing Type', setup.billingType],
    ]);
    setupSheet['!cols'] = [{ wch: 40 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, setupSheet, 'ND Setup');

    // Build ND Rate Master sheet
    const rateHeaders = ['Resource Key', 'Display Name', 'Role', 'Country', 'Hourly Cost', 'Bill Rate', 'Active', 'Baseline SOW Hrs'];
    const rateRows = resources.map(r => [
      r.key,
      r.displayName,
      r.role,
      r.country || 'USA',
      r.hourlyCost,
      r.billRate,
      'Yes',
      r.baselineSowHrs,
    ]);
    const rateSheet = XLSX.utils.aoa_to_sheet([['RATE MASTER'], [], rateHeaders, ...rateRows]);
    rateSheet['!cols'] = Array(8).fill({ wch: 18 });
    XLSX.utils.book_append_sheet(wb, rateSheet, 'ND Rate Master');

    // Build ND Timesheet sheet (empty, for CSV imports)
    const timeHeaders = ['Resource ID', 'Resource Name', 'Timesheet Date', 'Hours'];
    const timeSheet = XLSX.utils.aoa_to_sheet([timeHeaders]);
    timeSheet['!cols'] = Array(4).fill({ wch: 18 });
    XLSX.utils.book_append_sheet(wb, timeSheet, 'ND Timesheet');

    // Build ND Resources sheet (computed from Rate Master)
    const resourceHeaders = ['Resource Key', 'Display Name', 'Role', 'Bill Rate', 'Hourly Cost', 'Baseline SOW Hrs', 'Approved CO Hrs', 'Total Budget Hrs', 'Budget $', 'Budget Cost $', 'Key Found?', 'Actual Hrs', 'ETC Hrs', 'EAC Hrs'];
    const resourceRows = resources.map(r => [
      r.key,
      r.displayName,
      r.role,
      r.billRate,
      r.hourlyCost,
      r.baselineSowHrs,
      0,
      r.baselineSowHrs,
      r.baselineSowHrs * r.billRate,
      r.baselineSowHrs * r.hourlyCost,
      'OK',
      0,
      0,
      0,
    ]);
    const resourceSheet = XLSX.utils.aoa_to_sheet([resourceHeaders, ...resourceRows]);
    resourceSheet['!cols'] = Array(14).fill({ wch: 18 });
    XLSX.utils.book_append_sheet(wb, resourceSheet, 'ND Resources');

    // Build ND Summary sheet (dashboard)
    const summarySheet = XLSX.utils.aoa_to_sheet([
      [`${setup.projectName}`],
      [`Client: ${setup.client} | PM: ${setup.projectManager}`],
      [],
      ['HOURS', null, null, 'REVENUE', null, null, 'SCHEDULE'],
      ['Baseline SOW hours', resources.reduce((sum, r) => sum + (r.baselineSowHrs || 0), 0), null, 'Signed SOW value', setup.sowValue, null, 'Week 1 ending', new Date(setup.week1Ending)],
      ['Approved change order hours', 0, null, 'Budget $ (baseline + approved CO)', setup.sowValue, null, 'Status date', new Date(setup.statusDate)],
      ['Total budget hours', resources.reduce((sum, r) => sum + (r.baselineSowHrs || 0), 0), null, 'EAC $', setup.sowValue, null, 'Last week ending', null],
      ['Actual hours to date', 0, null, 'Variance vs budget ($)', 0, null, 'Weeks elapsed', 0],
      ['Estimate to complete (ETC)', 0, null, 'Revenue recognised to date', 0, null, 'Weeks remaining', setup.numWeeks],
      ['Estimate at completion (EAC)', 0, null, null, null, null, '% of schedule elapsed', 0],
      ['Variance vs budget (hrs)', 0, null, 'COST & MARGIN', null, null, 'Burn rate vs time', 0],
      ['% of EAC delivered', 0, null, 'Budget cost', resources.reduce((sum, r) => sum + (r.baselineSowHrs || 0) * r.hourlyCost, 0), null, null, null],
      [null, null, null, 'EAC cost', resources.reduce((sum, r) => sum + (r.baselineSowHrs || 0) * r.hourlyCost, 0)],
      [null, null, null, 'Budget margin %', 0],
      [null, null, null, 'EAC margin %', 0],
      [null, null, null, 'Target margin %', 0.20],
      [null, null, null, 'EAC margin vs target (pts)', 0],
    ]);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'ND Summary');

    // Build ND Workplan sheet (weekly plan vs actual)
    const weeks = [];
    const startDate = new Date(setup.week1Ending);
    for (let i = 0; i < setup.numWeeks; i++) {
      weeks.push(new Date(startDate.getTime() + i * 7 * 24 * 60 * 60 * 1000));
    }

    const workplanHeaders = ['Resource Key', 'Resource', 'Role', 'Bill Rate', 'Budget Hrs'];
    weeks.forEach(week => {
      workplanHeaders.push(XLSX.utils.format_cell({ t: 'd', v: week }));
      workplanHeaders.push('Plan');
      workplanHeaders.push('Act');
    });

    const workplanRows = resources.map(r => {
      const row = [r.key, r.displayName, r.role, r.billRate, r.baselineSowHrs];
      weeks.forEach(() => {
        row.push(Math.round(r.baselineSowHrs / setup.numWeeks)); // Distribute baseline evenly
        row.push('Plan');
        row.push('Act');
      });
      return row;
    });

    const workplanSheet = XLSX.utils.aoa_to_sheet([workplanHeaders, ...workplanRows]);
    XLSX.utils.book_append_sheet(wb, workplanSheet, 'ND Workplan');

    // Build other sheets as placeholders
    const checkSheet = XLSX.utils.aoa_to_sheet([['INTEGRITY CHECKS'], [], ['All checks pass (placeholder)']]);
    XLSX.utils.book_append_sheet(wb, checkSheet, 'ND Checks');

    // Save to temp file
    tempFile = join(tmpdir(), `generated_${Date.now()}.xlsx`);
    XLSX.writeFile(wb, tempFile);

    // Read file content
    const fs = require('fs');
    const fileContent = fs.readFileSync(tempFile);

    // Save to database
    const projectResult = await getPool().query(`
      INSERT INTO pm_projects (name, client, project_manager, sow_value, billing_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [setup.projectName, setup.client, setup.projectManager, setup.sowValue, setup.billingType]);

    const projectId = projectResult.rows[0].id;

    // Add PM as member
    await getPool().query(`
      INSERT INTO project_members (project_id, pm_email, role)
      VALUES ($1, $2, 'editor')
    `, [projectId, pmEmail]);

    // Store Excel file
    await getPool().query(`
      INSERT INTO excel_files (project_id, file_content, last_updated_by)
      VALUES ($1, $2, $3)
    `, [projectId, fileContent, pmEmail]);

    return res.status(201).json({
      success: true,
      projectId,
      message: 'Project created successfully',
    });
  } catch (err) {
    console.error('Generate project error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (tempFile && require('fs').existsSync(tempFile)) unlinkSync(tempFile);
    if (client) client.release();
  }
};

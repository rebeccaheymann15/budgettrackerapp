const XLSX = require('xlsx');

function parseExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    return data.map((row, rowIndex) => {
      // Skip empty rows (rows with no Opp ID)
      if (!row['Opp ID'] || String(row['Opp ID']).trim() === '') {
        return null;
      }

      const cellZ = worksheet['Z' + (rowIndex + 2)];
      const eacRevenueValue = cellZ ? cellZ.v : null;

      const cellAH = worksheet['AH' + (rowIndex + 2)];
      const ahValue = cellAH ? cellAH.v : null;

      return {
        oppId: String(row['Opp ID']).trim(),
        account: row['Account'] || '',
        opportunityName: row['Opportunity Name'] || '',
        projectName: row['Project Name'] || '',
        projectManager: row['Project Manager'] || '',
        coa: row['COA'] || '',

        status: mapStatus(row['Project Overall']),
        financialStatus: mapStatus(row['Financials']),
        scopeStatus: mapStatus(row['Scope']),
        qualityStatus: mapStatus(row['Quality']),
        resourcesStatus: mapStatus(row['Resources']),
        scheduleStatus: mapStatus(row['Schedule']),
        clientStatus: mapStatus(row['Client Relationship']),

        eacMarginPercent: parseFloat(row['EAC Margin %']) || null,
        odeMarginPercent: parseFloat(row[' ODE Margin % ']) || null,
        varianceMarginPt: parseFloat(row[' Variance to ODE Margin % ']) || null,
        eacRevenue: parseCurrency(eacRevenueValue),
        odeRevenue: parseCurrency(row[' ODE Revenue $ ']),
        eacCost: parseCurrency(row['EAC Cost $']),

        pmStatusSummary: row['PM Status Summary'] || '',
        leadCommentary: row['Lead Commentary'] || '',
        columnAH: ahValue || '',
      };
    }).filter(Boolean); // Remove null entries from skipped rows
  } catch (err) {
    console.error('Excel parsing error:', err);
    throw err;
  }
}

function mapStatus(val) {
  if (!val) return null;
  const s = String(val).toLowerCase().trim();
  if (s.includes('green')) return 'Green';
  if (s.includes('yellow')) return 'Yellow';
  if (s.includes('red')) return 'Red';
  return null;
}

function parseCurrency(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val; // Already a number

  // Convert to string, remove $, commas, and whitespace
  const str = String(val).trim();
  const cleaned = str.replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);

  if (isNaN(parsed)) {
    console.log('Failed to parse currency:', val, 'cleaned:', cleaned);
    return null;
  }
  return parsed;
}

function calculateMetrics(projects) {
  return {
    totalProjects: projects.length,
    greenCount: projects.filter(p => p.status === 'Green').length,
    yellowCount: projects.filter(p => p.status === 'Yellow').length,
    redCount: projects.filter(p => p.status === 'Red').length,
    noStatusCount: projects.filter(p => !p.status).length,
  };
}

module.exports = {
  parseExcelFile,
  calculateMetrics,
};

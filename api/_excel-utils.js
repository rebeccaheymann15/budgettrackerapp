const XLSX = require('xlsx');

function parseCSVExport(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Row 0 (1-indexed as row 1) = week-end dates
  // Row 1 = headers (all say "Hours")
  // Row 2+ = data (Resource in col B, hours starting col C)

  const weekDates = data[0].slice(2).filter(d => d); // Start from column C (index 2)
  const normalizedData = [];

  // Process each resource row (starting from row 3, index 2)
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row[1] || row[1] === 'Total') continue; // Skip totals

    // Extract Resource ID from "Name (ID)" format
    const resourceStr = row[1];
    const idMatch = resourceStr.match(/\((\d+)\)/);
    const resourceId = idMatch ? idMatch[1] : null;

    if (!resourceId) continue;

    // Process hours for each week
    for (let j = 0; j < weekDates.length; j++) {
      const weekEnd = weekDates[j];
      const hours = row[2 + j]; // Column C starts at index 2

      if (weekEnd && hours) {
        normalizedData.push({
          resourceId,
          resourceName: resourceStr.replace(/ \(\d+\)/, ''),
          weekEnd: new Date(weekEnd).toISOString().split('T')[0],
          hours: parseFloat(hours),
        });
      }
    }
  }

  return normalizedData;
}

function injectTimeseriesIntoExcel(workbook, timeseries) {
  // For MVP: we'll create a simple normalized timesheet
  // In the ND Timesheet tab, we'll overwrite rows with the normalized data
  // The Excel formulas will pick it up via SUMIFS

  const sheet = workbook.Sheets['ND Timesheet'];
  if (!sheet) {
    throw new Error('ND Timesheet tab not found in Excel file');
  }

  // Clear existing data (rows 4+)
  for (let row = 4; row < 1000; row++) {
    for (let col = 1; col <= 20; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      delete sheet[cellRef];
    }
  }

  // Write headers if not present
  sheet['A3'] = { v: 'Resource ID' };
  sheet['B3'] = { v: 'Resource Name' };
  sheet['C3'] = { v: 'Timesheet Date' };
  sheet['D3'] = { v: 'Hours' };

  // Write timeseries data
  let rowIndex = 3;
  for (const item of timeseries) {
    rowIndex++;
    const row = rowIndex;

    sheet[XLSX.utils.encode_cell({ r: row, c: 0 })] = { v: item.resourceId };
    sheet[XLSX.utils.encode_cell({ r: row, c: 1 })] = { v: item.resourceName };
    sheet[XLSX.utils.encode_cell({ r: row, c: 2 })] = { v: new Date(item.weekEnd) };
    sheet[XLSX.utils.encode_cell({ r: row, c: 3 })] = { v: item.hours };
  }

  // Update dimensions
  sheet['!ref'] = `A1:D${rowIndex}`;

  return workbook;
}

function extractSummaryData(workbookPath) {
  // Read the Excel file with data_only to get calculated values
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(workbookPath);
  const sheet = workbook.Sheets['ND Summary'];

  if (!sheet) {
    throw new Error('ND Summary tab not found');
  }

  const summary = {};

  // Extract key metrics from ND Summary sheet
  const cellMap = {
    'baselineSOWHours': 'B5',
    'approvedCOHours': 'B6',
    'totalBudgetHours': 'B7',
    'actualHours': 'B8',
    'etcHours': 'B9',
    'eacHours': 'B10',
    'varianceHours': 'B11',
    'percentDelivered': 'B12',
    'sowValue': 'E5',
    'budgetRevenue': 'E6',
    'eacRevenue': 'E7',
    'varianceRevenue': 'E8',
    'recognizedRevenue': 'E9',
    'budgetCost': 'E12',
    'eacCost': 'E13',
    'budgetMarginPct': 'E14',
    'eacMarginPct': 'E15',
    'targetMarginPct': 'E16',
    'marginVariance': 'E17',
    'week1End': 'H5',
    'statusDate': 'H6',
    'lastWeekEnd': 'H7',
    'weeksElapsed': 'H8',
    'weeksRemaining': 'H9',
    'schedulePercent': 'H10',
    'burnRate': 'H11',
  };

  for (const [key, cellRef] of Object.entries(cellMap)) {
    const cell = sheet[cellRef];
    summary[key] = cell ? cell.v : null;
  }

  return summary;
}

module.exports = {
  parseCSVExport,
  injectTimeseriesIntoExcel,
  extractSummaryData,
};

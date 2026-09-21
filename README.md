# Project Health Dashboard

A full-stack application for tracking and visualizing weekly project delivery health across your business unit. Upload Excel files weekly to build historical trends and monitor portfolio status.

## Features

✅ **Weekly File Uploads** — Upload Excel project portfolio files  
✅ **Persistent Database** — Stores historical snapshots for trend analysis  
✅ **Portfolio Summary** — RYG (Red/Yellow/Green) status breakdown  
✅ **Project Cards** — Detailed view of at-risk projects with margins & commentary  
✅ **Trend Charts** — Week-over-week status movement and margin performance  
✅ **Responsive Design** — Works on desktop and mobile  

## Quick Start

### Prerequisites
- Node.js 16+
- Excel file with project portfolio data (`.xlsx`)

### Installation

```bash
npm install
```

### Running the Application

```bash
npm start
```

The dashboard will be available at **http://localhost:5000**

## How It Works

### 1. Upload Weekly Data
- Click the upload area on the dashboard
- Select your Excel project portfolio file
- The system automatically extracts:
  - Project status (Red/Yellow/Green)
  - Account & project details
  - Financial metrics (EAC Margin, ODE Margin, variance)
  - Project manager & COA assignments
  - Status summaries & commentary

### 2. View Current Week
- **Portfolio Summary** — At-a-glance counts of Red/Yellow/Green/Total projects
- **Red Accounts** — Detailed cards for projects in red status
- **Yellow Accounts** — Emerging risks grouped by practice area
- **Margin Analysis** — Financial health metrics for at-risk projects

### 3. Track Trends
- **Status Trend Chart** — Line graph showing Red/Yellow/Green counts over time
- **Margin Performance** — Bar chart of EAC margins for red/yellow projects
- Compare week-over-week status changes to identify improving/declining trends

## API Endpoints

### Upload Weekly Snapshot
```
POST /api/upload
Content-Type: multipart/form-data
Body: { file: <.xlsx file> }

Response:
{
  "success": true,
  "week": "2026-07-21",
  "metrics": {
    "totalProjects": 93,
    "greenCount": 54,
    "yellowCount": 21,
    "redCount": 3,
    "noStatusCount": 15
  }
}
```

### Get Current Week Summary
```
GET /api/summary/current

Response:
{
  "week": "2026-07-21",
  "metrics": { ... },
  "redProjects": [ ... ],
  "yellowProjects": [ ... ],
  "greenProjects": [ ... ],
  "allProjects": [ ... ]
}
```

### Get Trend Data (All Weeks)
```
GET /api/trends

Response: [
  {
    "week": "2026-07-14",
    "statusCounts": { "green": 52, "yellow": 20, "red": 3, "total": 93 },
    "redProjects": [ ... ],
    "yellowProjects": [ ... ]
  },
  ...
]
```

### Get Project History
```
GET /api/project/:oppId/history

Response: [
  {
    "oppId": "339419",
    "week": "2026-07-14",
    "status": "Green",
    "eacMarginPercent": 0.67,
    ...
  },
  ...
]
```

### Get All Snapshots
```
GET /api/snapshots

Response: [
  {
    "id": 1,
    "week": "2026-07-21",
    "metric": {
      "totalProjects": 93,
      "greenCount": 54,
      ...
    }
  },
  ...
]
```

## Data Schema

### Excel File Requirements

Your Excel file should have these columns:
- `Opp ID` — Opportunity/Project ID
- `Account` — Client account name
- `Project Name` — Project name
- `Project Manager` — PM name(s)
- `Project Overall` — Status (Red/Yellow/Green)
- `Financials`, `Scope`, `Quality`, `Resources`, `Schedule`, `Client Relationship` — Individual status flags
- `COA` — Center of Account (business unit)
- `EAC Margin %` — Estimated at completion margin
- `ODE Margin %` — Original deal economics margin
- `Variance to ODE Margin %` — Margin variance
- `PM Status Summary` — Commentary from project manager
- `Lead Commentary` — Additional notes

### Database Tables

**weeklySnapshots**
- Stores one record per week
- Links projects and metrics

**projects**
- 93+ records per snapshot
- Full project details + status + financial metrics

**metrics**
- Portfolio summary counts per week
- Enables efficient trend queries

## Architecture

**Backend:** Node.js + Express  
**Database:** SQLite (via better-sqlite3)  
**Frontend:** React 18 (CDN) + HTML/CSS/Canvas  
**File Processing:** XLSX parser  

### Key Files

```
├── server/
│   ├── server.js         # Express API server
│   ├── db.js            # SQLite initialization & queries
│   └── utils.js         # Excel parsing & metrics calculation
├── public/
│   ├── index.html       # React app HTML shell
│   └── app.js           # React dashboard component
├── prisma/
│   └── dev.db           # SQLite database file (auto-created)
└── uploads/             # Temporary Excel file storage
```

## Development

### View Server Logs
```bash
tail -f /tmp/server.log
```

### Reset Database
```bash
rm prisma/dev.db
npm start
```

### Add More Endpoints
Edit `server/server.js` and add new routes. The `db` object uses better-sqlite3 prepared statements for fast, safe queries.

## Next Steps

**Optional enhancements:**
- Weekly email summaries of status changes
- Detailed project comparison (week A vs week B)
- Export current view as PDF/Excel
- Slack notifications for new Red projects
- Historical margin trend lines per project
- Practice area (COA) summary dashboard
- Risk heat maps showing status + financial impact

## Troubleshooting

**File upload fails:**
- Ensure Excel file is `.xlsx` format
- Check that columns match expected names

**Charts not showing:**
- Ensure trends exist (upload 2+ weeks of data)
- Check browser console for JavaScript errors

**Database locked:**
- Kill any running server processes: `pkill -f "npm start"`
- Restart: `npm start`

## License

Internal use only.

# Project Health Dashboard — Getting Started

## What You've Built

A professional-grade web application that transforms your manual Excel-based weekly reporting into a **persistent, trend-enabled dashboard** for executive leadership.

### Problem Solved ✓
- **Before**: Download Excel → Run skill → Static HTML → No history
- **After**: Upload Excel → Automatic storage → Interactive dashboard → Week-over-week trends

## Installation & Setup (2 minutes)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Start the Server
```bash
npm start
```

### Step 3: Open Your Browser
Go to: **http://localhost:5000**

## Using the Dashboard

### Weekly Upload
1. Click "📁 Upload Weekly Report" section
2. Select your project portfolio Excel file
3. System automatically:
   - Parses 93+ projects
   - Extracts status, margins, commentary
   - Stores in database for history

### Current Week View
**Portfolio Summary**
- Green: 54 projects ✓
- Yellow: 21 projects 🟡
- Red: 3 projects 🔴
- No Status: 15 projects (visibility gap)

**Red Accounts** (at-risk projects)
- Osram Sylvania: 6.4% margin (vs 24.1% ODE)
- The Leading Hotels Of The World: 18.5% margin (vs 50.8% ODE)
- Tommy Bahama Group: 49.7% margin (improving from Yellow)

**Yellow Accounts** (emerging risks)
- 21 projects across Commerce, Content, RS&S, XD, SSR
- Financial margin pressure: most <60% EAC margin
- Each card shows: PM, COA, margin variance, action items

### Trend Analysis
**Status Chart**
- Line graph: Green/Yellow/Red counts per week
- Identify portfolio health trajectory
- Spot status regressions early

**Margin Performance**
- Bar chart of Red/Yellow projects' EAC margins
- Compare week-to-week financial deterioration
- Flag outliers and improvement opportunities

## Key Features in Detail

### 📊 Portfolio Summary
At a glance see:
- Total active projects
- RYG distribution
- Data quality (projects missing status)

### 🔴 Red Account Cards
For each at-risk project:
- Account name & project title
- Project manager & COA
- EAC Margin vs ODE (baseline)
- Margin variance in points
- Status flags (Finance, Scope, Quality, Schedule, etc.)
- PM action summary
- Latest commentary

### 🟡 Yellow Account Cards  
Risk monitoring:
- Emerging financial pressures
- Resource constraints
- Schedule slipping
- Client relationship fragility

### 📈 Trend Charts
**Status Trend** (line chart)
- Weekly Red/Yellow/Green counts
- Identify improving/declining weeks
- Spot recurring problem projects

**Margin Performance** (bar chart)
- EAC margins for at-risk projects
- Visual ranking of financial health
- Compare portfolio by severity

## Data Flow

```
Your Excel File
      ↓
  [POST /api/upload]
      ↓
  Parse & Extract
      ↓
  Store in SQLite
      ↓
  Dashboard Retrieves [GET /api/summary/current]
      ↓
  React Renders
      ↓
  Charts & Cards
```

## Files You Modified

```
├── server/
│   ├── server.js         ← Express API endpoints
│   ├── db.js            ← SQLite setup & queries
│   └── utils.js         ← Excel parsing logic
├── public/
│   ├── index.html       ← Main page template
│   └── app.js           ← React dashboard component
├── .env                 ← Configuration
├── package.json         ← Dependencies & scripts
└── README.md            ← Full API documentation
```

## Common Tasks

### Upload Last Week's Report
```bash
# Click upload on dashboard
# Select: dx-project-portfolio-2026-07-28.xlsx
```

### View Specific Project History
Use the `/api/project/:oppId/history` endpoint to track a single project's status over time.

### Export Snapshot
```bash
# Query the database directly
sqlite3 prisma/dev.db "SELECT * FROM projects WHERE snapshotId = 1"
```

### Reset Everything
```bash
rm prisma/dev.db
npm start
# Dashboard will be empty, ready for new uploads
```

## Example API Calls

### See Current Week Summary
```bash
curl http://localhost:5000/api/summary/current | jq .metrics
```

Output:
```json
{
  "totalProjects": 93,
  "greenCount": 54,
  "yellowCount": 21,
  "redCount": 3,
  "noStatusCount": 15
}
```

### Get All Snapshots
```bash
curl http://localhost:5000/api/snapshots | jq '.[] | {week, metrics}'
```

### Track a Project Over Weeks
```bash
# Find Osram Sylvania's project ID, then:
curl http://localhost:5000/api/project/339419/history | jq '.[] | {week, status, eacMarginPercent}'
```

## Next: Deploy to Production

### Option 1: Heroku (Recommended for Quick Deploy)
```bash
heroku create your-app-name
git push heroku main
```

### Option 2: Cloud Server (AWS, Azure, GCP)
- Copy files to server
- Run `npm install && npm start`
- Use PM2 to keep running: `pm2 start server/server.js`
- Put behind Nginx reverse proxy

### Option 3: Docker Container
Create `Dockerfile`:
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

Then:
```bash
docker build -t health-dashboard .
docker run -p 5000:5000 health-dashboard
```

## Troubleshooting

**Upload fails silently:**
```bash
tail -f /tmp/server.log
# Check error messages
```

**Charts not loading:**
- Need at least 2 weeks of data for trends
- Check browser console (F12) for JavaScript errors

**Database getting large:**
- Weekly snapshots accumulate data
- Current size: ~1-2MB per snapshot
- Keep 52 weeks = ~100MB max

**Port 5000 already in use:**
```bash
# Kill existing process
lsof -ti:5000 | xargs kill -9
# Or use different port
PORT=3000 npm start
```

## What's Next?

The foundation is built. Consider adding:

1. **Email Reports** — Weekly digest of Red/Yellow changes
2. **Slack Integration** — Notify when project goes Red
3. **PDF Export** — Save dashboard as PDF for distribution
4. **Advanced Filtering** — By COA, PM, margin threshold
5. **Forecasting** — Predict next week's status based on trend
6. **Comparison View** — This week vs last week side-by-side
7. **Alerts** — Custom thresholds (margin drops >10pt, new Red)

## Questions?

- Check `README.md` for full API documentation
- Review `server/server.js` for available endpoints
- Examine `public/app.js` for React component structure

---

**You're all set!** 🚀 Start uploading weekly reports and watch the trends emerge.

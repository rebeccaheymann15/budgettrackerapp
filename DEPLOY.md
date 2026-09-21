# Vercel Deployment Guide

## Quick Deploy to Vercel

This app is optimized for Vercel's serverless platform.

### Prerequisites
- Vercel account (free tier works)
- GitHub repository (optional but recommended)

### Deploy Steps

#### Option 1: Via Vercel CLI (Fastest)
```bash
npm install -g vercel
vercel --prod
```

#### Option 2: Via GitHub Auto-Deploy
1. Push code to GitHub
2. Go to https://vercel.com/new
3. Import your GitHub repository
4. Vercel auto-deploys on every push

### After Deployment
- Frontend: Auto-served from `/public`
- API: Serverless functions in `/api`
- Database: SQLite stored in `/tmp` (ephemeral)

### Known Limitations
- Database resets every 24 hours (Vercel's ephemeral storage)
- For persistent data, upgrade to Vercel KV or use external PostgreSQL

### Environment Variables (Optional)
Currently none required. To add:
1. Go to Project Settings → Environment Variables
2. Add any needed config

### Monitoring
- View logs: `vercel logs`
- Check deployment status: https://vercel.com/dashboard

---

**Deployed at:** https://dbtexechealth.vercel.app/

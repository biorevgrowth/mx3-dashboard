# MX3 Dashboard

Production source for MX3 Fitness's executive and sales rep dashboards, the API that serves them, the database schema, and the n8n workflow backups that drive the data pipelines.

> **Maintainer onboarding:** Read this file to get the dev environment running. For the comprehensive system handoff (architecture, runbooks, operational history, integrations), request the **MX3 Dashboard & n8n Technical Handoff** doc from the current maintainer. Without it, you have the code but not the operational context.

---

## What's in this repo

```
.
├── src/                  # Executive Dashboard (React 19 + Vite 8)
├── sales/                # Sales Rep Dashboards for Kinga + Pete (React 19 + Vite 6)
├── api-for-railway/      # Executive Dashboard API (Bun + Hono + pg)
│   └── index.tsx
├── database/
│   └── schema.sql        # Postgres schema (executive tables only — sales tables are in migrations not yet merged here)
├── n8n workflow backups/ # JSON exports of all 3 n8n workflows
├── mx3-integration-handoff.docx   # Companion doc for the HubSpot → QBO + ShipStation integration
└── README.md             # this file
```

The Sales Rep API (`mx3-sales-api`) is currently in a separate repo and **pending consolidation** into this one (likely as `/sales-api/`). Confirm with the maintainer before working on that surface.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend (executive) | React 19 + Vite 8 |
| Frontend (sales) | React 19 + Vite 6 |
| Executive API | Bun v1.3 + Hono 4 + node-postgres (`pg`) |
| Sales API | Node + Express + `pg` (separate repo for now) |
| Database | Railway Postgres |
| Hosting | Railway (Pro plan) |
| Automation | n8n (self-hosted on Railway, separate project) |
| Integrations | HubSpot CRM, QuickBooks Online, ShipStation, OpenRouter (Claude), Slack |

---

## Quick Start

### Prerequisites
- Node 22+ and `npm`
- [Bun](https://bun.sh/) v1.3+ (for the executive API)
- A `.env` file with `DATABASE_URL` (request from maintainer) and `VITE_API_URL` (the API base URL)
- Railway CLI: `npm i -g @railway/cli` and `railway login`

### Run the executive dashboard locally
```bash
npm install
echo "VITE_API_URL=https://grateful-flow-production-5403.up.railway.app" > .env.local
npm run dev
# open http://localhost:5173
```

### Run the sales rep dashboards locally
```bash
cd sales
npm install
echo "VITE_API_URL=https://mx3-sales-api-production.up.railway.app" > .env.local
npm run dev
# open http://localhost:5173/rep/kinga
```

### Run the executive API locally
```bash
cd api-for-railway
bun install
DATABASE_URL=<request-from-maintainer> bun run index.tsx
# health check: curl http://localhost:3000/api/health
```

### Build for production
```bash
npm run build              # executive dashboard → /dist
cd sales && npm run build  # sales dashboard → /sales/dist
```

---

## Deployment

All deploys go to Railway, project `executive-dashboard` (ID `736f948b-c82d-4bfa-aeec-69dfcfc658a1`).

### Executive Dashboard (`mx3-dashboard` service)
**Auto-deploys** from `main` branch on push. No manual action needed.
Production URL: `https://mx3-dashboard-production-61a7.up.railway.app/`

### Sales Rep Dashboard (`mx3-sales-dashboard` service)
**Manual deploy** today. Reconnection to GitHub auto-deploy is on the to-do list.

```bash
# Subdir gotcha: Railway CLI walks to git root for `railway up`,
# which would upload the entire monorepo. Copy `sales/` to a tmp dir first.
cp -r sales /tmp/sales-deploy
cd /tmp/sales-deploy
railway link --project 736f948b-c82d-4bfa-aeec-69dfcfc658a1
railway up --service mx3-sales-dashboard
```
Production URL: `https://mx3-sales-dashboard-production.up.railway.app/`

### Executive API (`grateful-flow` service)
**Manual deploy** today.
```bash
cd api-for-railway
railway link --project 736f948b-c82d-4bfa-aeec-69dfcfc658a1
railway up --service grateful-flow
```
Production URL: `https://grateful-flow-production-5403.up.railway.app/`

### Sales API (`mx3-sales-api` service)
Source is in a separate repo currently. Pending consolidation into this one. Ask the maintainer.

---

## Database

Railway Postgres in the same project. Connection string is in each service's `DATABASE_URL` env var (Railway internal URL). For external connections (psql from your laptop, scripts), use `DATABASE_PUBLIC_URL` from the Postgres service variables tab.

The schema file at `database/schema.sql` covers the executive dashboard tables (verticals, regions, goals, daily_snapshots, vertical_snapshots, region_snapshots, daily_briefings). Sales rep tables (`rep_snapshots`, `qbo_invoices`, `customer_rep_map`, etc.) are defined in migration files in the separate sales API repo and have been applied to production. Consolidation pending.

---

## n8n Workflows

Three workflows automate this system, hosted in a **separate Railway project** (`MX3-n8n`, ID `0c78a2da-c169-4f09-88e8-4d910f34aa31`):

1. **MX3 Executive Dashboard — Daily KPI Refresh** (6 AM daily)
2. **MX3 Sales Rep Pipeline** (6 AM daily)
3. **Phase 1: Deal Confirmed → QBO Invoice + ShipStation Order** (polls every 10 minutes — mission-critical)

JSON backups of all three are committed in `n8n workflow backups/`. If you change a workflow in the n8n UI, export it and update the backup.

n8n URL: `https://primary-production-e9e7a.up.railway.app/` (separate auth from Railway).

---

## Contacts

- **CEO:** Michael
- **COO:** Genevieve (Railway admin, day-to-day ops)
- **Sales reps:** Kinga (Athletics/Sports), Pete (Workplace Safety/Healthcare)
- **Original maintainer:** Shaun Thresher (BioRevGrowth)

---

## Where to go next

1. Get the **MX3 Dashboard & n8n Technical Handoff** doc from the current maintainer
2. Get Railway access from Genevieve (workspace invite)
3. Get GitHub collaborator access on this repo
4. Get n8n UI access (separate from Railway)
5. Get HubSpot, QuickBooks, ShipStation, Slack workspace access as needed

The handoff doc covers operational runbooks, known issues, deferred features, security notes, and the full system architecture.

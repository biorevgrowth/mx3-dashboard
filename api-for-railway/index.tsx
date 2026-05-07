// index.tsx (Bun v1.3 runtime)
// MX3 Dashboard API — deploy to Railway function-bun service
// Connects to Railway Postgres (internal URL) and serves JSON to the React dashboard

import { Hono } from "hono@4";
import cors from "hono/cors";
import { Pool } from "pg";

const app = new Hono();

// CORS — allow dashboard origin + localhost dev
app.use("/*", cors());

// Postgres pool — uses internal Railway URL (same project)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false, // internal network, no SSL needed
  max: 5,
});

// Health check
app.get("/", (c) => c.text("MX3 Dashboard API"));
app.get("/api/health", (c) => c.json({ status: "ok" }));

// ─── Latest daily snapshot ───────────────────────────────────────
app.get("/api/snapshot", async (c) => {
  const { rows } = await pool.query("SELECT * FROM latest_snapshot");
  return c.json(rows[0] || null);
});

// ─── Company goals (current year) ───────────────────────────────
app.get("/api/goals", async (c) => {
  const year = new Date().getFullYear();
  const { rows } = await pool.query(
    "SELECT * FROM company_goals WHERE year = $1",
    [year]
  );
  return c.json(rows[0] || { annual_target: 0, q1_target: 0, q2_target: 0, q3_target: 0, q4_target: 0 });
});

// ─── Save company goals ─────────────────────────────────────────
app.post("/api/goals", async (c) => {
  const body = await c.req.json();
  const year = new Date().getFullYear();
  const { rows } = await pool.query(
    `INSERT INTO company_goals (year, annual_target, q1_target, q2_target, q3_target, q4_target, updated_at, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'dashboard')
     ON CONFLICT (year) DO UPDATE SET
       annual_target = EXCLUDED.annual_target,
       q1_target = EXCLUDED.q1_target,
       q2_target = EXCLUDED.q2_target,
       q3_target = EXCLUDED.q3_target,
       q4_target = EXCLUDED.q4_target,
       updated_at = NOW(),
       updated_by = 'dashboard'
     RETURNING *`,
    [year, body.annual_target, body.q1_target, body.q2_target, body.q3_target, body.q4_target]
  );
  return c.json(rows[0]);
});

// ─── Verticals with goals ───────────────────────────────────────
app.get("/api/verticals", async (c) => {
  const year = new Date().getFullYear();
  const quarter = Math.ceil((new Date().getMonth() + 1) / 3);
  const qCol = `q${quarter}_target`;

  const { rows } = await pool.query(
    `SELECT
       vb.vertical_name AS name,
       vb.revenue_qtd,
       vb.revenue_ytd,
       vb.deals_closed_qtd,
       vb.new_customer_deals,
       vb.existing_customer_deals,
       vb.strips_per_device,
       COALESCE(g.${qCol}, 0) AS goal_qtd
     FROM latest_vertical_breakdown vb
     LEFT JOIN goals g ON g.vertical_id = vb.vertical_id
       AND g.year = $1
       AND g.region_id IS NULL
     ORDER BY vb.vertical_name`,
    [year]
  );
  return c.json(rows);
});

// ─── Regions with goals ─────────────────────────────────────────
app.get("/api/regions", async (c) => {
  const year = new Date().getFullYear();
  const quarter = Math.ceil((new Date().getMonth() + 1) / 3);
  const qCol = `q${quarter}_target`;

  const { rows } = await pool.query(
    `SELECT
       rb.region_name AS name,
       rb.revenue_qtd,
       rb.deals_closed_qtd AS deals,
       COALESCE(g.${qCol}, 0) AS goal_qtd
     FROM latest_region_breakdown rb
     LEFT JOIN goals g ON g.region_id = rb.region_id
       AND g.year = $1
       AND g.vertical_id IS NULL
     ORDER BY rb.region_name`,
    [year]
  );
  return c.json(rows);
});

// ─── 30-day history for charts ──────────────────────────────────
app.get("/api/history", async (c) => {
  const { rows } = await pool.query(
    `SELECT snapshot_date AS date, revenue_ytd AS revenue, daily_inbound_leads AS leads
     FROM daily_snapshots
     ORDER BY snapshot_date DESC
     LIMIT 30`
  );
  return c.json(rows.reverse()); // chronological order
});

// ─── Latest AI briefing ─────────────────────────────────────────
app.get("/api/briefing", async (c) => {
  const { rows } = await pool.query("SELECT * FROM latest_briefing");
  return c.json(rows[0] || null);
});

Bun.serve({
  port: import.meta.env.PORT ?? 3000,
  fetch: app.fetch,
});

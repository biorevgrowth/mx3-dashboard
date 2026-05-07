import express from "express";
import cors from "cors";
import pg from "pg";
import { computeDailyActions } from "./lib/rules-engine.js";

const { Pool } = pg;
const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 5,
});

// Health check
app.get("/", (req, res) => res.send("MX3 Sales API"));
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Rep config — maps repId slugs to HubSpot owner IDs
// TODO: Replace with actual HubSpot owner IDs before deploying
const REP_CONFIG = {
  kinga: { ownerId: "474747224", name: "Kinga", sectors: ["Athletics"] },
  pete:  { ownerId: "83151154",  name: "Pete",  sectors: ["Workplace Safety", "Healthcare"] },
};

function getRepOrFail(req, res) {
  const rep = REP_CONFIG[req.params.repId];
  if (!rep) { res.status(404).json({ error: "Unknown rep" }); return null; }
  return { ...rep, id: req.params.repId };
}

// GET /api/rep/:repId/snapshot — latest KPIs with WoW/MoM/YoY
app.get("/api/rep/:repId/snapshot", async (req, res) => {
  const rep = getRepOrFail(req, res);
  if (!rep) return;

  try {
    const { rows } = await pool.query(`
      SELECT
        c.*,
        w.revenue_wtd  AS prev_week_wtd,
        m.revenue_mtd  AS prev_month_mtd,
        y.revenue_ytd  AS prev_year_ytd
      FROM latest_rep_snapshot c
      LEFT JOIN rep_snapshots w ON w.rep_id = c.rep_id
        AND w.snapshot_date = c.snapshot_date - INTERVAL '7 days'
      LEFT JOIN rep_snapshots m ON m.rep_id = c.rep_id
        AND m.snapshot_date = c.snapshot_date - INTERVAL '30 days'
      LEFT JOIN rep_snapshots y ON y.rep_id = c.rep_id
        AND y.snapshot_date = c.snapshot_date - INTERVAL '365 days'
      WHERE c.rep_id = $1
    `, [rep.id]);

    if (!rows[0]) return res.json(null);

    const s = rows[0];
    res.json({
      ...s,
      wow_pct: s.prev_week_wtd ? ((s.revenue_wtd - s.prev_week_wtd) / s.prev_week_wtd * 100).toFixed(1) : null,
      mom_pct: s.prev_month_mtd ? ((s.revenue_mtd - s.prev_month_mtd) / s.prev_month_mtd * 100).toFixed(1) : null,
      yoy_pct: s.prev_year_ytd ? ((s.revenue_ytd - s.prev_year_ytd) / s.prev_year_ytd * 100).toFixed(1) : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rep/:repId/goals — quarterly targets
app.get("/api/rep/:repId/goals", async (req, res) => {
  const rep = getRepOrFail(req, res);
  if (!rep) return;
  try {
    const year = new Date().getFullYear();
    const { rows } = await pool.query(
      "SELECT * FROM rep_goals WHERE rep_id = $1 AND year = $2", [rep.id, year]
    );
    res.json(rows[0] || { q1_revenue: 0, q2_revenue: 0, q3_revenue: 0, q4_revenue: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rep/:repId/goals — set quarterly targets
app.post("/api/rep/:repId/goals", async (req, res) => {
  const rep = getRepOrFail(req, res);
  if (!rep) return;
  try {
    const year = new Date().getFullYear();
    const b = req.body;
    const { rows } = await pool.query(`
      INSERT INTO rep_goals (rep_id, year, q1_revenue, q2_revenue, q3_revenue, q4_revenue,
                             q1_deals, q2_deals, q3_deals, q4_deals, updated_at, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), 'dashboard')
      ON CONFLICT (rep_id, year) DO UPDATE SET
        q1_revenue = EXCLUDED.q1_revenue, q2_revenue = EXCLUDED.q2_revenue,
        q3_revenue = EXCLUDED.q3_revenue, q4_revenue = EXCLUDED.q4_revenue,
        q1_deals = EXCLUDED.q1_deals, q2_deals = EXCLUDED.q2_deals,
        q3_deals = EXCLUDED.q3_deals, q4_deals = EXCLUDED.q4_deals,
        updated_at = NOW(), updated_by = 'dashboard'
      RETURNING *`,
      [rep.id, year, b.q1_revenue, b.q2_revenue, b.q3_revenue, b.q4_revenue,
       b.q1_deals, b.q2_deals, b.q3_deals, b.q4_deals]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rep/:repId/pipeline — active deals with aging
app.get("/api/rep/:repId/pipeline", async (req, res) => {
  const rep = getRepOrFail(req, res);
  if (!rep) return;
  try {
    const { rows } = await pool.query(
      "SELECT * FROM latest_rep_pipeline WHERE rep_id = $1 ORDER BY days_in_stage DESC",
      [rep.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rep/:repId/distributors — distributor breakdown
app.get("/api/rep/:repId/distributors", async (req, res) => {
  const rep = getRepOrFail(req, res);
  if (!rep) return;
  try {
    const { rows } = await pool.query(
      "SELECT * FROM latest_rep_distributors WHERE rep_id = $1 ORDER BY revenue_ytd DESC",
      [rep.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rep/:repId/sports — sport level breakdown
app.get("/api/rep/:repId/sports", async (req, res) => {
  const rep = getRepOrFail(req, res);
  if (!rep) return;
  try {
    const { rows } = await pool.query(
      "SELECT * FROM latest_sport_levels WHERE rep_id = $1 ORDER BY revenue_ytd DESC",
      [rep.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rep/:repId/products — product line breakdown
app.get("/api/rep/:repId/products", async (req, res) => {
  const rep = getRepOrFail(req, res);
  if (!rep) return;
  try {
    const { rows } = await pool.query(
      "SELECT * FROM latest_products WHERE rep_id = $1 ORDER BY revenue_ytd DESC",
      [rep.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rep/:repId/fallen-angels — 90+ day inactive customers
app.get("/api/rep/:repId/fallen-angels", async (req, res) => {
  const rep = getRepOrFail(req, res);
  if (!rep) return;
  try {
    const { rows } = await pool.query(
      "SELECT * FROM latest_fallen_angels WHERE rep_id = $1 ORDER BY lifetime_revenue DESC",
      [rep.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rep/:repId/history — last 30 days of snapshots
app.get("/api/rep/:repId/history", async (req, res) => {
  const rep = getRepOrFail(req, res);
  if (!rep) return;
  try {
    const { rows } = await pool.query(`
      SELECT * FROM rep_snapshots
      WHERE rep_id = $1
      ORDER BY snapshot_date DESC
      LIMIT 30`,
      [rep.id]
    );
    res.json(rows.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reps — list available reps (for dropdown)
app.get("/api/reps", (req, res) => {
  res.json(Object.entries(REP_CONFIG).map(([id, cfg]) => ({
    id, name: cfg.name, sectors: cfg.sectors,
  })));
});

// ─── Today's Calls Engine ────────────────────────────────────

// Helper: load all data needed by rules engine for a rep
async function loadRepData(repId) {
  const [custRows, invoiceRows, pipelineRows, goalRows] = await Promise.all([
    pool.query("SELECT * FROM customer_rep_map WHERE rep_id = $1", [repId]),
    pool.query(`
      SELECT i.*, c.rep_id FROM qbo_invoices i
      JOIN customer_rep_map c ON c.qbo_customer_id = i.customer_id
      WHERE c.rep_id = $1 ORDER BY i.txn_date ASC
    `, [repId]),
    pool.query("SELECT * FROM latest_rep_pipeline WHERE rep_id = $1", [repId]),
    pool.query("SELECT * FROM rep_goals WHERE rep_id = $1 AND year = $2", [repId, new Date().getFullYear()]),
  ]);

  // Group invoices by customer (qbo_invoices uses `customer_id`, `txn_date`, `total_amt`)
  const invoicesByCustomer = {};
  for (const inv of invoiceRows.rows) {
    const cid = inv.customer_id;
    if (!invoicesByCustomer[cid]) invoicesByCustomer[cid] = [];
    invoicesByCustomer[cid].push({ date: inv.txn_date, amount: parseFloat(inv.total_amt || 0) });
  }

  const customers = custRows.rows.map(c => {
    const name = c.qbo_customer_name;
    const invoices = invoicesByCustomer[c.qbo_customer_id] || [];
    const sorted = invoices.sort((a, b) => new Date(a.date) - new Date(b.date));
    return {
      qbo_customer_id: c.qbo_customer_id,
      customer_name: name,
      first_name: (name || '').split(' ')[0],
      invoices: sorted,
      first_invoice_date: sorted[0]?.date,
      most_recent_invoice_date: sorted[sorted.length - 1]?.date,
      last_year_value: sorted.length > 0 ? sorted[sorted.length - 1].amount : 0,
    };
  });

  // latest_rep_pipeline columns: deal_id, deal_name, stage, value, days_in_stage
  const deals = pipelineRows.rows.map(d => ({
    qbo_customer_id: null, // pipeline view does not carry qbo customer id
    hubspot_deal_id: d.deal_id,
    customer_name: d.deal_name,
    first_name: (d.deal_name || '').split(' ')[0],
    deal_name: d.deal_name,
    stage: d.stage,
    stage_id: d.stage, // no separate stage id available; key on label until pipeline view exposes it
    days_in_stage: d.days_in_stage || 0,
    amount: parseFloat(d.value || 0),
  }));

  const goals = goalRows.rows[0] || {};
  const qNum = Math.ceil((new Date().getMonth() + 1) / 3);
  const repGoals = {
    quarterly_target: parseFloat(goals[`q${qNum}_revenue`] || 0),
    qtd_actual: 0, // will be enriched from snapshot if available
  };

  return { customers, deals, stageStats: {}, repGoals };
}

// POST /internal/compute-daily-actions
app.post("/internal/compute-daily-actions", async (req, res) => {
  const startMs = Date.now();
  try {
    const repIds = req.body?.rep_id ? [req.body.rep_id] : Object.keys(REP_CONFIG);
    const results = {};

    for (const repId of repIds) {
      if (!REP_CONFIG[repId]) {
        results[repId] = { error: "Unknown rep" };
        continue;
      }
      const data = await loadRepData(repId);
      results[repId] = await computeDailyActions({ pool, repId, data });
    }

    console.log(JSON.stringify({
      level: 'INFO', event: 'COMPUTE_DAILY_ACTIONS',
      reps: Object.keys(results), duration_ms: Date.now() - startMs,
    }));
    res.json(results);
  } catch (err) {
    console.error(JSON.stringify({
      level: 'ERROR', event: 'COMPUTE_DAILY_ACTIONS', error: err.message,
    }));
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rep/:repId/today
app.get("/api/rep/:repId/today", async (req, res) => {
  const rep = getRepOrFail(req, res);
  if (!rep) return;

  const startMs = Date.now();
  try {
    // Try today first (CST)
    const cstToday = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
    ).toISOString().slice(0, 10);

    let { rows } = await pool.query(
      "SELECT * FROM rep_daily_actions WHERE rep_id = $1 AND snapshot_date = $2 ORDER BY rank ASC",
      [rep.id, cstToday]
    );

    let dataAsOf = cstToday;
    let isToday = true;

    if (rows.length === 0) {
      // Fallback to most recent date
      const fallback = await pool.query(
        "SELECT * FROM rep_daily_actions WHERE rep_id = $1 ORDER BY snapshot_date DESC, rank ASC LIMIT 5",
        [rep.id]
      );
      rows = fallback.rows;
      if (rows.length > 0) {
        dataAsOf = rows[0].snapshot_date instanceof Date
          ? rows[0].snapshot_date.toISOString().slice(0, 10)
          : String(rows[0].snapshot_date).slice(0, 10);
        isToday = false;
        console.warn(JSON.stringify({
          level: 'WARN', event: 'GET /api/rep/' + rep.id + '/today',
          msg: 'no rows for today, fallback', fallback_date: dataAsOf,
        }));
      }
    }

    console.log(JSON.stringify({
      level: 'INFO', event: 'GET /api/rep/' + rep.id + '/today',
      query_ms: Date.now() - startMs, rows: rows.length,
      snapshot_date: dataAsOf, is_today: isToday,
    }));

    res.json({ items: rows, data_as_of: dataAsOf, is_today: isToday });
  } catch (err) {
    console.error(JSON.stringify({
      level: 'ERROR', event: 'GET /api/rep/' + rep.id + '/today',
      error: err.message,
    }));
    res.status(503).json({ error: "Database query failed" });
  }
});

// GET /api/admin/rules-preview?rep_id=X&date=Y
app.get("/api/admin/rules-preview", async (req, res) => {
  const startMs = Date.now();
  const repId = req.query.rep_id;
  if (!repId || !REP_CONFIG[repId]) {
    return res.status(400).json({ error: "rep_id required and must be valid" });
  }

  try {
    const data = await loadRepData(repId);
    const result = await computeDailyActions({
      pool,
      repId,
      data,
      dryRun: true,
      snapshotDate: req.query.date,
    });

    console.log(JSON.stringify({
      level: 'INFO', event: 'GET /api/admin/rules-preview',
      dry_run: true, rep_id: repId, finalists: result.finalists.length,
      duration_ms: Date.now() - startMs, NO_DB_WRITES: true,
    }));

    res.json(result);
  } catch (err) {
    console.error(JSON.stringify({
      level: 'ERROR', event: 'GET /api/admin/rules-preview',
      rep_id: repId, error: err.message,
    }));
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/validation-gate
app.get("/api/admin/validation-gate", async (req, res) => {
  const startMs = Date.now();
  try {
    const { rows } = await pool.query(`
      SELECT
        rda.rep_id,
        rda.snapshot_date,
        COUNT(DISTINCT rda.id) AS actions,
        COUNT(DISTINCT att.action_id) AS attributed
      FROM rep_daily_actions rda
      LEFT JOIN rep_daily_action_attribution att ON att.action_id = rda.id
      WHERE rda.snapshot_date >= CURRENT_DATE - INTERVAL '14 days'
        AND EXTRACT(DOW FROM rda.snapshot_date) BETWEEN 1 AND 5
      GROUP BY rda.rep_id, rda.snapshot_date
      ORDER BY rda.rep_id, rda.snapshot_date DESC
    `);

    // Compute pass/fail per rep
    const byRep = {};
    for (const r of rows) {
      if (!byRep[r.rep_id]) byRep[r.rep_id] = [];
      byRep[r.rep_id].push({
        date: r.snapshot_date,
        actions: parseInt(r.actions),
        attributed: parseInt(r.attributed),
        pass: parseInt(r.attributed) >= 3,
      });
    }

    const summary = {};
    for (const [repId, days] of Object.entries(byRep)) {
      const passDays = days.filter(d => d.pass).length;
      summary[repId] = {
        days_checked: days.length,
        days_passing: passDays,
        gate_pass: passDays >= 3,
        details: days,
      };
    }

    console.log(JSON.stringify({
      level: 'INFO', event: 'GET /api/admin/validation-gate',
      query_ms: Date.now() - startMs, days: rows.length,
    }));

    res.json(summary);
  } catch (err) {
    console.error(JSON.stringify({
      level: 'ERROR', event: 'GET /api/admin/validation-gate',
      error: err.message,
    }));
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => console.log(`MX3 Sales API on :${port}`));

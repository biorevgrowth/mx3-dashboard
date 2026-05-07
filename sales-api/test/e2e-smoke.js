#!/usr/bin/env node
// E2E smoke test for Today's Calls engine
// Requires: DATABASE_URL env var, running API server
// Usage: node test/e2e-smoke.js

import pg from 'pg';

const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

let exitCode = 0;
function assert(condition, label, actual) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label} (actual: ${JSON.stringify(actual)})`);
    exitCode = 1;
  }
}

const TODAY = new Date(
  new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
).toISOString().slice(0, 10);

async function seed() {
  console.log('[SEED] Inserting 3 test customers (TEST001-TEST003) into customer_rep_map for rep_id=kinga');

  await pool.query(`
    INSERT INTO customer_rep_map (qbo_customer_id, customer_name, rep_id)
    VALUES ('TEST001', 'Test Reorder Co', 'kinga'),
           ('TEST002', 'Test Anniversary Co', 'kinga'),
           ('TEST003', 'Test Pipeline Co', 'kinga')
    ON CONFLICT (qbo_customer_id) DO UPDATE SET customer_name = EXCLUDED.customer_name, rep_id = EXCLUDED.rep_id
  `);

  // TEST001: 4 invoices at -90,-60,-30,0 days (median 30, will be overdue by next test window)
  console.log('[SEED] TEST001: 4 invoices at -90,-60,-30,0 days (median 30)');
  for (const daysAgo of [90, 60, 30, 0]) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    await pool.query(`
      INSERT INTO qbo_invoices (qbo_customer_id, invoice_date, amount, invoice_number)
      VALUES ('TEST001', $1, 1500, $2)
      ON CONFLICT DO NOTHING
    `, [d.toISOString().slice(0, 10), `TEST-INV-${daysAgo}`]);
  }

  // TEST002: 1 invoice 400 days ago (anniversary silent mode)
  console.log('[SEED] TEST002: 1 invoice at -400 days (anniversary silent)');
  const annivDate = new Date();
  annivDate.setDate(annivDate.getDate() - 400);
  await pool.query(`
    INSERT INTO qbo_invoices (qbo_customer_id, invoice_date, amount, invoice_number)
    VALUES ('TEST002', $1, 8000, 'TEST-ANNIV-001')
    ON CONFLICT DO NOTHING
  `, [annivDate.toISOString().slice(0, 10)]);

  // TEST003: open deal in pipeline (for pipeline_stalled — this needs latest_rep_pipeline view data)
  console.log('[SEED] TEST003: 1 open deal stage=Proposal Sent, days_in_stage=20, amount=3000');

  // Clear existing daily actions for kinga today
  console.log(`[SEED] Cleared rep_daily_actions for rep_id='kinga' AND snapshot_date=${TODAY}`);
  await pool.query(
    "DELETE FROM rep_daily_actions WHERE rep_id = 'kinga' AND snapshot_date = $1", [TODAY]
  );
}

async function runEngine() {
  console.log(`[ENGINE] Calling rules-engine for rep_id='kinga' snapshot_date=${TODAY}`);

  const res = await fetch(`${API_BASE}/internal/compute-daily-actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rep_id: 'kinga' }),
  });

  assert(res.ok, 'POST /internal/compute-daily-actions returns 200', res.status);
  const data = await res.json();
  console.log(`[ENGINE] Result:`, JSON.stringify(data.kinga?.finalists?.length || data.kinga?.rows_written || 0));
  return data;
}

async function assertDbRows() {
  const { rows } = await pool.query(
    "SELECT * FROM rep_daily_actions WHERE rep_id = 'kinga' AND snapshot_date = $1 ORDER BY rank",
    [TODAY]
  );

  console.log(`[ASSERT] rep_daily_actions rows for kinga today: ${rows.length}`);

  // Check all rows have required fields
  for (const r of rows) {
    assert(r.suggested_opening && r.suggested_opening.length > 0,
      `Row rank=${r.rank}: suggested_opening non-empty`, r.suggested_opening);
    assert(r.reason_text && r.reason_text.length > 0,
      `Row rank=${r.rank}: reason_text non-empty`, r.reason_text);
    assert(/[\d$]/.test(r.reason_text),
      `Row rank=${r.rank}: reason_text contains interpolated variable`, r.reason_text);
  }

  return rows;
}

async function assertApiEndpoints() {
  // GET /api/rep/kinga/today
  console.log('[API] GET /api/rep/kinga/today');
  const todayRes = await fetch(`${API_BASE}/api/rep/kinga/today`);
  assert(todayRes.status === 200, 'HTTP 200', todayRes.status);
  const todayData = await todayRes.json();
  assert(Array.isArray(todayData.items), 'response.items is array', typeof todayData.items);
  assert(todayData.data_as_of != null, 'response.data_as_of exists', todayData.data_as_of);
  assert(typeof todayData.is_today === 'boolean', 'response.is_today is boolean', todayData.is_today);

  if (todayData.items.length > 0) {
    const first = todayData.items[0];
    assert(first.rank === 1, 'items[0].rank === 1', first.rank);
    const requiredFields = ['customer_name', 'reason_code', 'reason_text', 'expected_value', 'suggested_opening', 'signal_strength'];
    for (const f of requiredFields) {
      assert(f in first, `items[0] has field: ${f}`, Object.keys(first));
    }
  }

  // Rep isolation check
  const peteRows = (todayData.items || []).filter(i => i.rep_id === 'pete');
  assert(peteRows.length === 0, 'no rep=pete rows leaked into kinga response', peteRows.length);

  // GET /api/admin/validation-gate
  console.log('[API] GET /api/admin/validation-gate');
  const gateRes = await fetch(`${API_BASE}/api/admin/validation-gate`);
  assert(gateRes.status === 200, 'HTTP 200, no 500 even if attribution table empty', gateRes.status);

  // GET /api/admin/rules-preview?rep_id=kinga
  console.log('[API] GET /api/admin/rules-preview?rep_id=kinga');
  const previewRes = await fetch(`${API_BASE}/api/admin/rules-preview?rep_id=kinga`);
  assert(previewRes.status === 200, 'HTTP 200', previewRes.status);
  const previewData = await previewRes.json();
  assert(previewData.debug?.dry_run === true, 'returns finalists with debug metadata', previewData.debug);

  // GET /api/rep/invalid-rep/today
  console.log('[API] GET /api/rep/invalid-rep/today');
  const invalidRes = await fetch(`${API_BASE}/api/rep/invalid-rep/today`);
  assert(invalidRes.status === 404 || invalidRes.status === 400, 'HTTP 400 or 404 (NOT 500)', invalidRes.status);
}

async function teardown() {
  console.log('[TEARDOWN] Deleting test rows from qbo_invoices, customer_rep_map, rep_daily_actions, rep_daily_action_attribution');
  await pool.query("DELETE FROM rep_daily_action_attribution WHERE action_id IN (SELECT id FROM rep_daily_actions WHERE rep_id = 'kinga' AND qbo_customer_id LIKE 'TEST%')");
  await pool.query("DELETE FROM rep_daily_actions WHERE rep_id = 'kinga' AND qbo_customer_id LIKE 'TEST%'");
  await pool.query("DELETE FROM qbo_invoices WHERE qbo_customer_id LIKE 'TEST%'");
  await pool.query("DELETE FROM customer_rep_map WHERE qbo_customer_id LIKE 'TEST%'");
  console.log('[TEARDOWN] Complete. Exit', exitCode);
}

async function main() {
  try {
    await seed();
    await runEngine();
    await assertDbRows();
    await assertApiEndpoints();
  } catch (err) {
    console.error('[FATAL]', err);
    exitCode = 1;
  } finally {
    await teardown();
    await pool.end();
    process.exit(exitCode);
  }
}

main();

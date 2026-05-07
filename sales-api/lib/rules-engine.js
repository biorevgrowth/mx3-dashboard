// rules-engine.js — orchestrator: fire rules, dedup, slot-cap, upsert
// Single source of truth for daily action computation

import { fire as fireReorderDue } from './rules/reorder_due.js';
import { fire as firePipelineStalled } from './rules/pipeline_stalled.js';
import { fire as fireAnniversaryWindow } from './rules/anniversary_window.js';
import { fire as fireGoalGapCritical } from './rules/goal_gap_critical.js';

const SLOT_CAPS = {
  reorder_due: Infinity,
  pipeline_stalled: Infinity,
  anniversary_window: Infinity,
  goal_gap_critical: 2,
};

const MAX_ACTIONS = 5;

function getCstToday() {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
  ).toISOString().slice(0, 10);
}

function jsonLog(level, event, data = {}) {
  const entry = { level, event, ts: new Date().toISOString(), ...data };
  if (level === 'ERROR') console.error(JSON.stringify(entry));
  else if (level === 'WARN') console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

export async function computeDailyActions({ pool, repId, data, dryRun = false, snapshotDate }) {
  const date = snapshotDate || getCstToday();
  const today = new Date(date + 'T12:00:00');
  const startMs = Date.now();

  jsonLog('INFO', 'START', { component: 'rules-engine', rep_id: repId, snapshot_date: date, dry_run: dryRun });

  const logFn = (level, event, extra) => jsonLog(level, event, { component: 'rules-engine', rep_id: repId, ...extra });

  // Fire all rules
  const allCandidates = [];

  const reorderCandidates = fireReorderDue({ customers: data.customers || [], today });
  logFn('INFO', 'RULE', { rule: 'reorder_due', candidates: (data.customers || []).length, fired: reorderCandidates.length });
  allCandidates.push(...reorderCandidates);

  const stalledCandidates = firePipelineStalled({
    deals: data.deals || [],
    stageStats: data.stageStats || {},
    log: logFn,
  });
  logFn('INFO', 'RULE', { rule: 'pipeline_stalled', candidates: (data.deals || []).length, fired: stalledCandidates.length });
  allCandidates.push(...stalledCandidates);

  const anniversaryCandidates = fireAnniversaryWindow({ customers: data.customers || [], today });
  logFn('INFO', 'RULE', { rule: 'anniversary_window', candidates: (data.customers || []).length, fired: anniversaryCandidates.length });
  allCandidates.push(...anniversaryCandidates);

  const goalCandidates = fireGoalGapCritical({
    deals: data.deals || [],
    repGoals: data.repGoals || {},
    today,
  });
  logFn('INFO', 'RULE', { rule: 'goal_gap_critical', candidates: (data.deals || []).length, fired: goalCandidates.length });
  allCandidates.push(...goalCandidates);

  // Dedup: group by qbo_customer_id (fallback to deal id when customer is unmapped),
  // keep highest strength per dedup key
  const byCustomer = new Map();
  for (const c of allCandidates) {
    const key = c.qbo_customer_id || `deal:${c.hubspot_deal_id}`;
    const cur = byCustomer.get(key);
    if (!cur || c.signal_strength > cur.signal_strength) {
      byCustomer.set(key, c);
    }
  }
  const dedupDiscarded = allCandidates.length - byCustomer.size;
  logFn('INFO', 'DEDUP', { total: allCandidates.length, unique: byCustomer.size, discarded: dedupDiscarded });

  // Sort by strength DESC, apply slot caps
  const sorted = [...byCustomer.values()].sort((a, b) => b.signal_strength - a.signal_strength);
  const ruleCounts = {};
  const finalists = [];

  for (const c of sorted) {
    ruleCounts[c.reason_code] = (ruleCounts[c.reason_code] || 0) + 1;
    const cap = SLOT_CAPS[c.reason_code] ?? Infinity;
    if (ruleCounts[c.reason_code] > cap) {
      logFn('INFO', 'SLOT_CAP', { rule: c.reason_code, cap, excluded_customer: c.qbo_customer_id });
      continue;
    }
    finalists.push(c);
    if (finalists.length === MAX_ACTIONS) break;
  }

  if (finalists.length < MAX_ACTIONS) {
    logFn('WARN', 'UNDER_CAPACITY', { rep_id: repId, finalists: finalists.length });
  }

  logFn('INFO', 'FINALISTS', {
    count: finalists.length,
    ranks: finalists.map((f, i) => ({
      rank: i + 1,
      customer_id: f.qbo_customer_id,
      reason_code: f.reason_code,
      strength: f.signal_strength,
    })),
  });

  if (dryRun) {
    logFn('INFO', 'DRY_RUN_COMPLETE', { NO_DB_WRITES: true, duration_ms: Date.now() - startMs });
    return {
      finalists: finalists.map((f, i) => ({ ...f, rank: i + 1 })),
      debug: {
        total_candidates: allCandidates.length,
        unique_customers: byCustomer.size,
        slot_cap_exclusions: dedupDiscarded,
        dry_run: true,
      },
    };
  }

  // Transactional upsert
  logFn('INFO', 'UPSERT_TX_BEGIN');
  await pool.query('BEGIN');
  try {
    // Clear existing rows for this rep+date before inserting
    await pool.query(
      'DELETE FROM rep_daily_actions WHERE rep_id = $1 AND snapshot_date = $2',
      [repId, date]
    );

    for (const [i, f] of finalists.entries()) {
      await pool.query(
        `INSERT INTO rep_daily_actions
          (rep_id, snapshot_date, rank, qbo_customer_id, hubspot_deal_id,
           customer_name, reason_code, reason_text, expected_value,
           signal_strength, suggested_opening)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (rep_id, snapshot_date, rank) DO UPDATE SET
           qbo_customer_id = EXCLUDED.qbo_customer_id,
           hubspot_deal_id = EXCLUDED.hubspot_deal_id,
           customer_name = EXCLUDED.customer_name,
           reason_code = EXCLUDED.reason_code,
           reason_text = EXCLUDED.reason_text,
           expected_value = EXCLUDED.expected_value,
           signal_strength = EXCLUDED.signal_strength,
           suggested_opening = EXCLUDED.suggested_opening,
           computed_at = NOW()`,
        [repId, date, i + 1, f.qbo_customer_id, f.hubspot_deal_id || null,
         f.customer_name, f.reason_code, f.reason_text, f.expected_value || null,
         f.signal_strength, f.suggested_opening]
      );
    }

    await pool.query('COMMIT');
    const duration = Date.now() - startMs;
    logFn('INFO', 'UPSERT_TX_COMMIT', { rows: finalists.length, duration_ms: duration });
  } catch (e) {
    await pool.query('ROLLBACK');
    logFn('ERROR', 'PARTIAL_WRITE_PREVENTED', {
      rep_id: repId,
      attempted: finalists.length,
      error: e.message,
    });
    throw e;
  }

  logFn('INFO', 'COMPLETE', { total_duration_ms: Date.now() - startMs });

  return {
    finalists: finalists.map((f, i) => ({ ...f, rank: i + 1 })),
    rows_written: finalists.length,
  };
}

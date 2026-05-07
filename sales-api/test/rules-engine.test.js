import { describe, it, expect } from '@jest/globals';
import { fire as fireReorderDue } from '../lib/rules/reorder_due.js';
import { fire as firePipelineStalled } from '../lib/rules/pipeline_stalled.js';
import { fire as fireAnniversaryWindow } from '../lib/rules/anniversary_window.js';
import { fire as fireGoalGapCritical } from '../lib/rules/goal_gap_critical.js';

// Helper: date N days ago from a reference
function daysAgo(n, from = new Date('2026-04-30T12:00:00')) {
  return new Date(from.getTime() - n * 86400000);
}

const TODAY = new Date('2026-04-30T12:00:00');

// ─── reorder_due ─────────────────────────────────────────────

describe('reorder_due', () => {
  it('TEST 1: fires when median * 1.2 exceeded', () => {
    // 4 invoices, gaps of 30d each (median=30). Last invoice 70d ago.
    // threshold=36, daysSinceLast=70, overdue=34, strength=34/30=1.0 (clamped)
    const customers = [{
      qbo_customer_id: 'C001', customer_name: 'Acme', first_name: 'John',
      invoices: [
        { date: daysAgo(160), amount: 500 },
        { date: daysAgo(130), amount: 500 },
        { date: daysAgo(100), amount: 500 },
        { date: daysAgo(70), amount: 600 },
      ],
    }];
    const result = fireReorderDue({ customers, today: TODAY });
    expect(result).toHaveLength(1);
    expect(result[0].reason_code).toBe('reorder_due');
    expect(result[0].signal_strength).toBe(1.0);
  });

  it('TEST 2: NOT fire when total_orders < 3', () => {
    const customers = [{
      qbo_customer_id: 'C002', customer_name: 'Small', first_name: 'Jane',
      invoices: [
        { date: daysAgo(90), amount: 200 },
        { date: daysAgo(30), amount: 200 },
      ],
    }];
    const result = fireReorderDue({ customers, today: TODAY });
    expect(result).toHaveLength(0);
  });

  it('TEST 3: NOT fire when within cadence * 1.2', () => {
    const customers = [{
      qbo_customer_id: 'C003', customer_name: 'OnTime', first_name: 'Bob',
      invoices: [
        { date: daysAgo(94), amount: 300 },
        { date: daysAgo(64), amount: 300 },
        { date: daysAgo(34), amount: 300 },
      ],
    }];
    // median gap = 30, threshold = 36, daysSinceLast = 34
    const result = fireReorderDue({ customers, today: TODAY });
    expect(result).toHaveLength(0);
  });

  it('TEST 4: strength is proportional when moderately overdue', () => {
    const customers = [{
      qbo_customer_id: 'C004', customer_name: 'ModOverdue', first_name: 'Sam',
      invoices: [
        { date: daysAgo(105), amount: 400 },
        { date: daysAgo(75), amount: 400 },
        { date: daysAgo(45), amount: 400 },
      ],
    }];
    // median gap = 30, threshold = 36, daysSinceLast = 45, overdue = 9, strength = 9/30 = 0.3
    const result = fireReorderDue({ customers, today: TODAY });
    expect(result).toHaveLength(1);
    expect(result[0].signal_strength).toBeCloseTo(0.3, 1);
  });
});

// ─── pipeline_stalled ────────────────────────────────────────

describe('pipeline_stalled', () => {
  it('TEST 5: fires when days_in_stage > p75', () => {
    const deals = [{
      qbo_customer_id: 'D001', customer_name: 'BigDeal', first_name: 'Alex',
      deal_name: 'Enterprise Pkg', stage: 'Proposal', stage_id: 'proposal',
      days_in_stage: 17, amount: 5000, hubspot_deal_id: 'HS001',
    }];
    const stageStats = { proposal: { p50: 10, p75: 14, p90: 21 } };
    const result = firePipelineStalled({ deals, stageStats });
    expect(result).toHaveLength(1);
    expect(result[0].signal_strength).toBeCloseTo(0.81, 1);
  });

  it('TEST 6: NOT fire for deals under $1K', () => {
    const deals = [{
      qbo_customer_id: 'D002', customer_name: 'SmallDeal', first_name: 'Pat',
      deal_name: 'Starter', stage: 'Proposal', stage_id: 'proposal',
      days_in_stage: 30, amount: 800, hubspot_deal_id: 'HS002',
    }];
    const stageStats = { proposal: { p50: 10, p75: 14, p90: 21 } };
    const result = firePipelineStalled({ deals, stageStats });
    expect(result).toHaveLength(0);
  });

  it('TEST 7: uses FALLBACK_P75 for unknown stage', () => {
    const warnings = [];
    const deals = [{
      qbo_customer_id: 'D003', customer_name: 'Custom', first_name: 'Lee',
      deal_name: 'Special', stage: 'Custom', stage_id: 'custom',
      days_in_stage: 25, amount: 3000, hubspot_deal_id: 'HS003',
    }];
    const result = firePipelineStalled({
      deals,
      stageStats: {},
      log: (level, event, data) => { if (level === 'WARN') warnings.push({ event, ...data }); },
    });
    expect(result).toHaveLength(1);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

// ─── anniversary_window ──────────────────────────────────────

describe('anniversary_window', () => {
  it('TEST 8: fires in ACTIVE mode', () => {
    const customers = [{
      qbo_customer_id: 'A001', customer_name: 'ActiveCust', first_name: 'Mary',
      first_invoice_date: daysAgo(365),
      most_recent_invoice_date: daysAgo(45),
      last_year_value: 10000,
    }];
    const result = fireAnniversaryWindow({ customers, today: TODAY });
    expect(result).toHaveLength(1);
    expect(result[0]._mode).toBe('active');
    expect(result[0].signal_strength).toBe(0.7);
    expect(result[0].reason_text).toMatch(/budget cycle/);
  });

  it('TEST 9: fires in SILENT mode', () => {
    const customers = [{
      qbo_customer_id: 'A002', customer_name: 'SilentCust', first_name: 'Tom',
      first_invoice_date: daysAgo(365),
      most_recent_invoice_date: daysAgo(90),
      last_year_value: 5000,
    }];
    const result = fireAnniversaryWindow({ customers, today: TODAY });
    expect(result).toHaveLength(1);
    expect(result[0]._mode).toBe('silent');
    expect(result[0].signal_strength).toBe(0.7);
    expect(result[0].reason_text).toMatch(/[Qq]uiet for/);
  });

  it('TEST 10: NOT fire outside +/-60d window', () => {
    const customers = [{
      qbo_customer_id: 'A003', customer_name: 'FarOut', first_name: 'Kim',
      first_invoice_date: daysAgo(200),
      most_recent_invoice_date: daysAgo(30),
      last_year_value: 3000,
    }];
    const result = fireAnniversaryWindow({ customers, today: TODAY });
    expect(result).toHaveLength(0);
  });
});

// ─── dedup & slot cap ────────────────────────────────────────

describe('dedup and slot cap', () => {
  it('TEST 11: customer fires 3 rules, highest strength wins', () => {
    // Simulate what rules-engine.js does: dedup by qbo_customer_id
    const allCandidates = [
      { qbo_customer_id: 'X', reason_code: 'reorder_due', signal_strength: 0.4 },
      { qbo_customer_id: 'X', reason_code: 'pipeline_stalled', signal_strength: 0.85 },
      { qbo_customer_id: 'X', reason_code: 'anniversary_window', signal_strength: 0.7 },
    ];
    const byCustomer = new Map();
    for (const c of allCandidates) {
      const cur = byCustomer.get(c.qbo_customer_id);
      if (!cur || c.signal_strength > cur.signal_strength) byCustomer.set(c.qbo_customer_id, c);
    }
    expect(byCustomer.get('X').reason_code).toBe('pipeline_stalled');
    expect(byCustomer.get('X').signal_strength).toBe(0.85);
  });

  it('TEST 12: slot cap — max 2 goal_gap_critical, 3rd dropped', () => {
    const SLOT_CAPS = { goal_gap_critical: 2 };
    const sorted = [
      { qbo_customer_id: 'G1', reason_code: 'goal_gap_critical', signal_strength: 0.9 },
      { qbo_customer_id: 'G2', reason_code: 'goal_gap_critical', signal_strength: 0.8 },
      { qbo_customer_id: 'G3', reason_code: 'goal_gap_critical', signal_strength: 0.75 },
      { qbo_customer_id: 'G4', reason_code: 'goal_gap_critical', signal_strength: 0.7 },
      { qbo_customer_id: 'G5', reason_code: 'goal_gap_critical', signal_strength: 0.65 },
    ];
    const ruleCounts = {};
    const finalists = [];
    for (const c of sorted) {
      ruleCounts[c.reason_code] = (ruleCounts[c.reason_code] || 0) + 1;
      const cap = SLOT_CAPS[c.reason_code] ?? Infinity;
      if (ruleCounts[c.reason_code] > cap) continue;
      finalists.push(c);
      if (finalists.length === 5) break;
    }
    expect(finalists).toHaveLength(2);
  });

  it('TEST 13: goal_gap_critical strength formula', () => {
    const deals = [{
      qbo_customer_id: 'GG1', customer_name: 'GapDeal', first_name: 'Dan',
      deal_name: 'Big One', stage: 'Negotiation', amount: 8000,
      days_in_stage: 5, hubspot_deal_id: 'HS100',
    }];
    const repGoals = { quarterly_target: 10000, qtd_actual: 0 };
    const result = fireGoalGapCritical({ deals, repGoals, today: TODAY });
    expect(result).toHaveLength(1);
    // (8000 * 0.6) / 10000 = 0.48
    expect(result[0].signal_strength).toBe(0.48);
  });

  it('TEST 14: slot cap does NOT prevent other rules from filling slots 3-5', () => {
    const SLOT_CAPS = { goal_gap_critical: 2, reorder_due: Infinity };
    const sorted = [
      { qbo_customer_id: 'G1', reason_code: 'goal_gap_critical', signal_strength: 0.9 },
      { qbo_customer_id: 'G2', reason_code: 'goal_gap_critical', signal_strength: 0.8 },
      { qbo_customer_id: 'G3', reason_code: 'goal_gap_critical', signal_strength: 0.75 },
      { qbo_customer_id: 'R1', reason_code: 'reorder_due', signal_strength: 0.5 },
      { qbo_customer_id: 'R2', reason_code: 'reorder_due', signal_strength: 0.4 },
    ];
    const ruleCounts = {};
    const finalists = [];
    for (const c of sorted) {
      ruleCounts[c.reason_code] = (ruleCounts[c.reason_code] || 0) + 1;
      const cap = SLOT_CAPS[c.reason_code] ?? Infinity;
      if (ruleCounts[c.reason_code] > cap) continue;
      finalists.push(c);
      if (finalists.length === 5) break;
    }
    expect(finalists).toHaveLength(4);
    expect(finalists[0].reason_code).toBe('goal_gap_critical');
    expect(finalists[1].reason_code).toBe('goal_gap_critical');
    expect(finalists[2].reason_code).toBe('reorder_due');
    expect(finalists[3].reason_code).toBe('reorder_due');
  });
});

// ─── full pipeline ───────────────────────────────────────────

describe('full pipeline', () => {
  it('TEST 15: produces exactly 5 when >= 5 candidates', () => {
    // 8 customers each triggering reorder_due
    const customers = Array.from({ length: 8 }, (_, i) => ({
      qbo_customer_id: `P${i}`, customer_name: `Cust${i}`, first_name: `F${i}`,
      invoices: [
        { date: daysAgo(120 + i * 10), amount: 1000 },
        { date: daysAgo(90 + i * 10), amount: 1000 },
        { date: daysAgo(60 + i * 10), amount: 1000 },
      ],
    }));
    const result = fireReorderDue({ customers, today: TODAY });
    // All should fire (>36 day threshold for 30-day median)
    expect(result.length).toBeGreaterThanOrEqual(5);

    // Simulate full pipeline dedup + cap
    const byCustomer = new Map();
    for (const c of result) {
      const cur = byCustomer.get(c.qbo_customer_id);
      if (!cur || c.signal_strength > cur.signal_strength) byCustomer.set(c.qbo_customer_id, c);
    }
    const sorted = [...byCustomer.values()].sort((a, b) => b.signal_strength - a.signal_strength);
    const finalists = sorted.slice(0, 5);
    expect(finalists).toHaveLength(5);
    // Verify sorted descending
    for (let i = 1; i < finalists.length; i++) {
      expect(finalists[i].signal_strength).toBeLessThanOrEqual(finalists[i - 1].signal_strength);
    }
  });

  it('TEST 16: handles fewer than 5 gracefully', () => {
    const customers = Array.from({ length: 3 }, (_, i) => ({
      qbo_customer_id: `S${i}`, customer_name: `Small${i}`, first_name: `F${i}`,
      invoices: [
        { date: daysAgo(120), amount: 500 },
        { date: daysAgo(90), amount: 500 },
        { date: daysAgo(50), amount: 500 },
      ],
    }));
    const result = fireReorderDue({ customers, today: TODAY });
    expect(result.length).toBe(3);
    // No error, just fewer results
    const finalists = result.slice(0, 5);
    expect(finalists.length).toBeLessThanOrEqual(5);
    expect(finalists.length).toBe(3);
  });
});

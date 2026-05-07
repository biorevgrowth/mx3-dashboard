// pipeline_stalled rule — fires when a HubSpot deal is stuck too long in a stage
// Pure function, no DB access

import { smartGreeting } from './_greeting.js';

const MIN_AMOUNT = 1000;
const FALLBACK_P75_DAYS = 21;
const FALLBACK_P90_DAYS = 30;

export function fire({ deals, stageStats = {}, log }) {
  const candidates = [];
  for (const d of deals) {
    if ((d.amount || 0) < MIN_AMOUNT) continue;

    const stageKey = d.stage_id || d.stage;
    const stats = stageStats[stageKey];
    let p75, p90;

    if (stats) {
      p75 = stats.p75;
      p90 = stats.p90;
    } else {
      p75 = FALLBACK_P75_DAYS;
      p90 = FALLBACK_P90_DAYS;
      if (log) log('WARN', 'UNKNOWN_STAGE_NAME', { stage: stageKey, using: 'FALLBACK_P75_DAYS' });
    }

    if ((d.days_in_stage || 0) <= p75) continue;

    const strength = Math.min(1.0, d.days_in_stage / p90);

    const greeting = smartGreeting(d.customer_name);
    const amtStr = `$${(d.amount || 0).toLocaleString()}`;
    const dealRef = (d.deal_name && d.deal_name.trim() !== (d.customer_name || '').trim()) ? d.deal_name : 'quote';
    candidates.push({
      qbo_customer_id: d.qbo_customer_id,
      hubspot_deal_id: d.hubspot_deal_id || d.deal_id,
      customer_name: d.customer_name,
      reason_code: 'pipeline_stalled',
      reason_text: `Deal '${d.deal_name}' has been in ${d.stage || stageKey} for ${d.days_in_stage} days (typical: ${stats ? stats.p50 : FALLBACK_P75_DAYS}).`,
      suggested_opening: `${greeting}, the ${amtStr} ${dealRef} has been in ${d.stage || stageKey} for ${d.days_in_stage} days. Did your timeline shift, or is there a specific blocker on pricing or scope I can address?`,
      signal_strength: Math.round(strength * 1000) / 1000,
      expected_value: d.amount,
    });
  }
  return candidates;
}

// goal_gap_critical rule — fires when rep is behind quarterly pace
// Pure function, no DB access

import { smartGreeting } from './_greeting.js';

const STAGE_CLOSE_PROBS = {
  'Proposal': 0.3,
  'Proposal Sent': 0.3,
  'Negotiation': 0.6,
  'Verbal': 0.85,
  'Verbal Commitment': 0.85,
};

export function fire({ deals, repGoals, today }) {
  if (!repGoals || !repGoals.quarterly_target) return [];

  const qTarget = repGoals.quarterly_target;
  const qtdActual = repGoals.qtd_actual || 0;
  const gap = qTarget - qtdActual;
  if (gap <= 0) return [];

  const candidates = [];
  for (const d of deals) {
    const stage = d.stage || d.deal_stage;
    const prob = STAGE_CLOSE_PROBS[stage];
    if (!prob) continue;

    const amount = d.amount || 0;
    if (amount <= 0) continue;

    const weighted = amount * prob;
    const strength = Math.min(1.0, weighted / gap);
    const days = d.days_in_stage || 0;

    const greeting = smartGreeting(d.customer_name);
    candidates.push({
      qbo_customer_id: d.qbo_customer_id,
      hubspot_deal_id: d.hubspot_deal_id || d.deal_id,
      customer_name: d.customer_name,
      reason_code: 'goal_gap_critical',
      reason_text: `Need $${gap.toLocaleString()}/Q. This deal at ${Math.round(prob * 100)}% close = $${Math.round(weighted).toLocaleString()}. Stalled ${days}d.`,
      suggested_opening: `${greeting}, you're at ${stage} with $${amount.toLocaleString()} on the table${(d.deal_name && d.deal_name.trim() !== (d.customer_name || '').trim()) ? ` (${d.deal_name})` : ''}. What's the realistic close date you're working toward, and what would unblock it this week?`,
      signal_strength: Math.round(strength * 1000) / 1000,
      expected_value: amount,
    });
  }
  return candidates;
}

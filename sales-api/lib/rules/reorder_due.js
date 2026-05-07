// reorder_due rule — fires when a repeat customer is overdue for reorder
// Pure function, no DB access

import { smartGreeting } from './_greeting.js';

const MIN_ORDERS = 3;
const MIN_CADENCE_DAYS = 7;     // ignore bulk same-day patterns
const CADENCE_MULTIPLIER = 1.2;

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function fire({ customers, today }) {
  const candidates = [];
  for (const c of customers) {
    if (!c.invoices || c.invoices.length < MIN_ORDERS) continue;

    const dates = c.invoices.map(i => new Date(i.date)).sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
    }
    const medianCadence = median(gaps);
    if (medianCadence < MIN_CADENCE_DAYS) continue;  // skip bulk same-day patterns
    const lastInvoiceDate = dates[dates.length - 1];
    const daysSinceLast = (today - lastInvoiceDate) / (1000 * 60 * 60 * 24);
    const threshold = medianCadence * CADENCE_MULTIPLIER;

    if (daysSinceLast <= threshold) continue;

    const daysOverdue = daysSinceLast - threshold;
    const strength = Math.min(1.0, daysOverdue / medianCadence);
    const lastValue = c.invoices[c.invoices.length - 1].amount || 0;

    const greeting = smartGreeting(c.customer_name);
    const lastDateStr = lastInvoiceDate.toISOString().slice(0, 10);
    candidates.push({
      qbo_customer_id: c.qbo_customer_id,
      customer_name: c.customer_name,
      reason_code: 'reorder_due',
      reason_text: `Reorders typically every ${Math.round(medianCadence)} days, today is day ${Math.round(daysSinceLast)}. Last order $${lastValue.toLocaleString()}.`,
      suggested_opening: `${greeting}, your last order was $${lastValue.toLocaleString()} on ${lastDateStr} and you usually re-up about every ${Math.round(medianCadence)} days. Want me to put together the next batch, or are you stocked for now?`,
      signal_strength: Math.round(strength * 1000) / 1000,
      expected_value: lastValue,
    });
  }
  return candidates;
}

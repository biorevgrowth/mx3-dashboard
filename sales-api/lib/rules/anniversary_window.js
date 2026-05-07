// anniversary_window rule — fires when today is within +/-60 days of first invoice anniversary
// Pure function, no DB access

import { smartGreeting } from './_greeting.js';

const WINDOW_DAYS = 60;
const FLAT_STRENGTH = 0.7;
const ACTIVE_RECENCY_DAYS = 60;

export function fire({ customers, today }) {
  const candidates = [];
  for (const c of customers) {
    if (!c.first_invoice_date) continue;

    const firstDate = new Date(c.first_invoice_date);
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();
    const annivThisYear = new Date(today.getFullYear(), firstDate.getMonth(), firstDate.getDate());

    // Check if within +/-60 days of anniversary
    const diffDays = (today - annivThisYear) / (1000 * 60 * 60 * 24);
    if (Math.abs(diffDays) > WINDOW_DAYS) continue;

    // Determine mode
    const mostRecentInvoice = c.most_recent_invoice_date ? new Date(c.most_recent_invoice_date) : null;
    const daysSinceLastInvoice = mostRecentInvoice
      ? (today - mostRecentInvoice) / (1000 * 60 * 60 * 24)
      : Infinity;
    const mode = daysSinceLastInvoice <= ACTIVE_RECENCY_DAYS ? 'active' : 'silent';

    const annivMonth = firstDate.toLocaleString('en-US', { month: 'long' });
    const lastYearValue = c.last_year_value || 0;
    const silentDays = Math.round(daysSinceLastInvoice);
    const lastDate = mostRecentInvoice
      ? mostRecentInvoice.toISOString().slice(0, 10)
      : 'unknown';

    const greeting = smartGreeting(c.customer_name);
    let reason_text, suggested_opening;
    if (mode === 'active') {
      reason_text = `Your ${annivMonth} budget cycle is opening. Last year: $${lastYearValue.toLocaleString()} on ${firstDate.toISOString().slice(0, 10)}.`;
      suggested_opening = `${greeting}, last ${annivMonth} you ordered $${lastYearValue.toLocaleString()}. What does this ${annivMonth} look like? Same volume or scaling?`;
    } else {
      reason_text = `11 months in. Last activity ${lastDate}. Quiet for ${silentDays}d.`;
      suggested_opening = `${greeting}, it's been ${silentDays} days since your last order. Still actively using the system, or has something shifted?`;
    }

    candidates.push({
      qbo_customer_id: c.qbo_customer_id,
      customer_name: c.customer_name,
      reason_code: 'anniversary_window',
      reason_text,
      suggested_opening,
      signal_strength: FLAT_STRENGTH,
      expected_value: lastYearValue,
      _mode: mode,
    });
  }
  return candidates;
}

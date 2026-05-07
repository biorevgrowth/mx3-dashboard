// ═══════════════════════════════════════════
// KINGA — Sport Levels (v2: HubSpot industry-based)
// ═══════════════════════════════════════════
// REPLACES the v1 keyword pattern matcher (which defaulted everything to "D1").
// Now reads `industry` straight off customer_rep_map (seeded from HubSpot).
// Customers with NULL industry roll up as "Unclassified".

const REP_ID = 'kinga';

const invoiceResp = $('QuickBooks — Fetch Invoices YTD').first().json;
const invoices = invoiceResp.QueryResponse?.Invoice || [];
const custMap = $('Postgres — Fetch Customer Map').all().map(i => i.json);

const repCusts = custMap.filter(m => m.rep_id === REP_ID);
const repCustIds = new Set(repCusts.map(m => m.qbo_customer_id));
const industryByCustId = Object.fromEntries(
  repCusts.map(m => [m.qbo_customer_id, m.industry || 'Unclassified'])
);

const now = new Date();
const yearStart = new Date(now.getFullYear(), 0, 1);
const today = now.toISOString().slice(0, 10);

function productRevenue(inv) {
  return (inv.Line || [])
    .filter(l => l.DetailType === 'SalesItemLineDetail')
    .filter(l => {
      const ref = l.SalesItemLineDetail?.ItemAccountRef?.name || '';
      return ref.includes('41000') || ref.includes('43000') ||
             ref.includes('44000') || ref.includes('45000');
    })
    .reduce((sum, l) => sum + parseFloat(l.Amount || 0), 0);
}

// Group by industry
const byIndustry = {};
for (const inv of invoices) {
  const cid = String(inv.CustomerRef?.value);
  if (!repCustIds.has(cid)) continue;
  if (new Date(inv.TxnDate) < yearStart) continue;

  const industry = industryByCustId[cid];
  if (!byIndustry[industry]) {
    byIndustry[industry] = { revenue: 0, deals: 0 };
  }
  byIndustry[industry].revenue += productRevenue(inv);
  byIndustry[industry].deals += 1;
}

return Object.entries(byIndustry).map(([industry, vals]) => ({
  json: {
    rep_id: REP_ID,
    snapshot_date: today,
    level: industry,                                         // reused column; now stores industry
    revenue_ytd: Math.round(vals.revenue * 100) / 100,
    deals_ytd: vals.deals,
    yoy_growth: 0,                                           // TODO: compute from prior-year snapshot
  },
}));

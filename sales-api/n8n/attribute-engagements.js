// n8n Code Node: Attribute Engagements
// Runs at 6:30 AM CST, matches HubSpot engagements to daily actions
// Sequential calls to HubSpot Engagements API (NOT bulk)
// Add to workflow CfWczdj6w1jPdc1u

const API_BASE = $env.MX3_API_URL || 'https://mx3-sales-api-production.up.railway.app';
const HUBSPOT_TOKEN = $env.HUBSPOT_ACCESS_TOKEN;
const MAX_CALLS = 20;
const ATTRIBUTION_WINDOW_HOURS = 48;

// Get recent daily actions (last 2 days)
const pgPool = $env.DATABASE_URL;
const { rows: actions } = await $runQuery(`
  SELECT rda.id, rda.rep_id, rda.qbo_customer_id, rda.customer_name,
         rda.snapshot_date, rda.computed_at, rda.hubspot_deal_id
  FROM rep_daily_actions rda
  WHERE rda.snapshot_date >= CURRENT_DATE - INTERVAL '2 days'
    AND NOT EXISTS (
      SELECT 1 FROM rep_daily_action_attribution att WHERE att.action_id = rda.id
    )
  ORDER BY rda.snapshot_date DESC
  LIMIT ${MAX_CALLS}
`);

let hits = 0;
let misses = 0;
let rowsWritten = 0;
const engagementTypes = { CALL: 0, EMAIL: 0, NOTE: 0, MEETING: 0 };
const startMs = Date.now();

for (const action of actions) {
  try {
    // Look up contact engagements via HubSpot deal associations
    const dealId = action.hubspot_deal_id;
    if (!dealId) { misses++; continue; }

    const engRes = await fetch(
      `https://api.hubapi.com/engagements/v1/engagements/associated/deal/${dealId}/paged?limit=10`,
      { headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` } }
    );

    const rateLimitRemaining = engRes.headers.get('x-hubspot-ratelimit-remaining');
    if (parseInt(rateLimitRemaining) < 100) {
      console.log(JSON.stringify({
        level: 'WARN', event: 'Attribute Engagements',
        rate_limit_remaining: rateLimitRemaining,
      }));
    }

    if (!engRes.ok) {
      console.log(JSON.stringify({
        level: 'WARN', event: 'Attribute Engagements',
        msg: 'attribution_miss', action_id: action.id,
        customer_id: action.qbo_customer_id, status: engRes.status,
      }));
      misses++;
      continue;
    }

    const engData = await engRes.json();
    const cutoff = new Date(action.computed_at).getTime();
    let matched = false;

    for (const eng of (engData.results || [])) {
      const engAt = new Date(eng.engagement?.timestamp || eng.engagement?.createdAt);
      const hoursSince = (engAt.getTime() - cutoff) / (1000 * 60 * 60);

      if (hoursSince < 0 || hoursSince > ATTRIBUTION_WINDOW_HOURS) continue;

      const engType = (eng.engagement?.type || 'NOTE').toUpperCase();
      engagementTypes[engType] = (engagementTypes[engType] || 0) + 1;

      await $runQuery(`
        INSERT INTO rep_daily_action_attribution
          (action_id, hubspot_engagement_id, engagement_type, engagement_at, hours_since_action)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [action.id, String(eng.engagement?.id), engType, engAt.toISOString(), Math.round(hoursSince * 100) / 100]);

      rowsWritten++;
      matched = true;
    }

    if (matched) hits++;
    else misses++;
  } catch (err) {
    console.log(JSON.stringify({
      level: 'ERROR', event: 'Attribute Engagements',
      action_id: action.id, error: err.message,
    }));
    misses++;
  }
}

console.log(JSON.stringify({
  level: 'INFO', event: 'Attribute Engagements',
  actions_to_check: actions.length, hubspot_calls: actions.length,
  hits, misses, engagement_types: engagementTypes,
  rows_written: rowsWritten, duration_ms: Date.now() - startMs,
}));

return [{ json: { hits, misses, rows_written: rowsWritten, engagement_types: engagementTypes } }];

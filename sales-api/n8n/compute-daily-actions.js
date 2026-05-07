// n8n Code Node: Compute Daily Actions
// Thin HTTP POST to mx3-sales-api internal endpoint
// Add to workflow CfWczdj6w1jPdc1u, schedule 6 AM CST

const API_BASE = $env.MX3_API_URL || 'https://mx3-sales-api-production.up.railway.app';
const reps = ['kinga', 'pete'];
const results = [];

for (const repId of reps) {
  const startMs = Date.now();
  try {
    const response = await fetch(`${API_BASE}/internal/compute-daily-actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rep_id: repId }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.log(JSON.stringify({
        level: 'ERROR', event: 'Compute Daily Actions',
        rep: repId, status: response.status, error: errText,
        msg: 'will retry next 6 AM',
      }));
      results.push({ rep: repId, status: 'error', code: response.status });
      continue;
    }

    const data = await response.json();
    const finalists = data[repId]?.rows_written || data[repId]?.finalists?.length || 0;
    const durationMs = Date.now() - startMs;

    console.log(JSON.stringify({
      level: 'INFO', event: 'Compute Daily Actions',
      rep: repId, finalists, duration_ms: durationMs,
    }));

    if (finalists < 5) {
      console.log(JSON.stringify({
        level: 'WARN', event: 'Compute Daily Actions',
        rep: repId, finalists, msg: 'thin pipeline',
      }));
    }

    results.push({ rep: repId, status: 'ok', finalists, duration_ms: durationMs });
  } catch (err) {
    console.log(JSON.stringify({
      level: 'ERROR', event: 'Compute Daily Actions',
      rep: repId, error: err.message, msg: 'HTTP failed, will retry next 6 AM',
    }));
    results.push({ rep: repId, status: 'error', error: err.message });
  }
}

return results.map(r => ({ json: r }));

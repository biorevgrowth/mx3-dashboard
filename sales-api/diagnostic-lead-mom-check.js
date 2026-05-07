// diagnostic-lead-mom-check.js
// Reads DATABASE_URL from env — no credentials hardcoded.
// Run from: cd mx3-sales-api && node ../experiences/clients/mx3/diagnostic-lead-mom-check.js

import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set. Export it before running:");
  console.error('  export DATABASE_URL="postgresql://user:pass@host:port/dbname"');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 1,
});

const DISCOVER_QUERY = `
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name ILIKE '%snapshot%' OR table_name ILIKE '%daily%' OR table_name ILIKE '%kpi%')
  ORDER BY table_name;
`;

async function run() {
  let client;
  try {
    client = await pool.connect();

    console.log("--- Candidate tables (snapshot/daily/kpi) ---");
    const { rows: tables } = await client.query(DISCOVER_QUERY);
    if (tables.length === 0) {
      console.log("No matches. All public tables:");
      const { rows: all } = await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;`
      );
      all.forEach((r) => console.log("  - " + r.table_name));
      return;
    }
    tables.forEach((r) => console.log("  - " + r.table_name));

    const target =
      tables.find((r) => r.table_name.includes("daily_snapshot"))?.table_name ||
      tables.find((r) => r.table_name.includes("snapshot"))?.table_name ||
      tables[0].table_name;

    const { rows: cols } = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${target}' ORDER BY ordinal_position;`
    );
    const colNames = cols.map((c) => c.column_name);
    console.log(`\n--- Columns of "${target}" ---`);
    console.log("  " + colNames.join(", "));

    const dateCol = colNames.find((c) => c.includes("date")) || colNames[0];
    const leadCol = colNames.find((c) => c.includes("lead"));
    const revCol = colNames.find((c) => c.includes("revenue"));
    const custCol = colNames.find((c) => c.includes("customer"));
    const select = [dateCol, leadCol, revCol, custCol].filter(Boolean).join(", ");

    const QUERY = `SELECT ${select} FROM ${target} ORDER BY ${dateCol} DESC LIMIT 35;`;
    console.log(`\n--- Running: ${QUERY} ---\n`);
    const { rows } = await client.query(QUERY);

    if (rows.length === 0) {
      console.log("No rows returned — table may be empty or name may differ.");
      return;
    }

    // Print header — adaptive columns
    const cw = 22;
    const headerCols = [dateCol, leadCol, revCol, custCol].filter(Boolean);
    const hr = "-".repeat(cw * headerCols.length + 5);
    console.log(hr);
    console.log(headerCols.map((c) => pad(c, cw)).join(""));
    console.log(hr);
    for (const r of rows) {
      console.log(
        headerCols
          .map((c) => pad(String(r[c] ?? "NULL").slice(0, cw - 1), cw))
          .join("")
      );
    }
    console.log(hr);

    // Quick summary
    const last7 = rows.slice(0, 7);
    const zeroLeadDays = leadCol
      ? last7.filter((r) => Number(r[leadCol]) === 0 || r[leadCol] === null).length
      : 0;
    const hasRealRevenue = revCol ? last7.some((r) => Number(r[revCol]) > 0) : false;
    const hasRealCustomers = custCol ? last7.some((r) => Number(r[custCol]) > 0) : false;

    console.log("\n--- HYPOTHESIS CHECK (last 7 rows) ---");
    console.log(`Zero-lead days (last 7):   ${zeroLeadDays}/7`);
    console.log(`revenue_mtd has real data: ${hasRealRevenue}`);
    console.log(`new_customers has real data: ${hasRealCustomers}`);

    if (zeroLeadDays >= 5 && (hasRealRevenue || hasRealCustomers)) {
      console.log("\nRESULT: HYPOTHESIS CONFIRMED");
      console.log(
        "daily_inbound_leads is 0 for most days while other metrics have data."
      );
      console.log(
        "MoM denominator = 0 → division returns 0.0%. Fix: backfill or recompute lead rows."
      );
    } else if (zeroLeadDays === 0) {
      console.log("\nRESULT: HYPOTHESIS DISPROVED");
      console.log(
        "daily_inbound_leads has non-zero values. Bug is elsewhere (MoM calc logic or frontend)."
      );
    } else {
      console.log("\nRESULT: PARTIAL / INCONCLUSIVE");
      console.log(
        `${zeroLeadDays}/7 zero days — inspect full table output above for the pattern.`
      );
    }
  } catch (err) {
    console.error("Query failed:", err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

function pad(str, len) {
  return str.length >= len ? str.slice(0, len - 1) + " " : str + " ".repeat(len - str.length);
}

run();

-- ============================================================
-- MX3 Diagnostics Executive Dashboard — Postgres Schema
-- Deploy on Railway Postgres
-- ============================================================

-- Market verticals
CREATE TABLE IF NOT EXISTS verticals (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    display_order INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO verticals (name, display_order) VALUES
    ('Workplace Safety', 1),
    ('Athletics', 2),
    ('Military', 3),
    ('Healthcare', 4)
ON CONFLICT (name) DO NOTHING;

-- Geographic regions
CREATE TABLE IF NOT EXISTS regions (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    display_order INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Placeholder regions — update with your actual territories
INSERT INTO regions (name, display_order) VALUES
    ('Northeast', 1),
    ('Southeast', 2),
    ('Midwest', 3),
    ('West', 4)
ON CONFLICT (name) DO NOTHING;

-- Financial goals by vertical, region, and period
-- Leadership team edits these from the dashboard UI
CREATE TABLE IF NOT EXISTS goals (
    id              SERIAL PRIMARY KEY,
    year            INT NOT NULL,
    quarter         INT CHECK (quarter BETWEEN 1 AND 4),
    vertical_id     INT REFERENCES verticals(id),
    region_id       INT REFERENCES regions(id),
    annual_target   NUMERIC(12,2),        -- full-year revenue goal
    q1_target       NUMERIC(12,2),
    q2_target       NUMERIC(12,2),
    q3_target       NUMERIC(12,2),
    q4_target       NUMERIC(12,2),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_by      TEXT,                  -- who last edited
    UNIQUE(year, vertical_id, region_id)
);

-- Company-level annual goal (rollup / override)
CREATE TABLE IF NOT EXISTS company_goals (
    id              SERIAL PRIMARY KEY,
    year            INT NOT NULL UNIQUE,
    annual_target   NUMERIC(12,2) NOT NULL,
    q1_target       NUMERIC(12,2),
    q2_target       NUMERIC(12,2),
    q3_target       NUMERIC(12,2),
    q4_target       NUMERIC(12,2),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_by      TEXT
);

-- Daily KPI snapshots — one row per day written by n8n at 6 AM
CREATE TABLE IF NOT EXISTS daily_snapshots (
    id                  SERIAL PRIMARY KEY,
    snapshot_date       DATE NOT NULL UNIQUE,
    snapshot_ts         TIMESTAMPTZ DEFAULT NOW(),

    -- Revenue actuals (from QuickBooks)
    revenue_wtd         NUMERIC(12,2),   -- week to date
    revenue_mtd         NUMERIC(12,2),   -- month to date
    revenue_qtd         NUMERIC(12,2),   -- quarter to date
    revenue_ytd         NUMERIC(12,2),   -- year to date

    -- Sales volume
    deals_closed_wtd    INT,
    deals_closed_mtd    INT,
    deals_closed_qtd    INT,
    deals_closed_ytd    INT,

    -- Velocity & efficiency
    avg_order_size      NUMERIC(10,2),
    sales_velocity_days NUMERIC(6,1),    -- avg days to close

    -- Lead metrics (from HubSpot)
    daily_inbound_leads INT,
    leads_7day_avg      NUMERIC(6,1),

    -- Customer mix (MTD)
    new_customer_deals      INT,
    new_customer_revenue    NUMERIC(12,2),
    existing_customer_deals INT,
    existing_customer_revenue NUMERIC(12,2),

    -- Product metrics
    total_devices_sold_ytd  INT,
    total_strips_sold_ytd   INT,
    strips_per_device       NUMERIC(6,2),

    -- Growth signals (month-over-month)
    revenue_mom_pct         NUMERIC(6,2),
    lead_volume_mom_pct     NUMERIC(6,2),
    new_customers_mom_pct   NUMERIC(6,2),

    -- Raw data hash for dedup
    data_hash               TEXT
);

-- Breakdown by vertical — one row per vertical per day
CREATE TABLE IF NOT EXISTS vertical_snapshots (
    id              SERIAL PRIMARY KEY,
    snapshot_date   DATE NOT NULL,
    vertical_id     INT NOT NULL REFERENCES verticals(id),
    revenue_qtd     NUMERIC(12,2),
    revenue_ytd     NUMERIC(12,2),
    deals_closed_qtd INT,
    new_customer_deals INT,
    existing_customer_deals INT,
    strips_per_device NUMERIC(6,2),
    UNIQUE(snapshot_date, vertical_id)
);

-- Breakdown by region — one row per region per day
CREATE TABLE IF NOT EXISTS region_snapshots (
    id              SERIAL PRIMARY KEY,
    snapshot_date   DATE NOT NULL,
    region_id       INT NOT NULL REFERENCES regions(id),
    revenue_qtd     NUMERIC(12,2),
    revenue_ytd     NUMERIC(12,2),
    deals_closed_qtd INT,
    UNIQUE(snapshot_date, region_id)
);

-- Cross-dimension snapshot (vertical × region)
CREATE TABLE IF NOT EXISTS cross_snapshots (
    id              SERIAL PRIMARY KEY,
    snapshot_date   DATE NOT NULL,
    vertical_id     INT NOT NULL REFERENCES verticals(id),
    region_id       INT NOT NULL REFERENCES regions(id),
    revenue_qtd     NUMERIC(12,2),
    revenue_ytd     NUMERIC(12,2),
    deals_closed_qtd INT,
    UNIQUE(snapshot_date, vertical_id, region_id)
);

-- Indexes for dashboard query performance
CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_vertical_date ON vertical_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_region_date ON region_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_cross_date ON cross_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_goals_year ON goals(year);

-- Daily executive briefings — generated by Claude API via n8n at 6 AM
CREATE TABLE IF NOT EXISTS daily_briefings (
    id              SERIAL PRIMARY KEY,
    briefing_date   DATE NOT NULL UNIQUE,
    summary         TEXT NOT NULL,           -- plain-English state of business
    projection      TEXT NOT NULL,           -- EOY forecast narrative
    actions         JSONB NOT NULL,          -- [{signal, action, urgency}]
    model_used      TEXT,                    -- e.g. 'claude-sonnet-4-6'
    input_hash      TEXT,                    -- hash of KPI data sent to Claude
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefing_date ON daily_briefings(briefing_date DESC);

-- View: latest briefing
CREATE OR REPLACE VIEW latest_briefing AS
SELECT * FROM daily_briefings
ORDER BY briefing_date DESC
LIMIT 1;

-- View: latest snapshot (convenience for dashboard)
CREATE OR REPLACE VIEW latest_snapshot AS
SELECT * FROM daily_snapshots
ORDER BY snapshot_date DESC
LIMIT 1;

-- View: latest vertical breakdown
CREATE OR REPLACE VIEW latest_vertical_breakdown AS
SELECT vs.*, v.name as vertical_name
FROM vertical_snapshots vs
JOIN verticals v ON v.id = vs.vertical_id
WHERE vs.snapshot_date = (SELECT MAX(snapshot_date) FROM vertical_snapshots)
ORDER BY v.display_order;

-- View: latest region breakdown
CREATE OR REPLACE VIEW latest_region_breakdown AS
SELECT rs.*, r.name as region_name
FROM region_snapshots rs
JOIN regions r ON r.id = rs.region_id
WHERE rs.snapshot_date = (SELECT MAX(snapshot_date) FROM region_snapshots)
ORDER BY r.display_order;

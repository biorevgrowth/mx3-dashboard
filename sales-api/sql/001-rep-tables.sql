-- MX3 Sales Rep Dashboard — Database Schema
-- Run against the existing Railway Postgres (same DB as executive dashboard)

CREATE TABLE IF NOT EXISTS rep_snapshots (
    id              SERIAL PRIMARY KEY,
    rep_id          TEXT NOT NULL,
    snapshot_date   DATE NOT NULL,
    revenue_wtd     NUMERIC(12,2),
    revenue_mtd     NUMERIC(12,2),
    revenue_qtd     NUMERIC(12,2),
    revenue_ytd     NUMERIC(12,2),
    deals_closed_mtd INTEGER DEFAULT 0,
    deals_closed_ytd INTEGER DEFAULT 0,
    avg_order_size  NUMERIC(12,2),
    sales_velocity_days NUMERIC(6,1),
    UNIQUE(rep_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS rep_goals (
    id              SERIAL PRIMARY KEY,
    rep_id          TEXT NOT NULL,
    year            INTEGER NOT NULL,
    q1_revenue      NUMERIC(12,2),
    q2_revenue      NUMERIC(12,2),
    q3_revenue      NUMERIC(12,2),
    q4_revenue      NUMERIC(12,2),
    q1_deals        INTEGER,
    q2_deals        INTEGER,
    q3_deals        INTEGER,
    q4_deals        INTEGER,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_by      TEXT,
    UNIQUE(rep_id, year)
);

CREATE TABLE IF NOT EXISTS rep_pipeline_deals (
    id              SERIAL PRIMARY KEY,
    rep_id          TEXT NOT NULL,
    deal_id         TEXT NOT NULL,
    deal_name       TEXT,
    stage           TEXT,
    value           NUMERIC(12,2),
    days_in_stage   INTEGER,
    last_stage_change TIMESTAMP,
    snapshot_date   DATE NOT NULL,
    UNIQUE(rep_id, deal_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS rep_distributor_snapshots (
    id              SERIAL PRIMARY KEY,
    rep_id          TEXT NOT NULL,
    distributor_name TEXT NOT NULL,
    sector          TEXT,
    revenue_ytd     NUMERIC(12,2),
    revenue_qtd     NUMERIC(12,2),
    deals_ytd       INTEGER DEFAULT 0,
    mom_growth      NUMERIC(8,2),
    snapshot_date   DATE NOT NULL,
    UNIQUE(rep_id, distributor_name, snapshot_date)
);

CREATE TABLE IF NOT EXISTS sport_level_snapshots (
    id              SERIAL PRIMARY KEY,
    rep_id          TEXT NOT NULL,
    snapshot_date   DATE NOT NULL,
    level           TEXT NOT NULL,
    revenue_ytd     NUMERIC(12,2),
    deals_ytd       INTEGER DEFAULT 0,
    yoy_growth      NUMERIC(8,2),
    UNIQUE(rep_id, snapshot_date, level)
);

CREATE TABLE IF NOT EXISTS product_snapshots (
    id              SERIAL PRIMARY KEY,
    rep_id          TEXT NOT NULL,
    snapshot_date   DATE NOT NULL,
    product_line    TEXT NOT NULL,
    units_sold_ytd  INTEGER DEFAULT 0,
    revenue_ytd     NUMERIC(12,2),
    yoy_growth      NUMERIC(8,2),
    UNIQUE(rep_id, snapshot_date, product_line)
);

CREATE TABLE IF NOT EXISTS fallen_angels (
    id              SERIAL PRIMARY KEY,
    rep_id          TEXT NOT NULL,
    customer_name   TEXT NOT NULL,
    last_purchase_date DATE,
    days_inactive   INTEGER,
    lifetime_revenue NUMERIC(12,2),
    snapshot_date   DATE NOT NULL,
    UNIQUE(rep_id, customer_name, snapshot_date)
);

-- Views for API convenience
CREATE OR REPLACE VIEW latest_rep_snapshot AS
SELECT DISTINCT ON (rep_id) *
FROM rep_snapshots
ORDER BY rep_id, snapshot_date DESC;

CREATE OR REPLACE VIEW latest_rep_pipeline AS
SELECT *
FROM rep_pipeline_deals
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM rep_pipeline_deals);

CREATE OR REPLACE VIEW latest_rep_distributors AS
SELECT *
FROM rep_distributor_snapshots
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM rep_distributor_snapshots);

CREATE OR REPLACE VIEW latest_sport_levels AS
SELECT *
FROM sport_level_snapshots
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM sport_level_snapshots);

CREATE OR REPLACE VIEW latest_products AS
SELECT *
FROM product_snapshots
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM product_snapshots);

CREATE OR REPLACE VIEW latest_fallen_angels AS
SELECT *
FROM fallen_angels
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM fallen_angels);

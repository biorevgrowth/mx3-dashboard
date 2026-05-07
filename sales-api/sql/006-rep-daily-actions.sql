-- 006-rep-daily-actions.sql
-- Today's Calls engine: stores daily ranked action items per rep

CREATE TABLE IF NOT EXISTS rep_daily_actions (
  id                 SERIAL PRIMARY KEY,
  rep_id             TEXT NOT NULL,
  snapshot_date      DATE NOT NULL,
  rank               INT  NOT NULL,
  qbo_customer_id    TEXT,
  hubspot_deal_id    TEXT,
  customer_name      TEXT NOT NULL,
  reason_code        TEXT NOT NULL,
  reason_text        TEXT NOT NULL,
  expected_value     NUMERIC(12,2),
  signal_strength    NUMERIC(4,3),
  suggested_opening  TEXT NOT NULL,
  computed_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rep_id, snapshot_date, rank)
);

CREATE INDEX IF NOT EXISTS idx_rda_rep_date ON rep_daily_actions(rep_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_rda_rep_date_for_view ON rep_daily_actions(snapshot_date DESC);

CREATE TABLE IF NOT EXISTS rep_daily_action_attribution (
  action_id              INT REFERENCES rep_daily_actions(id) ON DELETE CASCADE,
  hubspot_engagement_id  TEXT,
  engagement_type        TEXT,
  engagement_at          TIMESTAMPTZ,
  hours_since_action     NUMERIC(6,2),
  PRIMARY KEY (action_id, hubspot_engagement_id)
);

CREATE OR REPLACE VIEW latest_rep_daily_actions AS
SELECT * FROM rep_daily_actions
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM rep_daily_actions);

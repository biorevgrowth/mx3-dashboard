-- MX3 Dashboard — QBO as Single Source of Truth
-- Creates qbo_invoices (local invoice store) and customer_rep_map (vertical lookup)
-- Run against Railway Postgres (same DB as executive dashboard)

-- Local QBO invoice store
CREATE TABLE IF NOT EXISTS qbo_invoices (
  qbo_invoice_id TEXT PRIMARY KEY,        -- QBO Invoice.Id
  doc_number TEXT,                          -- e.g. "mx31986"
  txn_date DATE NOT NULL,                  -- Invoice date
  customer_id TEXT NOT NULL,               -- QBO CustomerRef.value
  customer_name TEXT,                       -- QBO CustomerRef.name
  total_amt NUMERIC(12,2),                 -- TotalAmt (includes tax/shipping)
  product_revenue NUMERIC(12,2),           -- Sum of product lines only (excl tax/shipping)
  device_revenue NUMERIC(12,2) DEFAULT 0,  -- 41000 Sales:Device Sales
  strip_revenue NUMERIC(12,2) DEFAULT 0,   -- 44000 Sales:Hydration Testing Strips
  sweat_revenue NUMERIC(12,2) DEFAULT 0,   -- 43000 Sales:Sweat Tests
  accessory_revenue NUMERIC(12,2) DEFAULT 0, -- 45000 Sales:Accessories
  device_qty INT DEFAULT 0,
  strip_qty INT DEFAULT 0,
  sweat_qty INT DEFAULT 0,
  accessory_qty INT DEFAULT 0,
  ship_state TEXT,                          -- 2-letter state from ShipAddr
  ship_region TEXT,                         -- Northeast/Southeast/Midwest/West
  balance NUMERIC(12,2),                   -- Outstanding balance
  invoice_status TEXT,                      -- EInvoiceStatus: Sent/Viewed/Paid
  raw_json JSONB,                          -- Full QBO invoice for debugging
  last_updated_qbo TIMESTAMPTZ,            -- QBO MetaData.LastUpdatedTime
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qbo_invoices_txn_date ON qbo_invoices(txn_date);
CREATE INDEX IF NOT EXISTS idx_qbo_invoices_customer ON qbo_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_qbo_invoices_last_updated ON qbo_invoices(last_updated_qbo);

-- Customer to rep/vertical mapping
CREATE TABLE IF NOT EXISTS customer_rep_map (
  qbo_customer_id TEXT PRIMARY KEY,
  qbo_customer_name TEXT NOT NULL,
  rep_id TEXT NOT NULL,                    -- 'kinga' or 'pete'
  vertical TEXT NOT NULL,                   -- 'Athletics', 'Workplace Safety', 'Healthcare', 'Military', 'Distributor'
  first_invoice_date DATE,                 -- For new/existing customer classification
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_rep_map_rep ON customer_rep_map(rep_id);
CREATE INDEX IF NOT EXISTS idx_customer_rep_map_vertical ON customer_rep_map(vertical);

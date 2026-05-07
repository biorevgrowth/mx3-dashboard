-- 005-add-industry-to-distributor-view.sql
-- Joins HubSpot industry into latest_rep_distributors so the dashboard
-- card subtitle can show the actual industry instead of just "Athletics".

CREATE OR REPLACE VIEW latest_rep_distributors AS
SELECT s.*, m.industry
FROM rep_distributor_snapshots s
LEFT JOIN customer_rep_map m ON s.distributor_name = m.qbo_customer_name
WHERE s.snapshot_date = (SELECT MAX(snapshot_date) FROM rep_distributor_snapshots);

-- One obvious name-based classification we hadn't seeded:
UPDATE customer_rep_map SET industry = 'Sports - College' WHERE qbo_customer_name = 'Indiana University';

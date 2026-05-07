-- 004-add-industry-to-customer-map.sql
-- Adds HubSpot industry classification to customer_rep_map so the
-- "Sport Levels" snapshot can group by real HubSpot industry instead
-- of name-pattern matching that defaulted everything to "D1".

ALTER TABLE customer_rep_map
  ADD COLUMN IF NOT EXISTS industry TEXT;

-- Seed for Kinga's confirmed customers (derived from HubSpot deals owner=474747224).
-- Source: deal-name match against pipeline 1300571 export 2026-04-29.
-- Customers without a confident HubSpot match are left NULL and will roll up
-- under "Unclassified" until manually tagged.

UPDATE customer_rep_map SET industry = 'Sports - MLB'                  WHERE qbo_customer_id = '2674'; -- Logan Aitken
UPDATE customer_rep_map SET industry = 'Sports - College'              WHERE qbo_customer_id = '2703'; -- Brooks Gillerlain
UPDATE customer_rep_map SET industry = 'Sports - MLB'                  WHERE qbo_customer_id = '1275'; -- Axel Lopez
UPDATE customer_rep_map SET industry = 'Sports - MLB'                  WHERE qbo_customer_id = '724';  -- Chad Jackson
UPDATE customer_rep_map SET industry = 'Sports - Soccer'               WHERE qbo_customer_id = '2733'; -- Kirsty Hicks
UPDATE customer_rep_map SET industry = 'Sports - MLB'                  WHERE qbo_customer_id = '1359'; -- Tara Boening
UPDATE customer_rep_map SET industry = 'Sports - College'              WHERE qbo_customer_id = '2696'; -- Alyssa Davis
UPDATE customer_rep_map SET industry = 'Sports - MLB'                  WHERE qbo_customer_id = '2707'; -- Nikki Fioretti
UPDATE customer_rep_map SET industry = 'Sports - College'              WHERE qbo_customer_id = '2763'; -- Chad Traver
UPDATE customer_rep_map SET industry = 'Sports - College'              WHERE qbo_customer_id = '2739'; -- Nicole Johnson
UPDATE customer_rep_map SET industry = 'Sports - College'              WHERE qbo_customer_id = '2495'; -- Erin Wesolowski
UPDATE customer_rep_map SET industry = 'Sports - Pro'                  WHERE qbo_customer_id = '435';  -- Breanna Cecil
UPDATE customer_rep_map SET industry = 'Sports - Performance Facility' WHERE qbo_customer_id = '2039'; -- Chris Lockwood
UPDATE customer_rep_map SET industry = 'Sports - Other'                WHERE qbo_customer_id = '2672'; -- Paige Blyth
UPDATE customer_rep_map SET industry = 'Sports - College'              WHERE qbo_customer_id = '691';  -- Alison C O'Connor
UPDATE customer_rep_map SET industry = 'Sports - College'              WHERE qbo_customer_id = '448';  -- Jessica Garay

-- Verification:
-- SELECT industry, COUNT(*) FROM customer_rep_map WHERE rep_id='kinga' GROUP BY industry ORDER BY COUNT(*) DESC;

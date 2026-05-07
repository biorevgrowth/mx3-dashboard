-- Seed customer_rep_map with unmapped QBO customers
-- Generated 2026-04-17 from QBO invoice + HubSpot deal cross-reference
-- Review before running: 17 "unknown" customers defaulted to Kinga/Athletics

-- ============================================================
-- KINGA — Confirmed via HubSpot deal name match (25 customers)
-- ============================================================
INSERT INTO customer_rep_map (qbo_customer_id, qbo_customer_name, rep_id, vertical, first_invoice_date)
VALUES
  ('2674', 'Logan Aitken',                'kinga', 'Athletics', '2026-02-02'),
  ('2703', 'Brooks Gillerlain',           'kinga', 'Athletics', '2026-03-23'),
  ('568',  'Scott Wood',                  'kinga', 'Athletics', '2026-02-16'),
  ('1275', 'Axel Lopez',                  'kinga', 'Athletics', '2026-01-08'),
  ('938',  'Jaime Gottlieb',              'kinga', 'Athletics', '2026-03-09'),
  ('724',  'Chad Jackson',                'kinga', 'Athletics', '2026-04-10'),
  ('332',  'Scott Stansbury',             'kinga', 'Athletics', '2026-02-10'),
  ('2733', 'Kirsty Hicks',               'kinga', 'Athletics', '2026-03-17'),
  ('1359', 'Tara Boening',               'kinga', 'Athletics', '2026-02-24'),
  ('2696', 'Alyssa Davis',               'kinga', 'Athletics', '2026-02-24'),
  ('268',  'Patrick Wesley',             'kinga', 'Athletics', '2026-02-17'),
  ('2707', 'Nikki Fioretti',             'kinga', 'Athletics', '2026-03-05'),
  ('2763', 'Chad Traver',                'kinga', 'Athletics', '2026-04-02'),
  ('2746', 'Michael Wesley',             'kinga', 'Athletics', '2026-03-30'),
  ('2415', 'Jonathan Brainard',          'kinga', 'Athletics', '2026-03-05'),
  ('2739', 'Nicole Johnson',             'kinga', 'Athletics', '2026-03-23'),
  ('2495', 'Erin Wesolowski',            'kinga', 'Athletics', '2026-04-06'),
  ('2549', 'Delfino Martinez Gonzalez',  'kinga', 'Athletics', '2026-03-25'),
  ('2753', 'Felicia Graham',             'kinga', 'Athletics', '2026-04-02'),
  ('435',  'Breanna Cecil',              'kinga', 'Athletics', '2026-02-25'),
  ('2676', 'Mike Sciortino',             'kinga', 'Athletics', '2026-02-05'),
  ('2039', 'Chris Lockwood',             'kinga', 'Athletics', '2026-03-06'),
  ('2672', 'Paige Blyth',               'kinga', 'Athletics', '2026-03-17'),
  ('691',  'Alison C O''Connor',         'kinga', 'Athletics', '2026-03-24'),
  ('448',  'Jessica Garay',              'kinga', 'Athletics', '2026-04-13')
ON CONFLICT (qbo_customer_id) DO UPDATE SET
  rep_id = EXCLUDED.rep_id, vertical = EXCLUDED.vertical, updated_at = NOW();

-- ============================================================
-- PETE — Confirmed via HubSpot deal name match (6 customers)
-- ============================================================
INSERT INTO customer_rep_map (qbo_customer_id, qbo_customer_name, rep_id, vertical, first_invoice_date)
VALUES
  ('2778', 'Israel Rodriguez',           'pete', 'Workplace Safety', '2026-04-16'),
  ('2771', 'Jerome Parker',              'pete', 'Workplace Safety', '2026-04-08'),
  ('2381', 'Alexander Nyamekye',         'pete', 'Distributor',      '2026-03-13'),
  ('2692', 'Zach Waranch',               'pete', 'Workplace Safety', '2026-02-23'),
  ('2247', 'Shelbi Schnebelen',          'pete', 'Workplace Safety', '2026-04-16'),
  ('2729', 'Miriam van Reijen',          'pete', 'Workplace Safety', '2026-03-16')
ON CONFLICT (qbo_customer_id) DO UPDATE SET
  rep_id = EXCLUDED.rep_id, vertical = EXCLUDED.vertical, updated_at = NOW();

-- ============================================================
-- UNKNOWN — Defaulted to Kinga/Athletics (17 customers)
-- These are personal names (not companies), consistent with
-- Kinga's athletics contacts. Review and correct if any are Pete's.
-- ============================================================
INSERT INTO customer_rep_map (qbo_customer_id, qbo_customer_name, rep_id, vertical, first_invoice_date)
VALUES
  ('2651', 'Victoria Gamble',            'kinga', 'Athletics', '2026-01-20'),
  ('2731', 'Guilherme Cardoso',          'kinga', 'Athletics', '2026-03-17'),
  ('486',  'Rachel Sharley',             'kinga', 'Athletics', '2026-03-19'),
  ('2497', 'Jeffrie Parrish',            'kinga', 'Athletics', '2026-04-01'),
  ('376',  'Susana Melendez',            'kinga', 'Athletics', '2026-04-07'),
  ('1463', 'Carmen Spencer',             'kinga', 'Athletics', '2026-04-14'),
  ('2374', 'Devin Haygood',              'kinga', 'Athletics', '2026-03-29'),
  ('633',  'Rachel Higginson',           'kinga', 'Athletics', '2026-03-13'),
  ('2362', 'Morgan Kelly',               'kinga', 'Athletics', '2026-03-17'),
  ('2777', 'Jaelyn Shipman',             'kinga', 'Athletics', '2026-04-13'),
  ('1417', 'Lindsey Salwasser',          'kinga', 'Athletics', '2026-02-09'),
  ('828',  'Rachel Adamkowski',          'kinga', 'Athletics', '2026-04-15'),
  ('1249', 'Savannah Gustafson',         'kinga', 'Athletics', '2026-02-27'),
  ('484',  'Wendy Riddle',               'kinga', 'Athletics', '2026-04-15'),
  ('381',  'Allison Keim',               'kinga', 'Athletics', '2026-03-23'),
  ('1085', 'Jordyn Laufenberg',          'kinga', 'Athletics', '2026-02-27'),
  ('2238', 'Maryellen Carrigan',         'kinga', 'Athletics', '2026-02-11')
ON CONFLICT (qbo_customer_id) DO UPDATE SET
  rep_id = EXCLUDED.rep_id, vertical = EXCLUDED.vertical, updated_at = NOW();

-- Verify
SELECT rep_id, vertical, count(*) as customers
FROM customer_rep_map
GROUP BY rep_id, vertical
ORDER BY rep_id, vertical;

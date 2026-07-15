CREATE TABLE market_statistics (
  region_code TEXT NOT NULL,
  reference_month TEXT NOT NULL CHECK (reference_month GLOB '[0-9][0-9][0-9][0-9][0-1][0-9]'),
  metric TEXT NOT NULL CHECK (metric IN (
    'supply-units',
    'move-in-units',
    'unsold-units',
    'presale-units',
    'population',
    'households',
    'net-migration'
  )),
  value REAL NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('unit', 'person', 'household')),
  source TEXT NOT NULL,
  source_updated_at TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (region_code, reference_month, metric, source)
);

CREATE INDEX idx_market_statistics_month
  ON market_statistics (reference_month DESC, region_code, metric);

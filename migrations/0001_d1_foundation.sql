PRAGMA foreign_keys = ON;

CREATE TABLE ingestion_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_type TEXT NOT NULL,
  lawd_cd TEXT NOT NULL,
  deal_ymd TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'complete', 'partial', 'failed')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  page_count INTEGER NOT NULL DEFAULT 0 CHECK (page_count >= 0),
  item_count INTEGER NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  error_code TEXT
);

CREATE TABLE transaction_pages (
  property_type TEXT NOT NULL,
  lawd_cd TEXT NOT NULL,
  deal_ymd TEXT NOT NULL,
  page_no INTEGER NOT NULL CHECK (page_no > 0),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  item_count INTEGER NOT NULL CHECK (item_count >= 0),
  total_count INTEGER NOT NULL CHECK (total_count >= 0),
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (property_type, lawd_cd, deal_ymd, page_no)
);

CREATE TABLE data_quality_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingestion_run_id INTEGER,
  property_type TEXT NOT NULL,
  lawd_cd TEXT NOT NULL,
  deal_ymd TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  detail TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  resolved_at TEXT,
  FOREIGN KEY (ingestion_run_id) REFERENCES ingestion_runs(id) ON DELETE SET NULL
);

CREATE INDEX idx_ingestion_runs_query
  ON ingestion_runs (property_type, lawd_cd, deal_ymd, started_at DESC);

CREATE INDEX idx_quality_issues_open
  ON data_quality_issues (resolved_at, detected_at DESC);

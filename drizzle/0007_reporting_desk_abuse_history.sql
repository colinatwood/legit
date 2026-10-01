ALTER TABLE moderation_reports ADD COLUMN reporter_owner_key TEXT;

ALTER TABLE moderation_reports ADD COLUMN resolution TEXT;

ALTER TABLE moderation_reports ADD COLUMN resolved_at TEXT;

ALTER TABLE moderation_reports ADD COLUMN resolved_by_fingerprint TEXT;

CREATE INDEX idx_moderation_reports_target_state ON moderation_reports (target_id, review_state, created_at);

CREATE TABLE desk_items (
  id TEXT PRIMARY KEY NOT NULL,
  owner_key TEXT NOT NULL,
  happening_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (owner_key, happening_key)
);

CREATE INDEX idx_desk_items_owner_created ON desk_items (owner_key, created_at);

CREATE TABLE abuse_buckets (
  actor_fingerprint TEXT NOT NULL,
  scope TEXT NOT NULL,
  bucket_start TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (actor_fingerprint, scope, bucket_start)
);

CREATE INDEX idx_abuse_buckets_updated ON abuse_buckets (updated_at);

CREATE TABLE correction_history (
  id TEXT PRIMARY KEY NOT NULL,
  history_type TEXT NOT NULL CHECK (history_type IN ('correction', 'appeal')),
  public_story_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  review_state TEXT NOT NULL DEFAULT 'pending' CHECK (review_state IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by_fingerprint TEXT
);

CREATE INDEX idx_correction_history_story_state ON correction_history (public_story_id, review_state, created_at);

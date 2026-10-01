CREATE TABLE happenings (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  topic TEXT NOT NULL,
  public_location TEXT NOT NULL,
  public_lat REAL,
  public_lng REAL,
  location_precision TEXT NOT NULL CHECK (location_precision IN ('aggregate', 'exact')),
  identity_visibility TEXT NOT NULL CHECK (identity_visibility IN ('anonymous', 'attributed')),
  identity_display TEXT,
  impact INTEGER NOT NULL DEFAULT 1 CHECK (impact BETWEEN 1 AND 5),
  balance TEXT NOT NULL DEFAULT 'agnostic',
  legitimacy_score INTEGER NOT NULL DEFAULT 0 CHECK (legitimacy_score BETWEEN 0 AND 100),
  review_state TEXT NOT NULL DEFAULT 'pending',
  attachment_state TEXT NOT NULL DEFAULT 'none',
  attachment_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  retention_until TEXT NOT NULL
);

CREATE INDEX idx_happenings_review_created ON happenings (review_state, created_at);

CREATE TABLE claims (
  id TEXT PRIMARY KEY NOT NULL,
  happening_id TEXT NOT NULL REFERENCES happenings(id),
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unverified',
  attribution TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_claims_happening_id ON claims (happening_id);

CREATE TABLE evidence (
  id TEXT PRIMARY KEY NOT NULL,
  claim_id TEXT NOT NULL REFERENCES claims(id),
  evidence_type TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('supports', 'qualifies', 'contradicts')),
  provenance TEXT NOT NULL,
  review_state TEXT NOT NULL DEFAULT 'pending',
  submitted_at TEXT NOT NULL
);

CREATE INDEX idx_evidence_claim_review ON evidence (claim_id, review_state);

CREATE TABLE moderation_reports (
  id TEXT PRIMARY KEY NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  review_state TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE INDEX idx_moderation_reports_state_created ON moderation_reports (review_state, created_at);

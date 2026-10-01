ALTER TABLE reputation_events ADD COLUMN owner_key TEXT;

CREATE INDEX idx_reputation_owner_key ON reputation_events (owner_key);

CREATE TABLE privacy_deletion_audit (
  id TEXT PRIMARY KEY NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('profile', 'retention')),
  deleted_happenings INTEGER NOT NULL DEFAULT 0,
  deleted_reputation_events INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_privacy_deletion_audit_created ON privacy_deletion_audit (created_at);

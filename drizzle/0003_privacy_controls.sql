ALTER TABLE happenings ADD COLUMN owner_key TEXT;

CREATE INDEX idx_happenings_owner_key ON happenings (owner_key);

CREATE TABLE privacy_preferences (
  owner_key TEXT PRIMARY KEY NOT NULL,
  opt_out_sharing INTEGER NOT NULL DEFAULT 1 CHECK (opt_out_sharing IN (0,1)),
  limit_sensitive INTEGER NOT NULL DEFAULT 1 CHECK (limit_sensitive IN (0,1)),
  updated_at TEXT NOT NULL
);

CREATE TABLE privacy_requests (
  id TEXT PRIMARY KEY NOT NULL,
  owner_key TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('correction')),
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_privacy_requests_owner_created ON privacy_requests (owner_key, created_at);

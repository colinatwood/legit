CREATE TABLE moderator_verification_events (
  id TEXT PRIMARY KEY NOT NULL,
  moderator_fingerprint TEXT NOT NULL,
  verification_level TEXT NOT NULL CHECK (verification_level IN ('token', 'token_and_secret')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_moderator_verification_fingerprint_time ON moderator_verification_events (moderator_fingerprint, created_at);

CREATE TABLE moderator_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('happening', 'report', 'privacy_request', 'coordination')),
  target_id TEXT NOT NULL,
  moderator_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'completed', 'released', 'expired')),
  claimed_at TEXT NOT NULL,
  completed_at TEXT,
  response_seconds INTEGER,
  completed_decision TEXT
);
CREATE INDEX idx_moderator_tasks_target_status ON moderator_tasks (task_type, target_id, status, claimed_at);
CREATE INDEX idx_moderator_tasks_fingerprint_time ON moderator_tasks (moderator_fingerprint, claimed_at);

CREATE TABLE moderator_quality_events (
  id TEXT PRIMARY KEY NOT NULL,
  decision_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('upheld', 'reversed', 'inconclusive')),
  basis TEXT NOT NULL,
  reviewer_fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_moderator_quality_decision ON moderator_quality_events (decision_id);
CREATE INDEX idx_moderator_quality_outcome_time ON moderator_quality_events (outcome, created_at);

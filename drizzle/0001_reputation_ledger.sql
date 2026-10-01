CREATE TABLE reputation_events (
  id TEXT PRIMARY KEY NOT NULL,
  actor_fingerprint TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  action_day TEXT NOT NULL,
  points_awarded INTEGER NOT NULL CHECK (points_awarded BETWEEN 0 AND 5),
  basis TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (actor_fingerprint, action_type, target_id)
);

CREATE INDEX idx_reputation_actor_day ON reputation_events (actor_fingerprint, action_type, action_day);

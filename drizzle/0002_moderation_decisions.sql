CREATE TABLE moderation_decisions (
  id TEXT PRIMARY KEY NOT NULL,
  happening_id TEXT NOT NULL REFERENCES happenings(id),
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'hold', 'flag')),
  reason TEXT NOT NULL,
  moderator_fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_moderation_decisions_happening_created ON moderation_decisions (happening_id, created_at);

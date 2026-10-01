ALTER TABLE reputation_events ADD COLUMN risk_state TEXT NOT NULL DEFAULT 'normal' CHECK (risk_state IN ('normal', 'coordination_review'));

CREATE INDEX idx_reputation_risk_target ON reputation_events (risk_state, target_id);

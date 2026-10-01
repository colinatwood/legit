ALTER TABLE privacy_requests ADD COLUMN resolution TEXT;

ALTER TABLE privacy_requests ADD COLUMN resolved_at TEXT;

ALTER TABLE privacy_requests ADD COLUMN resolved_by_fingerprint TEXT;

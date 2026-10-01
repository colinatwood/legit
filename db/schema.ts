export const legitTables = {
  happenings: ["public_location", "location_precision", "identity_visibility", "review_state", "attachment_state", "retention_until", "owner_key"],
  claims: ["happening_id", "status", "attribution"],
  evidence: ["claim_id", "evidence_type", "relationship", "provenance", "review_state"],
  moderation_reports: ["target_type", "target_id", "reason", "review_state", "reporter_owner_key", "resolution", "resolved_at", "resolved_by_fingerprint"],
  moderation_decisions: ["happening_id", "decision", "reason", "moderator_fingerprint", "created_at"],
  reputation_events: ["actor_fingerprint", "action_type", "target_id", "action_day", "points_awarded", "basis", "risk_state", "owner_key"],
  desk_items: ["owner_key", "happening_key", "created_at"],
  abuse_buckets: ["actor_fingerprint", "scope", "bucket_start", "request_count", "updated_at"],
  correction_history: ["history_type", "public_story_id", "summary", "review_state", "created_at", "resolved_at", "resolved_by_fingerprint"],
  moderator_verification_events: ["moderator_fingerprint", "verification_level", "created_at", "expires_at"],
  moderator_tasks: ["task_type", "target_id", "moderator_fingerprint", "status", "claimed_at", "completed_at", "response_seconds", "completed_decision"],
  moderator_quality_events: ["decision_id", "outcome", "basis", "reviewer_fingerprint", "created_at"],
  privacy_preferences: ["owner_key", "opt_out_sharing", "limit_sensitive", "updated_at"],
  privacy_requests: ["owner_key", "request_type", "details", "status", "resolution", "resolved_at", "resolved_by_fingerprint", "created_at"],
  privacy_deletion_audit: ["scope", "deleted_happenings", "deleted_reputation_events", "created_at"]
} as const;

-- Cover the disputes.resolved_by foreign key with a partial index.
-- Without this, future deletes/updates on profiles cascade a sequential
-- scan over disputes. Partial-NULL predicate keeps the index tiny.

CREATE INDEX IF NOT EXISTS idx_disputes_resolved_by
  ON public.disputes (resolved_by)
  WHERE resolved_by IS NOT NULL;
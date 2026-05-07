-- Phase 1 Trigger skeletons for escrow lifecycle
-- This patch provides placeholder trigger functions to be fleshed out in Phase 2+.

-- Example: when a milestone becomes funded, emit a ledger event
CREATE OR REPLACE FUNCTION trigger_after_milestone_fund() RETURNS trigger AS $$
BEGIN
  -- TODO: insert ledger event, update wallet balances via SECURITY DEFINER function
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER milestone_fund_trigger
AFTER UPDATE ON milestones
FOR EACH ROW
WHEN (NEW.status = 'funded')
EXECUTE FUNCTION trigger_after_milestone_fund();

-- Example: when milestone moved to submitted, schedule auto-release
CREATE OR REPLACE FUNCTION trigger_after_milestone_submitted() RETURNS trigger AS $$
BEGIN
  -- TODO: set auto_release_at and notify parties
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER milestone_submitted_trigger
AFTER UPDATE ON milestones
FOR EACH ROW
WHEN (NEW.status = 'submitted')
EXECUTE FUNCTION trigger_after_milestone_submitted();

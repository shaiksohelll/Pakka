-- Phase 1 SECURITY DEFINER function scaffolds
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
BEGIN
  -- Admin is determined by profiles role via auth.uid()
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- fund_escrow: lock funds for a milestone (atomic ledger + wallet update)
CREATE OR REPLACE FUNCTION fund_escrow(_milestone_id UUID) RETURNS VOID AS $$ BEGIN
  -- Placeholder: implement atomic ledger+wallet updates in Phase 2
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- submit_milestone: worker submits milestone for review
CREATE OR REPLACE FUNCTION submit_milestone(_milestone_id UUID) RETURNS VOID AS $$ BEGIN
  -- Placeholder
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- approve_milestone: client approves milestone; funds released
CREATE OR REPLACE FUNCTION approve_milestone(_milestone_id UUID) RETURNS VOID AS $$ BEGIN
  -- Placeholder
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- dispute_milestone: client files a dispute
CREATE OR REPLACE FUNCTION dispute_milestone(_milestone_id UUID, _reason TEXT) RETURNS VOID AS $$ BEGIN
  -- Placeholder
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_force_release: admin overrides to release funds
CREATE OR REPLACE FUNCTION admin_force_release(_milestone_id UUID) RETURNS VOID AS $$ BEGIN
  -- Placeholder
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_refund: admin refunds funds back to client
CREATE OR REPLACE FUNCTION admin_refund(_milestone_id UUID) RETURNS VOID AS $$ BEGIN
  -- Placeholder
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- auto_release_milestones: cron job to auto-release funded milestones
CREATE OR REPLACE FUNCTION auto_release_milestones() RETURNS VOID AS $$ BEGIN
  -- Placeholder
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

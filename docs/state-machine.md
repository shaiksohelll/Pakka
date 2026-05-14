State Machine — Pakka Milestones

Overview
- The escrow flow is driven by two interconnected state machines:
 1) jobs.status: the lifecycle of a job (open, assigned, in_progress, completed, cancelled, disputed).
 2) milestones.status: per-milestone funding and delivery workflow (pending, funded, submitted, approved, disputed, released, refunded).
- All transitions must occur through SECURITY DEFINER Postgres functions. No direct client mutation of statuses.

Milestones State Transitions
1) pending -> funded
- Trigger: fund_escrow(milestone_id)
- Effect: milestone.status becomes 'funded'; atomic ledger entry created; client.locked_balance increases by amount; escrow_ledger updated (fund entry).
- Caller: client action initiating escrow funding.

2) funded -> submitted
- Trigger: submit_milestone(milestone_id) when worker submits proof and clicks Submit for Review.
- Effect: milestone.status = 'submitted'; submitted_at = now(); auto_release_at = now() + interval '72 hours'.
- Caller: worker action.

3) submitted -> approved
- Trigger: approve_milestone(milestone_id)
- Effect: escrow_held decreases by milestone amount; worker.available increases by amount; milestone.status = 'released' or 'approved' depending on design (commonly 'released' in ledger terms).
- Caller: client action.
- Also: emits realtime notification to both parties.

4) submitted -> disputed
- Trigger: dispute_milestone(milestone_id, reason)
- Effect: milestone.status = 'disputed'; create disputes row; funds remain locked; notification sent.
- Caller: client action.

5) submitted -> auto-release (cron)
- Trigger: auto_release_milestones() scheduler
- Effect: if auto_release_at <= now() and no dispute exists for milestone, milestone.status -> 'released'; worker wallet updated; ledger entry created; realtime notification.
- Caller: Edge Function cron.

6) disputed -> resolved_client
- Trigger: admin_refund or adjudicated refund
- Effect: escrow_held -= amount; client.available += amount; milestone.status = 'refunded' or 'released' depending on outcome; create ledger entries and notification.
- Caller: admin action.

7) disputed -> resolved_worker
- Trigger: admin_force_release
- Effect: same as approved, but initiated by admin.
- Caller: admin action.

8) disputed -> split
- Trigger: admin splits funds between parties using a dedicated SQL function.
- Effect: two ledger entries created; milestone.status = 'released' as per split outcome; wallet balances updated accordingly.
- Caller: admin action.

Cross-cutting considerations
- All writes go through SECURITY DEFINER functions; client code should never mutate status directly.
- RLS should constrain reads to the appropriate scope (owner, job participants, admin).
- Realtime subscriptions should be wired to milestone updates so both client and worker UIs reflect changes immediately.
- Idempotency: actions accept an Idempotency-Key; duplicate calls should be safely ignored.

Key Callers by Transition
- fund_escrow: client action (Phase 3/4 EFT)
- submit_milestone: worker action
- approve_milestone: client action
- dispute_milestone: client action
- auto_release_milestones: edge cron
- admin_*: admin role for overrides, refunds, releases, splits

Title: ADR-0004: Auto-release cadence
Status: Proposed
Context:

- Milestones should auto-release after a fixed window if no dispute exists to prevent funds from staying locked indefinitely.
  Decision:
- Implement a recurring edge function cron (every 5 minutes in prod cadence) to release funded milestones past their auto_release_at and with no active disputes.
  Consequences:
- Automates the release flow, reduces manual intervention, and requires robust idempotency and event notifications.

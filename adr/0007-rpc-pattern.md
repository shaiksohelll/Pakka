Title: ADR-0007: RPC pattern for SQL-bound actions
Status: Proposed
Context:

- All mutations rely on SECURITY DEFINER RPCs; we need a robust, auditable pattern for RPC exposure from the app.
Decision:
- Define naming conventions, input validation with Zod, access guards, and transaction patterns for RPCs such as fund_escrow, submit_milestone, etc.
Consequences:
- Aligns development practices and streamlines onboarding for new RPCs while maintaining security guarantees.

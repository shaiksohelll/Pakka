Title: ADR-0002: Escrow data & money flow model
Status: Proposed
Context:

- The escrow system is the core of Pakka. We require a robust, auditable model that ensures money moves only via SECURITY DEFINER functions and is zero-sum.
  Decision:
- Describe the data model (tables, relationships) and the money flow (fund, release, refund) with explicit guards and RLS rationale. Outline high-level API surface (RPCs) and their scope.
  Consequences:
- Enables a single source of truth for money movement and auditability. Guides implementation of functions like fund_escrow, submit_milestone, approve_milestone, dispute_milestone, and auto_release.

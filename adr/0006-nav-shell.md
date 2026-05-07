Title: ADR-0006: Persistent navigation shells
Status: Proposed
Context:
- Phase 4/6 UX requires persistent bottom navigation shells for clients and workers to improve navigation consistency.
Decision:
- Implement a persistent Shell layout per role with a top-level nav and a bottom bar that remains visible across routes.
Consequences:
- Ensures consistent access to core sections and reduces orphaned routes. Requires careful routing and route guards in the SPA.

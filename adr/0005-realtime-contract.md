Title: ADR-0005: Realtime contract boundaries
Status: Proposed
Context:

- The UI must reflect changes in escrow state in real-time for both clients and workers.
  Decision:
- Define the channel boundaries, data privacy constraints, and RPC wrappers that surface updates via Supabase Realtime with proper token binding.
  Consequences:
- Improves user experience while ensuring data access remains scoped via RLS and SECURITY DEFINER RPCs.

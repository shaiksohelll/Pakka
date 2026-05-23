# Pakka — Agent context

## Project

Open-source milestone-escrow reference implementation for Indian marketplaces. MIT-licensed, production-grade engineering, mock wallet by design.

## Stack

- Next.js 15 (App Router) + TypeScript strict + Tailwind v4 + shadcn/ui
- Supabase (Postgres + Auth + Realtime + Storage + Edge Functions)
- TanStack Query (server state) + Zustand (client state)
- Zod everywhere, react-hook-form for forms
- pnpm package manager

## Inviolable rules

1. NEVER mutate wallets/ledger from client code. Only via Postgres SECURITY DEFINER functions.
2. NEVER disable RLS, even temporarily. Every table has it.
3. ALL mutations are Server Actions in `src/app/_actions/`. No direct supabase calls from client components for writes.
4. ALL inputs validated with Zod on both client and server.
5. Money values formatted with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })`.

## Phase status

- Phase 0 (foundations): done
- Phase 1 (schema + RLS + state machine SQL): done
- Phase 2 (phone OTP auth + role bifurcation + KYC): done @ commit 2bd5443
- Phase 3 (jobs CRUD + browse + apply): ✅ done @ commit 577400d
- Phase 4 (escrow state machine): IN PROGRESS
- Phase 5-8: pending

## Key paths

- `supabase/migrations/` — DO NOT MODIFY, only consume
- `src/lib/supabase/{client,server,middleware}.ts` — auth-aware Supabase clients
- `src/app/onboarding/` — Phase 2 KYC flows
- `src/app/_actions/` — all Server Actions live here
- `src/lib/schemas/` — shared Zod schemas
- `middleware.ts` — route protection

## Conventions

- Mobile-first, max-width 640px centered on desktop
- Status badges via shared `<StatusBadge variant="..." />` component
- Loading skeleton + empty state + error boundary on every async page
- Optimistic UI on mutations, rollback toast on error
- Sentry capture inside every Server Action try/catch

## What "done" means for any prompt

- `pnpm typecheck` passes
- `pnpm lint` passes
- Git commit with conventional message format

## Out of scope reminders

- No real money — Demo Mode banner everywhere
- No Razorpay integration (documented in `/docs/production-swap.md` instead)
- No React Native — PWA + TWA wrap only

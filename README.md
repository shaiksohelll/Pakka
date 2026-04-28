# Pakka

> **Open-source milestone escrow reference implementation for Indian marketplaces.**
> Built as a portfolio artifact — production-grade infrastructure code, simulated money by design.

🔗 **Live demo:** [mypakka.vercel.app](https://mypakka.vercel.app) · **License:** MIT · **Status:** 🚧 In development (Phase 2 of 8)

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3FCF8E?logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## What this is

Pakka is a milestone-based escrow system for two-sided service marketplaces (e.g., construction, repair, home services). It's designed as a **reference implementation** that any marketplace builder can fork and adapt.

The money is **simulated by design** — real INR escrow in India requires an RBI-approved PPI license. The _engineering_ (atomic ledger, state machine, RLS, dispute resolution, realtime sync) is 100% production-grade. A 1-page production-swap guide shows how to wire in Razorpay Route when you have the license.

## Why it exists

This repo demonstrates the kind of infrastructure work senior engineers ship:

- 🔐 **Atomic state machine in Postgres** — `SECURITY DEFINER` functions with `SELECT FOR UPDATE` row locking, never trust the client with money
- 🛡️ **RLS as the auth layer** — every table policy-protected, admin bypass via `is_admin()`, defense-in-depth via column-locking triggers
- 📒 **Append-only escrow ledger** — every wallet movement is a row, sums to zero across the system, verifiable by property tests
- ⚡ **Realtime sync** — Supabase Realtime pushes state changes to both client and worker UIs simultaneously
- 📱 **PWA + TWA** — one codebase, web demo for recruiters, Play Store install for end users

## Architecture

┌─────────────────┐ ┌──────────────────┐ ┌─────────────────┐
│ Next.js 15 │────▶│ Supabase │────▶│ Postgres │
│ PWA (Vercel) │ │ Auth + Realtime │ │ RLS + Triggers │
└─────────────────┘ └──────────────────┘ └─────────────────┘
│ │
▼ ▼
┌──────────────────┐ ┌─────────────────┐
│ Edge Functions │ │ SECURITY │
│ (auto-release) │ │ DEFINER fns │
└──────────────────┘ └─────────────────┘

**State machine** (milestone status):

​
pending → funded → submitted → approved → released
│
▼
disputed → resolved_client | resolved_worker | split

See [`docs/adr/0001-escrow-state-machine-in-postgres.md`](docs/adr/0001-escrow-state-machine-in-postgres.md) for the full reasoning.

## Stack

| Layer         | Choice                                                           | Why                                     |
| ------------- | ---------------------------------------------------------------- | --------------------------------------- |
| Frontend      | Next.js 15 (App Router) + TypeScript strict                      | Hireable, RSC-native                    |
| Styling       | Tailwind v4 + shadcn/ui                                          | Fast, accessible, composable            |
| State         | Zustand + TanStack Query                                         | Client + server state separation        |
| Backend       | Supabase (Postgres + Auth + Realtime + Storage + Edge Functions) | RLS, free tier covers demo              |
| Auth          | Phone OTP + RLS                                                  | Real auth boundary, not middleware      |
| Payments      | Mock wallet (Demo Mode)                                          | RBI/PPI license required for real money |
| Mobile        | PWA + TWA via PWABuilder                                         | One codebase, Play Store install        |
| Observability | Sentry + PostHog                                                 | Error tracking + analytics              |

## Demo credentials

> The live demo runs in Demo Mode. Use phone `+91 9999999999` and OTP `123456` to log in as any seeded user. No SMS is sent.

| Role                 | Phone            | What you can see                        |
| -------------------- | ---------------- | --------------------------------------- |
| Client               | `+91 9999900001` | Funded jobs, approve/dispute milestones |
| Worker (verified)    | `+91 9999900011` | Submit proofs, withdrawable balance     |
| Worker (KYC pending) | `+91 9999900012` | Browse-only state                       |
| Admin                | `+91 9999900099` | Dispute kill-switch, KYC review queue   |

## Local development

### Prerequisites

- Node.js 20+, pnpm 9+
- A free [Supabase](https://supabase.com) project
- The [Supabase CLI](https://supabase.com/docs/guides/cli) (optional, for migrations)

### Setup

​

1. Clone
   git clone https://github.com/shaiksohelll/Pakka.git
   cd Pakka
2. Install
   pnpm install
3. Configure
   cp .env.local.example .env.local
   Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DEMO_MODE=true
4. Run migrations against your Supabase project
   supabase link --project-ref YOUR_REF
   supabase db push
5. Seed demo data (run supabase/seed.sql in the SQL Editor)
6. Start
   pnpm dev

Open [http://localhost:3000](http://localhost:3000).

## Project structure

​
src/
app/ # Next.js App Router routes
components/
ui/ # shadcn primitives
features/ # feature-specific components
lib/
supabase/ # client, server, middleware Supabase clients
schemas/ # Zod validation schemas
hooks/ # TanStack Query + custom hooks
supabase/
migrations/ # numbered SQL migrations (schema, RLS, escrow fns, hardening)
seed.sql # demo data for every UI state
docs/
adr/ # Architecture Decision Records
production-swap.md # how to wire in Razorpay Route

## Status

- [x] **Phase 0** — Foundations (repo, Vercel, Supabase, brand)
- [x] **Phase 1** — Schema, RLS, escrow functions, hardening triggers, seed data
- [ ] **Phase 2** — Auth (phone OTP) + role bifurcation + KYC onboarding (in progress)
- [ ] Phase 3 — Job posting + browse
- [ ] Phase 4 — Escrow ledger + state machine UI
- [ ] Phase 5 — Materials, disputes, admin
- [ ] Phase 6 — PWA, polish, i18n
- [ ] Phase 7 — Tests, observability, security audit
- [ ] Phase 8 — Deploy + Play Store

## Documentation

- [ADR-0001 — Escrow state machine in Postgres SECURITY DEFINER functions](docs/adr/0001-escrow-state-machine-in-postgres.md)
- More ADRs and a `production-swap.md` arrive in Phase 8.

## License

MIT. Fork it, ship it, modify it. Attribution appreciated but not required.

## Author

Built by **[Shaik Sohel](https://github.com/shaiksohelll)** — a portfolio artifact demonstrating production-grade marketplace infrastructure.

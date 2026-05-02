# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Pakka Web App (`artifacts/pakka`)

Indian escrow job marketplace migrated from Next.js/Vercel to React + Vite in this Replit pnpm monorepo.

### Architecture

- **Router**: Wouter (`Switch`, `Route`, `Redirect`, `useParams`, `useLocation`, `useSearch`)
- **Auth guard**: `AuthGuard` component in `App.tsx` — reads Supabase session, redirects unauthenticated users to `/login`
- **Backend**: Supabase (auth + database + realtime + storage)
- **State**: TanStack Query for server state, Zustand available for client state
- **Styling**: Tailwind CSS v4 with oklch color tokens, shadcn/ui components

### Environment Variables Required

- `VITE_SUPABASE_URL` — Supabase project URL (Replit Secret)
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key (Replit Secret)

### Routes

| Path | Component | Auth |
|------|-----------|------|
| `/` | Landing page | Public |
| `/login` | Phone OTP form | Public |
| `/login/verify?phone=` | OTP verification | Public |
| `/onboarding/role` | Role selector | Auth |
| `/onboarding/client` | Client profile form | Auth |
| `/onboarding/worker` | Worker KYC multi-step form | Auth |
| `/client` | Client dashboard | Auth |
| `/client/jobs` | Job list | Auth |
| `/client/jobs/new` | Post job (6-step wizard) | Auth |
| `/client/jobs/:id` | Job detail + applications | Auth |
| `/client/jobs/:id/milestones` | Escrow milestone management | Auth |
| `/client/wallet` | Wallet + transactions | Auth |
| `/worker` | Worker dashboard | Auth |
| `/worker/feed` | Job browse + infinite scroll | Auth |
| `/worker/applications` | Applications tracker | Auth |
| `/worker/jobs/:id` | Job detail + apply modal | Auth |
| `/worker/jobs/:id/milestones` | Milestone submit flow | Auth |
| `/worker/wallet` | Worker wallet | Auth |
| `/worker/kyc-pending` | KYC review status | Auth |
| `/admin` | Admin placeholder | Auth |

### Key Files

- `src/App.tsx` — Wouter router + AuthGuard + AppHeader
- `src/lib/supabase/client.ts` — browser Supabase client (VITE_ env vars)
- `src/app/_actions/jobs.ts` — job posting, application, accept worker actions
- `src/app/_actions/escrow.ts` — fund/submit/approve/dispute milestone actions
- `src/app/login/actions.ts` — OTP request + verify + redirect by role
- `src/app/onboarding/actions.ts` — role select, client/worker onboarding

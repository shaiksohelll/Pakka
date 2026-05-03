# Pakka — India's Trusted Job Escrow Platform

## Project Overview

Pakka is a mobile-first React + Vite web app (pnpm monorepo artifact at `artifacts/pakka/`) that connects clients who need work done with verified workers, using an escrow model to guarantee payment safety. It is an Indian market product with OTP-based phone auth via Supabase.

## Architecture

- **Monorepo**: pnpm workspace at root (`pnpm-workspace.yaml`), artifact under `artifacts/pakka/`
- **Frontend**: React 19, Vite 6, Tailwind v4 (`@tailwindcss/vite`), shadcn/ui components
- **Routing**: wouter
- **State / Data**: TanStack Query v5
- **Auth & DB**: Supabase (`@supabase/ssr` → `createBrowserClient` singleton at `src/lib/supabase.ts`)
- **Forms**: react-hook-form + zod v3
- **Notifications**: sonner toasts
- **Dev port**: 5173 (Replit-supported port)

## Key Directories

```
artifacts/pakka/
  src/
    actions/          # Supabase mutations (auth, jobs, escrow, onboarding)
    components/
      forms/          # CityAreaFields combobox (Sprint 2 Bug 2)
      layout/         # BottomNav, PageShell
      ui/             # Full shadcn/ui component library
    data/             # india-areas.ts (8 Tier-1 cities × 30 areas)
    hooks/            # use-user.ts, use-mobile.tsx, use-toast.ts
    lib/
      schemas/        # zod schemas (auth, jobs, onboarding)
      types/          # database.ts (Supabase DB types)
      format.ts       # currency / date formatters
      supabase.ts     # singleton browser client
      utils.ts        # cn()
    pages/            # All 16 pages (client/, worker/, onboarding/, admin)
    App.tsx           # wouter Router
    main.tsx          # React root
  postcss.config.mjs  # Empty — shadows root Next.js postcss config
  vite.config.ts      # Port 5173, base from BASE_PATH env, @tailwindcss/vite
  tsconfig.json       # Self-contained (no extends to non-existent base)
pnpm-workspace.yaml   # packages: ["artifacts/*"] + catalog: devDep versions
supabase/migrations/  # SQL migrations for all tables + Sprint 2 city/area split
```

## Supabase Environment

Secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are set in Replit secrets.

## Demo Credentials

- Clients: +919876500001 – +919876500003
- Workers: +919876500011 – +919876500015
- Admin:   +919876500099
- OTP: **123456** (all accounts)

## Sprint History

- **Sprint 1**: Full migration from Next.js — all pages, components, actions, Supabase wiring
- **Sprint 2 Bug 1**: Geo fix — `Promise.race` with 10 s timeout + `GeolocationPositionError` code handling in `new-job.tsx`
- **Sprint 2 Bug 2**: City/area split — `india-areas.ts` (Tier-1 data) + `CityAreaFields` combobox using Popover+Command, `indian-cities-json` for full city list
- **Sprint 3 (infra)**: Fixed 6 root causes blocking Vite startup; switched to port 5173

## Workflow

```
name: artifacts/pakka: web
command: pnpm --filter @workspace/pakka run dev
port: 5173
```

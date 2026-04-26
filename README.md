# pakka

Production-grade Next.js 15 starter with App Router, strict TypeScript, Tailwind CSS v4, shadcn/ui, Supabase SSR helpers, React Query, Zustand, and PWA-ready setup.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript strict mode
- Tailwind CSS v4
- shadcn/ui initialized with neutral base color
- Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- State + data: Zustand + React Query
- Validation/forms: Zod + React Hook Form + resolvers
- UI utilities: Sonner, Lucide, date-fns
- PWA plugin: `next-pwa` (service worker registration intentionally disabled for now)
- Tooling: ESLint + Prettier

## Prerequisites

- Node.js 20+
- pnpm 10+

## Quick Start

1. Install dependencies:

```bash
pnpm install
```

2. Create your local env file by duplicating `.env.local.example` as `.env.local` (or run one of the commands below):

```bash
# macOS/Linux
cp .env.local.example .env.local

# Windows PowerShell
Copy-Item .env.local.example .env.local
```

3. Fill in Supabase values in `.env.local`.

4. Start the app:

```bash
pnpm dev
```

5. Open `http://localhost:3000`.

## Scripts

- `pnpm dev` - start local dev server (Turbopack)
- `pnpm build` - production build
- `pnpm start` - serve production build
- `pnpm lint` - run ESLint
- `pnpm format` - format all files
- `pnpm format:check` - check Prettier formatting

## Environment Variables

Defined in `.env.local.example`:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `NEXT_PUBLIC_SITE_NAME`

## Project Structure

```text
pakka/
  public/
  src/
    app/
      favicon.ico
      globals.css
      layout.tsx
      page.tsx
    components/
      features/
        home-hero.tsx
        providers.tsx
      ui/
        button.tsx
    hooks/
      use-app-store.ts
    lib/
      supabase/
        client.ts
        middleware.ts
        server.ts
      types/
        index.ts
      utils.ts
  supabase/
    functions/
      health/
        index.ts
    migrations/
      .gitkeep
  .env.local.example
  .gitignore
  .prettierignore
  .prettierrc
  components.json
  eslint.config.mjs
  next.config.ts
  package.json
  pnpm-lock.yaml
  postcss.config.mjs
  tsconfig.json
  README.md
```

## Notes

- `@/*` alias maps to `src/*` via `tsconfig.json`.
- The global layout includes a mobile-first shell with `max-w-[480px]` on mobile and wider breakpoints up to full width on desktop.
- `sonner` toaster is mounted globally in `Providers`.
- PWA is configured in `next.config.ts` with `register: false`; enable registration later when ready.
- Supabase folders are scaffolded for migrations and edge functions.

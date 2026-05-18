# CLAUDE.md — Pakka repo rules

Canonical context for any AI assistant working on this codebase. Read before touching code. Re-read if context drifts after long sessions.

## What this project is

Pakka is an open-source MIT reference implementation of milestone-escrow infrastructure for a service marketplace. **Not a startup** — it's a portfolio artifact and a fork base. Audience: recruiters reviewing GitHub, senior engineers reading the code.

**Demo Mode is the design.** Real INR escrow needs an RBI PPI license — out of scope. Wallets hold demo balances; top-up and withdraw are ledger-only. No Razorpay, no Stripe, no real money path.

## Stack

- Next.js 15.5.15 App Router + Turbopack
- React 19.1.0, TypeScript strict
- Tailwind v4 + shadcn/ui (cmdk, Radix primitives)
- Supabase (Postgres + Auth + Realtime + Edge Functions + Storage)
- TanStack Query 5.100.5 for async state
- React Hook Form + @hookform/resolvers/zod, Zod 3.25.76
- pnpm 10.33.2
- Vitest + fast-check
- Vercel (mypakka.vercel.app)

## Don't touch

These SECURITY DEFINER functions are the financial state machine. Smoke-tested across multiple production runs. Modifications require an ADR.

- fund_escrow
- submit_milestone
- approve_milestone
- dispute_milestone
- admin_force_release
- admin_refund
- auto_release_milestones
- topup_wallet
- withdraw_wallet (once PR #18 lands)

If a feature needs new financial logic, add a new RPC. Do not edit existing ones.

## Async state pattern (non-negotiable)

For any async UI state that must reflect the full request lifecycle (submit button disabled, dialog close-lock, "Processing…" label):

CORRECT — useMutation binds isPending to the full async lifecycle:

    const mutation = useMutation({
      mutationFn: someAction,
      onSuccess: () => { /* invalidate queries, toast */ },
      onError: (err) => { /* toast err.message */ },
      onSettled: () => { inFlightRef.current = false },
    })
    <Button disabled={mutation.isPending}>...</Button>

WRONG — useTransition's isPending flips false at the first await:

    const [isPending, startTransition] = useTransition()
    startTransition(async () => { await someAction() })

useTransition's isPending only stays true through the synchronous prefix. It releases mid-request and your button + close-lock + label all unlock while the server is still working. Bit PR #14, PR #16 review, and PR #17. Use useMutation, useSWRMutation, or explicit useState<boolean> with finally.

## Dialog component pattern

Canonical reference: src/components/wallet/topup-dialog.tsx (post-PR-#17). Every async dialog follows:

- useMutation bound to the full async lifecycle (above)
- inFlightRef = useRef(false) — synchronous guard for the double-click window before mutation.isPending flips true
- mountedRef = useRef(true) — strict-mode reset; gate setState + toasts in onSuccess/onError so they don't fire after unmount
- formatInr from @/lib/format for every currency display (toast, button label, bounds string, chip labels)
- onWheel={blurOnWheel} on number inputs — prevents accidental scroll-wheel value changes

## SQL conventions

Every state-changing RPC follows this template:

    create or replace function public.<verb_noun>(p_arg1 type, p_idempotency_key uuid)
    returns table (...)
    language plpgsql
    security definer
    set search_path = public
    as $$
    begin
      if auth.uid() is null then
        raise exception 'not_authenticated' using errcode = '42501';
      end if;
      if p_arg1 is null or p_arg1 <= 0 then
        raise exception 'invalid_amount' using errcode = '22023';
      end if;
      -- business logic
    end;
    $$;

    grant execute on function public.<verb_noun>(...) to authenticated;

- security definer + set search_path = public always together
- grant execute … to authenticated — never anon, never public
- Postgres errcodes (42501, 22023) — client maps codes to user-facing messages, never raw error text
- Idempotency: every state-changing RPC takes p_idempotency_key uuid. The UNIQUE constraint scope and the function's lookup predicate must include the same owner column (per-user, not global). See topup_wallet migration 20260518002100.

## RLS + cross-user reads

profiles RLS allows self-read only. Client sessions cannot .from('profiles').in('id', otherUserIds) and get rows back — query silently returns []. For any cross-user enrichment (e.g. showing worker names on a client's application list), use a SECURITY DEFINER RPC with an explicit EXISTS clause proving the caller is authorized to see those IDs. See get_application_worker_summary.

Per ADR-0032: never silently default to [] on .error. Always throw.

## Realtime subscription contract

Every .on('postgres_changes') site must:

1. Use a Supabase client that calls supabase.realtime.setAuth(session.access_token) after every auth state change. Without it, channels auth with anon key and the server silently drops broadcasts.
2. Pass filter as a string template (filter: `job_id=eq.${jobId}`). Object-form filters are accepted by TS but silently no-op at runtime.
3. Clean up with supabase.removeChannel(channel), NOT channel.unsubscribe().
4. Chain .subscribe((status) => console.log('[<channel>]', status)) so DevTools confirms SUBSCRIBED.
5. On event, refetch via queryClient.invalidateQueries(...). Don't reach into local state and mutate.

Tables needing REPLICA IDENTITY FULL + supabase_realtime publication: milestones, wallets, escrow_ledger, job_applications, jobs, notifications, disputes.

## Error handling + Sentry

Every server action / RPC wrapper catch block includes:

    } catch (err) {
      // TODO: Sentry.captureException(err)
      throw err
    }

The // TODO: Sentry.captureException(err) marker is a grep target. When Sentry SDK lands (PR #18), a single sed pass replaces markers with real calls. Don't remove markers, don't change wording.

## Conventional commits

Format: <type>(<scope>): <subject>

- feat(wallet): add worker withdrawal flow
- fix(wallet): bind top-up pending state to mutation lifecycle
- chore(deps): bump @tanstack/react-query to 5.100.5
- docs(adr): accept ADR-0036 persistent nav shell

Body explains why, not what — the diff shows what.

Branch naming: <type>/<scope>-<short-description>, kebab-case.

- feat/wallet-withdrawal
- fix/wallet-topup-pending-state

## Migrations

- Filename: supabase/migrations/<YYYYMMDDHHMMSS>_<verb_noun>.sql
- Timestamps in IST — no need to convert
- Idempotent where possible: create or replace function, do $$ … exception when duplicate_object then null end $$, add column if not exists
- One migration per logical change. Don't bundle unrelated schema work.
- Apply via Supabase MCP apply_migration or supabase db push — never paste into Studio without saving the file first.

## Phase 5.5 AI rules

Effective when Phase 5.5 lands.

- Single server-side wrapper: src/lib/ai/llm.ts with complete() and completeWithSchema<T>(). All LLM calls go through it.
- Wrapper handles: timeout, retry with exponential backoff, fallback model, Sentry capture, per-feature env flag check.
- Structured output via Zod schemas → JSON Schema. Never trust raw model output.
- Provider: OpenRouter. Sonnet 4.6 for drafters, Opus 4.6 for summarizers needing 1M context.
- Every AI feature has a feature flag (AI_JOB_DRAFTER_ENABLED, etc.) + a non-AI fallback path that works when the flag is false.
- AI is advisory only for money/trust/KYC/disputes. Humans click the final button.
- Prompts versioned in src/lib/ai/prompts/<feature>/v<n>.ts. Never inline prompts in feature code.
- Override telemetry: every time a user edits an AI-generated field before submit, log a Sentry breadcrumb. This is the resume-defining instrumentation.

## Roadmap pointers

- Big roadmap: the "Build Roadmap — Vibe Coding Pakka to Production" doc
- Phase 4 handoff: Notion page "Pakka Phase 4 — Context Handoff"
- Phase 5 backlog: Notion page "Pakka — Phase 5 backlog"
- Bridge prompts (Sprints 1/2/3): Notion page "Replit Day-1 Prompts — Phase 4 Closeout"
- ADRs: docs/adr/<NNNN>-<short-name>.md

## Maintainer preferences

- Phase ordering is sacred. Don't skip ahead to AI features before Phase 4 + Phase 5 close. Half-built phases create review-fix churn (see PR #14/#15/#17).
- One PR, one focus. No mixing unrelated migrations.
- Short, clear, step-by-step. Lead with the diff plan, not philosophy.
- No filler. Don't repeat what the diff shows. Don't say "I have made the changes" — show the changes.
- Verify before declaring done. pnpm typecheck && pnpm lint && pnpm test && pnpm build — all four green.
# ADR-0036: Persistent Bottom Navigation Shell

**Status:** Accepted  
**Date:** 2026-05-02  
**Deciders:** Engineering

---

## Context

After the Vite migration, the app had no persistent navigation chrome. Every route
was a blank page with no way to switch between Home, Jobs, Applications, and Wallet
without using the browser back button. `/worker/jobs` (without an `:id`) returned a
404 because it was never registered as a route.

---

## Decision

1. **`BottomNav.tsx`** — a `fixed bottom-0` bar (`h-14`, `z-40`) rendered inside
   `AuthGuard` in `App.tsx`. Tabs vary by role:
   - **Client:** Home · My Jobs · Wallet
   - **Worker:** Browse · Applications · Wallet
   - Hidden on auth/onboarding routes.

2. **`/worker/jobs` redirect** — added as an explicit wouter route that redirects to
   `/worker/applications` so old links and back-button artifacts don't 404.

3. **CTA z-index audit (ADR-0043 companion fix)** — all `fixed bottom-0` CTA bars
   (post-job-form, worker-job-detail) changed to `fixed bottom-14` so they float
   above the nav bar rather than being hidden beneath it. Form scroll padding
   updated from `pb-28` → `pb-36` for correct clearance against both bars.

---

## Consequences

- **Good:** one-tap navigation between all primary sections.
- **Good:** no 404 on `/worker/jobs` for users following old links.
- **Good:** CTAs (Apply, Next/Back, Post Job) are no longer occluded by the nav bar.
- **Neutral:** back-button deep-links in worker-job-detail already used `/worker/jobs/:id`
  (not `/worker/jobs`), so no further changes were needed there.

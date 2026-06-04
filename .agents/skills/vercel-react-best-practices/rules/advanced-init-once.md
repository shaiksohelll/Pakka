---
title: Initialize App Once, Not Per Mount
impact: LOW-MEDIUM
impactDescription: avoids duplicate init in development
tags: initialization, useEffect, app-startup, side-effects
---

## Initialize App Once, Not Per Mount

Do not put app-wide initialization that must run once per app load inside `useEffect([])` of a component. Components can remount and effects will re-run. Use a module-level guard or top-level init in the entry module instead.

> **Client-only.** The `didInit` module-level guard below is only appropriate in browser/client entry modules, and only for non-request/user-specific, idempotent initialization. Do **not** use a mutable module-level guard in Next.js Server Components, SSR, or any request-scoped code: module variables are process-wide and shared across concurrent requests, so they can leak state between users. For server-side one-time setup, run it at top level in a server entry/module that is designed for that scope (or use a per-request mechanism), not via a mutable module flag.

**Incorrect (runs twice in dev, re-runs on remount):**

```tsx
function Comp() {
  useEffect(() => {
    loadFromStorage()
    checkAuthToken()
  }, [])

  // ...
}
```

**Correct (once per app load, client entry only):**

```tsx
'use client'

let didInit = false

function Comp() {
  useEffect(() => {
    if (didInit) return
    didInit = true
    loadFromStorage()
    checkAuthToken()
  }, [])

  // ...
}
```

Reference: [Initializing the application](https://react.dev/learn/you-might-not-need-an-effect#initializing-the-application)

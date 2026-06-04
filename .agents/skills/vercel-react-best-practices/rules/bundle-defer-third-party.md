---
title: Defer Non-Critical Third-Party Libraries
impact: MEDIUM
impactDescription: loads after hydration
tags: bundle, third-party, analytics, defer
---

## Defer Non-Critical Third-Party Libraries

Analytics, logging, and error tracking don't block user interaction. Load them after hydration.

**Incorrect (blocks initial bundle):**

```tsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

**Correct (loads after hydration):**

`next/dynamic` with `{ ssr: false }` is only allowed in a Client Component, so isolate it in its own `'use client'` file and render that from the Server Component `RootLayout`.

```tsx
// app/analytics-client.tsx
'use client'
import dynamic from 'next/dynamic'

const Analytics = dynamic(
  () => import('@vercel/analytics/react').then(m => m.Analytics),
  { ssr: false }
)

export default function AnalyticsClient() {
  return <Analytics />
}
```

```tsx
// app/layout.tsx (Server Component)
import AnalyticsClient from './analytics-client'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <AnalyticsClient />
      </body>
    </html>
  )
}
```

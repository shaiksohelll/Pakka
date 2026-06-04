---
title: Use useTransition Over Manual Loading States
impact: LOW
impactDescription: reduces re-renders and improves code clarity
tags: rendering, transitions, useTransition, loading, state
---

## Use useTransition Over Manual Loading States

Use `useTransition` to mark non-urgent state updates so the UI stays responsive, and use its built-in `isPending` flag instead of a manual `useState` loading boolean. Note that React only treats the **synchronous** state updates made inside the `startTransition` callback as part of the transition - network work should happen outside the transition, with the resulting state update wrapped in `startTransition`.

**Incorrect (manual loading state):**

```tsx
function SearchResults() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const handleSearch = async (value: string) => {
    setIsLoading(true)
    setQuery(value)
    const data = await fetchResults(value)
    setResults(data)
    setIsLoading(false)
  }

  return (
    <>
      <input onChange={(e) => handleSearch(e.target.value)} />
      {isLoading && <Spinner />}
      <ResultsList results={results} />
    </>
  )
}
```

**Correct (await outside the transition, wrap the resulting update):**

```tsx
import { useTransition, useState } from 'react'

function SearchResults() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isPending, startTransition] = useTransition()

  const handleSearch = async (value: string) => {
    setQuery(value) // Update input immediately

    // Do the async work outside the transition...
    const data = await fetchResults(value)

    // ...then mark the resulting state update as non-urgent.
    startTransition(() => {
      setResults(data)
    })
  }

  return (
    <>
      <input onChange={(e) => handleSearch(e.target.value)} />
      {isPending && <Spinner />}
      <ResultsList results={results} />
    </>
  )
}
```

**Benefits:**

- **Built-in pending state**: `isPending` is managed for you while the transition's updates render
- **Better responsiveness**: Urgent updates (like typing into the input) aren't blocked by the non-urgent results render
- **Interrupt handling**: A newer transition's render can supersede an in-progress one

Note: `useTransition` does not cancel in-flight network requests or replace request-lifecycle error handling - handle fetch errors and cancellation (e.g. `AbortController`) yourself.

Reference: [useTransition](https://react.dev/reference/react/useTransition)

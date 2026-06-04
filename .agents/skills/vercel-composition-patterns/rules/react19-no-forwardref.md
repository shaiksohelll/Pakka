---
title: React 19 API Changes
impact: MEDIUM
impactDescription: cleaner component definitions and context usage
tags: react19, refs, context, hooks
---

## React 19 API Changes

> **⚠️ React 19+ only.** Skip this if you're on React 18 or earlier.

In React 19, `ref` can be passed as a regular prop (so `forwardRef` is usually
unnecessary), and `use(context)` is a more flexible alternative to
`useContext()`. Both `forwardRef` and `useContext()` still work and are not
deprecated — the guidance below is about the preferred pattern for new code.

**Legacy (forwardRef still works):**

```tsx
const ComposerInput = forwardRef<TextInput, Props>((props, ref) => {
  return <TextInput ref={ref} {...props} />
})
```

**Preferred (ref as a regular prop):**

```tsx
function ComposerInput({ ref, ...props }: Props & { ref?: React.Ref<TextInput> }) {
  return <TextInput ref={ref} {...props} />
}
```

**Also valid (useContext still supported):**

```tsx
const value = useContext(MyContext)
```

**Preferred when you need conditional/loop usage (use):**

```tsx
const value = use(MyContext)
```

Unlike `useContext()`, `use()` can be called conditionally (e.g. inside an `if`
block), which is the main reason to prefer it for new code.

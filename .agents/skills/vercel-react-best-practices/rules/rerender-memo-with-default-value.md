---

title: Extract Default Non-primitive Parameter Value from Memoized Component to Constant
impact: MEDIUM
impactDescription: avoids unstable default props re-rendering descendants
tags: rerender, memo, optimization

---

## Extract Default Non-primitive Parameter Value from Memoized Component to Constant

`memo()` compares a component's incoming props before rendering, so an unused default value does not break the component's own memoization. The real problem is when a non-primitive default (an array, object, or function) is created inside the component and then passed down to child components: a fresh instance is created on every render, fails strict equality, and forces those descendants to re-render unnecessarily.

To address this, extract the default value into a stable reference - a module-level constant (or `useMemo`/`useCallback` when it must be created inside the component).

**Incorrect (`onClick` is a new value on every render and is passed to a child):**

```tsx
const UserAvatar = memo(function UserAvatar({ onClick = () => {} }: { onClick?: () => void }) {
  // onClick is forwarded to a memoized child, which now re-renders every time
  return <AvatarButton onClick={onClick} />
})

// Used without optional onClick
<UserAvatar />
```

**Correct (stable default value):**

```tsx
const NOOP = () => {};

const UserAvatar = memo(function UserAvatar({ onClick = NOOP }: { onClick?: () => void }) {
  return <AvatarButton onClick={onClick} />
})

// Used without optional onClick
<UserAvatar />
```

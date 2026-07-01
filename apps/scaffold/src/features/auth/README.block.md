# Auth Block

Stable contract — DO NOT rewrite core logic.

## Exports

- `useAuth()` — `{ user, session, loading }`
- `AuthProvider` — session listener wrapper
- `ProtectedRoute` — redirect unauthenticated users

## Stub mode

When `auth.state === "stub"`, `useAuth()` returns `{ user: null, loading: false }`.

## Activation

Run `pnpm blocks:activate auth` to enable email auth with profiles table.

# Lovable Agent Policy

Policy-as-code manifest for agent boundaries and protected paths.

## Protected paths

The AI agent MUST NOT modify these paths without explicit user override:

```yaml
protected_paths:
  - src/features/auth/AuthProvider.tsx
  - src/features/auth/ProtectedRoute.tsx
  - src/features/auth/hooks/useAuth.ts
  - src/features/admin/AdminDashboard.tsx
  - src/features/admin/hooks/**
  - src/features/admin/components/Metric*.tsx
  - src/features/*/metrics.tab.ts
  - src/integrations/supabase/client.ts
  - supabase/functions/_shared/**
  - supabase/functions/admin-metrics/**
  - supabase/migrations/0001_*.sql
  - supabase/migrations/0002_*.sql
  - supabase/migrations/0003_*.sql
```

## Agent may configure

```yaml
agent_may_configure:
  - src/features/auth/pages/*
  - lovable.blocks.json
  - src/pages/*
  - src/services/*
  - src/components/**
  - supabase/migrations/*_domain_*.sql
```

## Block contracts (import boundaries)

Feature code MUST use these stable contracts:

- `useAuth()`, `AuthProvider`, `ProtectedRoute` from `@/features/auth`
- `supabase` from `@/integrations/supabase/client`
- `uploadFile()`, `getPublicUrl()` from `@/features/storage/upload`
- `useRole()`, `isAdmin()` from `@/features/admin/rbac`
- `env` from `@/lib/env`

## Work classification

1. **Block activation** — deterministic recipes, no LLM
2. **Block configuration** — parameterized edits only
3. **Feature generation** — LLM writes domain code outside protected paths
4. **Block override** — rare; requires explicit user intent

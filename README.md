# Lovable-Style POC

A proof-of-concept implementation of the [Lovable.dev](https://lovable.dev) AI-native application platform architecture. See [`docs/`](./docs/) for full system design documentation.

## What's included

| Component | Path | Description |
|-----------|------|-------------|
| **Scaffold** | `apps/scaffold` | Frozen Tier 1–3 blocks, Plant Pal reference app |
| **Platform UI** | `apps/platform` | Simplified chat + preview builder |
| **Block registry** | `packages/block-registry` | Manifest schema, activation recipes |
| **Agent core** | `packages/agent-core` | Classifier, planner, build gate |
| **Shared** | `packages/shared` | Types, env validation |

## Quick start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run scaffold dev server (Plant Pal app)
pnpm --filter @app/scaffold dev

# Run platform builder UI (separate terminal)
pnpm --filter @app/platform dev
```

Open http://localhost:5173 for the Plant Pal app.

Open http://localhost:3001 for the platform landing page, or go directly to http://localhost:3001/builder for the builder UI (Google sign-in required unless `BUILDER_AUTH_DISABLED=1`).

### Builder Google OAuth

The builder at `/builder` requires Google sign-in. Set these env vars when running the platform (see `.env.sample`):

```bash
BETTER_AUTH_SECRET=...   # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3001
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) with redirect URI `http://localhost:3001/api/auth/callback/google`.

To skip auth during local development: `BUILDER_AUTH_DISABLED=1 pnpm --filter @app/platform dev`

## Local Supabase

```bash
cd apps/scaffold

# Start local Supabase stack
supabase start

# Apply migrations + seed
supabase db reset

# Copy env vars from supabase status output
cp .env.sample apps/scaffold/.env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

## Block activation

Blocks start in **stub** mode. Activate deterministically:

```bash
pnpm blocks:activate auth
pnpm blocks:activate storage
pnpm blocks:activate ai
pnpm blocks:activate rbac

# Validate manifest
pnpm blocks:validate-manifest

# Deactivate
pnpm blocks:deactivate auth
```

## Plant Pal flow

1. Activate blocks: `auth`, `storage`, `ai`
2. Sign up at `/signup`
3. Upload a plant photo at `/analyze`
4. View history at `/history`

RLS ensures users only see their own `plant_checks` rows.

## Agent platform

The platform UI (`apps/platform`) demonstrates the simplified agent loop:

- **Block activation** — deterministic recipes, no LLM
- **Feature generation** — template-based patches (LLM hook ready)
- **Build gate** — `pnpm build` validation
- **Plan mode** — preview diffs before apply

Example prompts:
- `"Add login"` → block activation (auth)
- `"Add a plants page that lists my plants"` → feature generation

## Deploy (Vercel + Supabase free tier)

### Frontend (Vercel Hobby)

1. Connect GitHub repo to Vercel
2. Set root directory to `apps/scaffold`
3. Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
4. Deploy — `vercel.json` handles SPA routing

### Backend (Supabase free)

1. Create project at [supabase.com](https://supabase.com)
2. `supabase link --project-ref <ref>`
3. `supabase db push`
4. `supabase functions deploy admin-metrics analyze-plant send-email`

### Supabase project pause

Free tier projects pause after ~1 week of inactivity. Restore from the Supabase dashboard.

## Export scaffold

```bash
pnpm export:scaffold
# Output: export/scaffold/ (standalone repo)
```

## Testing

```bash
pnpm test                    # Unit tests
pnpm --filter @app/scaffold test:e2e  # Playwright E2E
```

## Policy

Agent boundaries are defined in [`LOVABLE.md`](./LOVABLE.md). CI validates protected path diffs:

```bash
pnpm policy:check-protected-paths
```

## Architecture docs

| Doc | Description |
|-----|-------------|
| [system-design.md](./docs/system-design.md) | Platform architecture |
| [reusable-blocks.md](./docs/reusable-blocks.md) | Block catalog |
| [generated-app-anatomy.md](./docs/generated-app-anatomy.md) | Runtime anatomy |
| [agent-loop.md](./docs/agent-loop.md) | Agent orchestration |
| [implementation-plan.md](./docs/implementation-plan.md) | This POC plan |

## POC constraints

- Vercel Hobby + Supabase free tier
- Simplified agent (no MCP server, no Visual Edits)
- Tier 3 blocks (Stripe, multi-tenant) are stubs only
- Cold starts and manual Supabase restores are acceptable

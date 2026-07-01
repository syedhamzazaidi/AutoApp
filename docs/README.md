# Lovable Platform System Design

Architecture documentation for [Lovable.dev](https://lovable.dev) — the AI-powered full-stack app builder.

**POC focus:** Generated apps in this repo target **free-tier hosting** (Vercel Hobby + Supabase free). Cold starts and manual Supabase restores are acceptable; see [system-design.md §7](./system-design.md#7-infrastructure--devops).

## Documents

| Document | Description |
|----------|-------------|
| [system-design.md](./system-design.md) | Main platform reference — layers, backend, infrastructure, security, integrations |
| [reusable-blocks.md](./reusable-blocks.md) | Frozen scaffold blocks, activation model, admin dashboard metrics |
| [generated-app-anatomy.md](./generated-app-anatomy.md) | What Lovable generates and how apps run at runtime |
| [agent-loop.md](./agent-loop.md) | AI agent orchestration — five-step loop, modes, error handling |
| [implementation-plan.md](./implementation-plan.md) | How to implement the POC — phases, IaC, block order, testing |

## Reading order

1. **system-design.md** — start here for the big picture
2. **reusable-blocks.md** — how codegen avoids reinventing auth, storage, admin, etc.
3. **generated-app-anatomy.md** — what ends up in the user's repo
4. **agent-loop.md** — how prompts become code through the agent cycle
5. **implementation-plan.md** — execution plan for building the POC (start here when implementing)

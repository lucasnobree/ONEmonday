# ONEmonday — Onboarding & Handoff

Internal multi-sector management platform (Monday.com-style). This document
onboards a developer/agent to the repo **and** captures the current state of
the in-progress professionalization effort so work can resume on any device.

---

## 1. What this project is

- **App**: Next.js 16 (App Router, Turbopack) + React 19, TypeScript strict, in
  [`apps/web`](apps/web).
- **Backend**: Supabase (Postgres + RLS), schema in [`supabase/`](supabase).
- **UI**: Tailwind v4, shadcn-style components, TanStack Query, dnd-kit, recharts.
- **Modules**: Core (boards/cards/projects), CRM, HR, Support Desk are built.
  Analytics, Dev-Tools, Finance, Legal, Marketing are placeholders being built
  in Wave 2 (see §5).

## 2. Local setup

```bash
# 1. Start local Supabase (Docker required) — runs on ALTERNATE ports 54341+
apps/web/node_modules/.bin/supabase start

# 2. apps/web/.env.local  (gitignored — create it)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54341
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH

# 3. Install + run
cd apps/web && npm install && npm run dev
```

- Ports were moved to **54341+** (`supabase/config.toml`) to avoid a clash with
  another local Supabase project. Studio: http://127.0.0.1:54343.
- **Admin login** (created manually — there is no public signup):
  `admin@onemonday.local` / `admin123`. It has a row in `public.users`
  (`is_global_admin=true`) and `user_sector_roles` for all 4 sectors.
- Demo data: `supabase/sample_data.sql` + `sample_data_modules.sql` are NOT
  auto-loaded; run them with `docker exec -i supabase_db_ONEmonday psql -U
  postgres -d postgres -f -` after `supabase start`.
- After pulling new migrations: `apps/web/node_modules/.bin/supabase migration up --local`.

## 3. Commands (run from `apps/web`)

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server (slow first hit per route — on-demand compile) |
| `npm run build && npm run start` | Production mode (fast) |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm test` / `npm run test:coverage` | Vitest unit/integration |
| `npm run test:e2e` | Playwright E2E |

## 4. Conventions

Trunk-based: short-lived `feat/`, `fix/`, `chore/` branches off `master`,
Conventional Commits (validated by commitlint + CI). See
[`CONTRIBUTING.md`](CONTRIBUTING.md). Migrations are append-only, idempotent,
RLS on every new table; per-wave numbering bands (Wave 1: 00016/00020/00030/
00040; Wave 2: 00050s–00090s).

## 5. Current state of work (2026-05-15)

### Done — on local `master` (35 commits ahead of `origin/master`)
- **Foundation**: Vitest + Playwright, GitHub Actions CI, versioning
  (CHANGELOG, CONTRIBUTING, commitlint), `.claude/agents/` subagent definitions.
  Tag **`v0.1.0`** marks the pre-foundation MVP.
- **Wave 1**: Core, CRM, HR, Support improved by 4 parallel agents, integrated,
  senior-reviewed, review findings fixed. State verified green: lint 0,
  typecheck 0, **131 unit tests**, build OK, migrations `00016/00020/00030/00040`
  applied locally.

### Wave 2 — done
All five placeholder modules are built, integrated into `master` and verified
green (**249 unit tests**, lint 0, typecheck 0, build OK), with migrations
`00050`–`00090` applied:
- **Finance** — invoices, expenses, budgets, cash-flow dashboard.
- **Legal** — contract repository, renewals, matters, clause library.
- **Analytics** — KPI dashboard and saved metric reports.
- **Dev-Tools** — incidents (MTTA/MTTR), services, deployments, feature flags.
- **Marketing** — campaigns, content calendar, audience segments.

All nine sector modules are now active in the sidebar. The `salvage/*`
branches (crashed-agent partials) are obsolete and can be deleted.

### ⚠️ Not yet pushed to GitHub
- `origin/master` is still at the original `43c12e7`. Tag `v0.1.0` IS pushed.
- `git push origin master` is **blocked**: the OAuth token lacks the `workflow`
  scope and the commits include `.github/workflows/ci.yml`.
- **To unblock** (and to make this work reachable from another device): run
  `gh auth refresh -s workflow` (authorize in browser), then
  `git push origin master` and push the `feat/*-wave2` branches.

## 6. How to resume

1. **Push first** (see §5) — run `gh auth refresh -s workflow`, then
   `git push origin master`. Until then this work lives only on this machine.
2. Recommended next steps:
   - Senior-review the Wave 2 modules (see `.claude/agents/senior-reviewer.md`).
   - Expand E2E coverage for the new modules.
   - Open follow-ups deferred from Wave 1: WIP-limit check-then-insert race
     (`lib/actions/cards.ts`), HR document-deletion permission granularity.
   - Delete the obsolete `salvage/*` and merged `feat/*-wave*` branches.

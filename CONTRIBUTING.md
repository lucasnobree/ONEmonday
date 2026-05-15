# Contributing to ONEmonday

## Local setup

The app lives in [`apps/web`](apps/web) (Next.js 16) and the database is a local
Supabase stack defined in [`supabase/`](supabase).

```bash
# 1. Start the local Supabase stack (Docker required)
apps/web/node_modules/.bin/supabase start

# 2. Configure apps/web/.env.local with the printed URL and publishable key
#    NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. Install and run the app
cd apps/web
npm install
npm run dev
```

## Branching model

Trunk-based development off `master`:

- `master` is always releasable; CI must be green.
- Work happens on short-lived branches, one concern each:
  - `feat/<scope>-<short-desc>` — new functionality
  - `fix/<scope>-<short-desc>` — bug fixes
  - `chore/<short-desc>` — tooling, deps, infra
- Open a pull request into `master`. CI (lint, typecheck, unit tests, build,
  commitlint) must pass before merge.
- Prefer squash-merge so `master` keeps one Conventional Commit per change.

## Commit messages

This repo uses [Conventional Commits](https://www.conventionalcommits.org/),
validated in CI by commitlint (`apps/web/commitlint.config.mjs`).

```
<type>(<scope>): <subject>
```

- **type**: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`, `build`.
- **scope** (optional but encouraged): a module or area — `core`, `boards`,
  `projects`, `crm`, `hr`, `support`, `analytics`, `dev-tools`, `finance`,
  `legal`, `marketing`, `auth`, `sectors`, `ui`, `db`, `supabase`, `ci`,
  `deps`, `tests`, `docs`.

## Tests

All commands run from `apps/web`:

| Command | Purpose |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Unit/integration tests (Vitest) |
| `npm run test:coverage` | Unit tests with coverage report |
| `npm run test:e2e` | End-to-end tests (Playwright) |

Unit tests live next to the code as `*.test.ts(x)`. E2E specs live in
`apps/web/e2e/`. A change to a module should ship with focused tests for the
behaviour it touches; bug fixes should add a regression test.

## Versioning & releases

[Semantic Versioning](https://semver.org/). Every user-facing change is recorded
under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md). A release moves those
entries under a new `## [x.y.z]` heading and is tagged `vX.Y.Z`.

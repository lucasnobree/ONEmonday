# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Test infrastructure: Vitest + Testing Library for unit/integration tests and
  Playwright for E2E, with `test`, `test:coverage` and `test:e2e` scripts.
- GitHub Actions CI: lint, typecheck, unit tests, build, and Conventional
  Commits validation on pull requests.
- Versioning process: this changelog, `CONTRIBUTING.md`, and commitlint.
- Specialized subagent definitions under `.claude/agents/`.
- Per-sector feature-gap research under `docs/research/`.
- **Core**: card editing, card/checklist-item deletion, tag assignment,
  WIP-limit enforcement, a board filter bar (search + priority), and card
  completion tracking via a database trigger.
- **CRM**: deal rotting indicators, structured closed-lost reasons, an
  immutable deal stage-history table, a weighted pipeline forecast, and CSV
  export on the activities page.
- **HR**: document expiry tracking with dashboard alerts, free-text employee
  directory search, and the onboarding responsible-role surfaced in the UI.
- **Support Desk**: Canned Responses CRUD, first-response tracking, ticket
  reopening, ticket tags, and ticket assignment to sector agents.
- **Finance** module: invoices, expenses, budgets, and a cash-flow dashboard;
  all monetary amounts stored as integer cents.
- **Legal** module: contract repository with renewal tracking, legal matters
  intake, and a clause library.

### Changed
- Sector switching is backed by `useSyncExternalStore` for snapshot-stable,
  cross-tab state without effect-driven updates.

### Fixed
- Sector switching now propagates across all open screens (shared
  `SectorProvider` context instead of isolated per-component state).
- CRM: Top Performers grouped by card id instead of deal owner; recent-deals
  stage badge used the priority colour instead of the column colour.
- HR: editing an employee silently dropped phone, birth date and manager;
  document and onboarding actions lacked server-side permission checks.
- Support: the response-SLA timer never stopped (first response was never
  recorded); KB publish and SLA active toggles were ignored on submit.

### Security
- HR document/onboarding server actions now enforce permissions server-side
  rather than relying on RLS alone.

### Migrations
- `00016` card completion tracking · `00020` CRM deal health ·
  `00030` HR wave 1 · `00040` Support ticket tags · `00070` Finance ·
  `00080` Legal.

## [0.1.0] - 2026-05-15

### Added
- ONEmonday MVP: boards, cards, projects, notifications, auth and RBAC.
- CRM module: companies, contacts, deals, activities, proposals pipeline.
- HR module: employees, recruitment, onboarding, time-off, org chart.
- Support Desk module: tickets, SLA rules, escalation, knowledge base,
  canned responses.
- Supabase schema (15 migrations), seed data and sample datasets.

[Unreleased]: https://github.com/lucasnobree/ONEmonday/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/lucasnobree/ONEmonday/releases/tag/v0.1.0

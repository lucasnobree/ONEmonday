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

### Fixed
- Sector switching now propagates across all open screens (shared
  `SectorProvider` context instead of isolated per-component state).

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

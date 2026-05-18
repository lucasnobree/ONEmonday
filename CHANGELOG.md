# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Scheduled automation runtime
- `pg_cron` jobs (migration `00137`) periodically POST to secret-guarded
  `/api/cron/*` routes that drain the notification outbox and run due
  marketing-sequence steps — the runners that earlier phases left as manual
  buttons now run automatically. Activation needs `CRON_SECRET` and a
  `cron_settings` base URL in production.
- A migration go-live runbook: `docs/research/migration-go-live-runbook.md`.

### CRM email integration (migration Phase 2/6)
- Send email to a deal's contact from the "Comunicação" panel via the Resend
  adapter, logged as an `email` activity on the timeline.
- Inbound email webhook (`/api/webhooks/email`, Svix-signature verified) that
  matches the sender to a contact, threads onto their open deal, and logs an
  inbound `email` activity — closing RD Station CRM's email side for teams
  that send from ONEmonday (full IMAP two-way sync remains deferred).

### CRM lead lifecycle (migration Phase 2/6)
- Lead capture: sector users define field-list capture forms; each published
  form exposes a public, unauthenticated URL (`/f/<token>`) that creates a
  lead. The submission endpoint (`/api/forms/[id]`) stays inside RLS via an
  anon client, is rate-limited, honeypot-protected and strips unknown fields.
- Leads inbox (`/crm/leads`): triage inbound leads by status and source,
  sorted by score; qualify a lead to convert it into a `crm_contacts` +
  `crm_deals` pair on the pipeline, or discard it with a reason.
- Lead scoring: a rule-based model (points per attribute) shown in the inbox
  and used as the sort key, with a per-lead breakdown explaining the score.
- Honest scope: this is a focused field-list capture MVP — a drag-and-drop
  landing-page builder is deferred. It closes inbound lead capture/triage/
  scoring; email nurturing and sending still need the Marketing ESP track.

### Marketing automation & CRM communication (migration Phase 5)
- Marketing automation MVP: a Resend email adapter on the integration layer,
  email campaigns to audience segments, and linear trigger→step automation
  sequences (`/marketing/email`, `/marketing/automations`). A full RD Station
  Marketing replacement (forms, landing pages, lead scoring) stays out of
  scope — this is the feasible first slice.
- CRM communication: send WhatsApp from a deal and log sent/received
  messages and emails onto the deal timeline as activities (a "Comunicação"
  tab), closing the last functional gap before RD Station CRM can be retired.

### Finance & fiscal gateways (migration Phase 4)
- Internal financial management ONEmonday can own: AR/AP aging reports, a
  management DRE/P&L, and a categorized accountant export, on new
  `/finance/reports` and `/finance/reconciliation` pages.
- Fiscal/banking/payment gateway adapters on the Phase 1 integration layer:
  Focus NFe (NF-e/NFS-e emission), Pluggy (Open Finance bank sync, with a
  manual OFX-import fallback) and Asaas (boleto/PIX charges) — each runs in
  a safe no-op mode until real credentials are configured.
- Honest scope: ONEmonday owns the internal financial layer; SPED, the
  official accounting books and tax filings stay with the accountant, and
  fiscal emission needs an A1 certificate + provider accounts to go live.

### HR people-management (migration Phase 3)
- Builds the HR module toward Sólides people-management parity: a working
  recruitment ATS (candidate pipeline, stages, detail, interview notes),
  performance management (review cycles, evaluations, a 9-box grid, PDIs),
  and anonymous engagement/climate surveys with eNPS results.
- LGPD hardening: sensitive compensation/PII moved to a narrowly-scoped
  `hr_employee_compensation` table; `hr_employees` directory read tightened
  to a real permission instead of bare sector membership.
- Fixes a latent bug where recruitment write policies referenced an
  unregistered permission resource (only global admins could write).

### CRM migration parity (migration Phase 2)
- Builds the CRM toward Pipedrive / RD Station CRM parity so both can be
  retired: deal ownership (`owner_id`, picker, reassignment, owner-ranked
  Top Performers); activity/task management (scheduled + assignable
  activities, complete/reschedule, a pending-tasks view); real filters and
  sortable list views on deals/companies/contacts; and CRM events
  (deal won/lost, stage change, activity due) fan out to Teams/WhatsApp
  through the Phase 1 notification outbox.

### Integration layer (migration Phase 1)
- Foundation for consolidating the company's external SaaS onto ONEmonday:
  a provider-adapter integration layer (`lib/integrations/`), an encrypted
  `integration_credentials` store (AES-256-GCM), an idempotent
  `webhook_events` log, and a `notification_outbox` that generalizes in-app
  notifications to outbound channels.
- Microsoft Teams and WhatsApp (Cloud API) channel adapters, inbound webhook
  routes with signature verification, and an admin Settings → Integrações
  screen to configure credentials and event→channel routing.
- Migration roadmap and research: `docs/research/migration-*.md`.

### UX audit & quick wins (Wave 3)
- A screen-by-screen UX & market audit of all 39 screens
  (`docs/research/ux-audit-*.md`, `screenshots/audit/`), followed by the
  first wave of fixes across every module:
  - Filter selects now show localized labels instead of the raw `all` token.
  - pt-BR accents restored across UI copy app-wide.
  - Destructive deletes go through a shared confirmation dialog (native
    `prompt()`/`confirm()` removed).
  - Built-but-unreachable edit/delete actions wired into the UI (CRM
    companies/contacts, boards, projects, budgets, contract/matter owners).
  - Bug fixes: HR time-off saved the wrong policy id; CRM pipeline stage
    order was non-deterministic; the dashboard "by column" chart was empty
    for sector managers; Finance dates shifted a day in UTC-3; Analytics had
    a dead `group_by` control; Support showed a double-slash shortcut.

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
- **Analytics** module: a sector dashboard with period-over-period KPI cards
  and saved metric reports rendered as bar/line/pie/KPI charts.
- **Dev-Tools** module: incident tracking with MTTA/MTTR metrics, a service
  registry, a deployment log, and feature flags.
- **Marketing** module: campaigns with funnel metrics, a content calendar,
  and audience segments.
- All nine sector modules are now active in the sidebar.

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
- WIP column limits are now enforced race-free by a database trigger.
- Wave 2 senior review: Analytics metric trends no longer collapse to a
  single bucket; Dev-Tools incident edits no longer drop the assignee;
  Marketing's campaigns/calendar/audiences pages were added (nav previously
  linked to non-existent routes); Finance edit dialogs show the saved amount.

### Security
- HR document/onboarding server actions now enforce permissions server-side
  rather than relying on RLS alone.
- The Legal dashboard RPC now verifies sector access (it previously leaked
  aggregate counts cross-tenant); rewritten Wave 2 RPCs pin `search_path`.

### Migrations
- `00016` card completion tracking · `00017` WIP-limit trigger ·
  `00020` CRM deal health · `00030` HR wave 1 · `00040` Support ticket tags ·
  `00050` Analytics · `00060` Dev-Tools · `00070` Finance · `00080` Legal ·
  `00090` Marketing · `00100` Wave 2 review fixes.

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

# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Monday.com-style navigation refactor (Phases 1–3)
- A restructure of the whole navigation toward Monday.com conventions
  (research in `docs/research/monday-ux-patterns.md` and
  `docs/research/monday-board-card-spec.md`):
  - **Phase 1 — navigation shell**: the flat module sidebar + header
    sector dropdown + in-screen module tab strips are replaced by a single
    collapsible **Sector → Module → Sub-page** sidebar tree. Admins see
    every sector; other users see only theirs. Expansion state persists and
    the active route auto-expands. Module screens keep only their own data
    filters.
  - **Phase 2 — role-based landing & cross-board screens**: `/` now routes
    by role — admins land on a new **Global Overview** dashboard
    (per-sector cards + drill-down, migration `00208`), sector managers on
    their sector dashboard, individual contributors on a new **"Meu
    Trabalho"** cross-board task view (every card assigned to you, grouped
    Atrasado / Hoje / Esta semana / Depois). The sidebar gained Início,
    Meu Trabalho, Visão Geral and a Settings sub-page group.
  - **Phase 2b — on-screen sector filter**: module screens carry a
    `Setor: [Todos ▾]` selector for admins (default "Todos" = all sectors);
    sector managers and contributors have no selector and are locked to
    their own sector. Wired into every module screen — main, primary and
    secondary.
  - **Cross-sector dashboards**: under "Todos" the module dashboards now
    show a real cross-sector aggregate instead of empty KPIs. The ten
    dashboard RPCs (finance/marketing/analytics/legal/dev-tools summary,
    support operational metrics, HR headcount + expiring documents, CRM
    lead stats + aging) take a nullable `p_sector_id` where `NULL` means
    "every sector" and is gated to global admins; migrations
    `00209`–`00216`.
  - **Phase 3 — board/card visual polish**: the Boards surfaces brought to
    the Monday.com visual spec (`docs/research/monday-board-card-spec.md`)
    — a shared `StatusPill` primitive (compact + full-bleed cell modes),
    Kanban cards with a colored left accent / status pill / updates count /
    hover menu, a sticky two-row board header, an `+ Add column` tile, and
    a group-banded list view with checkbox column, inline name editing and
    per-group summary rows. Behavior (drag-drop, swimlanes, filters, WIP,
    column management) unchanged.

### Module depth (Wave 5 — high-impact backlog)
- The larger, High-impact items each Wave 4 audit deferred, built per
  module and integrated together:
  - **Core**: board column management UI (add/rename/recolour/reorder/
    WIP/delete), a deeper project detail page (edit, members strip,
    health + status note), and seeded default Analytics reports so the
    page is no longer empty on first load (migrations `00181`–`00183`).
  - **CRM**: capture-form fields map onto real lead properties instead of
    a raw JSON blob; lead ownership + SLA aging in the inbox; reusable
    WhatsApp/email message templates with variable substitution
    (migration `00185`).
  - **HR**: a real employee-facing survey answering flow with
    schema-level anonymity (participation tracked separately from the
    response); employee self-assessment in review cycles; job-opening
    editing and a drag-and-drop recruitment pipeline (migrations
    `00190`–`00191`).
  - **Support**: a public reply channel (internal-note vs public-reply,
    email-out via Resend for `email` tickets); operational dashboard
    KPIs (first-response/resolution time, SLA %, backlog age); SLA
    business-hours schedules and breach actions (migrations
    `00195`–`00197`).
  - **Finance & Legal**: invoice and expense detail sheets; a contract/
    matter status-change history with a lightweight contract approval
    step; a matter comment thread (migrations `00200`–`00201`).
  - **Marketing**: email campaigns send to the attached audience segment
    (segments now carry real recipient lists); an HTML-aware email body
    editor with a sanitized live preview; a "test credential" action in
    Settings → Integrações; clickable Dev-Tools overview cards
    (migration `00206`).

### UX audit & quick wins (Wave 4)
- A second screen-by-screen UX & market audit, this time of all 50
  dashboard screens (the migration-phase and module-backlog screens that
  Wave 3 predated) — reports in `docs/research/ux-audit-*-wave4.md`,
  screenshots in `screenshots/audit-wave4/` — followed by the quick-win
  fixes across every module:
  - Filter and sort dropdowns now show localized labels everywhere — a
    shared `FilterSelect` kills the raw `all` token across CRM; Core sort
    triggers, Settings → Integrações event/channel slugs and Finance
    fiscal-status tokens were showing raw values too.
  - pt-BR accents restored again across Core, Support and Finance copy.
  - Destructive actions wrapped in the shared confirmation dialog (CRM
    form delete, integration-credential delete, HR survey close, PDI
    cancel).
  - Bug fixes: Analytics KPI delta badge paired an arrow with an empty
    value; the Support dashboard SLA banner and KPI card disagreed; HR
    time-off balances resolved against the wrong year; the org chart
    opened with its root scrolled off-screen; Legal date-only fields
    shifted a day in UTC-3; column WIP limits are now enforced on create
    and move.
  - Reachability: hover-only Support card actions now work by keyboard
    and touch; the Settings sub-tabs render on every settings page.

### Module deferred backlogs (post-migration polish)
- The deferred-feature backlog of the five non-migration modules, built and
  integrated together:
  - **Core**: project detail pages with project↔card linking, search/sort on
    the boards and projects indexes, and Kanban group-by swimlanes with
    assignee/tag/due-date filters.
  - **Finance**: invoice line items, invoice PDF/print, expense receipt
    storage, and an expense approval workflow (migrations `00138`–`00140`).
  - **HR**: offboarding checklists (templates/instances/items), a top-down
    org chart with a connected department filter, headcount/turnover
    analytics, and a negative time-off-balance guard (migrations
    `00148`–`00150`).
  - **Support**: a multi-state ticket status (`new`/`open`/`pending`/
    `on_hold`/`resolved`) with SLA-clock pause, ticket attachments, Markdown
    rendering in KB articles, and ticket-queue bulk actions + sorting
    (migrations `00168`–`00169`).
  - **Legal**: contract document storage, automated contract-renewal
    notifications via the outbox + `/api/cron/legal-renewals`, read-only
    detail views, and clause↔contract linking (migrations `00178`–`00179`).

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
- Wave 5 senior-review fixes (migration `00207`): the HR survey anonymity
  guarantee is restored — `hr_survey_participants` and `hr_survey_responses`
  no longer share a `now()`-stamped column a manager could join on to
  de-anonymise responses; `get_support_operational_metrics` now enforces
  sector access; the email-campaign HTML body is sanitized server-side and
  previewed inside a sandboxed `<iframe>` instead of `dangerouslySetInnerHTML`
  (stored-XSS guard); the long-standing `support_tickets` write policies that
  referenced an unseeded `support_ticket` permission resource were corrected
  to `ticket`; legal status changes use an optimistic-concurrency guard with
  an atomic audit-trail write; project-member adds are constrained to the
  project's sectors.
- Module-backlog senior-review fixes (migration `00180`): the KB Markdown
  renderer drops `javascript:`/`data:` link hrefs (stored-XSS guard); the new
  storage buckets (`finance-receipts`, `support-attachments`,
  `legal-documents`) scope reads to the object's sector instead of any
  authenticated user; the four new `SECURITY DEFINER` functions pin
  `search_path`; the time-off balance guard fails closed when a balance
  cannot be verified; offboarding rejects a template from another sector;
  and expense receipts are served via signed URLs (the private bucket made
  the stored public URL unusable).

### Migrations
- `00016` card completion tracking · `00017` WIP-limit trigger ·
  `00020` CRM deal health · `00030` HR wave 1 · `00040` Support ticket tags ·
  `00050` Analytics · `00060` Dev-Tools · `00070` Finance · `00080` Legal ·
  `00090` Marketing · `00100` Wave 2 review fixes ·
  `00180` module-backlog review security fixes ·
  `00207` Wave 5 review security fixes.

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

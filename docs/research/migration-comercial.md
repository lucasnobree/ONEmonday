# Migration Feasibility & Feature-Gap Analysis — Comercial (CRM + Marketing)

**Goal:** Assess whether ONEmonday's CRM and Marketing modules can replace the paid
commercial/sales tools the company runs today — **RD Station Marketing**, **RD Station CRM**
and **Pipedrive** — so the company can cut software licensing costs.

**Author:** Product Researcher · **Date:** 2026-05-18
**Method:** Source review of the ONEmonday CRM module (`apps/web/app/(dashboard)/crm`,
`components/crm`, `hooks/crm`, `lib/validations/crm.ts`, `lib/actions/crm`, migrations
`00011`/`00014`) and Marketing module (`apps/web/app/(dashboard)/marketing`,
`components/marketing`, `hooks/marketing`, `lib/validations/marketing.ts`,
`lib/actions/marketing`, `lib/marketing/metrics.ts`, migration `00090`), the two existing UX
audits (`docs/research/ux-audit-crm.md`, `docs/research/ux-audit-marketing.md`), and web
research of the three commercial products against their official sites and reviews.

**Scope note:** This is analysis only. No application code was modified.

---

## 1. Current ONEmonday baseline (what exists today)

### CRM module
A genuinely thoughtful B2B sales CRM data model with a shallow interaction layer:

- **Tables (migrations 00011/00014):** `crm_companies`, `crm_contacts`, `crm_deals` (1:1 with
  a `cards` row — deals ride on the generic Boards kanban), `crm_activities`, `crm_proposals`,
  `crm_proposal_items`, `crm_pipeline_stage_defaults`. RLS + per-sector scoping throughout.
- **Pipeline:** native HTML5 drag-and-drop kanban over board columns, deal-rotting badges,
  weighted forecast (value × win-probability), stage-level default probabilities, probability
  lock/unlock.
- **Proposals:** line items (qty × unit price), status lifecycle (draft → sent → viewed →
  accepted/rejected/expired). No PDF, no shareable link — "Enviar" only flips a status.
- **Activities:** append-only timeline of call/email/meeting/note/task. `scheduled_at` and
  `completed_at` columns exist but the UI never exposes them — no real task management.
- **Companies/Contacts:** read-only card grids; edit/delete dialogs exist in code but are not
  wired. Structured lost-reason taxonomy.
- **Known gaps (per UX audit):** no inline editing, no bulk actions, weak filtering, no deal
  `owner_id`, `<Select>` pickers instead of comboboxes, silent error handling.

### Marketing module
A clean tracking ledger — it records numbers a human types in; it does not *execute* marketing:

- **Tables (migration 00090):** `marketing_campaigns` (budget/spend in cents, impressions /
  leads / conversions, channel, status), `marketing_audience_segments`,
  `marketing_content_items` (editorial calendar, optional `campaign_id`). RLS + per-sector.
- **Dashboard:** KPI cards + two charts from a server RPC (`get_marketing_summary`).
- **Metrics helper (`metrics.ts`):** `conversionRate`, `leadRate` (CTR), `costPerLead`,
  `costPerConversion`, `budgetUsagePercent`, `isOverBudget` — all computed, mostly unused in UI.
- **Calendar:** month-grid editorial calendar, no drag-and-drop, month view only.
- **Audiences:** a segment is `name + channel + hand-typed estimated_size` — not a queryable
  segment over real contact data.
- **Critical absence:** there is **no email-sending infrastructure, no form builder, no
  landing-page builder, no automation engine, no lead scoring** anywhere in the platform.

The headline conclusion up front: ONEmonday's **CRM is structurally close** to RD Station CRM
and Pipedrive (it is a CRM with the right model, missing usability and a few fields). Its
**Marketing module is not a marketing-automation platform** — it is a planning/reporting tool,
and RD Station Marketing's core (email sends, landing pages, forms, automation, lead scoring)
has essentially **no counterpart** in ONEmonday today.

---

## 2. Per-system overview

### 2.1 RD Station Marketing
Brazilian all-in-one inbound-marketing / marketing-automation platform. Features that matter
for this company:

- **Landing pages, forms and pop-ups** — drag-and-drop builders, no code, used to convert
  visitors into leads.
- **Email marketing** — drag-and-drop email editor, segmented sends; unlimited email sends on
  plans up to 100k contacts.
- **Marketing automation** — visual flow builder: nurturing sequences triggered by events,
  page visits, form submissions and lead score.
- **Lead scoring & qualification** — points/grades assigned by behaviour and profile, to
  prioritise sales-ready leads, with handoff/distribution to the sales team.
- **Lead database, segmentation and lead lifecycle tracking.**
- **Social media scheduling, Facebook Ads management, SEO tools** (keyword tracking via SEMrush).
- **Analytics** — funnel monitoring, channel performance, scheduled reports, marketing BI.
- **Compliance** — GDPR/LGPD support, double opt-in.
- Pricing scales with contact-base size and becomes expensive past the included tiers — this is
  the direct cost the company wants to eliminate.

### 2.2 RD Station CRM
Sales CRM, sold separately from RD Station Marketing. Features that matter:

- **Customisable sales funnels** with visual pipeline; deals, contacts, tasks.
- **Activities & follow-up reminders.**
- **Sales automation** — auto follow-up reminders, automated emails, deal-triggered actions.
- **WhatsApp integration** — negotiate inside WhatsApp Web via the WhatStation extension; all
  interactions logged back to the CRM.
- **Email logging**, full customer interaction history.
- **Goals/targets and team performance reports** for managers.
- Three tiers including a free plan.

### 2.3 Pipedrive
Visual sales CRM, the company's pipeline tool. Features that matter:

- **Visual pipeline management** — customisable kanban, drag-and-drop deal movement,
  per-stage win probability, multiple pipelines.
- **Deal management** — custom fields, deal stages, rotting indicators.
- **Activities & reminders** — scheduled tasks/calls/meetings with automated reminders;
  overdue/today/upcoming model.
- **Email integration** — two-way email sync, send/receive against a deal.
- **Workflow automation** — build automations from scratch or templates (create activities,
  send emails, trigger actions on stage change).
- **Reporting & forecasting** — customisable reports, dashboards, sales forecast, goals.
- **Products catalog**, **Leads inbox**, **Web forms**, **Smart Docs** (trackable shareable
  documents/quotes), AI sales assistant, 400–500+ marketplace integrations, mobile apps.

---

## 3. Feature-mapping tables

Legend — **Yes** = comparable capability shipped · **Partial** = data model or fragment exists
but incomplete/not wired · **No** = absent.

### 3.1 Pipedrive → ONEmonday CRM

| Pipedrive feature | ONEmonday has it? | Module | Notes |
|---|---|---|---|
| Visual kanban pipeline | **Yes** | CRM | Native HTML5 DnD over board columns; deal-rotting badges. |
| Drag-and-drop deal movement | **Partial** | CRM | Works, but mouse-only, no optimistic UI, errors swallowed (UX audit P1–P3). |
| Multiple/custom pipelines | **Partial** | CRM | Deals ride generic Boards; "pipeline" board matched by name substring — fragile (P5). |
| Custom fields on deals | **No** | CRM | `crm_deals` has a fixed schema; no custom-field mechanism. |
| Per-stage win probability | **Yes** | CRM | `crm_pipeline_stage_defaults` + probability lock. Above Pipedrive baseline. |
| Weighted forecast | **Yes** | CRM | Dashboard "Previsão Ponderada" = value × probability. |
| Deal owner / assignment | **No** | CRM | No `owner_id` on `crm_deals`; dashboard fakes owner via `created_by`. |
| Activities & reminders (scheduled, overdue) | **Partial** | CRM | `scheduled_at`/`completed_at` columns exist but UI never exposes them — append-only log only (A1–A2). |
| Contacts & companies | **Yes** | CRM | Full model, but read-only grids — edit/delete dialogs not wired (C1/CO1). |
| Leads inbox (pre-deal triage) | **No** | CRM | No lead entity distinct from deal/contact. |
| Email integration (2-way sync, send from deal) | **No** | CRM | No mailbox connection; emails are manually logged as activity text. |
| Web forms (lead capture) | **No** | — | No form builder anywhere. |
| Workflow automation | **No** | — | No automation engine in CRM or platform. |
| Reporting & forecasting | **Partial** | CRM | Dashboard KPIs + funnel exist; no custom reports, no date-range, no period-over-period (D2/D6). |
| Products catalog | **Partial** | CRM | Proposal line items are free-text; no reusable product/price catalog. |
| Quotes / shareable trackable docs | **No** | CRM | Proposals have no PDF and no public link (PR2). |
| Goals / targets | **No** | CRM | No goal entity. |
| CSV export | **Yes** | CRM | Present on every list. |
| Bulk actions on lists | **No** | CRM | No selection / bulk toolbar anywhere (C2/CO2). |
| Mobile app | **No** | — | Web only. |
| AI sales assistant | **No** | — | None. |
| 400+ integrations marketplace | **No** | — | None. |

### 3.2 RD Station CRM → ONEmonday CRM

| RD Station CRM feature | ONEmonday has it? | Module | Notes |
|---|---|---|---|
| Customisable sales funnels | **Partial** | CRM | Kanban exists; multi-pipeline / per-funnel config is weak (see 3.1). |
| Deals & contacts | **Yes** | CRM | Solid model. |
| Tasks / follow-up reminders | **Partial** | CRM | Same `scheduled_at`-not-exposed gap as Pipedrive row. |
| Sales automation (auto reminders, emails) | **No** | — | No automation engine. |
| WhatsApp integration | **No** | — | No WhatsApp channel anywhere in the platform. |
| Email logging | **Partial** | CRM | Manual: log an "email" activity by hand; no inbox sync. |
| Customer interaction history | **Yes** | CRM | Activity timeline per contact/company/deal. |
| Goals/targets & team performance reports | **Partial** | CRM | "Top Performers" exists but ranks by deal creator, not owner (D4). |

### 3.3 RD Station Marketing → ONEmonday Marketing

| RD Station Marketing feature | ONEmonday has it? | Module | Notes |
|---|---|---|---|
| Campaign register w/ budget & results | **Yes** | Marketing | `marketing_campaigns` — but metrics are hand-typed, not synced. |
| Derived metrics (CPL/CPA/CTR/ROI) | **Partial** | Marketing | Computed in `metrics.ts`, unit-tested, but only 2 of 6 shown in UI (F1). |
| Editorial content calendar | **Partial** | Marketing | Month grid only; no drag-and-drop, no week/list view (F15/F16). |
| Email marketing — drag-and-drop email editor | **No** | — | No email composer. |
| Email **sending** infrastructure | **No** | — | No ESP, no domain auth, no deliverability. **Hard blocker.** |
| Landing-page builder | **No** | — | None. |
| Form builder | **No** | — | None. |
| Pop-ups | **No** | — | None. |
| Marketing automation / flow builder | **No** | — | None. **Hard blocker.** |
| Lead scoring & grading | **No** | — | None. |
| Lead segmentation (queryable) | **No** | Marketing | "Audience" = name + hand-typed size; no rules, no CRM linkage (F22). |
| Lead capture → CRM handoff | **No** | — | Marketing and CRM are not connected; no attribution. |
| Social media scheduling | **Partial** | Marketing | Calendar can *plan* a social post; it cannot publish it. |
| Facebook/Google Ads management | **No** | — | None. |
| SEO / keyword tools | **No** | — | None. |
| Marketing analytics / funnel / scheduled reports | **Partial** | Marketing | Dashboard KPIs + 2 charts; no date-range, no scheduled reports (F2). |
| GDPR/LGPD consent, double opt-in | **No** | — | No consent or subscription model. |

---

## 4. Prioritized migration backlog

Effort: **S** ≈ days · **M** ≈ 1–3 weeks · **L** ≈ 1–3+ months. "DB" = needs a Supabase
migration. "Blocker" = the named tool cannot be retired until this ships; "Nice" = improves
parity but not strictly required to cut over.

### 4.1 To replace Pipedrive + RD Station CRM (one combined CRM target)

| # | Item | Effort | Module | DB? | Blocker? |
|---|---|---|---|---|---|
| 1 | Wire edit/delete for Companies & Contacts (dialogs already exist) | S | CRM | No | Blocker |
| 2 | Add `owner_id` to `crm_deals` + assignment UI; fix dashboard ranking | S–M | CRM | Yes | Blocker |
| 3 | Scheduled & completable activities — expose `scheduled_at`/`completed_at`, split "Tarefas pendentes" vs "Histórico", overdue/today views | M | CRM | No (cols exist) | Blocker |
| 4 | Explicit pipeline-board designation per sector (drop name-substring match); support multiple pipelines | M | CRM | Yes | Blocker |
| 5 | Filtering on Pipeline / Companies / Contacts / Activities (owner, value, stage, date) | M | CRM | No | Blocker |
| 6 | Custom fields on deals/companies/contacts (JSONB or EAV) | L | CRM | Yes | Nice→Blocker* |
| 7 | Searchable/clearable comboboxes replacing `<Select>` pickers | M | CRM | No | Nice |
| 8 | Bulk selection + bulk actions (export/delete/assign) on lists | M | CRM | No | Nice |
| 9 | Email inbox integration — connect a mailbox, 2-way sync, send-from-deal | L | CRM | Yes | Blocker** |
| 10 | WhatsApp integration (channel + message logging) | L | CRM | Yes | Blocker** |
| 11 | Reusable products/price catalog feeding proposal line items | M | CRM | Yes | Nice |
| 12 | Proposal PDF export + public trackable link (replaces Pipedrive Smart Docs) | M–L | CRM | Yes | Nice |
| 13 | Sales workflow automation engine (triggers on stage change, due-date reminders, auto-activities) | L | CRM/Platform | Yes | Blocker** |
| 14 | Reporting: date-range control, period-over-period deltas, custom/saved reports, goals | M–L | CRM | Yes (goals) | Nice |
| 15 | Leads inbox / pre-deal lead entity | M | CRM | Yes | Nice |
| 16 | Optimistic drag-drop + toast on failure + keyboard-accessible DnD | M | CRM | No | Nice |

\* Custom fields are "nice" for a basic cutover but become a **blocker** if either tool is used
today with non-trivial custom fields — audit the live tenants before deciding.
\*\* Email sync, WhatsApp and automation are the heavy items. They are blockers for *full*
parity but the team should decide per item whether to rebuild or to keep a cheaper
point-integration (see verdicts, §5).

### 4.2 To replace RD Station Marketing

| # | Item | Effort | Module | DB? | Blocker? |
|---|---|---|---|---|---|
| 17 | Surface CPL/CPA/CTR/ROI KPI cards (functions already exist) | S | Marketing | No | Nice |
| 18 | Connect audience segments to real CRM contacts (rule-based, live count) | L | Marketing+CRM | Yes | Blocker |
| 19 | Contact subscription / consent model (opt-in, unsubscribe, LGPD) | M | Marketing | Yes | Blocker |
| 20 | **Transactional/bulk email sending integration** — ESP provider (e.g. Resend/SES/SendGrid), domain auth (SPF/DKIM/DMARC), bounce/complaint handling, deliverability | L | Platform | Yes | **Hard blocker** |
| 21 | Drag-and-drop **email template/composer** | L | Marketing | Yes | Hard blocker |
| 22 | **Form builder** + embeddable forms, submission → CRM contact/lead | L | Marketing+CRM | Yes | Hard blocker |
| 23 | **Landing-page builder** (hosted pages, publish, analytics) | L | Marketing | Yes | Hard blocker |
| 24 | Pop-up builder | M–L | Marketing | Yes | Nice |
| 25 | **Marketing automation engine** — visual flow builder, event/score triggers, nurturing sequences, scheduling/queue worker | L (largest single item) | Platform | Yes | **Hard blocker** |
| 26 | **Lead scoring** — point rules by behaviour/profile, score on contact, threshold handoff | L | Marketing+CRM | Yes | Hard blocker |
| 27 | Campaign → contact/lead **attribution** (which campaign sourced which deal) | M–L | Marketing+CRM | Yes | Blocker |
| 28 | Calendar drag-and-drop reschedule + week/list views + filters | M | Marketing | No | Nice |
| 29 | Date-range control on the marketing dashboard (extend the RPC) | M | Marketing | Yes (RPC) | Nice |
| 30 | Social scheduling that actually **publishes** (Meta/LinkedIn APIs) | L | Marketing | Yes | Nice |
| 31 | Ad-platform sync (Meta/Google Ads) to auto-fill spend/impressions/leads | L | Marketing | Yes | Nice |

---

## 5. Migration verdict per tool

### Pipedrive — **Can plausibly replace (partial today, full with focused work).**
ONEmonday's CRM is *structurally* a Pipedrive-class CRM: it already has a visual pipeline,
weighted forecast, deal rotting, proposals with line items, and per-sector scoping — in some
respects (stage-default probabilities, structured lost reasons) it is *ahead* of Pipedrive.
The gap is **usability and a handful of fields**, not architecture. Backlog items 1–5 (all
S/M, no heavy infrastructure) close the table-stakes gap: edit/delete CRUD, deal owner,
scheduled/completable activities, real pipeline designation, filtering. The genuinely heavy
Pipedrive features — two-way **email sync** (#9) and **workflow automation** (#13) — are
real engineering projects. If the team's Pipedrive usage is "visual pipeline + activities +
manual email logging" (the common case for a small sales team), Pipedrive can be retired
after the §6 Phase 2. If they lean on email sync and automations heavily, retirement waits
for Phase 4. **Verdict: yes, in two stages.**

### RD Station CRM — **Can plausibly replace, with one caveat: WhatsApp.**
Functionally RD Station CRM and Pipedrive overlap almost entirely against ONEmonday's CRM, so
the same backlog covers it. The one distinct, important capability is the **WhatsApp
integration** (#10) — for a Brazilian sales team this is often the primary communication
channel, not a nice-to-have. Rebuilding WhatsApp properly (Business API, message logging,
templates) is an **L** project. Practical recommendation: do not rebuild it from scratch as a
condition of cutover — either (a) integrate the WhatsApp Business Cloud API directly into the
CRM activity log, or (b) keep a low-cost WhatsApp point tool and just stop paying for RD
Station CRM. **Verdict: yes for the CRM core; WhatsApp is the single decision point.**

### RD Station Marketing — **Cannot replace today; only partially replaceable, and only with
a major build.** Be blunt here. ONEmonday's Marketing module is a **planning and tracking
ledger**. RD Station Marketing's value is **execution**: it *sends* email, *hosts* landing
pages and forms, *runs* automation flows, and *scores* leads. ONEmonday has **none** of that
infrastructure — no ESP, no domain authentication, no deliverability handling, no form/page
builder, no automation runtime, no consent model. The hardest single piece is **email-sending
infrastructure and deliverability** (#20): this is not a feature, it is an operational
discipline (SPF/DKIM/DMARC, warm-up, bounce/complaint feedback loops, suppression lists,
LGPD). The **automation engine** (#25) is the largest single engineering item — a visual flow
builder plus a reliable background worker/queue. Honest options:

1. **Do not migrate off RD Station Marketing.** Keep it as the marketing-execution tool; it is
   the one product here whose replacement cost almost certainly exceeds its licence cost.
2. **Replace only the cheap parts** — campaign tracking, the editorial calendar, basic KPI
   reporting already exist in ONEmonday; the company can stop using RD Station's *reporting*
   surface but still needs it to *send*.
3. **Full replacement** is a multi-quarter program (items 18–27, several **L**) and should
   only be approved if RD Station Marketing's annual cost clearly justifies it, and likely
   still leveraging a third-party ESP and Meta/Google APIs rather than building from zero.

**Verdict: do not plan a near-term migration off RD Station Marketing. Treat it as the
long-term, optional, most-expensive track — and even then, "replace" means orchestrating
external providers, not building an ESP.**

---

## 6. Recommended phased migration order

**Phase 1 — CRM quick wins (weeks, S/M, no heavy infra).** Backlog 1, 2, 3, 5, 7, 16. Wire
edit/delete, add deal owner, make activities schedulable/completable, add filtering,
comboboxes, fix drag-drop. Outcome: the CRM becomes usable enough for a sales team to run
their day in it. *Nothing is retired yet — this is the foundation.*

**Phase 2 — Pipeline & proposals parity (M).** Backlog 4, 8, 11, 12, 14. Proper pipeline
designation/multiple pipelines, bulk actions, products catalog, proposal PDF + share link,
reporting date-range/deltas. **Decision gate:** if Pipedrive usage does not depend on email
sync or automations, **retire Pipedrive here.** If RD Station CRM usage does not depend on
WhatsApp, **retire RD Station CRM here.**

**Phase 3 — Communication & automation for CRM (L).** Backlog 9 (email sync), 10 (WhatsApp),
13 (sales workflow automation), 6 (custom fields), 15 (leads inbox). This closes the remaining
Pipedrive / RD Station CRM gaps. **Decision gate:** retire whichever sales tool was still in
use after Phase 2. After Phase 3, the company should be off **both** sales CRMs.

**Phase 4 — Marketing foundations (L, optional, only if the business case holds).** Backlog
17, 28, 29 first (cheap reporting/calendar parity — do anyway). Then the heavy track in order:
19 (consent model) → 20 (email-sending integration) → 21 (email composer) → 22 (form builder)
→ 27 (attribution). This lets the company *send campaign email and capture leads* from
ONEmonday.

**Phase 5 — Marketing automation & acquisition (L, longest).** Backlog 18 (queryable
segments), 25 (automation engine), 26 (lead scoring), 23 (landing pages), 24/30/31. Only after
this is RD Station Marketing fully replaceable. Realistically multi-quarter; reassess against
RD Station's licence cost before committing.

**Bottom line:** the company can stop paying for **Pipedrive and RD Station CRM within a
realistic short-to-mid-term roadmap** (Phases 1–3) — that is where the safe, high-confidence
savings are. **RD Station Marketing should remain in place** for the foreseeable future; its
replacement is a major build whose cost likely exceeds the subscription it would eliminate,
and any eventual replacement will still depend on external email/ad providers.

---

## 7. Sources

- [RD Station Marketing — official product page](https://www.rdstation.com/en/marketing/)
- [RD Station Marketing Review 2026 — Research.com](https://research.com/software/reviews/rd-station-marketing)
- [RD Station Marketing Features — G2](https://www.g2.com/products/rd-station-marketing/features)
- [RD Station Marketing pricing — official](https://www.rdstation.com/en/pricing/)
- [RD Station 2026: Benefits, Features & Pricing — Software Advice](https://www.softwareadvice.com/marketing/rd-station-profile/)
- [HubSpot CRM, RD Station CRM, or Pipedrive — Reportei](https://reportei.com/en/hubspot-crm-rd-station-crm-or-pipedrive-which-tool-to-choose/)
- [RD Station CRM & WhatsApp Business integration — n8n](https://n8n.io/integrations/rd-station-crm/and/whatsapp-business-cloud/)
- [About the WhatsApp Message feature — RD Station Help](https://ajuda.rdstation.com/s/article/About-the-WhatsApp-Message-feature-add-on?language=en_US)
- [Pipedrive — official site](https://www.pipedrive.com/)
- [Pipedrive features overview — official](https://www.pipedrive.com/en/features)
- [Pipeline Management — Pipedrive](https://www.pipedrive.com/en/features/pipeline-management)
- [Pipedrive CRM Review 2026 — CRM.org](https://crm.org/news/pipedrive-crm-review)
- Internal: `docs/research/ux-audit-crm.md`, `docs/research/ux-audit-marketing.md`,
  ONEmonday migrations `00011_crm.sql`, `00014_crm_proposals_pipeline.sql`, `00090_marketing.sql`.

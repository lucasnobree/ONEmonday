# CRM Module — Feature Gap Analysis

**Date:** 2026-05-15
**Author:** CRM module engineer
**Scope:** Prioritized gap analysis of the ONEmonday CRM module benchmarked against best-in-class
sales CRMs. Drives the `feat/crm-wave1` improvement wave.

---

## 1. Current state

The CRM module already ships a solid MVP+:

- **Entities:** companies, contacts, deals (1:1 with kanban `cards`), activities, proposals.
- **Pipeline:** drag-and-drop kanban grouped by board columns; per-stage totals.
- **Proposals:** full CRUD with line items, status workflow, CSV export, detail sheet.
- **Probability automation:** per-stage default win probability, manual lock toggle
  (migration 00014 — `crm_pipeline_stage_defaults`, `crm_deals.probability_locked`).
- **Dashboard:** stat cards, pipeline funnel, "closing soon", "top performers", recent deals.
- **Activities:** timeline with type filters and date range, email/meeting enriched fields.

It is already past "table stakes CRUD". The gaps below are what separates it from a
best-in-class sales tool.

## 2. Benchmark — what best-in-class CRMs do

| Product   | Differentiating capabilities relevant to us |
|-----------|----------------------------------------------|
| Pipedrive | **Deal rotting** — per-stage idle-day threshold, visual red flag on stale deals; activity-centric pipeline. |
| HubSpot   | Lead scoring, smart workflows, **closed-lost reason** as a required enum field feeding analytics. |
| Salesforce| Einstein predictive forecasting, **weighted pipeline** by stage probability. |
| Close     | Built around fast logging; structured lost-reason taxonomy with recyclable vs permanent losses. |
| Pipeline CRM / Freshsales | **Weighted forecast** = `amount × stage probability`; calibrate probabilities from historical close data. |

Key external findings:

- **Deal rotting** flags deals with no movement/update beyond a configurable per-stage
  period; status resets when the deal is moved or edited. It is one of the most-cited
  reasons reps trust Pipedrive's pipeline view.
- **Closed-lost reason** should be a *finite, enforced* enum (competitor, price, timing,
  no-fit, no-decision...) — generic free text like "bad fit" produces no insight, and too
  many values produce "analytic chaos". Pair the enum with a short free-text note.
- **Weighted pipeline** (`Σ value × win_probability`) yields 10–15% better forecast
  accuracy than raw pipeline totals; should be surfaced next to raw pipeline value.

## 3. Prioritized gap list

Priority = (impact on sales outcomes) × (fit with existing schema) ÷ (scope).

| # | Gap | Priority | Notes |
|---|-----|----------|-------|
| G1 | **No deal rotting / staleness signal.** Reps cannot see which open deals are going cold. | P0 | High impact, table stakes. Needs a stage-entry timestamp + per-stage idle threshold. |
| G2 | **Lost reasons are unstructured free text.** `crm_deals.lost_reason` is a free text box → no win/loss analytics possible. | P0 | High impact. Add an enforced category enum alongside the free-text note. |
| G3 | **Forecast shows only raw pipeline value.** Dashboard sums `value` but ignores `win_probability`. | P1 | Medium-high impact, trivial scope — data already present. |
| G4 | **Dashboard "Top Performers" is wrong.** Groups won deals by `card_id` (unique per deal) and labels the row with the *company* name → never aggregates, mislabels the performer. | P1 | Bug. Should group by the deal creator (`cards.created_by` → `users.full_name`). |
| G5 | **"Recent deals" stage badge uses priority colour variant.** The stage-column badge in the dashboard table is styled with `priorityVariants[priority]` — wrong semantics, misleading colour. | P2 | Bug / UX polish. |
| G6 | **Activities page has no export.** Proposals page exports CSV; activities (the highest-volume CRM record) cannot be exported. | P2 | UX parity / consistency. |
| G7 | **Lint debt across CRM files** — `any` casts in hooks, setState-in-effect in form dialogs, unused imports. | P1 | Quality gate; must be zero for the module. |
| G8 | Lead scoring, email/calendar sync, sequences, custom fields. | P3 | Out of scope for wave 1 — large, needs integrations/new infra. |

## 4. Wave 1 scope (this PR)

Implemented: **G1, G2, G3, G4, G5, G6, G7**.

- **G1 Deal rotting:** new `crm_deals.last_stage_change_at`; `move-deal` stamps it; new
  per-stage `rotting_days` column on `crm_pipeline_stage_defaults`; pure helper
  `getDealRotting()` computes status; pipeline cards show a "parada Xd" red badge.
- **G2 Lost reasons:** new `crm_deals.lost_reason_category` (enforced enum via CHECK);
  `closeDealLost` validates the category; deal detail sheet shows a category select and
  renders the category label.
- **G3 Weighted forecast:** dashboard gains a weighted-pipeline figure
  (`Σ value × win_probability/100`) next to raw pipeline value.
- **G4/G5 Bug fixes:** Top Performers aggregates by real deal creator; stage badge uses a
  neutral variant.
- **G6:** CSV export button on the activities page.
- **G7:** all CRM-owned files pass `eslint` with zero errors/warnings.

Deferred to a next wave (G8): lead scoring, activity sequences/cadences, custom fields,
email/calendar integration, quote PDF generation.

## Sources

- [Pipedrive vs HubSpot CRM comparison (Zapier)](https://zapier.com/blog/pipedrive-vs-hubspot/)
- [Salesforce vs HubSpot vs Pipedrive (Sybill)](https://www.sybill.ai/blogs/salesforce-vs-hubspot-vs-pipedrive)
- [The Rotting feature — Pipedrive Knowledge Base](https://support.pipedrive.com/en/article/the-rotting-feature)
- [How to use the Pipedrive Rotting feature (Solvaa)](https://solvaa.co.uk/how-to-use-the-pipedrive-rotting-feature-to-track-deal-inactivity-and-boost-conversions/)
- [Best Practices for Tracking Lost Sales in Your CRM (TechAdv)](https://www.techadv.com/blog/best-practices-tracking-lost-sales-your-crm)
- [Closed-Lost Reason is a Growth Hack Metric (Aptitude 8)](https://aptitude8.com/blog/closed-lost-reason-is-a-growth-hack-metric-you-should-be-tracking)
- [How to use pipeline-weighted techniques for sales forecasting (Drivetrain)](https://www.drivetrain.ai/post/pipeline-weighted-sales-forecasting)
- [How Pipeline CRM Calculates the Weighted Forecast](https://help.pipelinecrm.com/articles/235899-how-pipeline-crm-calculates-the-weighted-forecast)

# Analytics Module — Feature Gap Research

Prioritized scope for the ONEmonday Analytics module, benchmarked against
leading analytics / BI products. Today the module is an empty `ComingSoon`
placeholder.

## Benchmark products

- **Looker** — governed, centrally-defined metrics ("define a KPI once, every
  dashboard pulls the same definition") so numbers never drift.
- **Metabase** — self-serve dashboards for non-technical users; first-class
  dashboard-level **date-range filters** that fan out to every card.
- **Tableau** — drag-and-drop visual builder, certified data sources, content
  permissions.
- **Mixpanel** — saved metrics, **Metric Trees** (north-star KPI at the top,
  supporting metrics laddering up), funnels & retention.
- **Google Analytics** — audience segmentation, behavior-flow time series.

## What leading products consistently ship

1. **KPI cards / scorecards** — a headline number with period-over-period delta.
2. **Dashboards** — a saved collection of cards/charts, sector-scoped.
3. **Saved reports / questions** — a reusable, named chart definition.
4. **Dashboard-level date-range filtering** — one control that re-scopes every
   card (Metabase's strongest differentiator for usability).
5. **Time-series + breakdown charts** — line / bar / pie via a chart library.
6. **Cross-source aggregation** — one pane over many underlying datasets.
7. **Automated/scheduled report delivery** — email digests (68% of buyers rank
   this top-3, per Dresner 2025).
8. **Governed metric definitions** — a single source of truth per KPI.

## Gap analysis vs. ONEmonday today

ONEmonday already has rich per-module data — boards/cards (`completed_at`,
`due_date`), CRM (`crm_deals.value`, `actual_close_date`), Support
(`support_tickets.resolved_at`, `csat_rating`, `sla_*_breached`), HR
(`hr_employees.status`), Finance — but **no cross-module view**. Each module
has its own siloed dashboard. There is no place to compare sectors, no saved
reports, no shared KPI definitions, and no date-range scoping.

## Prioritized scope

### P0 — MVP (this wave)

- **Cross-module KPI overview** — sector-scoped scorecards aggregating
  boards/cards, CRM, Support and HR into one pane (`get_analytics_overview`
  RPC, RLS-checked).
- **KPI cards** — headline value + period-over-period delta vs. the previous
  equal-length window.
- **Date-range filtering** — a dashboard-level control (7/30/90 days, this
  quarter, custom) that re-scopes every metric — Metabase's core usability win.
- **Saved reports** — named, sector-scoped chart definitions (metric + chart
  type + grouping) persisted in `analytics_reports`, with full CRUD via
  Zod-validated server actions and RLS.
- **Charts** — line / bar / pie via `recharts` (already a dependency); a
  trend chart for time-series metrics and a breakdown chart for categorical.
- **Governed metric catalog** — a static, typed registry
  (`lib/analytics/metrics.ts`) so every chart and card resolves the same
  definition; mirrors Looker's "define once" principle.

### P1 — Next wave

- **Custom dashboards** — user-arranged grids of saved-report cards
  (`analytics_dashboards` + a join table). Schema headroom is left for this.
- **Scheduled email digests** — recurring delivery of a dashboard snapshot.
- **Drill-down** — click a chart segment to open the source records.
- **Goal / target tracking (OKRs)** — per-metric targets with progress.

### P2 — Later

- Funnel & retention analysis (Mixpanel-style) for the CRM pipeline and
  support lifecycle.
- Anomaly detection / forecasting on trend series.
- CSV / PDF export of reports.

## Sources

- [Metabase vs Looker — bixtech](https://bixtech.ai/metabase-vs-looker-which-bi-tool-fits-growing-teams/)
- [Metabase vs Looker vs Tableau 2026 — Valiotti](https://valiotti.com/metabase-vs-looker-vs-tableau-how-to-choose-your-bi-tool-in-2026/)
- [Best automated reporting tools 2026 — Basedash](https://www.basedash.com/blog/best-automated-reporting-tools-compared-2026)
- [Dashboard filters — Metabase Docs](https://www.metabase.com/docs/latest/dashboards/filters)
- [Saved Metrics and Behaviors — Mixpanel Docs](https://docs.mixpanel.com/docs/features/saved-metrics-and-behaviors)
- [Google Analytics vs Mixpanel — Statsig](https://www.statsig.com/perspectives/analytics-mixpanel-funnels-cohorts-retention-comparison)
- [20 digital analytics metrics that matter — Mixpanel](https://mixpanel.com/blog/digital-analytics-metrics/)

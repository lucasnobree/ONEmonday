# ONEmonday — UX & Market Audit (Executive Summary)

A meticulous screen-by-screen UX and market audit of all 9 modules (39 screens),
run by 8 specialized auditor agents against captured screenshots
(`screenshots/audit/`), the source code, and best-in-class market products.

Per-module detail: `ux-audit-{core,crm,hr,support,finance,legal,marketing,analytics-devtools-settings}.md`.

## Ratings

| Module | Rating | Headline |
| --- | --- | --- |
| Core (boards/projects) | 6.0 / 10 | Solid MVP; projects are dead ends |
| CRM | 6.0 / 10 | Strong model, shallow interaction layer |
| HR | 6.0 / 10 | Good IA; a data-integrity bug |
| Support Desk | 6.5 / 10 | Clean; no public reply path |
| Finance | 5.5 / 10 | A ledger, not yet an invoicing product |
| Legal | 5.5 / 10 | A contract register, not a CLM |
| Analytics | 6.0 / 10 | Only 3 of 8 KPIs reportable |
| Dev-Tools | 5.5 / 10 | Lists unmanaged; no incident workflow |
| Settings | 6.5 / 10 | Members read-only |
| Marketing | 6.0 / 10 | Shallow vs. market leaders |

**Overall: ~6.0/10** — a coherent, well-engineered MVP with a clean data model
and correct sector security, held back by a thin interaction layer and several
unfinished flows. The engineering primitives are strong; the product depth and
UX polish are the gap to market level.

## Cross-cutting findings (fix once, fixes everywhere)

1. **Filter selects render the raw value `all`** instead of a localized label —
   confirmed on CRM, Legal, HR, Core and Support. Highest-visibility defect,
   trivial fix in the shared select pattern.
2. **pt-BR accents are stripped** throughout UI copy ("Distribuicao",
   "Servico", "Acoes", "Relatorios") while Zod messages are correctly accented
   — a content defect, not an encoding limit. Pervasive.
3. **Lists have no search / sort / filter / pagination** — Core, CRM, Finance,
   Dev-Tools, Marketing, Support. Each works for seeded data and degrades past
   a few hundred rows.
4. **Destructive deletes have no confirmation** — Marketing, Dev-Tools, Finance,
   Support, Legal; HR uses native `prompt()`/`confirm()`. Needs one shared
   confirm dialog.
5. **Sector managers land on the generic board dashboard**, not their module —
   CRM, HR and Support managers see board KPIs instead of sales/people/ticket
   KPIs; the column chart there is even empty for scoped users.
6. **Built-but-unreachable code** — edit/delete mutations exist with no UI entry
   point (CRM companies/contacts, Core boards/projects, Legal owners/matters).
7. **Server validation errors are not surfaced inline** on forms — they are
   returned as field maps but shown only as generic toasts.
8. **No record detail views** — list rows open the edit dialog directly; there
   is no read-only detail page in most modules.

## Confirmed bugs

- **HR (High):** the time-off request dialog sends `policyId: employeeId`,
  storing a corrupt policy on every UI-created leave request.
- **CRM (High):** pipeline stage order is non-deterministic (`position`
  hard-coded to `0`); the proposals filter omits the "Expirada" status.
- **Core (High):** the dashboard "by column" chart is empty for every sector
  manager (an `!inner` join that RLS filters to nothing for scoped users).
- **Analytics (Medium):** the report form collects `group_by` but the trend
  RPC ignores it — a silently broken control.
- **Finance (Medium):** the `overdue` status never auto-transitions, so the
  "vencidas" hint and Vencida tab are unreliable.
- **Support (Low):** canned-response shortcut shows a double slash (`//escalar`).
- The `all` filter-token issue above is also a bug, not just polish.

## Recommended first wave — quick wins (high value, low effort)

1. Fix the `all` filter label across all modules.
2. Accent-correctness pass on all UI copy.
3. Add a shared confirmation dialog for every destructive delete.
4. Route each sector manager to their module's dashboard after login.
5. Wire the existing edit/delete mutations into the list/detail UIs.
6. Fix the HR time-off `policyId` bug and the CRM stage-ordering bug.
7. Surface server validation errors inline on forms.

## Strategic bets (high value, larger effort)

- **Core:** project detail pages + project↔card linking; Kanban swimlanes,
  filters and real WIP management.
- **CRM:** searchable entity pickers, bulk actions, optimistic pipeline drag.
- **Support:** a public reply channel and a richer ticket status model.
- **Finance:** real invoices (PDF, send, payment link, line items, AR aging);
  expense receipts and approval workflow.
- **Legal:** contract document storage and automated renewal notifications.
- **Marketing:** queryable audience segments; campaign detail + CRM attribution.
- **Analytics:** make all KPIs reportable; CSV export; honor `group_by`.
- **Dev-Tools:** incident acknowledge/timeline workflow; list management.

Every per-module report ends with its own prioritized backlog tagged
High/Medium/Low with cited market sources.

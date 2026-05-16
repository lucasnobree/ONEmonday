# UX Audit — Finance Module (Financeiro)

**Auditor:** Senior Product Designer (ux-auditor standard)
**Date:** 2026-05-15
**Module path:** `apps/web/app/(dashboard)/finance`, `apps/web/components/finance`, `apps/web/hooks/finance`, `apps/web/lib/finance`, `apps/web/lib/actions/finance`
**Screens audited:** Visão Geral (dashboard), Faturas (invoices), Despesas (expenses), Orçamentos (budgets)
**Evidence:** `screenshots/audit/admin/24-finance-dashboard.png` … `27-finance-budgets.png`

---

## Module Summary & Overall Rating

The Finance module covers four screens — a cash-flow dashboard, accounts-receivable invoices, accounts-payable expenses, and category budgets. The engineering foundation is genuinely strong: money is stored as **integer cents** throughout (`lib/finance/money.ts`), with a well-documented invariant, a locale-tolerant `parseCents` parser, server-side Zod validation, permission checks on every action, soft-delete, and a server-computed `get_finance_summary` RPC. Empty states, loading skeletons, CSV export, and `pt-BR` currency/date formatting are all present and consistent with the rest of the app.

However, as a **product**, the module is a thin transactional ledger. It records invoices, expenses and budgets and charts them — but it does almost none of the *workflow* that makes QuickBooks, Xero, Stripe Billing, Brex or Pleo valuable: no payment collection, no PDF/sending of invoices, no automatic overdue detection, no AR aging, no receipt capture, no approval routing, no recurring items, and no multi-currency consolidation despite the data model supporting three currencies. The screenshots show every screen empty, which makes UX gaps in dense states (sorting, pagination, search) invisible to a casual reviewer but real in the code.

**Overall rating: 5.5 / 10** — Solid, correct primitives; immature as a finance product. The gap to market leaders is in workflow and automation, not in code quality.

### Cross-cutting findings (apply to all screens)

| # | Finding | Impact |
|---|---------|--------|
| C1 | **No search box on any list.** Invoices and Expenses filter only by status/category tabs. With 200+ rows there is no way to find "INV-042" or a vendor by name. QuickBooks/Xero put a search field at the top of every register. | High |
| C2 | **No sorting and no pagination.** Tables render the full result set in DOM order (issue_date / expense_date desc, fixed). No clickable column headers, no page size. Lists will degrade badly past a few hundred rows. | High |
| C3 | **No "overdue" automation.** `INVOICE_STATUSES` includes `overdue`, but nothing transitions a `sent` invoice to `overdue` when `due_date` passes — it depends on a human manually editing the status. The dashboard's "faturas vencidas" hint and the Vencida tab are therefore unreliable. Xero/QuickBooks derive overdue from the due date automatically. | High |
| C4 | **Multi-currency is half-built.** The schema, `money.ts` and `formatCents` support BRL/USD/EUR, but both form dialogs hard-code `currency: "BRL"` on create with no currency selector. A list mixing currencies would also sum them naively. Either expose the selector or drop the unused capability. | Medium |
| C5 | **Accessibility: filter tab groups are not a real tablist.** The status/category pills (`invoices/page.tsx`, `expenses/page.tsx`) are bare `<button>`s with no `role="tab"`, `aria-selected`, or arrow-key navigation. The module tab bar in `layout.tsx` is plain `<Link>`s. Screen-reader users get no "tab 2 of 6" context. | Medium |
| C6 | **No row click-through / detail view.** Invoices and expenses can only be edited via a pencil icon that opens the same compact dialog. There is no read-only detail page, no audit trail, no per-invoice activity. Every leader offers a full record view. | Medium |
| C7 | **Inconsistent design language with the rest of the app.** Module sub-navigation is rendered twice — once as the segmented `layout.tsx` tab bar and again as in-page list headers — and the budgets page uses a hard-coded chart palette (`#6366f1`, `#f59e0b`) while cash-flow uses `#10b981`/`#ef4444`. No shared chart theme tokens. | Low |

---

## Screen 1 — Visão Geral / Dashboard

**Screenshot:** `24-finance-dashboard.png`
**Code:** `app/(dashboard)/finance/page.tsx`, `components/finance/cash-flow-chart.tsx`, `hooks/finance/use-finance-summary.ts`

### What works
- Four KPI cards (Receita Recebida, Despesa Paga, Caixa Líquido, A Receber em aberto) are computed server-side via the `get_finance_summary` RPC, so they enforce sector access and are consistent.
- Caixa Líquido switches colour (emerald/red) by sign — a good at-a-glance signal.
- A skeleton loading state covers cards + chart; the cash-flow chart has its own empty state ("Sem dados de fluxo de caixa").
- Currency values are rendered with `formatCents` (proper `R$ 1.234,56` `pt-BR` formatting) and the card value has a `title` tooltip for truncated amounts.

### Findings

| # | Finding | Impact | Recommendation |
|---|---------|--------|----------------|
| D1 | **The dashboard is purely retrospective.** It shows paid income, paid expense and outstanding AR — but no outstanding **AP** card even though `outstanding_ap_cents` is already in the `FinanceSummary` type and fetched. A finance manager cannot see "what do I owe" at a glance. | High | Add a fifth card "A Pagar (em aberto)" using `outstanding_ap_cents`. Consider a 2×3 or scrolling KPI row. |
| D2 | **No period selector.** Cash-flow is hard-coded to "últimos 6 meses" and KPIs are all-time. Xero and Stripe Billing dashboards let you pick the date range / compare to prior period. There is no way to answer "how did April look". | High | Add a date-range / month picker that drives both KPIs and the chart; show a delta vs. previous period. |
| D3 | **Empty chart renders an axis with no message.** The screenshot shows a Y-axis 0–4 and a grey hover band over `2026-02` with a tooltip reading "Entradas: R$ 0,00 / Saídas: R$ 0,00". The RPC returns 6 zero-value points, so `data.length === 0` is false and the "Sem dados" fallback never fires. The result looks broken. | Medium | Treat an all-zero series as empty, or render a flat baseline with a clear "Sem movimentação registrada" caption. |
| D4 | **"Faturas Recentes" is the only list and it is read-only.** Rows are not clickable and there is no "ver todas" link to `/finance/invoices`. The dashboard is a dead end. | Medium | Make rows link to the invoice (or open the edit dialog) and add a "Ver todas as faturas" link in the card header. |
| D5 | **No KPIs for the leaders' core metrics.** QuickBooks/Xero dashboards surface AR **aging buckets** (0-30 / 31-60 / 61-90 / 90+); Stripe Billing surfaces MRR, churn and active subscribers. ONEmonday shows none of these. | Medium | Add an AR aging mini-widget (stacked bar by bucket). If recurring billing is on the roadmap, add an MRR card. |
| D6 | **Dashboard date uses `new Date(inv.due_date)`** then `toLocaleDateString`. A `YYYY-MM-DD` string is parsed as **UTC midnight**, so users in `America/Sao_Paulo` (UTC-3) can see the date shifted back one day. | Medium | Parse date-only strings as local (`new Date(y, m-1, d)`) or format the raw parts; apply the fix everywhere a `*_date` is displayed. |
| D7 | **Net cash terminology.** "Caixa Líquido" is labelled as net cash but is computed only from *paid* income minus *paid* expense — it is not a true bank balance and ignores opening balance. | Low | Rename to "Resultado (pago)" or add a tooltip clarifying the definition. |

---

## Screen 2 — Faturas / Invoices

**Screenshot:** `25-finance-invoices.png`
**Code:** `app/(dashboard)/finance/invoices/page.tsx`, `components/finance/invoice-form-dialog.tsx`, `hooks/finance/use-invoices.ts`, `lib/actions/finance/invoices.ts`

### What works
- Status filter pills (Todas / Rascunho / Enviada / Paga / Vencida / Cancelada) map cleanly to the data model and to `INVOICE_STATUS_LABELS`.
- Empty state is well designed: icon, title, description, and a primary "Nova Fatura" action.
- CSV export (`exportToCSV`) is disabled when the filtered list is empty — good guard.
- `ConfirmDialog` protects deletion and names the invoice in the prompt.
- The server action stamps `paid_at` automatically when status becomes `paid` and clears it when it leaves `paid` — correct state handling.
- Status badges use distinct variants (`destructive` for overdue).

### Findings

| # | Finding | Impact | Recommendation |
|---|---------|--------|----------------|
| I1 | **An invoice cannot actually be sent or paid online.** "Enviada" and "Paga" are just dropdown values; there is no email send, no PDF, no payment link, no customer-facing view. QuickBooks, Xero, Stripe Billing and FreshBooks all generate a branded PDF and a hosted pay page. This is the single biggest functional gap. | High | Add invoice PDF generation and a "Enviar" action (email with the PDF / a hosted link). Even a static PDF download is a large step up. |
| I2 | **No line items.** An invoice has one `amount_cents` and one free-text `description`. Real invoices have multiple lines with quantity × unit price, plus tax. Without lines you cannot itemize, apply IVA/ISS, or produce a credible document. | High | Add a line-items editor (description, qty, unit price, line total) and derive `amount_cents` as the sum. |
| I3 | **No AR aging report.** There is no way to see invoices bucketed by how overdue they are — a standard QuickBooks/Xero report and a key collections tool. | High | Add an "Aging" view: 0-30 / 31-60 / 61-90 / 90+ days outstanding, per customer. |
| I4 | **No payment reminders.** Combined with C3 (no auto-overdue), the module gives a finance manager no help chasing money. QuickBooks schedules reminders at configurable day offsets; Xero sends them automatically. | High | Add scheduled overdue reminders (email) with configurable offsets; at minimum surface an "overdue" list with a "lembrar" action. |
| I5 | **`number` is a free-text required field with no auto-numbering.** Users must invent "INV-001" themselves and nothing prevents duplicates within a sector. Every leader auto-increments the next invoice number. | Medium | Auto-suggest the next sequential number on create; enforce a per-sector uniqueness constraint. |
| I6 | **Customer is a free-text string, not a linked entity.** `customer_name` has no relationship to the CRM `companies`/`contacts` module that already exists in this app. The same customer typed two ways becomes two customers, breaking any per-customer aging. | Medium | Replace the text input with a combobox bound to CRM contacts/companies (with a "create new" fallback). |
| I7 | **No partial payments / payment history.** An invoice is binary paid/unpaid. Partial receipts, payment date, and method are not recordable. | Medium | Add a payments sub-record (amount, date, method) and derive status from the balance. |
| I8 | **Date inputs allow illogical combinations only caught after submit.** `dueDate >= issueDate` is validated server-side via `.refine`, but the `<input type="date">` due field has no `min={issueDate}`, so the user only learns of the error after a round-trip. | Low | Set `min={issueDate}` on the Vencimento input for immediate feedback. |
| I9 | **No bulk actions.** With many invoices you cannot multi-select to mark paid, export a subset, or delete. | Low | Add row checkboxes with a bulk action bar (mark as sent/paid, export). |
| I10 | **Edit dialog is the only way to change status** — there is no inline status quick-action in the row. Changing 10 invoices to "paid" is 10 × (open dialog → select → save) ≈ 40+ clicks. | Low | Add an inline status dropdown or a row kebab menu with "Marcar como paga". |

---

## Screen 3 — Despesas / Expenses

**Screenshot:** `26-finance-expenses.png`
**Code:** `app/(dashboard)/finance/expenses/page.tsx`, `components/finance/expense-form-dialog.tsx`, `hooks/finance/use-expenses.ts`

### What works
- Eight category filter pills (Folha de Pagamento, Software, Viagens, Escritório, Marketing, Serviços, Impostos, Outros) plus "Todas" — driven by `EXPENSE_CATEGORIES`, so filters and the form select stay in sync.
- The filter bar is `flex-wrap`, so it degrades gracefully on narrow widths (unlike the fixed-height invoice bar).
- Same strong empty state, skeleton, CSV export, and `ConfirmDialog` pattern as Invoices.
- `paid_at` handling and permission checks mirror invoices — consistent server logic.

### Findings

| # | Finding | Impact | Recommendation |
|---|---------|--------|----------------|
| E1 | **No receipt / attachment capture.** This is the defining feature of modern expense tools — Brex and Pleo auto-parse a receipt photo and pre-fill the expense, eliminating ~80% of manual coding. ONEmonday expenses have no file attachment at all. | High | Add receipt upload (image/PDF) on the expense; ideally OCR pre-fill of vendor, amount and date. |
| E2 | **No approval workflow.** Any user who can create an expense creates it directly as `pending`/`paid`; there is no submitter → approver → paid routing. Brex/Pleo route by amount thresholds and department. For a multi-sector company this is a real control gap. | High | Add an approval state machine (submitted → approved/rejected → paid) with threshold-based routing and an approver role. |
| E3 | **No vendor entity.** Like invoice customers, `vendor_name` is free text — no dedup, no per-vendor spend total, no payment terms. | Medium | Introduce a vendors list (or reuse CRM companies) and bind the field to a combobox. |
| E4 | **No recurring expenses.** Payroll, software subscriptions and rent recur every month, yet each must be re-entered manually. Pleo and Brex track subscriptions automatically. | Medium | Add a "recurring" flag with a frequency, auto-generating the next expense. |
| E5 | **Two filter dimensions cannot be combined.** You can filter by category *or* see all, but not "Software expenses that are pending". Status is shown only as a badge with no filter. | Medium | Add a status filter (Pendente/Paga/Cancelada) alongside the category filter; allow combining them. |
| E6 | **No expense totals on the list.** The table shows individual rows but no sum of the filtered set — a finance user has to export to CSV and sum in a spreadsheet. | Medium | Add a footer/header showing the total of the filtered expenses (and count). |
| E7 | **No "bill pay" or due date for payables.** An expense has only `expense_date`, no due date — so you cannot see upcoming payables or build an AP aging like the invoice side needs. | Medium | Add an optional `due_date` and an AP aging view; surface "a pagar" on the dashboard (see D1). |
| E8 | **Category is fixed at 8 server-enforced values.** Companies often need custom categories or sub-categories / cost centers. The CHECK-constraint design makes this rigid. | Low | Consider a configurable category table per sector while keeping the current set as defaults. |

---

## Screen 4 — Orçamentos / Budgets

**Screenshot:** `27-finance-budgets.png`
**Code:** `app/(dashboard)/finance/budgets/page.tsx`, `components/finance/budget-form-dialog.tsx`, `hooks/finance/use-budgets.ts`

### What works
- The concept is sound: a budget per category per month, joined client-side with *paid* expenses for the same month to compute realized spend.
- When populated, the screen is the richest in the module: three summary cards (Total Orçado / Total Realizado / Saldo), a grouped Orçado-vs-Realizado bar chart, and per-category progress bars that turn red and exceed-visually when usage > 100%.
- `budgetUsagePercent` guards against divide-by-zero; `sumCents` keeps totals integer-safe.
- Chart Y-axis uses compact `pt-BR` notation (`1 mil`, `1 mi`) and the tooltip reverses the cents conversion correctly.

### Findings

| # | Finding | Impact | Recommendation |
|---|---------|--------|----------------|
| B1 | **Budgets only ever show the current month.** Both the page (`currentMonthKey()`) and the empty state ("Nenhum orçamento neste mês") are locked to `new Date()`. You cannot view, plan, or review last month or next month — even though a budget *is* created with a month picker. Past budgets become invisible the moment the month rolls over. | High | Add a month selector at the top of the page; drive `rows`, totals and chart from it. |
| B2 | **No annual / full-year view.** Best-practice budgeting needs a 12-month roll-up and rolling forecast; ONEmonday has no annual budget and no way to copy a month forward. | High | Add an annual view (categories × 12 months grid) and a "duplicate last month" action. |
| B3 | **Realized spend ignores pending expenses.** `actualByCategory` counts only `status === 'paid'`. A budget can look 60% used while large pending bills are about to land. Budget-vs-actual analysis normally includes committed/accrued cost. | Medium | Show committed (pending) spend as a separate segment on the progress bar, or offer a paid/accrual toggle. |
| B4 | **No variance figures, only a percentage.** The leaders' core budgeting output is the variance (absolute R$ and %) per line with over/under flagging. ONEmonday shows `realizado / orçado` and a `%` but never the R$ variance per category. | Medium | Add a variance column (Saldo per category, R$ + %) and sort/flag the largest overruns. |
| B5 | **Edit is impossible from the UI.** `updateBudgetSchema` and `useUpdateBudget` exist, but the budgets page only wires up *create* and *delete* — there is no pencil action on a budget row. To change an amount you must delete and recreate. | Medium | Wire the existing `updateBudget` mutation to a row edit action / inline amount editor. |
| B6 | **Duplicate budgets per category/month are not prevented in the UI.** Nothing stops creating two "Software" budgets for the same month; the join would then show only one arbitrarily or double-count depending on data. | Medium | Enforce a unique (sector, category, period_month) constraint and pre-filter already-budgeted categories out of the create dialog. |
| B7 | **No alerts when a budget is exceeded.** The bar turns red passively; there is no notification to the sector manager. | Low | Trigger an in-app/email alert when paid spend crosses a threshold (e.g. 90% / 100%). |
| B8 | **Chart palette is hard-coded and off-theme.** `#6366f1` / `#f59e0b` are not the app's theme tokens and differ from the cash-flow chart's colours. | Low | Use shared chart colour tokens for consistency (see C7). |

---

## Per-Sector Access

The module is correctly sector-scoped: every page guards on `currentSector` and every query filters `.eq("sector_id", sectorId)`; the `get_finance_summary` RPC and all server actions re-check `hasPermission(perms, sectorId, …)`. A sector manager therefore sees only their own sector's finance data, which is correct. Two observations:

- **Low** — There is no cross-sector consolidated view for an admin/CFO. A company-wide finance roll-up (all sectors) would be valuable and is currently impossible without switching sectors one by one.
- **Low** — The "Selecione um setor" fallback is a bare muted paragraph, inconsistent with the polished `EmptyState` component used elsewhere. Use `EmptyState` for visual consistency.

---

## Prioritized Backlog (by value / effort)

| Rank | Item | Screens | Impact | Rough effort |
|------|------|---------|--------|--------------|
| 1 | Auto-derive `overdue` from `due_date` (stop relying on manual status) | Invoices, Dashboard | High | Low |
| 2 | Add search box + column sort to invoice & expense lists | Invoices, Expenses | High | Low–Med |
| 3 | Add "A Pagar (em aberto)" KPI card + fix all-zero chart empty state | Dashboard | High / Med | Low |
| 4 | Month selector for Budgets (unlock past/future months) | Budgets | High | Low |
| 5 | Wire up budget edit (mutation already exists) + uniqueness guard | Budgets | Med | Low |
| 6 | Date-only parsing fix (timezone shift on all `*_date` displays) | All | Med | Low |
| 7 | AR aging report + aging widget on dashboard | Invoices, Dashboard | High | Med |
| 8 | Invoice line items + PDF generation + "Enviar" action | Invoices | High | High |
| 9 | Receipt attachment/upload on expenses (OCR pre-fill later) | Expenses | High | Med–High |
| 10 | Expense approval workflow with threshold routing | Expenses | High | High |
| 11 | Status filter + filtered totals on the expense list | Expenses | Med | Low |
| 12 | Link customers/vendors to CRM entities (combobox) | Invoices, Expenses | Med | Med |
| 13 | Recurring invoices & recurring expenses | Invoices, Expenses | Med | Med |
| 14 | Pagination on all lists; bulk actions | Invoices, Expenses | High / Low | Med |
| 15 | Accessibility: real `role="tablist"` + keyboard nav on filter pills | All | Med | Low |
| 16 | Expose the currency selector or remove unused multi-currency code | All | Med | Low |
| 17 | Variance column + committed-spend segment in budgets | Budgets | Med | Med |
| 18 | Cross-sector consolidated finance view for admins | All | Low | Med |

**Quick wins (do first):** items 1, 3, 4, 5, 6, 11, 15 are all low-effort and remove the most visible day-to-day friction. **Strategic bets:** items 8, 9, 10 are what actually closes the gap to QuickBooks/Xero (invoicing) and Brex/Pleo (expenses).

---

## Sources

- [Accounts receivable aging report guide — QuickBooks/Intuit](https://quickbooks.intuit.com/r/payments/accounts-receivable-aging-report/)
- [How to Set Up an AR Aging Report in QuickBooks — AccountingDepartment](https://www.accountingdepartment.com/blog/how-to-set-up-an-ar-aging-report-in-quickbooks)
- [Xero vs QuickBooks comparison — Webgility](https://www.webgility.com/blog/xero-vs-quickbooks)
- [Custom Email & SMS Invoice & Payment Reminders for Xero & QuickBooks — Paidnice](https://www.paidnice.com/email-sms-reminders)
- [Brex Review 2025 — Features & Pricing — WorkflowAutomation](https://workflowautomation.net/reviews/brex)
- [How to automate your expense approval process — Brex](https://www.brex.com/spend-trends/expense-management/expense-approval-process)
- [What are expense receipts and why should I track them — Brex](https://www.brex.com/spend-trends/expense-management/expense-receipts)
- [Pleo Explained: Expense Card Platform for Teams — Startupik](https://startupik.com/pleo-explained-expense-card-platform-for-teams/)
- [Billing analytics / Subscription analytics — Stripe Documentation](https://docs.stripe.com/billing/subscriptions/analytics)
- [Billing analytics dashboard — Stripe Help & Support](https://support.stripe.com/questions/billing-analytics-dashboard)
- [How to Perform Budget Variance Analysis — Martus Solutions](https://www.martussolutions.com/blog/budget-variance-analysis)
- [Best Business Budgeting Software Tools for 2026 — Ramp](https://ramp.com/blog/business-budgeting-software-tools)

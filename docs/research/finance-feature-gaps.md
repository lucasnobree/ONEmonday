# Finance Module — Feature Gap Research

Research into leading finance / accounting / spend-management products to define a
prioritized, focused MVP scope for the ONEmonday **Financeiro** module.

## Products surveyed

- **QuickBooks Online** — SMB accounting; invoicing, expense tracking, 50+ reports
  (P&L, balance sheet, cash-flow projections, budget vs. actuals).
- **Xero** — clean SMB accounting; invoicing, bank reconciliation, expense tracking,
  aged receivables/payables, cash-flow forecasting (Established plan).
- **Stripe Billing** — invoicing + revenue analytics dashboard (MRR, churned revenue,
  ARPU); CSV export of billing metrics.
- **Brex** — corporate spend management; department/project budgets with real-time
  enforcement, multi-level approval workflows, live budget tracking, overage alerts.
- **Pleo** — European SMB expense management; simplicity-first UX, simple approvals.

## Common-denominator feature set

Across all five products the consistent, table-stakes capabilities are:

1. **Invoicing / accounts receivable** — issue invoices to customers, track status
   (draft → sent → paid / overdue), aged receivables.
2. **Expense tracking / accounts payable** — record expenses by category, track
   payment status, aged payables.
3. **Budgets** — per-period budget per category/department, with budget-vs-actual
   tracking and overage visibility (Brex's live enforcement is the differentiator).
4. **Cash-flow view** — unified inflow/outflow timeline derived from invoices and
   expenses; KPIs for income, expense, net position.
5. **Reporting & KPIs** — summary dashboard with charts; CSV export.

## Prioritized scope for the ONEmonday Finance MVP (Wave 2)

Scope is deliberately focused — a high-quality vertical slice, not a full ledger.

### P0 — In this wave

| Feature | Rationale |
|---|---|
| **Invoices** (AR) | Core of QuickBooks/Xero/Stripe. Status lifecycle draft/sent/paid/overdue/void, due dates, customer name, currency. |
| **Expenses** (AP) | Core of QuickBooks/Xero/Brex/Pleo. Category, vendor, payment status pending/paid, expense date. |
| **Budgets** | Brex's headline feature. Per-category, per-period (month) planned amount; compare against actual expenses. |
| **Cash-flow / transactions dashboard** | Unified KPIs (total income, total expense, net cash, overdue AR) + 6-month inflow/outflow chart (`recharts`). Budget-vs-actual chart. |
| **Money correctness** | All amounts stored as **integer minor units (cents)**; pure helpers for parse/format/sum. Never floats. |
| **CSV export** | Universal across surveyed products; reuses existing `exportToCSV` util. |

### P1 — Next wave (documented, not built)

- Bank reconciliation / transaction import (CSV / Open Banking).
- Multi-currency with FX rates (Xero Established).
- Recurring invoices & subscription MRR analytics (Stripe Billing).
- Multi-level approval workflows for expenses (Brex Premium).
- Formal financial statements: DRE / balance sheet / aged AR-AP reports.
- Attachments (receipts) on expenses, OCR capture (Pleo/Brex).
- Tax handling per line item.
- Payment provider integration (Stripe/Pix) to mark invoices paid automatically.

### Explicitly out of scope

- General ledger / double-entry bookkeeping and chart of accounts.
- Payroll (owned by the HR module).
- Inventory / fixed-asset accounting.

## Design decisions

- **Integer cents everywhere.** DB columns are `bigint`, named `*_cents`. The web
  layer uses `lib/finance/money.ts` pure helpers (`reaisToCents`, `centsToReais`,
  `formatCents`, `sumCents`) — extensively unit-tested. No `numeric`/`float` for money.
- **Sector scoping & RLS.** Every new table carries `sector_id` and has RLS using
  `user_has_sector_access` (read) and `user_has_permission` (write), mirroring CRM.
- **Module enablement.** A `finance` module row (status `active`) is registered and
  enabled per sector via `sector_modules`, matching `00009_module_infrastructure.sql`.
- **Soft delete** via `is_active`, consistent with CRM/Support tables.

## Sources

- [Xero vs QuickBooks: 2026 Comparison — Intuit](https://quickbooks.intuit.com/compare/xero-vs-quickbooks/)
- [QuickBooks vs. Xero: Which Is Best in 2025? — Business News Daily](https://www.businessnewsdaily.com/xero-vs-quickbooks)
- [Xero vs. QuickBooks: Accounting Comparison (2025) — Rippling](https://www.rippling.com/blog/xero-vs-quickbooks)
- [How to automate your expense approval process — Brex](https://www.brex.com/spend-trends/expense-management/expense-approval-process)
- [Enterprise Expense Management: A Guide for Finance Teams — Brex](https://www.brex.com/spend-trends/expense-management/enterprise-expense-management)
- [The 5 Best Expense Management Tools of 2025 — Brex](https://www.brex.com/spend-trends/expense-management/expense-management-tools)
- [Subscription analytics — Stripe Documentation](https://docs.stripe.com/billing/subscriptions/analytics)
- [Billing analytics dashboard — Stripe Help & Support](https://support.stripe.com/questions/billing-analytics-dashboard)

# UX Audit — Finance Module (Financeiro) — Wave 4

**Auditor:** Senior Product Designer / Front-end Engineer
**Date:** 2026-05-18
**Scope:** New screens since Wave 3 — invoice line items + PDF/print + fiscal/charge dialog, expense receipts + approval workflow, AR/AP aging + DRE reports (`/finance/reports`), bank reconciliation (`/finance/reconciliation`).
**Evidence:** `screenshots/audit-wave4/admin/30-finance-dashboard.png` … `35-finance-reconciliation.png`
**Prior report:** `docs/research/ux-audit-finance.md` (Wave 3). This audit does not repeat already-fixed items.

---

## What Wave 3 fixed (verified)

- **D1** — Dashboard now has a fifth KPI card "A Pagar (em aberto)" (`30-finance-dashboard.png`).
- **D3** — All-zero cash-flow series now shows "Sem movimentação registrada nos últimos 6 meses" instead of a broken empty axis.
- **B1** — Budgets screen has a month selector ("Maio De 2026" with prev/next arrows).
- **E5/E6** — Expenses now has a second status filter row and a `Total: …` footer with row count (`expenses/page.tsx:310-320`).
- **C3/I1/I2** — Invoices: `effectiveInvoiceStatus` derives `overdue` from the due date; line-items editor and a print/PDF action exist.
- **E1/E2** — Expense receipts dialog and an approval-workflow menu exist.
- **C5** — Filter pills now carry `role="tablist"`/`role="tab"`/`aria-selected`.

The module is materially stronger than at Wave 3. Remaining findings are mostly about the *new* screens and interaction polish.

## Module summary & overall rating

Finance is now a credible operational ledger: receivables and payables, an approval-gated expense flow, a management DRE, AR/AP aging, an accountant CSV export, OFX bank import with a reconciliation matcher, and fiscal/charge stubs wired to Focus NFe / Asaas adapters. The engineering remains disciplined — integer cents, pure tested libs (`dre.ts`, `aging.ts`, `reconciliation.ts`, `ofx.ts` all have `.test.ts`), no-op adapter mode with honest "gateway não configurado" toasts.

The remaining gaps are in **screen-level UX**: the Reports screen has no loading/empty differentiation for aging, the Reconciliation screen exposes a raw matcher with no bulk action and English status tokens leaking into the UI, the DRE has no period grouping or export, and there is still no detail view for an invoice or expense. The fiscal dialog leaks raw enum values (`authorized`, `received`) as badge text.

**Overall rating: 7 / 10** — up from 5.5. Solid breadth; the new screens need a usability and pt-BR polish pass before they feel finished.

### Cross-cutting findings

| # | Finding | Impact |
|---|---------|--------|
| C1 | **Raw English/enum tokens leak into the UI on the new screens.** The fiscal dialog renders `d.status` and `c.status` directly as badge text — a user sees `authorized`, `pending`, `received`, `error` instead of pt-BR labels (`invoice-fiscal-dialog.tsx:156, 207`). The reconciliation matched-list and unmatched-list are clean, but the suggestion confidence is never surfaced. | High |
| C2 | **No invoice or expense detail view.** Legal got read-only detail sheets in this wave; Finance did not. An invoice/expense is still only reachable through stacked icon buttons (print, fiscal, edit, delete) opening compact dialogs. There is no record page showing line items, receipts, fiscal docs, charges, payment history and audit trail together. | Medium |
| C3 | **Still no list search or pagination on Invoices/Expenses.** Wave 3 flagged this (C1/C2); it is unaddressed. Reports and Reconciliation also render unbounded tables. With a real OFX import a statement can be hundreds of rows. | Medium |
| C4 | **No cross-screen "period" consistency.** Reports has a De/Até picker; the dashboard cash-flow is hard-locked to "últimos 6 meses"; budgets has a month selector; reconciliation has none. Four screens, three period models. | Low |

---

## Screen 1 — Visão Geral / Dashboard

**Screenshot:** `30-finance-dashboard.png`
**Code:** `app/(dashboard)/finance/page.tsx`

### What works
- Five KPI cards now including "A Pagar (em aberto)" — the Wave 3 D1 gap is closed.
- All-zero cash-flow chart shows an explicit caption.
- Consistent skeletons and `formatCents` pt-BR currency.

### Findings

| # | Finding | Impact | Recommendation |
|---|---------|--------|----------------|
| D1 | **Five KPI cards in one row wrap awkwardly and the 4th card's label "A Receber (em aberto)" breaks onto two lines** while the others sit on one — visible in the screenshot. The 5-up grid has no breakpoint logic. | Low | Use a `grid-cols-2 lg:grid-cols-3 xl:grid-cols-5` with consistent fixed card height, or a 2×3 layout. Normalize label length ("A Receber" / "A Pagar" with the qualifier as a sub-line). |
| D2 | **Dashboard still has no link to the new Reports screen.** A finance manager landing here cannot see the DRE, aging or accountant export without discovering the tab. The dashboard does not surface the aging buckets either, although `useFinanceAging` already exists. | Medium | Add an AR-aging mini-widget (stacked bar by bucket) and a "Ver relatórios" link; both reuse data already fetched in `/finance/reports`. |
| D3 | **No period selector** (Wave 3 D2, still open). Cash-flow is fixed to 6 months; KPIs are all-time. Omie's financial dashboards let you choose the period and compare. | Medium | Add a period control driving KPIs + chart, consistent with the Reports De/Até picker. |

---

## Screen 2 — Faturas / Invoices

**Screenshot:** `31-finance-invoices.png`
**Code:** `invoices/page.tsx`, `invoice-fiscal-dialog.tsx`, `invoice-line-items-editor.tsx`, `invoice-print-button.tsx`

### What works
- Effective-status derivation means a past-due `sent` invoice shows and filters as "Vencida" without manual editing (`invoices/page.tsx:51-56`).
- Line-items editor computes the invoice total from qty × unit price with integer-cents math (`invoice-line-items-editor.tsx`).
- Print button builds a printable HTML doc and is honest about pop-up blocking.
- Fiscal dialog uses no-op adapter mode and warns clearly when a gateway is unconfigured.

### Findings

| # | Finding | Impact | Recommendation |
|---|---------|--------|----------------|
| I1 | **Fiscal dialog renders raw status tokens.** `invoice-fiscal-dialog.tsx:156` shows `{d.status}` and `:207` shows `{c.status}` directly inside `<Badge>`. The user sees `authorized` / `pending` / `received` / `error` — English, lowercase, untranslated. Omie and ContaAzul show "Autorizada", "Em processamento", "Recebida". | High | Add `FISCAL_DOC_STATUS_LABELS` and `CHARGE_STATUS_LABELS` maps in `labels.ts` and render `LABELS[d.status]`. |
| I2 | **Four ungrouped icon buttons per row** (print, fiscal=FileText, edit=pencil, delete). The fiscal icon (`FileText`) is visually identical to a generic document and its only affordance is `aria-label="Fiscal e cobrança"` — no tooltip, ambiguous to a sighted user. Five+ actions is the threshold where a kebab menu wins. | Medium | Collapse print/fiscal/edit/delete into a row "..." menu (the pattern `expense-approval-menu.tsx` already uses), or add visible tooltips. |
| I3 | **No way to reach line items / fiscal docs except by opening dialogs.** There is no invoice detail view (see C2). Line items entered in the form are invisible on the list — the list still shows a single `amount_cents`. | Medium | Add an invoice detail sheet (mirror `ContractDetailSheet`) with tabs: Itens, Fiscal, Cobrança, Histórico. |
| I4 | **Print depends on browser pop-ups and prints immediately** (`invoice-print-button.tsx:62` calls `win.print()` right after `document.write`). On a slow machine the print dialog can fire before assets render; there is no preview. QuickBooks/Omie render a preview the user confirms before printing. | Low | Open the print window, let the user review, and trigger print from a button inside it (or wait for `onload`). |
| I5 | **CSV export still column-fixed; no search/sort/pagination** (Wave 3 C1/C2 open). | Medium | Add a search box (number + customer) and sortable headers. |

---

## Screen 3 — Despesas / Expenses

**Screenshot:** `32-finance-expenses.png`
**Code:** `expenses/page.tsx`, `expense-receipts-dialog.tsx`, `expense-approval-menu.tsx`

### What works
- Two filter rows (category + status) that combine, plus a `Total:` footer with count — Wave 3 E5/E6 closed.
- Approval menu only offers `approve`/`reject` when the user holds `expense:approve`, and reject requires a typed reason stored on the expense (`expense-approval-menu.tsx:45-52, 80-87`).
- Rejected rows show a truncated rejection reason inline with a `title` tooltip (`expenses/page.tsx:264-271`).
- Receipts dialog enforces a 10MB limit and image/PDF accept filter.

### Findings

| # | Finding | Impact | Recommendation |
|---|---------|--------|----------------|
| E1 | **Two stacked full-width filter rows consume a lot of vertical space and read as one control group** (`32-finance-expenses.png`). The category row has 9 pills and the status row 7; on a narrow viewport they wrap into a tall block before any data shows. | Low | Keep category as pills; move status to a compact `Select` dropdown, or right-align it on the same row as the category pills. |
| E2 | **Receipts are not OCR-assisted and the dialog accepts only one file at a time** (`expense-receipts-dialog.tsx:57` takes `files[0]`). Brex and Ramp auto-populate merchant, amount and date from a receipt photo via OCR and auto-match receipts to transactions; here the user uploads, then separately types every field. | Medium | Allow multi-file upload (loop like the contract uploader does); as a strategic bet, OCR pre-fill of vendor/amount/date. |
| E3 | **No receipt-required policy signal.** A paid expense with no attached receipt looks identical to one with a receipt — the paperclip icon gives no count or "missing receipt" warning. Brex/Ramp proactively flag missing documentation. | Medium | Show a receipt count badge on the paperclip and a subtle "sem comprovante" indicator on paid expenses. |
| E4 | **Approval menu trigger has no visible label and a typo in pt-BR.** `aria-label="Acoes de aprovacao"` and the toast `"Informe o motivo da rejeicao"` are missing accents ("Ações de aprovação", "rejeição") — `expense-approval-menu.tsx:97, 84`. The receipts dialog also has "ate 10MB" (`expense-receipts-dialog.tsx:113`, should be "até"). | Low | Accent-correct the strings; the rest of the module is accented, so this is an inconsistency. |
| E5 | **No expense detail view** (see C2) — receipts, approval history, rejection reason and the audit trail are split across a dialog and inline text. | Medium | Add an expense detail sheet with an approval timeline (who submitted/approved/rejected, when). |
| E6 | **Approval menu has no confirmation for `approve`/`pay`.** Reject is gated by a reason dialog, but approving or marking paid fires immediately on menu click — easy to mis-click in a dense table. | Low | Add a lightweight confirm (or undo toast) for the irreversible-feeling transitions. |

---

## Screen 4 — Orçamentos / Budgets

**Screenshot:** `33-finance-budgets.png`
**Code:** `budgets/page.tsx`

### What works
- Month selector ("Maio De 2026", prev/next) — Wave 3 B1 closed; past and future months are now reachable.
- Empty state is clear and on-brand.

### Findings

| # | Finding | Impact | Recommendation |
|---|---------|--------|----------------|
| B1 | **Month label capitalization is wrong for pt-BR.** The selector reads "Maio De 2026" — the "De" is title-cased. pt-BR month-year is "maio de 2026" (lowercase month and preposition), or "Maio/2026". Likely a blanket `capitalize` CSS class or a `toLocaleDateString` result that is being word-capitalized. | Low | Format with `Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })` and capitalize only the first letter, or use the `MM/AAAA` form. |
| B2 | **No annual view / copy-forward** (Wave 3 B2, still open) — each month's budget is entered from scratch. | Medium | Add a "duplicar mês anterior" action and a 12-month grid. |
| B3 | **Realized spend still counts only paid expenses** (Wave 3 B3) — with an approval workflow now in place, an `approved` (not yet paid) expense is a committed cost the budget ignores. | Medium | Show approved-but-unpaid as a committed segment on the progress bar. |

---

## Screen 5 — Relatórios / Reports  *(new)*

**Screenshot:** `34-finance-reports.png`
**Code:** `reports/page.tsx`, `aging-table.tsx`, `lib/finance/dre.ts`, `lib/finance/aging.ts`, `lib/finance/accounting-export.ts`

### What works
- Honest scoping copy: the DRE and accountant-export cards state plainly that SPED/ECD/ECF and the official DRE stay with the accountant — sets correct expectations and avoids fiscal liability.
- DRE shows Receita / Despesas / Resultado / Margem with sign-coloured values and a per-category expense breakdown table with share %.
- AR/AP aging is a proper 0-30 / 31-60 / 61-90 / 90+ table with a totals footer (`aging-table.tsx`) — matches Omie's overdue-by-bucket reports.
- "Mês anterior" shortcut button; De/Até inputs have `min`/`max` cross-bounds.

### Findings

| # | Finding | Impact | Recommendation |
|---|---------|--------|----------------|
| R1 | **The De/Até period only drives the DRE and the accountant export — not the aging tables.** `useFinanceAging(currentSector?.id)` (`reports/page.tsx:48`) takes no date argument; aging is always "as of today". A user who sets the period to April and sees the DRE update will reasonably assume the aging below also reflects April. This is a silent correctness-of-perception bug. | High | Either pass an "as-of" date to the aging RPC, or move the aging cards out from under the period selector with a clear "posição atual" caption. |
| R2 | **No loading state for the DRE-vs-aging split.** The DRE card has a skeleton (`dreLoading`), but the two `AgingTable`s and the export count have none — on first load they flash the empty label "Nenhuma fatura em aberto" before data arrives, which reads as "you have no overdue invoices" when you might. | Medium | Thread an `isLoading` into `AgingTable` and render skeleton rows; gate the export button count similarly. |
| R3 | **DRE has no export and no period grouping.** Omie's DRE is month-by-month (a column per month) and exports to PDF/Excel/CSV. ONEmonday's DRE is a single-period snapshot with no export — the only export on the screen is the raw accountant CSV. | Medium | Add "Exportar DRE" (CSV/PDF) and an optional monthly-column DRE view. |
| R4 | **DRE has no revenue breakdown.** Expenses are itemized by category with share %, but revenue is a single `R$ 0,00` number — no by-customer or by-month split, no comparison to the prior period. | Medium | Add a revenue breakdown (by customer or month) and a prior-period delta on Resultado/Margem. |
| R5 | **"Margem 0%" shown even when there is zero revenue.** With no movement the screen shows "Margem 0%", which is technically the zero-revenue fallback but reads as a real 0% margin. | Low | Render "—" for margin when revenue is 0. |
| R6 | **The period card is a bare card with three controls and a lot of empty space** (`34-finance-reports.png`) — visually it looks unfinished next to the dense cards below. | Low | Add a one-line summary in the period card ("Período: 01/05/2026 a 18/05/2026 · 18 dias") or merge the period control into the DRE card header. |
| R7 | **Aging tables show no currency context and no count.** Each row is a party + bucket amounts; there is no "N faturas" and no indication these are BRL only (the module supports 3 currencies). | Low | Add an invoice/expense count per party and a currency note. |

---

## Screen 6 — Conciliação / Bank Reconciliation  *(new)*

**Screenshot:** `35-finance-reconciliation.png`
**Code:** `reconciliation/page.tsx`, `lib/finance/reconciliation.ts`, `lib/finance/ofx.ts`

### What works
- OFX import via a hidden file input with a clear card and an honest note that automatic Open Finance (Pluggy) sync is "disponível quando o agregador estiver configurado".
- The matcher (`suggestReconciliation`) produces per-transaction candidate suggestions and `autoMatchableCount` surfaces "N de M com sugestão de correspondência exata".
- High-confidence suggestions pre-select the first candidate; unmatched and matched are split into two cards; "Desfazer" can reverse a match.
- Tested matching logic (`reconciliation.test.ts`, `ofx.test.ts`).

### Findings

| # | Finding | Impact | Recommendation |
|---|---------|--------|----------------|
| K1 | **No bulk "conciliar tudo" for high-confidence matches.** `autoMatchableCount` already tells the user "N exact matches", but the only way to act is row-by-row: per transaction, open the select (or accept the pre-selection), then click "Conciliar". For a 200-line statement that is 200+ clicks. QuickBooks' bank feed lets you accept all matched transactions at once. | High | Add an "Conciliar N correspondências exatas" button that batch-reconciles every transaction whose suggestion confidence is `high`. |
| K2 | **The reconciliation `Select` has no accessible label.** `reconciliation/page.tsx:291` — the `SelectTrigger` has no `aria-label`/`id`; a screen reader announces an unlabelled combobox. The expense/invoice filter pills got `role="tab"` in Wave 3, but this new control was missed. | Medium | Add `aria-label="Conciliar transação com fatura ou despesa"`. |
| K3 | **No matching tolerance or confidence shown to the user.** `suggestReconciliation` computes a `confidence` (`high`/...) used to pre-select, but the row never displays it — a user cannot tell a high-confidence auto-pick from a guess they should verify. QuickBooks shows a "match" vs "possible match" label. | Medium | Show a confidence badge ("correspondência exata" / "provável") next to the select. |
| K4 | **No date / direction / amount filter on the unmatched list.** A real statement mixes credits and debits; there is no way to isolate "saídas" or "transações de maio". | Low | Add a direction toggle and a date range filter over the unmatched table. |
| K5 | **No running reconciliation summary.** QuickBooks reconciliation always shows beginning balance, cleared total, and the difference-to-zero. ONEmonday shows only counts ("não conciliadas (0)"). A user cannot tell if the statement balances. | Medium | Add a summary strip: imported total, conciliado, pendente, and a difference figure. |
| K6 | **OFX is the only import path and there is no statement/account concept.** Transactions are not grouped by bank account or statement period; re-importing relies on dedup by external id (the toast says "já existente(s)"). There is no list of imported statements to review or delete. | Low | Introduce a bank-account dimension and a statements list; surface which account each transaction belongs to. |
| K7 | **Matched-list "Desfazer" is a `ghost` button with no confirm.** Unreconciling silently reverts a transaction; in a dense list this is an easy mis-click with no undo. | Low | Add a confirm or an undo toast. |

---

## Per-sector access

Sector scoping remains correct on the new screens: `useFinanceDre`, `useFinanceAging`, `useBankTransactions` and the reconcile/import mutations all take `sectorId` and the server actions re-check permissions. Two notes carried from Wave 3 are still open:

- **Low** — The "Selecione um setor" fallback on every new screen (`reports/page.tsx:83`, `reconciliation/page.tsx:113`) is still a bare muted `<p>`, not the `EmptyState` component.
- **Low** — No cross-sector consolidated reports view for an admin/CFO — the DRE and aging are per-sector only.

---

## Quick wins (low effort, high day-to-day value)

1. **C1/I1** — Add `FISCAL_DOC_STATUS_LABELS` + `CHARGE_STATUS_LABELS` and stop rendering raw `authorized`/`received`/`error` tokens.
2. **K1** — "Conciliar N correspondências exatas" bulk button on the reconciliation screen (matcher already produces the data).
3. **R1** — Caption the aging tables "posição atual" (or wire an as-of date) so they are not silently mistaken for the selected period.
4. **R2** — Loading skeletons for the aging tables and export count.
5. **K2/E4** — Add the missing `aria-label` on the reconciliation select; accent-correct "rejeição", "Ações", "até".
6. **B1** — Fix the "Maio De 2026" capitalization to "maio de 2026".
7. **R5** — Show "—" for DRE margin when revenue is 0.
8. **D1** — Fix the 5-KPI row wrapping / inconsistent card heights on the dashboard.

## Strategic bets

- **C2** — Invoice and expense **detail views** (tabbed sheets) — Finance is now the only module without them; Legal got them this wave.
- **K5** — A reconciliation **summary strip** (imported / conciliado / diferença) to make the screen trustworthy as a closing tool.
- **E2/E3** — Receipt **OCR pre-fill** and a **receipt-required policy** — the defining modern expense-management feature (Brex, Ramp).
- **C3** — Search + pagination across all list screens before real data volume arrives.

---

## Sources

- [Bank Reconciliation Software — QuickBooks](https://quickbooks.intuit.com/accounting/bank-reconciliation/)
- [Learn the reconcile workflow in QuickBooks Online — Intuit](https://quickbooks.intuit.com/learn-support/en-us/help-article/reconciliation-reports/learn-reconcile-workflow-quickbooks/L8ZibUuVE_US_en_US)
- [A closer look at the new QuickBooks bank feed and Accounting Agent — Firm of the Future](https://www.firmofthefuture.com/product-update/closer-look-at-quickbooks-bank-feed-and-accounting-agent/)
- [Relatórios: Finanças — Gerando e analisando DRE — Ajuda Omie](https://ajuda.omie.com.br/pt-BR/articles/6672272-relatorios-financas-gerando-e-analisando-dre)
- [Relatórios: Finanças — Contas a Receber em Aberto — Ajuda Omie](https://ajuda.omie.com.br/pt-BR/articles/6846339-relatorios-financas-contas-a-receber)
- [Gerando o Relatório de Contas a Pagar e a Receber Atrasadas — Ajuda Omie](https://ajuda.omie.com.br/pt-BR/articles/1400012-gerando-o-relatorio-de-contas-a-pagar-e-a-receber-atrasadas)
- [ContaAzul Financial APIs — Developers](https://developers.contaazul.com/docs/financial-apis-openapi/v1)
- [What are expense receipts and why should I track them — Brex](https://www.brex.com/spend-trends/expense-management/expense-receipts)
- [The Essential Guide to Expense Management Automation — Brex](https://www.brex.com/spend-trends/expense-management/expense-management-automation)
- [Brex vs Expensify vs Ramp — Ramp](https://ramp.com/blog/brex-vs-expensify-vs-ramp)
</content>
</invoke>

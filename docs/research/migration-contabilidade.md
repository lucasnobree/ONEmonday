# Migration Feasibility & Feature-Gap Analysis — Omie → ONEmonday Finance

**Author:** Product Researcher (sector-researcher standard)
**Date:** 2026-05-18
**Goal:** Assess whether the company can gradually migrate off **Omie** (paid Brazilian cloud ERP, used today by Contabilidade) onto the **ONEmonday Finance module**, to cut software costs.
**Scope:** Analysis only — no application code was modified. Output is this single report.

---

## 1. Executive Summary

Omie is a full Brazilian cloud ERP. The company uses it as its accounting/ERP tool. ONEmonday's Finance module is, today, a **thin internal financial ledger**: invoices (AR), expenses (AP), monthly budgets, and a cash-flow summary — all sector-scoped, money stored as integer cents, soft-deleted, permission-checked. It is well-engineered but immature as a finance *product* (see `docs/research/ux-audit-finance.md`, rated 5.5/10).

**The honest verdict up front:** ONEmonday **can** realistically replace the *internal financial management* slice of Omie — contas a pagar/receber tracking, fluxo de caixa, orçamento, basic reporting — with a focused build effort. ONEmonday **cannot** replace the *fiscal and accounting* slice — emissão de NF-e/NFS-e/NFC-e, conciliação bancária automática, geração de SPED/ECD/ECF, livros contábeis — without becoming a certified fiscal product, which is a multi-year regulated undertaking, not a feature.

**Recommendation:** Treat this as a **partial migration**. Move internal financial management into ONEmonday and cancel the portion of Omie's cost attributable to it. Keep a fiscal/accounting tool (Omie's cheapest fiscal-only tier, a dedicated NF-e emitter, or the accounting firm's own software) for the regulated obligations. A "total migration" off Omie is **not feasible** and pursuing it would expose the company to fiscal non-compliance risk.

---

## 2. Overview of Omie — What It Does

Omie (omie.com.br) is an integrated cloud ERP aimed at Brazilian SMEs. Its modules share one data model, so an invoice feeds inventory, financials and accounting at once. Modules relevant to this company:

| Omie module | What it covers |
|---|---|
| **Gestão Financeira** | Contas a pagar / contas a receber, fluxo de caixa, conciliação bancária, multiple bank accounts, financial reports updated daily, DRE. |
| **Emissão de Notas Fiscais** | NF-e (produtos), NFS-e (serviços, com cálculo de ISS e retenções), NFC-e (varejo, via Omie PDV); MDF-e / CT-e; cancelamentos, devoluções, notas complementares; faturamento em lote; integração direta com SEFAZ e prefeituras; já contempla destaque de IBS/CBS da Reforma Tributária. |
| **Omie.Cash** | Conta digital PJ nativa: pagar contas, receber via PIX, emitir boletos, com conciliação instantânea (sem importar arquivos). |
| **Conciliação Bancária** | Integração automática com internet banking de Itaú, Bradesco, Santander, Caixa; importação de OFX para os demais bancos; várias contas correntes. |
| **Gestão de Compras / Estoque** | Requisição e pedido de compra, posição de estoque, CMC (custo médio), ordens de produção. |
| **Gestão de Vendas / Serviços** | Pedido de venda (baixa estoque + gera contas a receber), ordem de serviço, contratos de serviço, faturamento em lote. |
| **Contabilidade / Painel do Contador** | Integração contábil com qualquer sistema contábil brasileiro; gera Balancete, DRE, Balanço, DFC e livros contábeis; geração de ECD/ECF via SPED; plano de contas x categorias; apuração e contabilização da distribuição de lucros; painel onde o contador acessa dados contábeis, financeiros e fiscais. |

For a company whose use of Omie is centred on **Contabilidade**, the load-bearing modules are: **financial management, fiscal emission, banking integration, and the accounting/SPED integration.** Inventory/purchasing/production matter only if the company also sells physical goods (not assumed here, but flagged below).

---

## 3. Feature Mapping — Omie vs. ONEmonday Finance

Legend: **Yes** = present and usable · **Partial** = data model or primitive exists but workflow incomplete · **No** = absent.

### 3.1 Internal financial management

| Omie feature | ONEmonday has it? | Notes |
|---|---|---|
| Contas a receber (invoice ledger) | **Partial** | `finance_invoices`: number, customer (free text), one amount, status, issue/due date. No line items, no PDF, no sending, no partial payments. |
| Contas a pagar (expense/bill ledger) | **Partial** | `finance_expenses`: vendor (free text), category (8 fixed), amount, status. No due date on payables → no AP scheduling/aging. No approval routing. |
| Fluxo de caixa | **Partial** | `get_finance_summary` RPC: 6-month inflow/outflow from *paid* items + 4 KPIs. No forecast, no opening balance, no period selector, no projected cash. |
| Orçamento (budget vs. realizado) | **Yes (basic)** | `finance_budgets` per category/month + budget-vs-actual chart. Current-month-only in UI; no annual view; no variance figures. |
| Multi-conta bancária / saldos | **No** | No bank-account entity at all. "Caixa Líquido" is paid income − paid expense, not a balance. |
| Conciliação bancária | **No** | No transaction import, no OFX, no matching. Hard gap (see §5). |
| DRE (income statement) | **No** | No P&L grouping by accounting category, no competency-date logic. |
| Categorias de receita/despesa configuráveis | **Partial** | 8 server-enforced expense categories via CHECK constraint; no revenue categories, not configurable, no cost centers. |
| Relatórios financeiros | **Partial** | CSV export per list + dashboard KPIs only. No DRE, no AR/AP aging, no cash-flow report. |
| Multi-moeda | **Partial** | Schema + `money.ts` support BRL/USD/EUR but forms hard-code BRL; sums would mix currencies naively. |
| Comissões | **No** | Not modelled. |
| Medição de inadimplência | **Partial** | `effectiveInvoiceStatus` derives overdue *for display only*; no aging report, no reminders, no default tracking. |

### 3.2 Fiscal documents & banking (the regulated slice)

| Omie feature | ONEmonday has it? | Notes |
|---|---|---|
| Emissão de NF-e | **No** | Requires SEFAZ webservice integration + A1 digital certificate + fiscal logic. Hard blocker. |
| Emissão de NFS-e | **No** | Requires per-município integration + ISS rules + retenções. Hard blocker. |
| Emissão de NFC-e | **No** | Requires SEFAZ + PDV. Hard blocker. |
| Boletos bancários | **No** | Requires bank/PSP integration (CNAB or API), nosso-número, registro. |
| Recebimento via PIX | **No** | Requires PSP integration. |
| Cancelamento / devolução / nota complementar | **No** | Depends on emission existing first. |
| IBS/CBS (Reforma Tributária) | **No** | Ongoing regulatory tracking — only viable inside a maintained fiscal product. |
| Integração bancária automática (Itaú/Bradesco/Santander/Caixa) | **No** | Open Finance / bank-API integrations + ongoing maintenance. |
| Conta digital PJ (Omie.Cash) | **No** | Out of scope for an internal tool. |

### 3.3 Accounting / SPED

| Omie feature | ONEmonday has it? | Notes |
|---|---|---|
| Integração contábil (plano de contas, exportação p/ sistema contábil) | **No** | No chart of accounts, no contábil export layout. |
| Geração de SPED / ECD / ECF | **No** | Legally formatted government files — requires certified accounting logic. Hard blocker. |
| Balancete / Balanço / DFC / livros contábeis | **No** | Formal accounting outputs. |
| Apuração de impostos / DAS / guias | **No** | Tax calculation and government guides. |
| Painel do Contador (acesso do contador) | **No** | No external-accountant role/portal. |

### 3.4 Operations (only relevant if the company sells physical goods)

| Omie feature | ONEmonday has it? | Notes |
|---|---|---|
| Estoque / posição de estoque / CMC | **No** | No inventory module in Finance. |
| Pedido de compra / requisição | **No** | No purchasing module. |
| Pedido de venda / ordem de serviço | **No** | No sales-order/OS module. CRM module exists separately but is not wired to Finance. |

---

## 4. Prioritized Migration Backlog

What ONEmonday Finance must build to absorb the **internal financial management** workload from Omie. Effort: **S** ≈ days, **M** ≈ 1–2 weeks, **L** ≈ 3+ weeks. "Blocker" = required before the company can stop using Omie for that workflow; "Nice" = improves parity but not gating.

| # | Item | Effort | DB migration? | Blocker / Nice |
|---|---|---|---|---|
| 1 | **Bank-account entity + balances** — `finance_bank_accounts` (name, bank, opening balance, currency); link invoices/expenses to an account. Foundation for true cash position. | M | **Yes** | Blocker |
| 2 | **Manual bank-statement / transaction import (OFX/CSV)** — `finance_transactions` table + OFX parser + manual "reconcile to invoice/expense" matching. Replaces Omie's manual conciliation; **not** automatic bank integration (see §5). | L | **Yes** | Blocker |
| 3 | **Due date on expenses (payables) + AP scheduling/aging** — add `due_date` to `finance_expenses`; "a pagar" view by due date; AP aging buckets. Today payables cannot be scheduled. | M | **Yes** | Blocker |
| 4 | **Partial payments / payment records** — `finance_payments` (amount, date, method, account); derive invoice/expense status from balance. Omie tracks partial receipts; ONEmonday is binary paid/unpaid. | M | **Yes** | Blocker |
| 5 | **DRE / P&L report** — group revenue and expense by accounting category over a period (competency or cash basis). Core of "Contabilidade" use. | M | Maybe (revenue categories) | Blocker |
| 6 | **Configurable categories + revenue categories + cost centers** — replace the 8 fixed CHECK-constraint expense categories with a `finance_categories` table; add income categories. Needed for a meaningful DRE. | M | **Yes** | Blocker |
| 7 | **AR/AP aging reports** — invoices and bills bucketed 0-30/31-60/61-90/90+, per customer/vendor. Standard collections/payables tool. | M | No | Blocker |
| 8 | **Cash-flow report with period selector + projection** — extend `get_finance_summary` beyond fixed 6 months; project from unpaid AR/AP due dates. | M | No (RPC change) | Blocker |
| 9 | **Customer/vendor as linked entities** — bind invoice `customer_name`/expense `vendor_name` to CRM companies/contacts (combobox). Prevents duplicate parties, enables per-party aging. | M | **Yes** (FK columns) | Nice (but needed for trustworthy aging) |
| 10 | **Invoice line items + PDF generation + "Enviar"** — itemized lines (qty × unit price), branded PDF, email send. Lets ONEmonday produce a real (non-fiscal) commercial invoice/proforma. | L | **Yes** | Nice |
| 11 | **Recurring invoices & expenses** — payroll, rent, SaaS recur monthly; auto-generate. | M | **Yes** | Nice |
| 12 | **Expense approval workflow** — submitter → approver → paid, threshold routing. Internal control Omie does not even strongly enforce. | L | **Yes** | Nice |
| 13 | **Receipt/attachment capture on expenses** — upload image/PDF per expense (Supabase Storage). Document trail for the accountant. | M | **Yes** | Nice |
| 14 | **Accounting export** — CSV/structured export of categorized transactions in a layout the external accountant can import. Bridges ONEmonday to the (retained) accounting tool. | S–M | No | Blocker (if accountant stays external) |
| 15 | **Cross-sector consolidated view** — company-wide finance roll-up for admin/CFO. Omie shows one company whole; ONEmonday is sector-scoped. | M | No | Nice |
| 16 | **Annual budget view + variance + duplicate-month** — see `ux-audit-finance.md` B1–B5. | M | No | Nice |
| 17 | **Search, sort, pagination, bulk actions on lists** — see `ux-audit-finance.md` C1–C2; gating for real data volumes. | M | No | Blocker (operational) |

**Items NOT in this backlog because they are not feasible as ONEmonday features:** NF-e/NFS-e/NFC-e emission, boletos, PIX, automatic bank integration, SPED/ECD/ECF generation, formal livros contábeis, tax calculation/DAS. See §5.

---

## 5. Migration Verdict — Honest Assessment

### 5.1 What ONEmonday can realistically own (internal financial management)

With backlog items 1–9, 14 and 17 done, ONEmonday Finance can credibly replace Omie for:

- Tracking contas a receber and contas a pagar with due dates, partial payments and aging.
- Cash-flow visibility and projection across bank accounts.
- Monthly/annual budgeting and budget-vs-actual.
- A management **DRE / P&L** for internal decision-making.
- A categorized transaction export the external accountant consumes.

This is real cost savings: the day-to-day financial control that finance/admin staff do in Omie can move into ONEmonday, which the company already runs and pays for.

### 5.2 What is NOT feasible to replicate quickly — or at all

These are **hard blockers** rooted in regulation, not engineering backlog. They should be stated plainly to stakeholders:

- **Emissão de documentos fiscais (NF-e / NFS-e / NFC-e).** Not a feature — a regulated capability. It requires: integration with each SEFAZ webservice (NF-e/NFC-e) and with *every município's* NFS-e system (no national standard), a valid **A1/A3 digital certificate**, correct tax computation (ICMS, ISS, IPI, PIS/COFINS, retenções), handling of cancelamento/devolução/carta de correção, contingency modes, and **continuous compliance maintenance** — including the IBS/CBS Reforma Tributária transition. Building and certifying this is a multi-year, dedicated-product effort and an ongoing liability. **ONEmonday should not attempt this.**

- **Conciliação bancária automática and boletos/PIX.** Automatic bank-feed integration depends on per-bank APIs / Open Finance agreements and ongoing maintenance. Issuing registered boletos and receiving PIX requires a bank or licensed PSP integration. ONEmonday can offer *manual OFX import + manual matching* (backlog item 2) — a usable substitute — but not Omie's automatic, instantaneous reconciliation or native conta digital (Omie.Cash).

- **Contabilidade formal / SPED.** ECD, ECF, SPED Fiscal, Balancete, Balanço, DFC, livros contábeis, apuração de impostos are **legally formatted obligations** that must be produced by a certified accounting tool and/or a registered accountant (contador). ONEmonday's "DRE" can only be a *management* P&L, not the official Demonstração de Resultado filed with the books. This work stays with the accountant.

### 5.3 The distinction the company must accept

| ONEmonday can realistically own | Must stay with a certified tool / an accountant |
|---|---|
| AR/AP tracking, due dates, partial payments | Emissão de NF-e / NFS-e / NFC-e |
| Cash flow, projection, bank-account balances | Conciliação bancária automática, boletos, PIX |
| Budgeting, budget-vs-actual, variance | SPED / ECD / ECF, livros contábeis |
| Management DRE/P&L, AR/AP aging | Apuração de impostos, DAS, guias |
| Categorized export to the accountant | Balanço, Balancete, DFC oficiais |
| Receipt capture, expense approval | IBS/CBS / Reforma Tributária compliance |

**Bottom line:** A *full* migration off Omie is **not feasible** and should not be promised. A *partial* migration is feasible and worthwhile: ONEmonday absorbs internal financial management; the company keeps a slim fiscal/accounting solution (Omie's lowest fiscal tier, a standalone NF-e/NFS-e emitter, or the contador's own software) for the regulated obligations. Cost saving = the difference between Omie's full plan and that slim fiscal-only retention.

---

## 6. Recommended Phased Migration Order

**Phase 0 — Decide the fiscal landing zone (before any build).**
Confirm with the company's accountant which tool will retain NF-e/NFS-e emission and SPED. Nothing below removes that dependency. Establish the categorized-export format the accountant needs (drives backlog #6 and #14).

**Phase 1 — Foundations (backlog #1, #3, #6, #17).**
Bank accounts, expense due dates, configurable + revenue categories, and list usability (search/sort/pagination). Until categories and accounts exist, no meaningful report can be built. No user migration yet — build only.

**Phase 2 — Core ledger parity (backlog #4, #7, #8, #9).**
Partial payments, AR/AP aging, period-aware cash flow, customer/vendor linkage. At the end of Phase 2, **start dual-running**: enter new invoices/expenses in both Omie and ONEmonday for one closing cycle to validate totals.

**Phase 3 — Reporting & cutover (backlog #5, #14, #5's DRE, #16).**
Management DRE, accounting export, annual budget/variance. Once a full month reconciles between systems, **cut over internal financial management to ONEmonday** and downgrade Omie to its fiscal-only scope.

**Phase 4 — Workflow polish (backlog #10, #11, #12, #13, #15).**
Invoice PDF/send, recurring items, expense approval, receipt capture, consolidated view. These deepen value but are not gating for the cost cut.

**What never gets a phase:** fiscal emission, automatic bank integration, SPED. These remain outside ONEmonday permanently.

---

## 7. Sources

Omie official:
- [Funcionalidades do ERP online — Finanças (Omie)](https://www.omie.com.br/modulos/financas/)
- [Conciliação bancária (Omie)](https://www.omie.com.br/funcionalidades/conciliacao-bancaria/)
- [Sistema para emissão de nota fiscal (Omie)](https://www.omie.com.br/funcionalidades/nota-fiscal/)
- [Sistema de Gestão ERP Online — página inicial (Omie)](https://www.omie.com.br/)
- [Sistema para contador — Painel do Contador (Omie)](https://www.omie.com.br/funcionalidades/painel-do-contador/)
- [Contadores — contabilidade digital (Omie)](https://www.omie.com.br/contadores/)
- [Emissão automática de nota fiscal (Blog Omie)](https://www.omie.com.br/blog/emissao-automatica-nota-fiscal/)

Omie help center (Ajuda Omie):
- [Compras e Estoque (Ajuda Omie)](https://ajuda.omie.com.br/pt-BR/collections/89844-compras-e-estoque)
- [Relatórios: Compras, Estoque e Produção — CMV/CPV (Ajuda Omie)](https://ajuda.omie.com.br/pt-BR/articles/3545867-relatorios-compras-estoque-e-producao-cmv-cpv)
- [Cadastrando um novo Pedido de Venda (Ajuda Omie)](https://ajuda.omie.com.br/pt-BR/articles/498865-cadastrando-um-novo-pedido-de-venda)
- [Serviços e NFS-e (Ajuda Omie)](https://ajuda.omie.com.br/pt-BR/collections/89873-servicos-e-nfs-e)
- [Passo 3 — Integração Contábil: Layout e Sistema Contábil (Ajuda Omie)](https://ajuda.omie.com.br/pt-BR/articles/1852450-passo-3-integracao-contabil-a-layout-e-sistema-contabil)
- [Passo 3 — Integração Contábil: Categorias x Plano Contábil (Ajuda Omie)](https://ajuda.omie.com.br/pt-BR/articles/1885612-passo-3-integracao-contabil-e-categorias-x-plano-contabil)

ONEmonday codebase:
- `supabase/migrations/00070_finance.sql` — Finance schema (`finance_invoices`, `finance_expenses`, `finance_budgets`, `get_finance_summary` RPC)
- `apps/web/lib/validations/finance.ts`, `apps/web/lib/finance/money.ts`, `apps/web/lib/finance/invoice-status.ts`, `apps/web/lib/actions/finance/invoices.ts`
- `docs/research/ux-audit-finance.md` — existing UX audit of the Finance module

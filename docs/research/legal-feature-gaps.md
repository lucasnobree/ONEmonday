# Legal Module (Juridico) — Feature Gap Analysis

**Date:** 2026-05-15
**Author:** Legal module engineer
**Scope:** Greenfield scope definition for the ONEmonday Legal module. Today the
module is an empty `ComingSoon` placeholder; this document benchmarks
leading legal / contract-lifecycle-management (CLM) products and defines a
prioritized first wave (`feat/legal-wave2`).

---

## 1. Method

There is no existing Legal code to audit — the route `app/(dashboard)/legal`
renders only a `ComingSoon` placeholder, and no `legal` module row, tables,
actions or hooks exist. So this analysis works the other way round: it
benchmarks five widely-adopted CLM / legal-ops products, extracts the
table-stakes feature set, and maps it onto the ONEmonday platform
conventions (sector scoping, RLS, server actions, TanStack Query) already
established by the HR, CRM and Support modules.

## 2. Competitor benchmarks

- **Ironclad** — AI CLM. Central **contract repository** with OCR search;
  a **contract status** model that is *automatically* derived from effective
  date, expiration date and auto-renewal type (Active / Inactive plus
  sub-statuses Evergreen, Auto-Renewing, Expiring); a built-in **contract
  reminder** engine that fires configurable alerts (e.g. "90 days before
  renewal, notify procurement + legal ops" for vendor agreements over a
  threshold). ([Ironclad CLM](https://ironcladapp.com/product/ai-based-contract-management),
  [Contract reminder software](https://ironcladapp.com/journal/contract-management/contract-reminder-software),
  [Contract & record status](https://support.ironcladapp.com/hc/en-us/articles/17438784927127-Contract-and-Record-Status-Overview))
- **DocuSign CLM** — automates the lifecycle from **intake → negotiation →
  storage → renewal**. A **Legal Intake form** captures structured details
  from internal stakeholders requesting legal work; intake **routes by request
  type** to specific queues, with multi-step approval stages and SLAs
  (e.g. 24h response for high priority). Post-signature **obligation
  management** tracks commitments and escalates overdue items.
  ([DocuSign CLM](https://www.docusign.com/products/clm),
  [Legal Intake form setup](https://www.esignglobal.com/blog/docusign-clm-setup-legal-intake-form-self-service-requests-portal),
  [Managing obligations post-signature](https://www.esign.ai/blog/manage-contract-obligations-post-signature-clm))
- **Juro** — browser-native CLM. **Legal-owned templates** with smart fields
  and **locked clauses**; a **clause library** of pre-approved fallback
  language reused across contracts; automated **approval workflows** triggered
  by conditions (value threshold, governing-law jurisdiction).
  ([Automated templates](https://juro.com/learn/automated-templates),
  [Contract playbooks](https://juro.com/learn/contract-playbook),
  [CLM requirements 2024](https://juro.com/learn/contract-lifecycle-management-requirements))
- **ContractWorks** — budget-friendly CLM focused on getting contracts "out of
  file cabinets". **Smart Tagging** auto-extracts agreement type, parties,
  effective / termination dates, initial & renewal terms and termination-notice
  windows; **automated alerts** for renewal deadlines, expirations and
  termination-notice windows; custom portfolio reports.
  ([ContractWorks vs LinkSquares](https://www.contractworks.com/contractworks-vs-linksquares))
- **LinkSquares** — AI repository search across the whole portfolio plus
  real-time **dashboards** giving legal and finance a view of contract status,
  risk and exposure. ([ContractWorks vs LinkSquares](https://www.contractworks.com/contractworks-vs-linksquares))

## 3. Distilled table-stakes feature set

Across all five products the recurring, non-negotiable capabilities are:

1. A **central contract repository** with structured metadata (counterparty,
   type, value, effective / expiration dates, owner).
2. A **lifecycle status** model — draft → in review → approval → active →
   expired / terminated / renewed.
3. **Renewal & expiry tracking** with proactive alerts and explicit handling of
   the *termination-notice window* and *auto-renew* cases.
4. A **legal request intake** queue — internal stakeholders submit matters
   (contract review, advice, dispute), which are triaged and assigned.
5. A **clause / template library** of pre-approved reusable language.
6. A **dashboard** surfacing status mix, upcoming renewals and the open-matter
   backlog.

## 4. Prioritized scope

Priority key: **P0** = security/data foundation, **P1** = table-stakes MVP,
**P2** = next wave, **P3** = future.

| #  | Capability | Priority | Wave 2? |
|----|-----------|----------|---------|
| L1 | `legal` module registration + `sector_modules` enablement + permissions + RLS on every table | **P0** | Yes |
| L2 | Contract repository: CRUD, counterparty, type, value, currency, owner, dates | **P1** | Yes |
| L3 | Contract lifecycle status (draft / in_review / approved / active / expiring / expired / renewed / terminated) | **P1** | Yes |
| L4 | Renewal & expiry tracking: expiry date, renewal type (none / auto / optional), notice-period days, derived renewal/expiry status + alerts | **P1** | Yes |
| L5 | Legal matters / requests intake: type, priority, status, requester, assignee | **P1** | Yes |
| L6 | Clause & template library: reusable approved clauses grouped by category | **P1** | Yes |
| L7 | Legal dashboard: status mix, upcoming renewals, expiring contracts, open matters | **P1** | Yes |
| L8 | Focused Vitest unit tests (renewal/expiry date logic, Zod) + Playwright E2E | **P1** | Yes |
| L9 | Contract document upload (private Storage bucket) + version history | **P2** | No (next wave) |
| L10 | Approval workflows with conditional routing (value/jurisdiction thresholds) | **P2** | No (next wave) |
| L11 | Obligation tracking & post-signature compliance checklists | **P2** | No (next wave) |
| L12 | Native e-signature integration | **P3** | No |
| L13 | AI metadata extraction / Smart Tagging from uploaded PDFs | **P3** | No |
| L14 | Cross-portfolio risk & exposure analytics | **P3** | No |

## 5. Wave 2 scope (this branch)

Delivered on `feat/legal-wave2`:

1. **L1** — migration `00080` registers the `legal` module (status `active`),
   adds `sector_modules` enablement rows, registers `contract` / `clause` /
   `legal_matter` permissions, grants them to the role hierarchy, and enables
   RLS on every new table via `user_has_sector_access` / `user_has_permission`.
2. **L2 + L3 + L4** — `legal_contracts` table + repository page: lifecycle
   status, counterparty, type, value, effective/expiry dates, renewal type and
   notice-period days. A pure `lib/legal/renewal.ts` module derives renewal and
   expiry status (mirrors Ironclad's auto-derived status) used by the UI and
   the dashboard.
3. **L5** — `legal_matters` table + intake page: matter type, priority, status,
   description, requester and assignee.
4. **L6** — `legal_clauses` table + clause library page: approved reusable
   clauses grouped by category.
5. **L7** — Legal dashboard: contract status mix, contracts needing renewal
   attention, and the open-matter backlog.
6. **L8** — Vitest unit tests for the renewal/expiry date logic and the Zod
   validators; a Playwright spec `e2e/legal.spec.ts`.

## 6. Deliberately deferred (next wave)

- L9 contract document upload + version history.
- L10 conditional approval workflows.
- L11 obligation tracking & compliance checklists.
- L12 e-signature, L13 AI extraction, L14 portfolio risk analytics.

## Sources

- Ironclad — AI contract management: <https://ironcladapp.com/product/ai-based-contract-management>
- Ironclad — contract reminder software: <https://ironcladapp.com/journal/contract-management/contract-reminder-software>
- Ironclad — contract & record status: <https://support.ironcladapp.com/hc/en-us/articles/17438784927127-Contract-and-Record-Status-Overview>
- DocuSign — CLM product: <https://www.docusign.com/products/clm>
- DocuSign CLM — legal intake form setup: <https://www.esignglobal.com/blog/docusign-clm-setup-legal-intake-form-self-service-requests-portal>
- DocuSign CLM — managing obligations post-signature: <https://www.esign.ai/blog/manage-contract-obligations-post-signature-clm>
- Juro — automated contract templates: <https://juro.com/learn/automated-templates>
- Juro — contract playbooks: <https://juro.com/learn/contract-playbook>
- Juro — CLM requirements: <https://juro.com/learn/contract-lifecycle-management-requirements>
- ContractWorks vs LinkSquares comparison: <https://www.contractworks.com/contractworks-vs-linksquares>

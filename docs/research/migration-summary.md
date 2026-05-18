# ONEmonday — Migration Feasibility Summary

Can the company drop the paid tools it uses today and run on ONEmonday to cut
costs? Researched per area against official sources. Detail:
`migration-rh.md`, `migration-comercial.md`, `migration-contabilidade.md`.

**Short answer:** partially — and the honest split matters. ONEmonday can take
over the *internal management* layer (people management, sales CRM, internal
financial control) with safe, real savings. It cannot take over the
*regulated* layer (payroll, electronic time-clock, fiscal-document emission,
marketing email infrastructure) — those carry legal/fiscal liability and
should stay on specialist vendors.

## Verdict per system

| System | Area | Verdict | Why |
| --- | --- | --- | --- |
| Teams / WhatsApp alerts | RH | ✅ Replaceable | Only in-app notifications today; a webhook/dispatch layer is a focused build |
| Sólides (people mgmt) | RH | 🟡 Partial | Directory/onboarding exist; recruitment/performance/surveys buildable; behavioral Profiler is proprietary |
| Folha Flash (payroll) | RH | ❌ Keep | eSocial + INSS/IRRF/FGTS — regulated, permanent fiscal liability |
| Tangerino (ponto) | RH | ❌ Keep | Portaria 671/2021 requires REP-P certification |
| Flash (benefits card) | RH | ❌ Keep | A Visa-branded fintech product — out of scope |
| Pipedrive | Comercial | ✅ Replaceable | ONEmonday CRM is already a Pipedrive-class model |
| RD Station CRM | Comercial | ✅ Replaceable | Replaceable; WhatsApp integration is the one decision point |
| RD Station Marketing | Comercial | ❌ Not near-term | No email/ESP, landing pages, or automation engine — a multi-quarter build |
| Omie | Contabilidade | 🟡 Partial | Internal financial mgmt yes; NF-e emission, bank reconciliation, SPED — no |

## Where the safe savings are

Highest-confidence, lowest-risk cost reduction — pursue these first:

1. **Both sales CRMs (Pipedrive + RD Station CRM).** ONEmonday's CRM is
   architecturally a peer; the gaps are usability and a few fields, mostly
   small/medium effort. This is the strongest migration case.
2. **Sólides people-management modules** — directory, onboarding, recruitment,
   performance, engagement surveys. Medium effort, no legal gate.
3. **Teams/WhatsApp alerting** — a notification dispatch layer ONEmonday lacks
   entirely today; small/medium effort, immediately useful platform-wide.
4. **Internal financial management** (the ONEmonday-ownable slice of Omie) —
   AP/AR tracking, cash flow, budgets, aging, a management DRE, accountant
   export.

## What must NOT be promised as a replacement

These have hard legal/fiscal/infrastructure blockers — keep the specialist
tool (or the accountant):

- **Payroll** (Folha Flash) — eSocial transmission, statutory calculations.
- **Electronic time-clock** (Tangerino) — REP-P certification, Portaria 671.
- **Fiscal document emission** (Omie NF-e/NFS-e) — SEFAZ integration, A1
  certificate, continuous tax-compliance maintenance incl. the Reforma
  Tributária (IBS/CBS).
- **Bank reconciliation / boletos / PIX** — per-bank APIs, Open Finance, PSP
  licensing. ONEmonday can do manual OFX import only.
- **Marketing automation / email sending** (RD Station Marketing) — needs an
  ESP, domain authentication, deliverability, an automation runtime.

## Recommended phased migration roadmap

- **Phase 0 — prerequisites.** Fix the HR audit defects (`ux-audit-hr.md` — the
  time-off `policyId` bug, read-only recruitment, native dialogs) and tighten
  `hr_employees` RLS before any salary/PII data lands (LGPD). Decide the fiscal
  "landing zone" for Omie before touching Finance.
- **Phase 1 — alerting.** Build the Teams/WhatsApp/email notification dispatch.
- **Phase 2 — sales CRM.** Close the CRM quick gaps (edit/delete CRUD, deal
  owner, task management via the existing `scheduled_at`/`completed_at`,
  filtering) and migrate Pipedrive + RD Station CRM off.
- **Phase 3 — people management.** Build out recruitment, performance and
  engagement surveys; migrate the Sólides people-ops modules.
- **Phase 4 — internal finance.** Build the ownable Omie slice (aging, DRE,
  accountant export); downgrade Omie to fiscal-only.
- **Phase 5 — optional, gated.** Marketing automation — only if RD Station
  Marketing's licence cost clearly justifies a major multi-quarter build.

## Bottom line

Realistic outcome: the company can retire **Pipedrive, RD Station CRM and the
Sólides people-management subscription**, add alerting it does not have today,
and shift internal financial control into ONEmonday — meaningful, low-risk
savings. **Folha Flash, Tangerino, the Flash card, Omie's fiscal core, and
RD Station Marketing should stay** — replacing them costs more (in build and
in compliance risk) than the licences save.

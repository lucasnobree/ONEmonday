# ONEmonday — Total-Migration Architecture Plan

**Author:** Solutions Architecture · **Date:** 2026-05-18
**Status:** Analysis & planning only — no application code modified.
**Builds on:** `migration-summary.md`, `migration-rh.md`, `migration-comercial.md`,
`migration-contabilidade.md`, `ux-audit-summary.md`.

---

## 0. Premise and the strategy correction

The prior research concluded that several systems "should stay on specialist
vendors." That conclusion was correct **for a build-from-scratch strategy**. The
company has now made a different decision: it wants to **consolidate onto
ONEmonday as its single platform** and stop paying the vendor stack — a *total*
migration — by **integrating certified third-party gateways under ONEmonday's
own UI**.

This is exactly how Omie and RD Station themselves operate. Omie does not run
SEFAZ; it integrates SEFAZ webservices. RD Station does not run mail servers;
it orchestrates sending infrastructure. ONEmonday can do the same: **own the
data, the workflow and the UI; rent the regulated/infrastructure capability
from a certified gateway via API.**

This reframes every "❌ Keep" verdict from the earlier research. "Keep Folha
Flash" becomes "integrate an eSocial/payroll engine API." "Keep Omie's fiscal
core" becomes "integrate a fiscal-emission API (Focus NFe / PlugNotas)." The
nine paid systems are still in scope for *retirement* — the company stops
paying **Sólides, Flash, Folha Flash, Tangerino, RD Station Marketing, RD
Station CRM, Pipedrive and Omie** as products — but four of them are replaced by
ONEmonday-UI-over-a-gateway rather than by native ONEmonday code.

What does **not** change: the company still needs an accountant, still needs a
digital certificate, still has fiscal liability. A gateway moves the *software*
cost and the *integration* burden; it does not move the *legal* responsibility.
Section 6 is honest about exactly where the residual risk and cost stay.

---

## 1. Target architecture — ONEmonday as the single platform

### 1.1 Current platform shape (from the codebase)

ONEmonday is a Next.js (a customised fork — see `apps/web/AGENTS.md`) app on
Supabase (Postgres + RLS + Storage + Auth). Established, working patterns the
integration layer must respect:

- **Server actions** (`apps/web/lib/actions/**`) are the only write path. Each
  action: `createClient()` → `auth.getUser()` → Zod `safeParse` →
  `getUserPermissions` / `hasPermission` → DB write → `revalidatePath`. See
  `lib/actions/finance/invoices.ts` as the reference shape.
- **Postgres RLS** with per-sector scoping (`user_sector_roles`,
  `user_has_permission(...)`) on every table; money stored as integer cents;
  soft deletes.
- **In-app notifications only** — `notifications` and `notification_preferences`
  tables exist (migration `00003`); `notification_preferences.channel` already
  has a `CHECK IN ('in_app','email','both','none')` enum, but **no outbound
  channel code exists anywhere in `lib/`**. This is the seam the dispatch layer
  plugs into.
- 23 migrations `00001`–`00100`, one per module. No external-integration tables,
  no secrets table, no job/queue, no webhook endpoint exist today.

### 1.2 The integration layer — design

A total migration requires one new architectural layer that ONEmonday does not
have today: a **provider-integration layer**. It has five parts.

**(a) Provider-adapter pattern.** Every external capability is defined as a
TypeScript interface; each gateway is one implementation. The rest of the app
depends on the interface, never on the vendor.

```
lib/integrations/
  fiscal/        FiscalProvider          → FocusNfeAdapter, PlugNotasAdapter
  banking/       BankingProvider         → PluggyAdapter, BelvoAdapter
  payments/      PaymentProvider         → AsaasAdapter, EfiAdapter   (PIX/boleto)
  payroll/       PayrollProvider         → <payroll/eSocial engine adapter>
  timeclock/     TimeclockProvider       → <REP-P vendor adapter>
  email/         EmailProvider           → SesAdapter, ResendAdapter
  messaging/     MessagingProvider       → WhatsAppCloudAdapter, TeamsWorkflowAdapter
  registry.ts    resolve(capability, sectorId) → configured adapter
```

Rationale: provider risk is real (price changes, outages, a municipality a
fiscal provider does not cover). Swapping `FocusNfeAdapter` for
`PlugNotasAdapter` must be a config change, not a rewrite. This also lets
different sectors use different providers if ever needed.

**(b) Outbound calls live behind server actions.** Adapters are server-only
modules called from server actions, exactly like every existing write. No
browser ever holds a provider key or calls a provider directly. A fiscal
emission is `lib/actions/finance/fiscal.ts → emitNfe()` → permission check →
`FiscalProvider.emit()` → persist the returned protocol/PDF/XML to a new
`finance_fiscal_documents` table + Supabase Storage.

**(c) Inbound webhooks — a new route group.** Gateways report results
asynchronously (an NF-e is *authorised* seconds later by SEFAZ; a bank
transaction *arrives* hours later; an email *bounces* days later). ONEmonday has
no inbound HTTP surface today. Add `app/api/webhooks/{fiscal,banking,payments,email,messaging}/route.ts`:

- Verify the provider's signature/HMAC before doing anything.
- Write the raw payload to a `webhook_events` table (idempotency key =
  provider event id; replay-safe).
- Update the domain row (fiscal doc → `authorized`; transaction → inserted;
  email → `bounced`).
- These routes use the Supabase **service role** (no user session on an inbound
  call) and must therefore enforce scoping in code, not via RLS.

**(d) Secret management — a real gap to close.** There is no secrets store
today. Provider API keys, and especially the **A1 digital certificate**, must
never sit in `.env` committed anywhere or in a plaintext column. Design:

- A `integration_credentials` table: `sector_id`, `provider`, `capability`,
  encrypted `secret` (pgcrypto / Supabase Vault), `metadata jsonb`, RLS so only
  global-admins can read; server actions read via a `SECURITY DEFINER` RPC.
- The A1 certificate (`.pfx`/`.p12` + password) is the most sensitive object in
  the whole platform. Preferred path: **the fiscal gateway custodies the
  certificate** (Focus NFe, PlugNotas and NFe.io all support uploading the A1
  to them) so ONEmonday never stores it. ONEmonday stores only the gateway API
  token. This is a deliberate liability-reduction choice.

**(e) The notification dispatch layer.** Generalise the existing
`notifications` table into a dispatch pipeline:

- `notification_outbox` — every dispatchable event enqueued with target
  channel(s) resolved from `notification_preferences`.
- A worker (Supabase scheduled function / pg_cron, or a small queue route)
  drains the outbox and calls `MessagingProvider` / `EmailProvider`.
- Channels: in-app (exists), email (SES/Resend), Microsoft Teams (Workflows
  webhook), WhatsApp (Cloud API). All four implement the same
  `MessagingProvider.send()` contract.

### 1.3 Cross-cutting infrastructure this introduces

| New primitive | Why total migration needs it | Used by |
|---|---|---|
| `webhook_events` table + signature verify | Gateways are async | fiscal, banking, payments, email |
| `integration_credentials` (encrypted) | Provider keys + certificate | all gateways |
| `notification_outbox` + worker | Multi-channel dispatch | alerts, all modules |
| A background job runner (pg_cron / scheduled fn) | Recurring sync, retries, the marketing automation engine | banking sync, outbox, automation |
| `integration_logs` / audit | Debuggability + LGPD/fiscal traceability | all gateways |
| Idempotency keys on every outbound call | Avoid double-emitting an NF-e / double-charging | fiscal, payments |

These are the genuine "platform tax" of a total migration. They are shared, so
they are built **once** in Phase 0/1 and amortised across all nine systems.

---

## 2. Per-system migration approach (all 9 systems)

Legend — **Native** = ONEmonday builds the feature in app code. **Gateway** =
ONEmonday builds UI/data/workflow over a third-party API. **Hybrid** = native
data + workflow, gateway only for the regulated/infra step.

### 2.1 Teams / WhatsApp alerts — **Native (dispatch) + Gateway (channels)**

ONEmonday builds the outbox + worker + event triggers natively; the actual
send goes through gateways:

- **Microsoft Teams.** The classic Incoming Webhook / Office 365 Connector is
  being **retired — connectors disabled 18–22 May 2026** ([Microsoft 365 Dev
  Blog](https://devblogs.microsoft.com/microsoft365dev/retirement-of-office-365-connectors-within-microsoft-teams/)).
  The supported replacement is a **Workflows (Power Automate) webhook**: a
  channel owner creates a Workflow that exposes an HTTP trigger URL; ONEmonday
  POSTs an Adaptive Card / MessageCard payload to it
  ([Microsoft Learn](https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook)).
  Cost: **free**. Effort: S.
- **WhatsApp.** Use the **WhatsApp Business Cloud API** (Meta-hosted). Requires
  a Meta Business account, a verified WhatsApp Business number, and
  pre-approved **message templates** for business-initiated messages. Billing
  is per-message since 1 Jul 2025: Brazil **utility** messages ≈ **US$0.0068**
  each (first 1,000/mo, cheaper above), **marketing** ≈ **US$0.0625**; messages
  inside an open 24h service window are free
  ([Meta pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing),
  [flowcall guide](https://www.flowcall.co/blog/whatsapp-business-api-pricing-2026)).
  HR/ops alerts are almost all *utility* category — very cheap. Effort: M
  (Meta verification + template approval is the slow part, not the code).
- **Email channel** — see 2.8 (shares the ESP with Marketing).

ONEmonday builds: outbox, worker, per-event triggers (leave approved, doc
expiring, onboarding overdue, deal stage change, invoice overdue, ticket SLA).
Gateway does: final delivery. **Retires the manual Teams/WhatsApp process.**

### 2.2 Sólides (people management) — **Native**

No regulated gate on recruitment, performance, 9Box, PDI, engagement surveys.
This is ordinary product work on the existing HR module (`migration-rh.md`
backlog #3–#7, #10). Build natively in ONEmonday. **One honest exception:** the
Sólides **Profiler** behavioral methodology is proprietary IP — ONEmonday can
build a generic DISC-style assessment but cannot replicate Profiler. If the
behavioral engine is essential, the only true replacement is *integrating a
behavioral-assessment provider*; otherwise accept a generic assessment.
**Recommendation: Native build; accept the Profiler gap.** Retires the Sólides
people-management subscription.

### 2.3 Folha Flash (payroll) — **Hybrid: native data, gateway engine + eSocial**

This is the verdict that flips most under the gateway strategy. ONEmonday does
**not** build a payroll calculation engine and does **not** transmit eSocial
itself. Instead:

- ONEmonday natively owns the **HR system-of-record**: employees, CLT/DP fields
  (PIS, CTPS, CBO, admissão/desligamento, dependentes), salary, cost centre,
  approved leave, and — once 2.4 lands — the consolidated journey/overtime that
  feeds payroll.
- A **payroll/eSocial engine** is integrated via API as the `PayrollProvider`.
  eSocial events are XML over SOAP-with-TLS signed with an **A1 certificate**
  ([sped-esocial reference](https://github.com/nfephp-org/sped-esocial)).
  Building and *maintaining* that against constantly-changing layouts (eSocial
  1.3, DCTFWeb coupling) is the work no one should do from scratch.
- **Candidate providers:** the realistic options are (a) a payroll-engine SaaS
  exposing an API the company drives from ONEmonday, or (b) keeping payroll
  **with the accountant**, who already owns eSocial responsibility, and
  ONEmonday simply exports the monthly payroll-input file to them.
- **Recommendation:** integrate at the *boundary the accountant already
  operates*. ONEmonday becomes the single place HR data is entered and the
  payroll-input package is generated; the accountant's system (or a payroll API
  under contract) does calculation + eSocial transmission. This retires Folha
  Flash as a *product the company licenses* without ONEmonday taking on fiscal
  liability. See §3 — eSocial responsibility legally stays with the
  employer + accountant regardless of tooling.

### 2.4 Tangerino (time-clock) — **Gateway (REP-P)**

A software time-clock is a **REP-P** under Portaria 671/2021 and legally
requires INPI registration of the program, AFD/AEJ files in the exact MTP
layout, and signed (PAdES/CAdES) registration receipts
([Senior — REP-P](https://www.senior.com.br/blog/portaria-671-o-que-e-rep-p-e-como-agiliza-o-controle-de-ponto-eletronico),
[UsePonto guide](https://useponto.com.br/blog/guia-pratico-portaria-671-2021)).

Two paths:

- **Certify ONEmonday itself as a REP-P.** Per art. 91 of the Portaria the
  *registration* requirement is "only" an INPI software registration — but the
  software must genuinely meet every technical requirement (AFD with digital
  signature, AEJ export, espelho de ponto, signed receipts, 5-year retention,
  auditor extraction). That is a regulated-software programme with permanent
  maintenance, not a feature. **Not recommended now.**
- **Integrate a certified REP-P vendor** as `TimeclockProvider`. The vendor
  remains the legally registered REP-P; ONEmonday embeds/links its punch
  capture and pulls the journey data back via API into the HR module so
  schedules, banco de horas and the payroll-input file (2.3) are all in
  ONEmonday. **Recommendation: integrate a certified REP-P.** This retires
  Tangerino as the company's *chosen brand* but the punch-and-AFD layer is
  still legally a certified REP-P — it is rented, not eliminated.

### 2.5 Flash (benefits card) — **Gateway / out of scope**

Cartão Flash is a Visa-branded prepaid multi-benefit fintech card (card
issuing, Bacen-regulated). ONEmonday cannot and must not issue cards. Options:
(a) integrate a benefits-card provider's API to *administer* allocations from
ONEmonday's UI while the provider issues the card; (b) keep Flash purely as the
card. Either way ONEmonday natively builds **benefits tracking** (which
employee has which benefit, values, history). **Recommendation:** native
benefits tracking; the physical card stays a third-party fintech product. This
is the one system that is **not fully retired** — see §6.

### 2.6 Pipedrive — **Native**

ONEmonday's CRM is already architecturally a Pipedrive-class CRM. Pure product
work (`migration-comercial.md` backlog #1–#16): edit/delete CRUD, deal
`owner_id`, schedulable activities, pipeline designation, filtering, custom
fields, proposal PDF. No gateway needed except email/WhatsApp logging, which
reuses 2.1/2.8. **Recommendation: Native.** Retires Pipedrive.

### 2.7 RD Station CRM — **Native**

Same target module as Pipedrive — one combined CRM. The one distinct capability
is **WhatsApp inside the deal**: covered by the 2.1 WhatsApp Cloud API
integration, with messages logged to `crm_activities`. **Recommendation:
Native CRM + reuse the WhatsApp gateway.** Retires RD Station CRM.

### 2.8 RD Station Marketing — **Hybrid: native automation, gateway sending**

The earlier research called this "do not migrate." Under the gateway strategy
it becomes feasible but it is still the **largest** workstream:

- **Email sending — Gateway.** ONEmonday must not run mail infrastructure.
  Integrate an **ESP** as `EmailProvider`. Options and 2026 pricing:
  **Amazon SES** US$0.10 / 1,000 emails — cheapest at volume, most ops work
  (you manage deliverability, SPF/DKIM/DMARC, suppression);
  **Resend** free 3,000/mo then US$20/mo for 50k — best DX for a Next.js
  codebase, React Email templates;
  **SendGrid** ~US$19.95/mo Essentials for 50k
  ([pricing comparison](https://www.buildmvpfast.com/api-costs/email),
  [SES vs SendGrid](https://www.sequenzy.com/versus/sendgrid-vs-amazon-ses)).
  **Recommendation: Resend** for launch (lowest friction, same vendor for
  transactional + marketing email, fits the stack); revisit SES only if monthly
  volume passes ~150–200k. The ESP also serves the 2.1 email *channel* — one
  integration, two consumers.
- **Automation engine, form builder, landing pages, lead scoring,
  segmentation — Native.** No certified gateway exists for these; they are
  ordinary (large) product builds. The automation engine specifically needs the
  Phase-1 background job runner (a visual flow builder + a reliable queue
  worker). Domain authentication (SPF/DKIM/DMARC), LGPD consent / double-opt-in,
  and bounce/complaint suppression are operational disciplines ONEmonday must
  own even with an ESP.
- **Recommendation:** Hybrid — gateway for *sending*, native for *orchestration*.
  Retires RD Station Marketing, but this is multi-quarter and is correctly the
  **last** workstream.

### 2.9 Omie — **Hybrid: native finance, gateway for fiscal + banking + PIX/boleto**

Split Omie into its three regulated sub-capabilities, each a separate gateway:

- **Internal financial management — Native.** AP/AR with due dates, partial
  payments, aging, cash flow, budgets, management DRE, accountant export
  (`migration-contabilidade.md` backlog #1–#9, #14–#17). Already mostly
  scoped.
- **Fiscal emission (NF-e / NFS-e / NFC-e) — Gateway.** Integrate a fiscal API
  as `FiscalProvider`. Candidates and 2026 pricing:
  **Focus NFe** ~R$109/mo incl. 200 docs, ~R$0.65/doc, no setup, 3,000+
  municipalities, any new município integrated for a flat R$199
  ([precos](https://focusnfe.com.br/precos/), [home](https://focusnfe.com.br/));
  **NFe.io** ~R$119/mo incl. 120 docs, ~R$0.75/doc + setup;
  **PlugNotas** (TecnoSpeed) — developer-focused REST API
  ([plugnotas.com.br/nfe](https://plugnotas.com.br/nfe/));
  **eNotas** — strong for digital-service companies
  ([nfe.io comparison](https://nfe.io/blog/nota-fiscal/nfeio-ou-enotas/)).
  NFS-e municipal coverage is the deciding factor — there is **no national
  NFS-e standard**, so the município(s) the company actually bills from must be
  on the provider's covered list. **Recommendation: Focus NFe** — best
  municipal coverage and the guaranteed flat-fee onboarding of a missing
  município de-risk the one hard variable. The provider also custodies the A1
  certificate (§1.2d).
- **Bank reconciliation — Gateway (Open Finance).** Integrate **Pluggy** or
  **Belvo** as `BankingProvider` to pull bank/credit-card transactions via
  Brazil's regulated Open Finance, replacing Omie's automatic conciliação
  ([Belvo aggregation](https://developers.belvo.com/products/aggregation_brazil/aggregation-brazil-introduction),
  [Pluggy Open Finance](https://www.pluggy.ai/en/open-finance)). ONEmonday
  builds the reconciliation/matching UI natively. **Recommendation: Pluggy**
  (Brazil-native, Open-Finance-regulated, widget for the bank-link consent
  flow); Belvo is the equivalent fallback adapter.
- **Boletos / PIX — Gateway (PSP).** Integrate a PSP as `PaymentProvider` to
  issue registered boletos and dynamic-QR PIX charges. **Asaas** (~R$0.99/charge
  promo, R$1.99 after — [Asaas precos](https://www.asaas.com/precos-e-taxas))
  and **Efí/Gerencianet** (PIX API ~1.98%, dynamic QR R$0.01 — see Efí docs)
  are the standard SME options. **Recommendation: Asaas** — simple flat-fee
  API, PIX + boleto + payment link in one. PSP webhooks confirm payment and
  auto-settle the AR row.
- SPED/ECD/ECF and formal livros contábeis stay with the **accountant** (§3).

**Recommendation: Hybrid.** ONEmonday becomes the finance front-end; three
gateways cover fiscal, banking and payments. Retires Omie as a licensed
product.

### 2.10 Summary table

| # | System | Approach | Chosen provider(s) | ONEmonday builds | Gateway does |
|---|---|---|---|---|---|
| 1 | Teams/WhatsApp alerts | Native + Gateway | Teams Workflows; WhatsApp Cloud API | outbox, triggers, worker | message delivery |
| 2 | Sólides (people) | Native | — (Profiler gap accepted) | recruitment, perf, 9Box, PDI, surveys | — |
| 3 | Folha Flash (payroll) | Hybrid | payroll/eSocial engine **or** accountant | HR record, payroll-input export | calc + eSocial transmission |
| 4 | Tangerino (ponto) | Gateway | certified REP-P vendor | schedules, banco de horas, journey UI | REP-P punch + AFD/AEJ |
| 5 | Flash (card) | Gateway / partial | benefits-card provider (card stays) | benefits tracking | card issuing |
| 6 | Pipedrive | Native | — | full CRM | — |
| 7 | RD Station CRM | Native | reuse WhatsApp gateway | full CRM | WhatsApp transport |
| 8 | RD Station Marketing | Hybrid | **Resend** (ESP) | automation, forms, pages, scoring | email sending |
| 9 | Omie | Hybrid | **Focus NFe** + **Pluggy** + **Asaas** | finance ledger, DRE, reconciliation UI | NF-e/NFS-e, bank feed, PIX/boleto |

---

## 3. Prerequisites & responsibilities

**Digital certificate (A1 e-CNPJ).** Required for fiscal emission and eSocial.
An **A1** is a `.pfx/.p12` file, 12-month validity, ~R$220–R$275 from an
ICP-Brasil Autoridade Certificadora ([Certisign](https://certisign.com.br/certificados/e-cnpj/nf-e),
[Mainô](https://blog.maino.com.br/qual-a-diferenca-entre-o-certificado-a1-e-cnpj-e-o-e-nf-e/)).
Action: the company procures one A1 e-CNPJ; **upload it to the fiscal gateway**
(Focus NFe) so ONEmonday never custodies it. Calendar a renewal reminder — an
expired certificate halts fiscal emission and eSocial.

**Provider contracts/accounts to open before any build:** Focus NFe account;
Pluggy (Open Finance) account; Asaas (PSP) merchant account; Meta Business +
verified WhatsApp Business number + approved templates; Resend account +
verified sending domain (SPF/DKIM/DMARC DNS records); a Microsoft 365 tenant
admin to create the Teams Workflow. Payroll: either a payroll-engine API
contract or a written agreement with the accountant on the payroll-input
format.

**What legally must stay with an accountant (contador).** A gateway does not
remove these — they are professional/legal obligations: SPED (ECD/ECF/Fiscal),
livros contábeis, balancete/balanço/DFC oficiais, apuração de impostos and
DAS/guias, and ultimate **eSocial conformity**. The accountant remains the
"gestor da conformidade trabalhista e previdenciária"
([contabeis.com.br](https://www.contabeis.com.br/trabalhista/esocial/)).
ONEmonday's role is to be the clean, single source of *input* data and to
*export* to the accountant — not to file. eSocial fiscal/labor liability stays
with the employer + accountant whether the engine is Folha Flash, a payroll API
or the accountant's own system.

**LGPD handling of payroll/PII.** The total migration concentrates salary, CLT
documents, bank data and behavioral data into ONEmonday — raising its LGPD
exposure materially. Required before any of that data lands:

- **Harden `hr_employees` RLS.** Today `hr_employees_select` (migration `00012`,
  lines 232–237) grants SELECT to **every user with any role in the sector** —
  too broad once salary/PIS/CTPS are columns there. Move sensitive fields to a
  separate `hr_employee_compensation` table (or column-restricted view) readable
  only by HR-admin permission + the employee themselves. This was flagged in
  `migration-rh.md` §6.4 and is now a hard prerequisite, not a nice-to-have.
- Encrypt `integration_credentials`; treat `webhook_events` payloads (they carry
  PII — bank transactions, fiscal docs) as sensitive, with retention limits.
- Add consent/opt-in tracking for marketing email (LGPD double-opt-in) — this is
  a Phase-5 table but must exist before the first marketing send.
- A data-processing agreement with each gateway (each becomes a sub-processor).

**Fix the known data-integrity defects first** (from `ux-audit-summary.md` /
`migration-rh.md`): the HR time-off `policyId` bug, the CRM stage-ordering bug,
the Core `!inner`-join empty chart. Migrating external data onto a buggy module
just moves the problem.

---

## 4. Cost analysis

### 4.1 The honest framing

Today the company pays **fixed SaaS subscriptions** (per-seat / per-tier) for
nine products. After migration it pays **ONEmonday (already owned) + usage-based
gateway fees**. The saving is real but it is *not* "zero" — three gateways
(fiscal, PSP, WhatsApp) and one ESP carry their own cost. The cost case is the
**difference between fixed subscriptions and metered usage**, plus eliminating
per-seat scaling.

### 4.2 Comparison

| Capability | Today (vendor, subscription) | After migration | Notes |
|---|---|---|---|
| People mgmt | Sólides subscription | R$0 (native) | Pure saving |
| Payroll | Folha Flash subscription | payroll-API fee **or** accountant fee | If moved to existing accountant, near-R$0 incremental |
| Time-clock | Tangerino subscription | certified REP-P fee (usually per-employee) | Reduced, not eliminated |
| Benefits card | Flash | Flash/issuer fee stays | **Not eliminated** — card is fintech |
| Sales CRM ×2 | Pipedrive + RD Station CRM | R$0 (native) | Two subscriptions eliminated |
| Marketing | RD Station Marketing (scales with contact base) | ESP usage: Resend ~US$20/mo @50k emails | Large saving — RD Station's contact-tier pricing is the costly one |
| Fiscal emission | (part of Omie) | Focus NFe ~R$109/mo + ~R$0.65/doc | New explicit line; small |
| Bank reconciliation | (part of Omie) | Pluggy Open Finance (usage/connection) | New explicit line |
| Boletos / PIX | (part of Omie / bank) | Asaas ~R$0.99–1.99/charge | Per-transaction; may replace existing bank boleto fees |
| Internal finance | (part of Omie) | R$0 (native) | Pure saving |
| Teams/WhatsApp alerts | manual labour | Teams free; WhatsApp ~US$0.007/utility msg | Negligible; removes manual work |
| Email alerts | none | shares the Resend ESP | Negligible |

### 4.3 Where the saving concentrates, and where it does not

- **Biggest, safest savings:** the two CRMs and the Sólides people-management
  subscription disappear entirely (native), and RD Station Marketing's
  contact-tier pricing collapses to a flat ESP fee.
- **Subscriptions become metered:** Omie's fiscal/banking value becomes
  Focus NFe + Pluggy + Asaas — cheap at SME volume, but they *scale with
  documents/transactions*. Model the company's real monthly NF-e + boleto
  volume before promising a number.
- **Not eliminated:** the Flash card (fintech), the REP-P fee (regulated), and
  eSocial transmission cost (engine or accountant). Be explicit with
  stakeholders that "stop paying the vendor stack" has these three honest
  exceptions.
- **New cost the migration itself adds:** engineering effort to build the
  integration layer and native modules, and ongoing maintenance of every
  adapter. This is a one-time + run-rate cost that must be in the business case
  against the subscription savings.

**Bottom line:** the cost-reduction case is genuine — multiple full
subscriptions eliminated, marketing pricing de-coupled from contact count — but
honest only if it is stated as *"fixed subscriptions → ONEmonday + metered
gateway fees,"* not as *"everything becomes free."*

---

## 5. Phased roadmap

Effort per workstream: **S** ≈ days, **M** ≈ 1–3 weeks, **L** ≈ 1–3+ months.

### Phase 0 — Foundations & prerequisites (no system retired yet)

- Build the **integration layer scaffolding**: `integration_credentials`
  (encrypted), `webhook_events`, the `app/api/webhooks/*` route group, the
  background job runner, `integration_logs`. **Effort: L. DB: yes.**
- Fix the data-integrity defects (HR `policyId`, CRM stage order, Core join).
  **Effort: M.**
- **Harden `hr_employees` RLS** / split compensation table. **Effort: M.
  DB: yes.**
- Procure the A1 certificate; open Focus NFe, Pluggy, Asaas, Resend, Meta
  accounts; confirm the accountant's payroll-input format and the fiscal
  landing zone. **Effort: S (procurement, parallel).**
- **Decision gate G0:** integration layer reviewed; certificate + accounts in
  hand; RLS hardened. No PII/salary/fiscal data until G0 passes.

### Phase 1 — Notification dispatch (retire: manual Teams/WhatsApp process)

- `notification_outbox` + worker; Teams Workflow channel; WhatsApp Cloud API
  channel; Resend email channel; per-module event triggers. **Effort: M.
  DB: yes.**
- **Gate G1:** alerts delivering on all four channels.

### Phase 2 — Sales CRM (retire: **Pipedrive + RD Station CRM**)

- CRM quick wins + parity (`migration-comercial.md` 1–8, 11–16). **Effort: M–L.
  DB: yes (owner_id, custom fields, products).**
- WhatsApp logging into `crm_activities` (reuses Phase 1). **Effort: S.**
- **Gate G2:** one sales cycle run entirely in ONEmonday → cancel both CRMs.

### Phase 3 — People management (retire: **Sólides people-mgmt subscription**)

- Recruitment ATS, performance reviews, 9Box, PDI, engagement surveys, org
  chart (`migration-rh.md` 3–7, 10). **Effort: L. DB: yes.**
- CLT/DP + compensation fields on the hardened HR schema. **Effort: M. DB: yes.**
- **Gate G3:** R&S + talent + engagement live → cancel Sólides (Profiler gap
  accepted).

### Phase 4 — Finance & fiscal (retire: **Omie**)

- Native finance ledger: bank accounts, due dates, partial payments, aging,
  DRE, accountant export (`migration-contabilidade.md` 1–9, 14–17).
  **Effort: L. DB: yes.**
- `FiscalProvider` (Focus NFe) — NF-e/NFS-e/NFC-e emission + status webhooks +
  `finance_fiscal_documents`. **Effort: L. DB: yes.**
- `BankingProvider` (Pluggy) — transaction sync + reconciliation UI.
  **Effort: L. DB: yes.**
- `PaymentProvider` (Asaas) — PIX/boleto issuance + payment webhooks.
  **Effort: M. DB: yes.**
- **Gate G4:** dual-run one closing cycle; totals reconcile; accountant signs
  off the export → cancel Omie. SPED stays with the accountant.

### Phase 5 — Payroll & time-clock (retire: **Folha Flash + Tangerino** as licensed products)

- `TimeclockProvider` (certified REP-P) — journey/banco-de-horas into HR.
  **Effort: M–L. DB: yes.**
- `PayrollProvider` — payroll-input export to the engine/accountant; consume
  results. **Effort: L. DB: yes.**
- **Gate G5:** one payroll month processed end-to-end; eSocial confirmed by the
  accountant → drop Folha Flash + Tangerino. REP-P fee and eSocial
  responsibility remain.

### Phase 6 — Marketing automation (retire: **RD Station Marketing**)

- `EmailProvider` (Resend) + domain auth; LGPD consent model; email composer;
  form builder; queryable segments; automation engine (on the Phase-0 job
  runner); lead scoring; landing pages; campaign→deal attribution
  (`migration-comercial.md` 17–31). **Effort: L (longest, multi-quarter).
  DB: yes.**
- **Gate G6:** the company sends, captures and nurtures from ONEmonday → cancel
  RD Station Marketing.

Ordering rationale: Phase 0 builds the shared layer once; Phases 1–3 are
low-risk native wins that retire four subscriptions early and build
credibility; Phases 4–5 carry the regulated/gateway risk and need the Phase-0
infrastructure; Phase 6 is the largest single build and goes last.

---

## 6. Risks & honest limits

**Provider concentration / lock-in.** Nine systems collapse onto ONEmonday +
~6 gateways. A fiscal-gateway outage stops invoicing; a PSP outage stops
collections. The adapter pattern (§1.2a) keeps a *second* implementation cheap,
but Brazil's Open Finance / fiscal market is concentrated — mitigation, not
elimination.

**The Flash benefits card is genuinely not eliminated.** Card issuing is a
Bacen-regulated fintech activity. "Total migration" has this honest exception:
ONEmonday administers benefits; a fintech still issues the card. Do not promise
otherwise.

**eSocial / fiscal liability never moves to ONEmonday.** A gateway transmits;
it does not assume responsibility. If payroll input is wrong, the *company* is
autuada. ONEmonday is the data front-end; the accountant stays the conformity
manager. This is a feature of the design, not a gap — but stakeholders must
understand the company does not "stop needing an accountant."

**REP-P stays partial.** Integrating a certified REP-P means the punch/AFD/AEJ
layer is still rented and still a separate (smaller) fee. Certifying ONEmonday
itself as a REP-P is possible but a regulated-software programme with permanent
maintenance — explicitly out of scope for this plan.

**NFS-e municipal coverage is the single biggest fiscal unknown.** There is no
national NFS-e standard. If the company bills services from a município not
covered by Focus NFe, emission waits on a R$199 + 15-business-day integration —
verify the company's município(s) *before* committing Phase 4 dates.

**Email deliverability is an operational discipline, not an integration.** An
ESP sends; it does not guarantee inbox placement. Domain warm-up, SPF/DKIM/DMARC,
bounce/complaint suppression and LGPD opt-in are ongoing work the company now
owns — previously RD Station absorbed it.

**Marketing automation is the largest, last and riskiest build.** Even with an
ESP, the automation engine, form/page builders and lead scoring are months of
native work. If RD Station Marketing's licence is modest, Phase 6's business
case must be re-validated at gate G4 before it is funded — it remains the one
workstream where "keep paying the vendor" can still be the rational answer.

**Migration-window data integrity.** Each gateway cutover (G2, G4, G5) needs a
dual-run period and a reconciliation gate. Fiscal and payroll especially must
not cut over on faith — a wrong NF-e or a missed eSocial event has legal cost.

**LGPD blast radius grows.** Concentrating salary, bank, fiscal and behavioral
data in one platform makes ONEmonday a higher-value breach target. The §3
hardening (RLS split, encrypted credentials, sub-processor agreements,
retention limits) is mandatory, not optional, and should be re-audited after
Phases 4–5.

---

## Sources

Fiscal emission: [Focus NFe](https://focusnfe.com.br/) ·
[Focus NFe — preços](https://focusnfe.com.br/precos/) ·
[PlugNotas NF-e](https://plugnotas.com.br/nfe/) ·
[NFe.io vs eNotas](https://nfe.io/blog/nota-fiscal/nfeio-ou-enotas/) ·
[Notaas — comparativo de APIs](https://www.notaas.com.br/blog/post/comparativo-5-apis-para-emissao-de-nfe-nfse-e-nfce-2025) ·
[Portal NFS-e Nacional — API](https://www.gov.br/nfse/pt-br/municipios/produtos-disponiveis/api-de-integracao)
Digital certificate: [Certisign — e-CNPJ NF-e](https://certisign.com.br/certificados/e-cnpj/nf-e) ·
[Mainô — A1 e-CNPJ vs e-NF-e](https://blog.maino.com.br/qual-a-diferenca-entre-o-certificado-a1-e-cnpj-e-o-e-nf-e/)
Open Finance: [Belvo — aggregation Brazil](https://developers.belvo.com/products/aggregation_brazil/aggregation-brazil-introduction) ·
[Pluggy — Open Finance](https://www.pluggy.ai/en/open-finance) ·
[Belvo — plans & pricing](https://belvo.com/plans-and-pricing/)
PIX/boleto PSP: [Asaas — preços e taxas](https://www.asaas.com/precos-e-taxas) ·
[Asaas — API de pagamentos](https://www.asaas.com/api-de-pagamentos) ·
[Efí/Gerencianet — API Pix docs](https://dev.efipay.com.br/en/docs/api-pix/cobrancas-imediatas/)
Payroll / eSocial: [eSocial — Contábeis](https://www.contabeis.com.br/trabalhista/esocial/) ·
[sped-esocial library](https://github.com/nfephp-org/sped-esocial) ·
[eSocial 1.3 — Contábeis](https://www.contabeis.com.br/noticias/68469/esocial-1-3-alteracoes-na-folha-de-pagamento-e-substituicao-da-dirf/)
Time-clock / REP-P: [Senior — REP-P / Portaria 671](https://www.senior.com.br/blog/portaria-671-o-que-e-rep-p-e-como-agiliza-o-controle-de-ponto-eletronico) ·
[UsePonto — guia Portaria 671](https://useponto.com.br/blog/guia-pratico-portaria-671-2021) ·
[Ortep — Portaria 671 guia completo](https://www.ortep.com.br/portaria-671-guia-completo/)
Email ESP: [Email API pricing comparison](https://www.buildmvpfast.com/api-costs/email) ·
[SES vs SendGrid](https://www.sequenzy.com/versus/sendgrid-vs-amazon-ses) ·
[Resend vs SendGrid 2026](https://dreamlit.ai/blog/resend-vs-sendgrid-vs-dreamlit)
Messaging: [Meta — WhatsApp Business Platform pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) ·
[WhatsApp API pricing 2026 — flowcall](https://www.flowcall.co/blog/whatsapp-business-api-pricing-2026) ·
[Microsoft 365 Dev Blog — O365 connectors retirement](https://devblogs.microsoft.com/microsoft365dev/retirement-of-office-365-connectors-within-microsoft-teams/) ·
[Microsoft Learn — Incoming Webhook / Workflows](https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook)
Internal: `docs/research/migration-summary.md`, `migration-rh.md`,
`migration-comercial.md`, `migration-contabilidade.md`, `ux-audit-summary.md`;
migrations `00003_projects_notifications.sql`, `00012_hr.sql`, `00070_finance.sql`;
`apps/web/lib/actions/notifications.ts`, `apps/web/lib/actions/finance/invoices.ts`.

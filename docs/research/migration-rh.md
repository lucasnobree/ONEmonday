# Migration Feasibility & Feature-Gap Analysis — HR/RH Stack → ONEmonday HR Module

**Scope:** Can the company gradually migrate OFF its paid HR tools (Sólides, Flash, Folha Flash, Tangerino / Sólides Ponto, and Teams/WhatsApp alert dispatch) ONTO the ONEmonday HR module, to cut software costs?
**Method:** Code review of the ONEmonday HR module (`apps/web/app/(dashboard)/hr`, `components/hr`, `hooks/hr`, `lib/actions/hr`, `lib/validations/hr.ts`, migrations `00012`/`00015`/`00030`) cross-referenced with the existing UX audit (`docs/research/ux-audit-hr.md`), plus web research of each external product (official sites/docs, pt-BR). Analysis only — no application code was modified.
**Date:** 2026-05-18

---

## 1. Executive summary

The ONEmonday HR module is a **people-operations module**: an employee directory, leave/absence requests with balances, a recruitment kanban, onboarding checklists, an org tree, and document storage with expiry tracking. It is genuinely useful for the *operational* side of HR.

It is **not** — and is nowhere near — a Brazilian **HR-tech / DP (departamento pessoal) suite**. The five systems in scope split cleanly into two groups:

- **Plausibly replaceable on the ONEmonday side** (people-ops, talent, engagement): the *people-management* slices of **Sólides**, the *HR-management* slice of **Flash**, and **HR alert dispatch**. These are software features with no legal/fiscal certification gate. ONEmonday already covers part of this and could be extended.
- **Not replaceable without becoming a regulated fiscal product** (payroll & time-clock): **Folha Flash** (folha de pagamento, eSocial) and **Tangerino / Sólides Ponto** (ponto eletrônico). Both carry hard legal/compliance blockers — eSocial event transmission, INSS/IRRF/FGTS calculation, and Portaria 671/2021 REP-P certification (INPI registration, AFD/AEJ files, SHA-256-hashed PAdES-signed receipts). Building these is a multi-year regulated-software effort, not a backlog item.

**Bottom line:** ONEmonday can realistically replace ~30-40% of this stack (people-ops, talent management, engagement, alerts) and should target that. **Payroll and the electronic time-clock should remain on specialist vendors** — or be outsourced to an accountant (contabilidade) — because the cost of legal non-compliance dwarfs the license savings. The benefits **card** (Flash) is a fintech product (Visa card issuing) and is also out of scope.

---

## 2. Per-system overview

### 2.1 Sólides — HR-tech suite with behavioral intelligence
Brazilian people-management platform (45k+ clients claimed). Core for this company:
- **Recrutamento & Seleção (R&S):** automated selection pipelines, talent sourcing, behavioral-data-driven hiring.
- **Perfil comportamental (Profiler):** maps candidates/employees into 4 behavioral profiles (executor, comunicador, analista, planejador) plus 50+ derived indicators (skills, leadership style, development points). This is Sólides' signature differentiator.
- **Avaliação de desempenho:** performance reviews integrated with 9Box matrix, individual goals, training.
- **PDI** (Plano de Desenvolvimento Individual): development plans, knowledge-gap identification.
- **Pesquisa de clima / engajamento:** automated climate surveys, eNPS, internal surveys, real-time reporting.
- **People Analytics:** dashboards over the above.
- (Sólides also bundles ponto and folha — see Tangerino and Folha Flash; treated separately below.)

Sources: [solides.com.br](https://solides.com.br/), [15 funcionalidades](https://solides.com.br/blog/funcionalidades-solides/), [Recrutamento e Seleção](https://solides.com.br/solucoes/recrutamento-e-selecao/), [Profiler](https://solides.com.br/lp/perfil-comportamental-profiler/), [Matriz 9 Box](https://solides.com.br/blog/9-box/), [Engajamento e Retenção](https://solides.com.br/blog/solides-engajamento-retencao-fl/).

### 2.2 Flash (HROS) — multibenefícios + despesas + gestão de pessoas
Benefits/HR operating system. Relevant slices:
- **Cartão Flash:** Visa-branded prepaid card, multi-category balance (alimentação, refeição, mobilidade, saúde, educação, cultura, vale-transporte — up to 8 categories), accepted at 12M+ Brazilian merchants. **This is a regulated fintech / card-issuing product.**
- **Gestão de despesas (Flash Expense):** corporate cards + expense reporting / prestação de contas automation.
- **Gestão de pessoas:** HR-management software — admissão/desligamento data, controle de jornada, trainings, internal surveys, evaluations.

Sources: [flashapp.com.br](https://flashapp.com.br/), [Cartão Flash](https://flashapp.com.br/cartao-flash), [Gestão de despesas](https://flashapp.com.br/gestao-de-despesas), [Gestão de pessoas](https://flashapp.com.br/gestao-de-pessoas), [plataforma integrada](https://flashapp.com.br/blog/flash-plataforma-integrada).

### 2.3 Folha Flash — payroll (folha de pagamento)
Flash's payroll product:
- Automated calculation of horas extras, descontos, IRRF, INSS, FGTS using current labor-law rules.
- **Direct eSocial integration** — generates and transmits mandatory events (admissões, desligamentos, folha) within legal deadlines.
- Férias management (períodos aquisitivos, proporcional/vencidas), rescisão contratual, 13º salário.
- Holerite digital (digital payslip) with employee portal/app access.
- Management reports: payroll cost, encargos by cost center.

Sources: [Folha de pagamento automatizada](https://flashapp.com.br/blog/folha-de-pagamento-automatizada), [Sistema de folha de pagamento](https://flashapp.com.br/blog/sistema-folha-de-pagamento), [Folha de pagamento e eSocial — Sólides](https://solides.com.br/blog/folha-de-pagamento-e-esocial-entenda-a-relacao/).

### 2.4 Tangerino (by Sólides) — ponto eletrônico
Now branded **Sólides Ponto**. Electronic time-clock:
- Clock-in/out via mobile app/tablet, **facial recognition**, **geolocation**, electronic timesheet signature.
- **Banco de horas** (time-bank), work schedules/escalas, overtime tracking, external-team tracking.
- Absence/absenteeism analytics, integration with férias and folha.
- **Compliant with Portaria 671/2021** (MTP) — see compliance section below.

Sources: [Tangerino agora é Sólides Ponto](https://querobolsa.com.br/revista/tangerino), [Controle de Ponto Sólides](https://solides.com.br/controle-de-ponto-digital/), [Portaria 671](https://solides.com.br/blog/portaria-671/).

### 2.5 Teams / WhatsApp alert dispatch
The company currently pushes HR notices/alerts into Microsoft Teams or WhatsApp. This is not a product — it is a *channel*. ONEmonday today has only **in-app notifications** (`lib/actions/notifications.ts` writes rows to a `notifications` table; no outbound channel, no webhook, no email, no Teams/WhatsApp integration anywhere in `apps/web/lib`).

---

## 3. Current ONEmonday HR module — what exists

From the code and migrations:

| Area | What ONEmonday has | Backing tables / RPCs |
|---|---|---|
| Employee directory | CRUD, profile sheet, CSV export, manager link, status (active/on_leave/terminated), employment type | `hr_employees` |
| Documents | Upload to `hr-documents` bucket, category, **expiry-date tracking**, expiring-docs dashboard widget | `hr_employee_documents`, `get_expiring_hr_documents` |
| Time-off / absences | Request → approve/reject, policies, per-year balances, balance RPC | `hr_time_off_policies/_requests/_balances`, `get_employee_time_off_balance` |
| Recruitment | Job openings, kanban board sheet (read-only), candidate schema with resume/LinkedIn/salary/rating | `hr_job_openings`, `hr_candidates` (linked to `cards`) |
| Onboarding | Templates (jsonb steps), instances, per-item checklist with due dates + responsible role | `hr_onboarding_templates/_instances/_items` |
| Org chart | Recursive `manager_id` tree | `hr_employees.manager_id` |
| Dashboard | KPIs, birthdays/anniversaries, active onboardings, upcoming leave, expiring docs | `get_hr_dashboard_stats` |
| Notifications | In-app only (DB rows) | `notifications` |

Known defects (from `ux-audit-hr.md`, still relevant to migration readiness): time-off dialog sends `employeeId` as `policyId` (corrupts balances); recruitment board is read-only (no way to add/move candidates); negative leave balances not blocked; native `prompt()/confirm()` dialogs. **These should be fixed before any tool migration**, because migrating data onto a buggy module just moves the problem.

What the module has **no concept of** today: salary/compensation, payroll, time-clock/ponto, work schedules, banco de horas, benefits, expenses, behavioral profiles, performance reviews, 9Box, PDI, climate/engagement surveys, eSocial, CLT contract data (PIS, CTPS, cargo CBO), and any outbound notification channel.

---

## 4. Feature-mapping tables (tool feature → ONEmonday has it?)

### 4.1 Sólides — people management
| Sólides feature | ONEmonday | Notes |
|---|---|---|
| Employee directory / people records | **Yes** | `hr_employees` covers basic fields. Lacks CLT/DP fields (PIS, CTPS, CBO, salary). |
| Recruitment pipeline (R&S) | **Partial** | Job openings + kanban exist; board is read-only, no candidate add/move (audit High finding). |
| ATS detail (resume, source, expected salary, rating) | **Partial** | Schema (`hr_candidates`) has the fields; UI never displays/edits them. |
| Behavioral profile / Profiler (DISC-style, 50+ indicators) | **No** | No assessment engine, no profile model. Core Sólides differentiator — proprietary methodology. |
| Performance evaluation / 9Box | **No** | No reviews, cycles, goals, or 9Box matrix. |
| PDI (development plans) | **No** | Not modeled. |
| Climate/engagement surveys, eNPS | **No** | No survey engine. (A generic forms feature may exist elsewhere in ONEmonday but not wired to HR.) |
| People Analytics dashboards | **Partial** | HR dashboard exists but only operational counts; no talent/engagement analytics. |
| Onboarding | **Yes** | Templates + instances + checklist — competitive. |
| Org chart | **Partial** | Indented tree, not a top-down diagram; filter fragments hierarchy (audit). |

### 4.2 Flash — benefits / expenses / HR management
| Flash feature | ONEmonday | Notes |
|---|---|---|
| Multi-benefit card (Visa, 8 categories) | **No** | Regulated fintech / card issuing — out of scope for an HR module. |
| Benefits administration (allocate values per category) | **No** | No benefits model. |
| Corporate expense management (Flash Expense) | **No** in HR | ONEmonday has a Finance module — expenses could conceivably live there, not in HR. |
| HR management / people records | **Partial** | Overlaps `hr_employees`; Flash adds jornada + trainings. |
| Controle de jornada | **No** | See Tangerino — same gap. |

### 4.3 Folha Flash — payroll
| Folha Flash feature | ONEmonday | Notes |
|---|---|---|
| Automated payroll calculation (IRRF, INSS, FGTS, horas extras) | **No** | No calculation engine; no salary data. |
| eSocial event generation & transmission | **No** | **Hard legal blocker** — government integration, certified events. |
| Holerite digital + employee access | **No** | No payslip artifact. |
| Férias calculation (aquisitivo, proporcional) | **No** | ONEmonday tracks leave *requests/balances* manually; does not compute legal férias accrual. |
| Rescisão / 13º salário calculation | **No** | Not modeled. |
| Payroll cost reports / encargos by cost center | **No** | Not modeled. |

### 4.4 Tangerino / Sólides Ponto — time-clock
| Tangerino feature | ONEmonday | Notes |
|---|---|---|
| Clock-in/out (mobile, facial recognition, geolocation) | **No** | No punch capture of any kind. |
| Portaria 671 REP-P compliance (INPI reg, AFD/AEJ, signed receipts) | **No** | **Hard legal/compliance blocker.** See section 6. |
| Work schedules / escalas | **No** | Not modeled. |
| Banco de horas (time-bank) | **No** | Distinct from leave balances; not modeled. |
| Overtime tracking | **No** | Not modeled. |
| Absenteeism analytics | **No** | Not modeled. |

### 4.5 Teams / WhatsApp alert dispatch
| Need | ONEmonday | Notes |
|---|---|---|
| In-app notifications | **Yes** | `notifications` table. |
| Outbound to Microsoft Teams | **No** | No webhook/connector code anywhere in `lib`. |
| Outbound to WhatsApp | **No** | No WhatsApp Business API integration. |
| Email notifications | **No** | No SMTP/Resend/email provider found. |
| HR-event triggers (leave approved, onboarding due, doc expiring) | **Partial** | Events are *computed* (dashboard widgets) but never *pushed* anywhere. |

---

## 5. Prioritized migration backlog

Effort: **S** = days, **M** = 1-3 weeks, **L** = 1-2+ months. "DB migration" = needs a new Supabase migration. "Blocker" = hard legal/compliance/fiscal gate that prevents migration regardless of effort.

| # | Item | Replaces | Effort | DB migration | Blocker? |
|---|---|---|---|---|---|
| 0 | **Fix existing HR defects first** (time-off `policyId` bug, recruitment add/move candidate, native dialogs, negative-balance guard) | — (prerequisite) | M | No | Prerequisite — do not migrate data onto a buggy module |
| 1 | **Outbound notification channel** — Teams Incoming Webhook + email; queue HR events (leave approved/rejected, doc expiring, onboarding overdue, birthday) | Teams/WhatsApp alerts | M | Yes (event/outbox table) | No |
| 2 | WhatsApp dispatch via WhatsApp Business Cloud API (template messages) | WhatsApp alerts | M | Yes (channel config) | No — but needs Meta business verification + paid template messages |
| 3 | **Make recruitment ATS real** — candidate add/move/detail, scorecards, interview notes, sources | Sólides R&S | M | Possibly (interview/scorecard tables) | No |
| 4 | **Performance review module** — review cycles, competencies, goals/OKRs, manager+self review | Sólides desempenho | L | Yes | No |
| 5 | **9Box matrix** — performance×potential placement, built on #4 | Sólides 9Box | M | Yes (or derived from #4) | No |
| 6 | **PDI module** — development plans, actions, linked to reviews | Sólides PDI | M | Yes | No |
| 7 | **Survey/engagement engine** — climate surveys, eNPS, anonymous responses, results dashboard | Sólides clima/engajamento | L | Yes | No |
| 8 | Compensation fields on employee (salary, salary history, cost center) | Sólides/Flash people data | S | Yes | No — but treat salary data as sensitive (RLS) |
| 9 | CLT/DP employee fields (PIS, CTPS, CBO, contract type, dependentes) | Folha Flash data model | S | Yes | No (data model only; not the calculations) |
| 10 | True org chart (top-down diagram, zoom, export) | Sólides org view | M | No | No |
| 11 | Benefits tracking (informational only — which benefits, values; **not** card issuing) | Flash benefits (partial) | M | Yes | No — cannot replace the actual Visa card |
| 12 | Behavioral profile assessment | Sólides Profiler | L | Yes | No build blocker, but Profiler is proprietary IP — would be a generic DISC, not Sólides-equivalent |
| 13 | **Ponto eletrônico (time-clock)** — punch capture, schedules, banco de horas, overtime | Tangerino / Sólides Ponto | L | Yes | **YES — Portaria 671 REP-P** |
| 14 | **Folha de pagamento (payroll)** — calculation engine + eSocial transmission + holerite | Folha Flash | XL | Yes | **YES — eSocial + fiscal/legal liability** |

---

## 6. Compliance / legal blockers (read before deciding)

### 6.1 Electronic time-clock — Portaria 671/2021 (MTP)
Replacing Tangerino is **not** a normal feature build. A software time-clock is a **REP-P** (Registrador Eletrônico de Ponto via Programa) and is legally regulated:

- **INPI registration** of the software is required for REP-P.
- Must generate the **AFD** (Arquivo Fonte de Dados) in the exact government-specified layout, retained **5 years**, and the **AEJ** (Arquivo Eletrônico de Jornada) of post-processed journey data.
- Every punch must produce an electronic **comprovante de registro**: PDF, with sequential registration number, employer/employee identification, work location, timestamp, **SHA-256 hash**, and an **electronic signature** — **PAdES** format for receipts, **CAdES** for AFD/AEJ files (per Portaria 1486).
- Must allow employee extraction of records (≥48h lookback) and immediate auditor data extraction.
- A REP-A (software authorized by collective agreement) is an alternative path, but it ceases when the convenção coletiva expires and still requires faithful electronic extraction.

**Verdict:** building a compliant REP-P is a regulated-software project (months of work + INPI + ongoing legal maintenance of file layouts as the MTP updates them). The penalty for non-compliant time-tracking is labor-court liability. **This is a hard blocker.** Recommendation: keep Tangerino/Sólides Ponto.

### 6.2 Payroll — eSocial + fiscal liability
Folha de pagamento requires correct calculation of INSS, IRRF, FGTS, horas extras, férias accrual, 13º, and rescisões under constantly-changing CLT rules, **and** generation/transmission of mandatory **eSocial** events to the government within legal deadlines. Errors create direct fiscal/labor liability (multas, autuações) for the company. Building and *maintaining* a payroll engine is an XL, ongoing, regulated effort. **Hard blocker.** Recommendation: keep Folha Flash, or move payroll to the company's accountant (contabilidade) — often cheaper than both a SaaS license and an in-house build.

### 6.3 Benefits card — fintech, out of scope
Cartão Flash is a Visa-branded prepaid card. Issuing payment cards is a regulated fintech activity (Bacen, card-network rules). ONEmonday cannot and should not replace it. At most ONEmonday can *record* which benefits an employee has.

### 6.4 Sensitive-data note
If compensation, CLT documents, or behavioral profiles are added (#8, #9, #12), they are sensitive personal data under **LGPD**. RLS must restrict salary/profile visibility beyond the current "any sector role can read" pattern — today `hr_employees` SELECT is open to every user with a role in the sector. Tighten before storing salaries.

---

## 7. Migration verdict per tool

| Tool | Verdict | Rationale |
|---|---|---|
| **Sólides — people mgmt / R&S / desempenho / PDI / clima** | **Partial → Yes, over time** | All software, no legal gate. ONEmonday already does directory + onboarding + a recruitment skeleton. Performance, 9Box, PDI, surveys are buildable (backlog #3-7). The **Profiler behavioral engine is proprietary** — ONEmonday can build a generic DISC but cannot truly "replace" Sólides' methodology. Realistic outcome: replace the operational + talent + engagement layers; accept losing the behavioral-intelligence differentiator. |
| **Flash — HROS** | **Mostly No** | The card and benefits administration are fintech and cannot be replicated. The HR-management slice overlaps ONEmonday and could migrate, but that is not why the company pays for Flash. **Keep Flash for benefits/expenses/card.** |
| **Folha Flash — payroll** | **No** | Hard eSocial + fiscal-liability blocker. Building a payroll engine is an XL regulated project with permanent legal risk. **Keep, or outsource to contabilidade.** |
| **Tangerino / Sólides Ponto — time-clock** | **No** | Hard Portaria 671 REP-P blocker (INPI registration, AFD/AEJ, signed receipts). **Keep.** |
| **Teams / WhatsApp alerts** | **Yes** | No legal gate. A Teams webhook + email is an M-effort build; WhatsApp is M-effort but needs Meta verification and paid templates. This is the clearest, fastest cost-relevant win — and removes a manual process. |

**Net:** the company can realistically retire **part of Sólides** (people-ops, talent, engagement modules) and replace the **Teams/WhatsApp manual dispatch** with native automation. It should **not** plan to retire Folha Flash, Sólides Ponto, or the Flash card. Expect roughly one of five systems fully replaceable, one partially, three retained — modest but real license savings, concentrated on the Sólides subscription.

---

## 8. Recommended phased migration order

**Phase 0 — Stabilize (prerequisite, ~M).** Fix the known HR defects from `ux-audit-hr.md` (time-off `policyId` corruption, read-only recruitment board, native dialogs, negative-balance guard). Do not migrate any external data onto a module with a data-integrity bug.

**Phase 1 — Quick win: alert dispatch (M).** Build the outbound notification channel (Teams webhook + email; backlog #1). Add HR-event triggers (leave approved/rejected, document expiring, onboarding overdue). This removes the manual Teams/WhatsApp step immediately and is the lowest-risk migration. Add WhatsApp (#2) as a fast-follow once Meta verification clears.

**Phase 2 — Recruitment (M).** Finish the ATS (#3): candidate add/move/detail, scorecards. This lets the company run R&S in ONEmonday and drop the Sólides recruitment module — the first piece of a paid tool actually retired.

**Phase 3 — Talent management (L).** Build performance reviews (#4), then 9Box (#5) and PDI (#6) on top. Add compensation + CLT data fields (#8, #9) with tightened RLS. This is the largest chunk of Sólides value that is legally migratable.

**Phase 4 — Engagement (L).** Survey/engagement engine with eNPS (#7). After this, the Sólides subscription can plausibly be cancelled (except its Ponto product, which stays).

**Phase 5 — Optional / accept-the-gap.** True org chart (#10), informational benefits tracking (#11), generic behavioral assessment (#12). Explicitly **do not** schedule payroll (#14) or time-clock (#13) — keep Folha Flash and Sólides Ponto, and revisit only if the company is prepared to fund a regulated-software programme.

---

### Sources
- Sólides — [Home](https://solides.com.br/), [15 funcionalidades](https://solides.com.br/blog/funcionalidades-solides/), [Recrutamento e Seleção](https://solides.com.br/solucoes/recrutamento-e-selecao/), [Profiler / perfil comportamental](https://solides.com.br/lp/perfil-comportamental-profiler/), [Matriz 9 Box](https://solides.com.br/blog/9-box/), [Engajamento e Retenção](https://solides.com.br/blog/solides-engajamento-retencao-fl/), [Avaliação de Desempenho](https://solides.com.br/blog/recursos/lp-bofu-avd-solides/)
- Flash — [Home](https://flashapp.com.br/), [Cartão Flash](https://flashapp.com.br/cartao-flash), [Gestão de despesas](https://flashapp.com.br/gestao-de-despesas), [Gestão de pessoas](https://flashapp.com.br/gestao-de-pessoas), [Plataforma integrada](https://flashapp.com.br/blog/flash-plataforma-integrada)
- Folha Flash / payroll — [Folha de pagamento automatizada](https://flashapp.com.br/blog/folha-de-pagamento-automatizada), [Sistema de folha de pagamento](https://flashapp.com.br/blog/sistema-folha-de-pagamento), [Folha de pagamento e eSocial — Sólides](https://solides.com.br/blog/folha-de-pagamento-e-esocial-entenda-a-relacao/)
- Tangerino / Sólides Ponto — [Tangerino agora é Sólides Ponto](https://querobolsa.com.br/revista/tangerino), [Controle de Ponto Digital](https://solides.com.br/controle-de-ponto-digital/), [Portaria 671](https://solides.com.br/blog/portaria-671/), [Portaria 373 do MTE](https://solides.com.br/blog/portaria-373-do-mte-regras-para-sistemas-alternativos-de-controle-de-ponto/)
- ONEmonday internal — `docs/research/ux-audit-hr.md`; migrations `00012_hr.sql`, `00015_hr_documents.sql`, `00030_hr_wave1.sql`; `apps/web/lib/validations/hr.ts`; `apps/web/lib/actions/hr/*`; `apps/web/lib/actions/notifications.ts`

# UX Audit — Support Desk Module (Wave 4)

**Auditor:** Senior Product Designer / Front-end Engineer
**Date:** 2026-05-18
**Module:** Support Desk (`apps/web/app/(dashboard)/support`)
**Scope:** Dashboard, Tickets, Regras SLA, Base de Conhecimento, Respostas Prontas.
**Method:** Screen-by-screen review of `screenshots/audit-wave4/admin/25–29`, cross-read against the module source (pages, components, libs), benchmarked against Zendesk, Intercom, Freshdesk and Jira Service Management.
**Predecessor:** Wave 3 report `docs/research/ux-audit-support.md`. This Wave 4 audit only covers items that are still open or newly introduced.

---

## What Wave 3 fixed (verified)

Several Wave 3 High/Medium items are resolved and are **not** re-raised:

- **Multi-state status** — `support_tickets.status` now carries `new / open / pending / on_hold / resolved` (`lib/support/sla.ts:56`, `lib/support/status.ts`). The Tickets table, dashboard derivation and detail sheet all render the new badges. Screenshot `26` confirms "Novo / Aberto / Resolvido" pills.
- **SLA pause** — `computeSlaPauseTransition` folds paused spans back into due dates; the detail sheet shows an "SLA pausado" hint (`ticket-detail-sheet.tsx:262`).
- **Bulk actions + sorting** — the Tickets queue has a select-all/per-row checkbox column, a bulk-status action bar, and three sortable headers (`tickets/page.tsx:461`, `:542`).
- **Delete confirmations** — SLA rules, KB articles, canned responses and attachments all wrap deletion in `ConfirmDialog`.
- **Filter labels** — `SelectValue` now uses a value→label function child, so triggers read "Todos os status" / "Todas" instead of raw `all` (`tickets/page.tsx:319`).
- **Markdown rendering** — `MarkdownRenderer` renders KB content; `stripMarkdown` cleans card previews.
- **Attachments** — `TicketAttachments` adds drag-drop upload with 10MB cap and signed-URL download.
- **CSV export** now includes Responsável and Tags.
- **Shortcut normalization** — `normalizeShortcut` strips leading slashes; screenshot `29` shows single-slash badges (`/escalar`, `/followup`).

**Overall rating: 7.5 / 10** — up from 6.5. The queue is now a competent triage surface and the SLA engine is genuinely strong. The remaining gaps are concentrated in (1) the still-internal-only conversation, (2) the dashboard's lack of operational metrics, and (3) consistent pt-BR accenting that *regressed* into the new screens.

| Screen | Wave 3 | Wave 4 |
|---|---|---|
| Dashboard (`25`) | 6.5 | 6.5 |
| Tickets (`26`) | 6 | 7.5 |
| Regras SLA (`27`) | 7.5 | 7.5 |
| Base de Conhecimento (`28`) | 7 | 8 |
| Respostas Prontas (`29`) | 7 | 7 |
| Ticket Detail Sheet | 6.5 | 7.5 |

---

## Screen 1 — Dashboard

**Screenshot:** `screenshots/audit-wave4/admin/25-support-dashboard.png`
**Code:** `app/(dashboard)/support/page.tsx`, `hooks/support/use-support-stats.ts`

### What works
- Clear hierarchy: red SLA banner → 4 KPI cards → recent-tickets table.
- KPI cards and the table both have skeleton/empty states.

### Findings

**H1 — The dashboard still counts tickets but reports no operational metric a support manager steers by.** *(High)*
The four cards remain "Total Tickets / Abertos / SLA Violados / Resolvidos" — bare counts, no period, no trend, not clickable. Every benchmarked product treats first-response time, resolution time, SLA attainment %, CSAT and backlog age as the *primary* dashboard metrics ([Freshworks — customer service dashboard](https://www.freshworks.com/explore-cx/customer-service-dashboard/); [Hiver — top help desk metrics 2025](https://hiverhq.com/blog/help-desk-metrics)). Wave 3 raised this; it is unaddressed in `page.tsx:55-76`. **Fix:** add a second KPI row — "Tempo médio 1ª resposta", "Tempo médio de resolução", "% SLA cumprido", "CSAT" — and a "Tickets por responsável" breakdown. The detail sheet already records `first_response_at` and `resolved_at`, so FRT/resolution time are computable today.

**H2 — Banner / card data inconsistency.** *(High)*
The banner reads "**4 tickets com SLA violado**" while the "SLA Violados" KPI card reads "**2**" (screenshot `25`). One of the two is wrong, or they measure different things (e.g. banner = response-or-resolve breach, card = a single flag). A visible self-contradiction on the landing screen erodes trust in every other number. **Fix:** drive both from one source. If they intentionally differ, label them ("2 resolução / 4 resposta") — see `use-support-stats.ts` and `sla-alert-banner.tsx`.

**M1 — Recent-tickets table omits Responsável and SLA, and uses the old binary status.** *(Medium)*
`page.tsx:135-180` renders Título / Prioridade / Status / Categoria / Criado em, and Status is still derived from `ticket.resolved_at` only (`:165`) — "Aberto" vs "Resolvido". The new five-state `ticket.status` exists on the row but is ignored here, so a ticket that is `pending` or `on_hold` shows as a generic "Aberto". The Tickets table already does this correctly. **Fix:** reuse `TICKET_STATUS_META[normalizeTicketStatus(ticket.status)]` and add Responsável + an SLA pill, consistent with `26`.

**M2 — KPI cards are not clickable.** *(Medium)*
Zendesk/Freshdesk dashboards click through every metric to a pre-filtered list. Here "SLA Violados" is a dead number. **Fix:** make each card navigate to `/support/tickets` with the matching filter (the Tickets page would need to read `searchParams` — still not wired, see T4).

**L1 — Every "Criado em" cell shows the same date.** *(Low)*
All eight rows read `15/05/2026` (seed data). With real data, a relative format ("há 3h", as the detail sheet's `formatRelativeTime` already produces) scans faster. **Fix:** relative dates in the recent list.

---

## Screen 2 — Tickets

**Screenshot:** `screenshots/audit-wave4/admin/26-support-tickets.png`
**Code:** `app/(dashboard)/support/tickets/page.tsx`, `ticket-detail-sheet.tsx`

### What works
- Bulk selection + bulk-status bar and three sortable headers are real, working Wave 3 wins.
- Rich rows: title, inline tag badges, priority, the new multi-state status badge, escalation badge, assignee, channel, colour-graded SLA pill, created date, one-click resolve.
- Good state coverage: skeleton, true empty state with CTA, and a distinct "no results for filters" message.
- Filter triggers now show localized labels — the Wave 3 raw-`all` defect is fixed.

### Findings

**H3 — The ticket "conversation" still never reaches the requester.** *(High)*
`CommentsTab` (`ticket-detail-sheet.tsx:442`) posts internal `card_comments` only — a plain `Textarea`, no public reply, no email-out, no internal-note vs. public-reply toggle. For `email`/`chat`-channel tickets (screenshot `26` shows both) the requester literally cannot be answered from the product. Zendesk's Agent Workspace makes the **Public reply / Internal note** toggle the central control of the composer ([Zendesk — Internal Note vs Public Reply](https://support.zendesk.com/hc/en-us/community/posts/4409222717722-Zendesk-s-New-Interface-Agent-Workspace-Internal-Note-vs-Public-Reply); [Zendesk — Adding comments to tickets](https://support.zendesk.com/hc/en-us/articles/4408828489370-Adding-comments-to-tickets)). This is the single largest functional gap versus all four benchmarks. **Fix:** add a public reply path (email-out for `email`-channel tickets) with an explicit "Nota interna" / "Responder cliente" switch in the composer.

**H4 — No free-text search on the ticket queue.** *(High)*
The KB has a search box; the Tickets queue still has none. There is no way to find a ticket by title, requester email or ID — only the four dropdown filters in `tickets/page.tsx:313-398`. Ticket search is primary in every benchmarked desk. **Fix:** add a debounced search input that filters by `card.title` / `requester_email` / ticket id.

**H5 — Bulk bar exposes only "Alterar status"; no bulk assign / tag / escalate.** *(Medium-High)*
`handleBulkStatus` (`tickets/page.tsx:260`) is the only bulk operation, rendered as five inline status buttons (screenshot would show "Novo / Aberto / Pendente / Em espera / Resolvido"). An agent still cannot multi-select to reassign or tag. Zendesk bulk-edit covers assignee, group, priority, tags and status together. **Fix:** add bulk assignee and bulk tag actions to the same bar; consider collapsing the five status buttons into one Select to reduce bar width.

**M3 — Resolving from the list and bulk-resolving bypass the first-response check.** *(Medium)*
The row resolve button and the bulk "Resolvido" action both move a ticket straight to resolved. Combined with H8 (manual first-response), a ticket can be closed having never recorded a first response, silently breaching response-SLA reporting. **Fix:** when resolving a ticket with no `first_response_at`, prompt or auto-stamp it; surface the implication.

**M4 — Filter state is still not URL-synced.** *(Medium)*
Filters/sort live in `useState` (`tickets/page.tsx:161-167`). The SLA banner deep-links to a filtered queue, and dashboard cards should (M2) — but the page never reads `searchParams`, so those links do nothing. **Fix:** hydrate filters + sort from `searchParams` and write them back; this also enables shareable views.

**M5 — No saved/custom views.** *(Medium)*
The four filters are not persistable. Zendesk's whole triage model is named Views ("Não atribuídos", "SLA em risco"). **Fix:** allow saving a filter+sort combination as a named view.

**M6 — Accent loss regressed into the new bulk bar and status meta.** *(Medium)*
The new code is mostly correct (`status.ts` uses "Em espera", "Resolvido"), but the SLA-rules screen still ships "Nao" (see S3) and the detail sheet still has un-accented headings (see D-findings). The product mixes correct and stripped diacritics within the same module. **Fix:** sweep all support strings for diacritics — "Não", "Histórico de Escalação", "Responsáveis", "Escalação".

**L2 — No pagination / virtualization.** *(Low for now)*
The table renders every active ticket for the sector. Fine for 8 seeded rows, will not survive a real backlog. **Fix:** server-side pagination or infinite scroll once volume grows.

**L3 — `TicketCreateDialog` still passes empty `boardId`/`columnId`.** *(Low)*
`tickets/page.tsx:449-450` and `:515-516` pass `boardId=""`/`columnId=""`. Verify `createTicket` assigns a sensible default board/column so tickets are not orphaned from the kanban. Same item as Wave 3 L11.

**L4 — Bulk-action bar lacks an undo.** *(Low)*
A bulk status change of many tickets is irreversible from the toast. Zendesk offers undo on bulk updates. **Fix:** add an "Desfazer" action to the success toast.

---

## Screen 3 — Regras SLA

**Screenshot:** `screenshots/audit-wave4/admin/27-support-sla-rules.png`
**Code:** `app/(dashboard)/support/sla-rules/page.tsx`, `sla-rule-form-dialog.tsx`

### What works
- Clean table; `formatHours` renders `4h` / `2d` / `1d 4h`; response/resolve times mono-spaced.
- Inline `Switch` for active/inactive; delete now goes through `ConfirmDialog` (Wave 3 fix verified at `:209`).

### Findings

**S1 — "Horário Comercial" is a yes/no flag with no schedule definition.** *(High)*
`sla-rules/page.tsx:182-190` renders a Sim/Não badge, but there is no UI anywhere to define *what* business hours are — timezone, working days, holidays. The SLA countdown therefore cannot honour the flag accurately; "Sim" is currently cosmetic. Freshdesk requires a Business Hours object (with operational hours and holiday calendar) before an SLA can reference it, and the SLA explicitly chooses "Business hours" vs "Calendar hours (24×7)" ([Freshdesk — Understanding SLA Policies](https://support.freshdesk.com/support/solutions/articles/37626-understanding-sla-policies)). **Fix:** add a Business Hours configuration (timezone + weekly schedule + holidays) and bind the flag to it.

**S2 — No breach/escalation actions on a rule.** *(High)*
A rule defines response/resolve windows but says nothing about *what happens* on breach — no notify-manager, no auto-escalate, no warn-at-X%. Freshdesk SLA policies include an Escalations section with per-target recipients and timing for first-response / next-response / resolution violations ([Freshdesk — Understanding SLA Policies](https://support.freshdesk.com/support/solutions/articles/37626-understanding-sla-policies)). Today the only breach surface is the dashboard banner — a manager who never opens the dashboard never knows. **Fix:** add optional breach actions to the rule form (notificar responsável/gestor, escalar automaticamente) and a warn threshold.

**S3 — "Nao" — stripped diacritic.** *(Medium)*
`sla-rules/page.tsx:188` literally renders `"Nao"`. Visible in screenshot `27`, three times. **Fix:** `"Não"`.

**M7 — Category column is dead weight.** *(Low)*
All four seeded rules show "Todas" (`:174`). The schema supports a `category` column, but with one rule per priority the flat table cannot express precedence when category-specific and priority-only rules both match. **Fix:** when category rules exist, indicate which rule wins, or group by category.

**M8 — No first-response vs resolution split in breach reporting.** *(Low)*
The rule cleanly separates the two times and the data model has `sla_response_breached` / `sla_resolve_breached`, but the dashboard merges them. See dashboard H2 — this is the likely root of the banner/card mismatch. **Fix:** report the two breach types separately.

---

## Screen 4 — Base de Conhecimento

**Screenshot:** `screenshots/audit-wave4/admin/28-support-knowledge-base.png`
**Code:** `app/(dashboard)/support/knowledge-base/page.tsx`, `kb-article-sheet.tsx`, `markdown-renderer.tsx`

### What works
- Segmented filter (Todos / Publicados / Rascunhos) + debounced search + "Novo Artigo".
- Markdown now renders properly in the detail sheet (`MarkdownRenderer`), and card previews use `stripMarkdown` — the Wave 3 raw-`##`/`**` defect is fixed. Screenshot `28` confirms clean preview text.
- Delete is confirmed via `ConfirmDialog` (`:267`).
- Responsive 3-column grid; skeleton and search-aware empty states.

### Findings

**K1 — Hover-only card actions are still not keyboard/touch accessible.** *(High)*
Edit / publish-toggle / delete sit in `opacity-0 group-hover:opacity-100` (`knowledge-base/page.tsx:235`). They are invisible without a mouse hover — unreachable for keyboard and touch users, and there is no `focus-within` fallback, so a keyboard user tabbing into the buttons cannot see them. Same pattern in Respostas Prontas (`canned-responses/page.tsx:171`). This is a WCAG 2.1 operability failure. **Fix:** add `group-focus-within:opacity-100`, make actions always-visible on touch (or move them into a keyboard-reachable kebab `DropdownMenu`).

**K2 — No usage signals — views, helpfulness, updated-at.** *(Medium)*
Cards show only `created_at` (`:227`). There is no view count, no "isto foi útil?" feedback, no "atualizado em". Zendesk Guide surfaces total views and a Helpfulness Score (% positive votes) as the core KB-health metrics ([Zendesk — Metrics that matter for your knowledge base](https://support.zendesk.com/hc/en-us/articles/4408838548250-Using-the-metrics-that-matter-to-improve-your-knowledge-base)). Without them an admin cannot tell which articles are used or stale. **Fix:** track and surface view counts + an updated-at date; add article feedback voting.

**K3 — No category filter, only free-text search.** *(Medium)*
`categories` is computed (`:60-66`) and passed only to the form. The list page has no category dropdown — yet the segmented control already proves the pattern. **Fix:** add a category filter (or collection grouping) next to the search box.

**K4 — KB is not linked into the ticket flow.** *(Medium)*
An agent in the ticket detail sheet cannot search or insert a KB article into a reply, and there is no customer-facing help center. Intercom and Zendesk couple KB suggestions directly into the agent composer. **Fix:** add a KB search/insert in the (future public) reply composer; consider a customer-facing portal.

**L5 — Card date is ambiguous.** *(Low)*
`28` shows "15/05/2026" with no label — could be created or updated. **Fix:** prefix with "Criado" / "Atualizado".

---

## Screen 5 — Respostas Prontas

**Screenshot:** `screenshots/audit-wave4/admin/29-support-canned-responses.png`
**Code:** `app/(dashboard)/support/canned-responses/page.tsx`, `lib/support/shortcut.ts`

### What works
- Card grid; click-to-expand (`line-clamp-3` → full); one-click "Copiar" with `Check` confirmation + toast.
- Shortcut badges now render single-slash (`/escalar`, `/followup`, `/resolvido`, `/ola`) — Wave 3 double-slash defect fixed by `normalizeShortcut`.
- Delete confirmed via `ConfirmDialog` (`:186`).

### Findings

**C1 — Shortcuts are still decorative; not usable inside a reply.** *(High)*
The cards show `/escalar`, `/followup` etc., but the ticket comment box (`CommentsTab`) is a plain `Textarea` with no `/`-autocomplete and no "inserir resposta pronta" picker — confirmed: `grep` for `canned`/`shortcut` in `ticket-detail-sheet.tsx` returns nothing. In Zendesk the macro keyboard shortcut applies a prepared response inside the composer ([Zendesk — Creating macros](https://support.zendesk.com/hc/en-us/articles/4408844187034-Creating-macros-for-repetitive-ticket-responses-and-actions)); Freshdesk/Help Scout fire canned responses on `/` in the reply box. Today the only way to use one is open this tab → Copiar → switch tabs → paste. **Fix:** wire a `/`-triggered canned-response picker into the ticket composer (the building block to add alongside H3).

**C2 — No template variables / merge fields.** *(Medium)*
Content is static; "Resolução de ticket" literally contains `**Solução aplicada:** [descrever aqui]` (visible in `29`). Benchmarked desks resolve `{{requester.name}}`, `{{agent.name}}`, `{{ticket.id}}` on insert. **Fix:** support variable interpolation that resolves when the response is inserted.

**C3 — No search, filter or category grouping.** *(Medium)*
The KB has search; canned responses do not, despite every card carrying a `category` badge (`escalonamento`, `follow_up`, `resolucao`, `saudacao`). A growing library becomes unscannable. **Fix:** add a search box + category filter, mirroring the KB layout.

**C4 — Stripped accents in seed content.** *(Low)*
Card titles/content show "Escalonamento para equipe tecnica", "Resolucao de ticket", "Saudacao inicial", "sua solicitacao" (`29`). This is seed data, not code, but it is the user-visible default library. **Fix:** correct the seed strings — "técnica", "Resolução", "Saudação", "solicitação".

**L6 — Hover-only edit/delete — same accessibility issue as K1.** *(Low, but same root cause)*
`canned-responses/page.tsx:171` uses the same `opacity-0 group-hover:opacity-100`. Fix together with K1.

**L7 — No usage analytics.** *(Low)*
No "usada N vezes" signal, so admins cannot prune dead templates. **Fix:** track insert counts once C1 lands.

---

## Component — Ticket Detail Sheet

**Code:** `components/support/ticket-detail-sheet.tsx`, `ticket-attachments.tsx`, `ticket-status-select.tsx`

### What works
- Three tabs (Detalhes / Comentários / Atividade); contextual footer (Marcar primeira resposta / Escalar / Resolver / Reabrir).
- New `TicketStatusSelect` inline status picker with an "SLA pausado" hint when status is `pending`/`on_hold` (`:262`) — good, and it correctly invalidates `sla-status`.
- New `TicketAttachments`: drag-drop, 10MB cap, signed-URL download, rollback of orphaned storage objects on metadata failure (`ticket-attachments.tsx:74-81`) — solid engineering.
- Activity timeline with coloured dots and relative timestamps.

### Findings

**D1 — SLA pills in the sheet use a different threshold model than the list.** *(Medium)*
`formatSlaTime` (`ticket-detail-sheet.tsx:135-146`) grades by *absolute hours remaining* (>4h green / 1–4h yellow / <1h red), while `getSlaIndicator` in the list (`tickets/page.tsx:99-117`) and `slaHealthFromPercentRemaining` in `lib/support/sla.ts:40` grade by *percentage remaining*. The same ticket can show green in the list and yellow in the sheet. A shared, percentage-based helper already exists in `sla.ts` and is unused by the sheet. **Fix:** make the sheet consume `slaHealthFromPercentRemaining`.

**D2 — `formatSlaTime` colour classes are not dark-mode aware.** *(Medium)*
`:103`, `:118`, `:139-145` return hard-coded `bg-red-50` / `bg-green-50` / `bg-yellow-50` / `text-red-600` with no `dark:` variants — unlike the rest of the module (and `TICKET_STATUS_META`) which carefully pairs `dark:` classes. In dark mode these SLA pills are low-contrast. **Fix:** add `dark:` variants, or reuse the badge classes from `status.ts`.

**D3 — First-response SLA is still satisfied by a manual button, not by replying.** *(Medium)*
"Marcar primeira resposta" (`:796`) is a discrete button; FRT is gameable and forgettable. Industry definition: FRT is measured to the first *substantive non-automated reply* ([Lorikeet — first response time benchmarks](https://www.lorikeetcx.ai/articles/first-response-time-benchmark-customer-service)). **Fix:** once a public reply exists (H3), auto-stamp `first_response_at` on the first outbound message and retire the manual button.

**D4 — Priority / category / channel are read-only in the sheet.** *(Medium)*
The Detalhes grid shows priority/category/channel as static text/badges (`:294-319`). Status is now editable via `TicketStatusSelect`, but re-triaging priority or category still requires leaving the desk. `updateTicketSchema` supports category/subcategory/channel edits. **Fix:** make priority/category/channel inline-editable, mirroring the status picker.

**D5 — Escalation targets are limited to the agent's own sectors.** *(Medium)*
`EscalateTicketForm` queries `user_sector_roles` for the *current user*, so an agent can only escalate to teams they are a member of — not necessarily the correct destination. **Fix:** drive the target list from organisation sectors (permission-checked), not the agent's memberships.

**D6 — No requester / contact panel.** *(Medium)*
The sheet shows only `requester_email` as one text field (`:333`). There is no contact identity, no history of that requester's other tickets, no organisation. Help Scout and Intercom sidebars surface exactly this. **Fix:** add a requester panel with prior-ticket history.

**D7 — Comment composer has no attachment support.** *(Low)*
`TicketAttachments` lives in the Detalhes tab; the Comentários composer (`:512`) is a bare Textarea. An agent replying to a comment cannot attach a file in context. **Fix:** allow attachments from the comment composer too (or unify once H3 builds the real reply box).

**L8 — Un-accented headings inside the sheet.** *(Low)*
`:199` "Historico de Escalacao", `:339` "Responsaveis", `:401` "Escalacao", and `formatRelativeTime` returns "min atras" / "h atras" (`:160-162`). **Fix:** "Histórico de Escalação", "Responsáveis", "Escalação", "atrás".

---

## Cross-cutting findings

- **Internal-only conversation (High).** The biggest remaining functional gap — no public reply / email-out, no internal-vs-public toggle (H3). This blocks C1 (canned-response insertion) and D3 (auto FRT) as well.
- **Dashboard has no operational metrics (High).** FRT, resolution time, SLA %, CSAT, backlog age, tickets-by-agent are all absent (H1); the banner/card numbers also contradict each other (H2).
- **pt-BR diacritics regressed (Medium).** The new `status.ts` strings are correct, but "Nao" (SLA rules), "Historico de Escalacao / Responsaveis / Escalacao" (detail sheet), "atras" (relative time) and the seed canned-response content are all un-accented. A module-wide sweep is overdue.
- **Hover-only actions break keyboard/touch (Medium).** KB and canned-response cards both hide actions behind `group-hover` with no `focus-within` fallback (K1, L6).
- **SLA threshold logic is inconsistent (Medium).** List uses percentage, sheet uses absolute hours, despite a shared helper in `sla.ts` (D1); sheet SLA pills also miss dark-mode variants (D2).
- **No business-hours model & no breach actions (High for SLA completeness).** The SLA engine computes pause spans well but cannot honour "Horário Comercial" and does nothing on breach (S1, S2).

---

## Prioritized backlog (value / effort)

| # | Improvement | Impact | Effort | Rationale |
|---|---|---|---|---|
| 1 | Fix dashboard banner/card SLA mismatch; drive both from one source | High | Low | Self-contradicting numbers on the landing screen |
| 2 | Sweep all support strings for pt-BR diacritics ("Não", "Histórico de Escalação", "Responsáveis", "atrás") + fix canned-response seed | High | Low | Visible polish defect that regressed into Wave 3 code |
| 3 | Add free-text search to the Tickets queue | High | Low | Core triage capability, still absent |
| 4 | Add `focus-within`/touch visibility (or kebab menu) to KB & canned-response card actions | High | Low | WCAG operability failure |
| 5 | Unify SLA pill logic on `slaHealthFromPercentRemaining` + add dark-mode variants | Medium | Low | Consistency + dark-mode contrast |
| 6 | Operational KPIs on dashboard (FRT, resolução, % SLA, CSAT) + clickable cards; align recent-table status with the 5-state enum | High | Medium | Metrics a manager actually steers by |
| 7 | URL-synced filters/sort + saved views; makes SLA banner & KPI deep-links work | Medium | Medium | Unblocks #6 click-through and shareable triage |
| 8 | Public reply path (email-out + internal-note/public-reply toggle) | High | High | Largest functional gap vs. all four benchmarks |
| 9 | Wire `/`-canned-response picker + template variables into the composer | High | Medium | Makes the canned-response library functional (depends on #8) |
| 10 | Bulk assign / bulk tag in the bulk-action bar | Medium | Medium | Completes triage workflow |
| 11 | Editable priority/category/channel in the detail sheet | Medium | Low | Re-triage without leaving the desk |
| 12 | SLA breach actions (notify/auto-escalate) + business-hours calendar config | High | High | Completes the SLA engine; "Horário Comercial" is cosmetic today |
| 13 | KB usage analytics (views, helpfulness votes, updated-at) + category filter | Medium | Medium | KB health is invisible today |
| 14 | Requester/contact panel with prior-ticket history in the detail sheet | Medium | Medium | Context parity with Help Scout/Intercom |
| 15 | Auto-stamp `first_response_at` on first public reply; guard resolve when FRT missing | Medium | Low | Fixes gameable FRT (depends on #8) |

---

## Quick wins

1. **Reconcile the dashboard banner ("4") vs the "SLA Violados" card ("2")** — one number is wrong; pick one source. (`use-support-stats.ts`, `sla-alert-banner.tsx`)
2. **Fix `"Nao"` → `"Não"`** in `sla-rules/page.tsx:188`, plus "Historico de Escalacao / Responsaveis / Escalacao" and "atras" in `ticket-detail-sheet.tsx`.
3. **Add a search input to the Tickets queue** — title / requester / id, debounced. (`tickets/page.tsx`)
4. **Make KB & canned-response card actions keyboard/touch reachable** — add `group-focus-within:opacity-100` (or a kebab menu) at `knowledge-base/page.tsx:235` and `canned-responses/page.tsx:171`.
5. **Switch the recent-tickets table to the 5-state status** — replace the `resolved_at` ternary at `page.tsx:165` with `TICKET_STATUS_META`.
6. **Add `dark:` variants to `formatSlaTime`** colour classes (`ticket-detail-sheet.tsx:103-145`) and reuse `slaHealthFromPercentRemaining` so list and sheet agree.
7. **Add a category filter to Respostas Prontas** — the `category` field is already on every card; reuse the KB filter pattern.

---

## Sources

- [Zendesk — Internal Note vs Public Reply (Agent Workspace)](https://support.zendesk.com/hc/en-us/community/posts/4409222717722-Zendesk-s-New-Interface-Agent-Workspace-Internal-Note-vs-Public-Reply)
- [Zendesk — Adding comments to tickets](https://support.zendesk.com/hc/en-us/articles/4408828489370-Adding-comments-to-tickets)
- [Zendesk — Creating macros for repetitive ticket responses](https://support.zendesk.com/hc/en-us/articles/4408844187034-Creating-macros-for-repetitive-ticket-responses-and-actions)
- [Zendesk — Using the metrics that matter to improve your knowledge base](https://support.zendesk.com/hc/en-us/articles/4408838548250-Using-the-metrics-that-matter-to-improve-your-knowledge-base)
- [Freshdesk — Understanding SLA Policies](https://support.freshdesk.com/support/solutions/articles/37626-understanding-sla-policies)
- [Freshworks — Customer service dashboard examples](https://www.freshworks.com/explore-cx/customer-service-dashboard/)
- [Hiver — Top 17 help desk metrics for 2025](https://hiverhq.com/blog/help-desk-metrics)
- [Lorikeet — First response time benchmarks 2026](https://www.lorikeetcx.ai/articles/first-response-time-benchmark-customer-service)

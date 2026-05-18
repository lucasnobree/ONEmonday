# UX Audit Wave 4 — Marketing (E-mail / Automações), Dev-Tools, Settings (Integrações)

**Auditor:** Senior Product Designer / Front-end Engineer
**Date:** 2026-05-18
**Scope:** Screens added or carried over since Wave 3 — Marketing `Campanhas de E-mail` and `Automações`, the Dev-Tools overview, and Settings `Integrações`. Wave 3 reports (`ux-audit-marketing.md`, `ux-audit-analytics-devtools-settings.md`) were read first; already-fixed items are noted and not re-raised.
**Method:** Screenshot review (`screenshots/audit-wave4/admin/40,45-50`) + source review of `app/(dashboard)/marketing/{email,automations}`, `app/(dashboard)/settings/integrations`, `components/marketing/*`, `hooks/marketing/*`, `lib/validations/marketing.ts`, `lib/marketing/labels.ts`. Market comparison via web research. **Analysis only — no code changed.**

---

## What Wave 3 already fixed (verified, not re-raised)

- **Dev-Tools delete confirmation** (Wave 3 F12): `dev-tools/page.tsx:46` now imports and uses `ConfirmDialog` on incident/service deletes. Resolved.
- **Marketing error states** (Wave 3 C1): a shared `MarketingError` component exists and the new E-mail/Automações pages render `isError → <MarketingError onRetry>`. Resolved for the new screens.
- **Delete confirmations on new Marketing screens** (Wave 3 F8/F24 pattern): both new screens wrap delete in `ConfirmDialog`. Good — the pattern propagated correctly.
- **Settings notification toggles** now carry `aria-label` (`settings/page.tsx:234,243`) — Wave 3 F21 resolved.
- **Select label association**: the new dialogs give every `SelectTrigger` an `id` matched to its `<Label htmlFor>` — Wave 3 F11/F26 pattern resolved on new screens.

---

## Module summary & ratings

| Area | Rating | Verdict |
|---|---|---|
| Marketing — E-mails | **5.5 / 10** | A working ESP send path with status tracking and proper locking, but no test send, no preview, no HTML editor, and recipients are hand-typed into a textarea even when an audience is attached. |
| Marketing — Automações | **5.5 / 10** | A real trigger→step engine with steps/enrollment dialogs, but it runs only on a manual "Processar agora" button, the linear step list cannot be reordered, and enrollment/processing results are invisible after the toast. |
| Dev-Tools — overview | **5.5 / 10** | Unchanged since Wave 3 — confirmation dialogs landed, but the overview is still 7 non-clickable stat cards over empty canvas with no recent-activity feed (Wave 3 F11/F15 still open). |
| Settings — Integrações | **6.0 / 10** | Solid encrypted-credential model and event routing, but raw enum strings leak to the UI, no test/verify action, no confirmation on credential delete, and the routed channels (Teams/WhatsApp) are disjoint from the in-app/email notification matrix on the Geral tab. |

Shared Wave 4 theme: **the new screens are functionally honest but operationally raw** — they expose enum slugs (`card_assigned`, `teams`), skip "test/preview before you commit" affordances that every leader treats as mandatory, and surface results only through a transient toast.

---

## SCREEN 1 — Marketing › Campanhas de E-mail

**Screenshot:** `screenshots/audit-wave4/admin/45-marketing-email.png` (empty tenant)
**Code:** `app/(dashboard)/marketing/email/page.tsx`, `components/marketing/email-campaign-form-dialog.tsx`, `components/marketing/email-send-dialog.tsx`, `hooks/marketing/use-email-campaigns.ts`

### What works
- Clear empty state (envelope icon + actionable copy) and a primary "Nova Campanha" top-right.
- The list row is well-built: name + subject truncated, a status `Badge` from a centralized variant map (`labels.ts:83`), and a delivered/failed summary string for `sent` campaigns.
- Correct **state locking**: when `status` is `sent` or `sending`, Enviar and Editar are `disabled` (`email/page.tsx:91,118,130`) — you cannot mutate an already-sent campaign.
- The send dialog parses `email` or `Name <email>` lines, shows a live "N destinatário(s) detectado(s)" counter, and is explicit about the Resend no-op mode.
- Delete is confirmed via `ConfirmDialog`.

### Findings

**W1 — No "enviar teste" / preview before sending a real campaign. (High)**
`EmailSendDialog` jumps straight from a textarea of addresses to a live send. There is no test-send to yourself, no desktop/mobile preview, no link check. Mailchimp makes "Send a test email" a first-class action in the email designer and offers Inbox Preview and a Link Checker ([Mailchimp — Preview and Test](https://mailchimp.com/help/preview-and-test-your-email-campaign/)). For a tool that can blast up to 5000 recipients (`sendEmailCampaignSchema`, `marketing.ts:193`), shipping with zero pre-send verification is the single biggest risk on this screen.
*Fix:* add a "Enviar teste" button in `email-campaign-form-dialog.tsx` and a read-only preview pane (render `body_html`) in an iframe; both reuse the existing `sendEmailCampaign` path with a single recipient.

**W2 — An audience can be attached but is never used as the recipient source. (High)**
`EmailCampaignFormDialog` has an "Audiência" select wired to `useSegments` (`email-campaign-form-dialog.tsx:192`) and stores `segment_id` on the campaign — yet `EmailSendDialog` ignores it entirely and forces the user to hand-paste every address into a textarea (`email-send-dialog.tsx:48`). The whole point of selecting an audience is that the system knows who to send to. Mailchimp/HubSpot send to the selected audience/list by definition. Right now the segment field is decorative.
*Fix:* when the campaign has a `segment_id`, default the send dialog to "Enviar para a audiência «X» (N contatos)" with the manual textarea as an override; resolve recipients server-side from the segment.

**W3 — "Editor simples de texto" with no HTML editing path and a silent HTML fallback. (High)**
The form only exposes a plain-text `Textarea`; `handleSubmit` synthesizes HTML by wrapping text in `<p>` and replacing newlines (`email-campaign-form-dialog.tsx:79-82`). `bodyHtml` exists in the schema and DB but there is no field to edit it, and the helper text openly defers a visual builder. The result: every campaign is an unstyled paragraph — no logo, no button, no layout. Mailchimp's drag-and-drop builder and even basic ESPs offer at minimum a rich-text editor.
*Fix:* short term, add a rich-text (or raw-HTML) tab so `bodyHtml` is reachable and previewable; medium term, a block/template builder. At minimum, ship 1-2 branded HTML templates.

**W4 — Recipient textarea has no validation feedback and silently drops malformed lines. (Medium)**
`parseRecipients` accepts any non-empty token as `{ email: line }` (`email-send-dialog.tsx:36`); "joao(at)exemplo" becomes a "recipient" and the count includes it. The Zod `emailSchema` will reject it server-side, but the user sees a correct-looking count then a generic failure. No per-line error, no dedupe, no "3 inválidos" warning.
*Fix:* validate each parsed line against an email regex, show invalid lines inline, dedupe, and split the counter into "N válidos · M inválidos".

**W5 — No campaign detail / per-campaign analytics. (Medium)**
A `sent` campaign shows only "X/Y entregues · Z falha(s)" inline. There is no open rate, click rate, bounce list, or send history — Resend reports deliveries/opens/clicks via webhooks, and `recipient_count`/`delivered_count`/`failed_count` already exist on the row. Mailchimp's post-send report is a core screen.
*Fix:* a `/marketing/email/[id]` detail page with delivery funnel and (once Resend webhooks are wired) open/click metrics.

**W6 — No filter, search, or sort on the campaign list. (Medium)**
`email/page.tsx` maps `emailCampaigns` straight to rows ordered by `created_at desc`. Consistent with the Wave 3 list-filter gap (Wave 3 F7) — at 30+ campaigns there is no way to find drafts vs. sent. The data is already client-side, so this is cheap.
*Fix:* add a status segmented filter + text search over the loaded array.

**W7 — No scheduled send despite `scheduled` status and `scheduled_at` column. (Low)**
`EMAIL_CAMPAIGN_STATUSES` includes `scheduled` and the row type carries `scheduled_at`, but no UI sets it — a campaign can only be sent immediately. The status is unreachable.
*Fix:* add a "Agendar envio" date-time option in the send dialog, or hide the `scheduled` status until supported.

**W8 — pt-BR copy is correct here.** "Campanhas de E-mail", "Componha e envie e-mails para uma audiência via gateway ESP" — accents and grammar are right. No copy finding. (Minor: "ESP" is an untranslated acronym in user-facing text; consider "provedor de e-mail".)

---

## SCREEN 2 — Marketing › Automações

**Screenshot:** `screenshots/audit-wave4/admin/46-marketing-automations.png` (empty tenant)
**Code:** `app/(dashboard)/marketing/automations/page.tsx`, `components/marketing/sequence-form-dialog.tsx`, `components/marketing/sequence-steps-dialog.tsx`, `components/marketing/sequence-enroll-dialog.tsx`, `hooks/marketing/use-sequences.ts`

### What works
- The model is genuinely sound: sequence (trigger + status) → ordered steps (`wait` / `send_email`) → enrollments with `current_step` and `next_run_at`. The steps dialog mirrors the schema's cross-field rules client-side (`sequence-steps-dialog.tsx:92-101`).
- Steps dialog is a clean repeater: add/remove rows, conditional fields (wait-days vs. email-campaign select), `#1/#2` ordering labels.
- Delete confirmed via `ConfirmDialog`; the "segment_entry" trigger conditionally reveals the audience select (`sequence-form-dialog.tsx:181`) — good progressive disclosure.

### Findings

**W9 — The engine runs only when a human clicks "Processar agora". (High)**
`runDueSequenceSteps` is invoked solely by the header button (`automations/page.tsx:90`). There is no cron/scheduled trigger visible — so a "espere 3 dias, depois envie e-mail" sequence does nothing on day 3 unless an admin happens to open this page and click. That defeats the word "automação". HubSpot workflows run continuously on their own schedule ([HubSpot — Enrollment triggers](https://knowledge.hubspot.com/workflows/set-your-workflow-enrollment-triggers)).
*Fix:* run `runDueSequenceSteps` on a scheduled server job (Supabase cron / edge function). Keep the manual button as a "forçar agora" debug aid, and label it as such.

**W10 — `segment_entry` trigger does not actually auto-enroll. (High)**
The trigger type promises "Entrada em audiência" (`labels.ts:107`), but the only enrollment path in the UI is the manual `SequenceEnrollDialog` (one email at a time). Nothing watches a segment for new members and enrolls them. So both trigger types behave identically: manual. This is a broken promise in the UI, same class as Wave 3 F6 (`group_by` collected but ignored).
*Fix:* implement segment-entry enrollment in the scheduled job, or — until then — disable/hide the `segment_entry` option and ship only `manual`.

**W11 — Steps cannot be reordered. (Medium)**
`SequenceStepsDialog` renders steps in array order with add/remove but no move-up/down and no drag handle; `stepOrder` is derived purely from array index on save (`sequence-steps-dialog.tsx:105`). To insert a wait before step 1 you must delete and rebuild. Every workflow builder (HubSpot, Mailchimp Customer Journey) supports reordering/inserting steps.
*Fix:* add up/down buttons (low effort) or drag-to-reorder on the step rows.

**W12 — Enrollment & processing results vanish into a toast. (Medium)**
`handleRun` reports "Processadas N inscrições · M e-mail(s) · K concluída(s)" only as a transient toast (`automations/page.tsx:72`). `useSequenceEnrollments` exists but is not rendered on this page — there is no way to see who is enrolled, what step they are on, or `next_run_at`. The sequence row shows only name + trigger + status.
*Fix:* add an "Inscrições" view per sequence (the hook is already written) showing recipient, current step, status, next run; show an enrollment count on the sequence row.

**W13 — No per-step delay granularity below 1 day, and no email/event triggers. (Low)**
`wait` steps are integer days only (`waitDays`, min 1). HubSpot best practice is a 15-30 minute delay after a form submit to feel natural ([HubSpot enrollment best practices](https://knowledge.hubspot.com/workflows/set-your-workflow-enrollment-triggers)). Triggers are limited to `segment_entry`/`manual` — no form-submission or CRM-event trigger.
*Fix:* allow hour-level waits; consider a form-submit trigger once CRM forms can emit events.

**W14 — "Processar agora" has no result surface if zero are due.** It will toast "Processadas 0 inscrições" which reads like a no-op error. Minor; consider an inline "última execução: …" line instead of a toast.

**W15 — pt-BR copy is correct.** "Sequências gatilho → passo (esperar / enviar e-mail)" is accurate; "Nutrir leads" is accepted marketing jargon. No accent issues.

---

## SCREEN 3 — Dev-Tools › Visão Geral

**Screenshot:** `screenshots/audit-wave4/admin/40-dev-tools.png`
**Code:** `app/(dashboard)/dev-tools/page.tsx`

This screen is **unchanged since Wave 3** — same 5 tabs, same 7 stat cards. Wave 3 F12 (delete confirmation) is now fixed (`ConfirmDialog` imported at `dev-tools/page.tsx:46`). The remaining Wave 3 findings still stand and are **not re-detailed here** — see `ux-audit-analytics-devtools-settings.md` F11, F13, F14, F15, F16, F17, F18, F19. Two are worth re-flagging because the screenshot makes them vivid:

**W16 — The overview is 7 stat cards over a large empty canvas; nothing is clickable and there is no recent-activity feed. (Medium — re-flag of Wave 3 F15)**
The screenshot shows ~70% of the viewport empty below the cards. "SEV1 Abertos: 0" is not a link; there is no "incidentes recentes" or "últimos deploys". PagerDuty's on-call view leads with the open-incident list, not just counts.
*Fix:* make each card deep-link into its tab pre-filtered, and add a recent-incidents / recent-deploys list below the cards.

**W17 — MTTA/MTTR cards render a bare "-" with no explanation on an empty tenant. (Low)**
With no incidents, both metric cards show "-" with no tooltip or "sem dados ainda" caption — a new admin cannot tell if it is broken or simply empty.
*Fix:* render "Sem incidentes resolvidos" muted text instead of "-", and add a tooltip defining MTTA/MTTR.

(Lists still lack filter/sort/search — Wave 3 F11 — and there is still no incident timeline/acknowledge — Wave 3 F13. Both remain the top Dev-Tools priorities.)

---

## SCREEN 4 — Settings › Integrações

**Screenshot:** `screenshots/audit-wave4/admin/49-settings-integrations.png`
**Code:** `app/(dashboard)/settings/integrations/page.tsx`, `lib/actions/integrations/{credentials,routes}`

### What works
- Strong security model: secrets are encrypted server-side, the UI never reads the secret back (it derives a `has_secret` boolean and shows a "Configurado / Sem segredo" badge — `integrations/page.tsx:104,290`). Password-type input for the WhatsApp token.
- `PermissionGate` with `integration:manage` and a clear fallback (`integrations/page.tsx:242`) — correctly gated, consistent with the rest of Settings.
- Provider-specific form fields (Teams = one webhook URL; WhatsApp = token + phone-number ID) via conditional rendering.
- Route toggles are optimistic with revert-on-error (`handleToggleRoute`, `integrations/page.tsx:189`), matching the notification-matrix pattern.
- The credential `Trash2` button and route toggles carry `aria-label`s.

### Findings

**W18 — Event and channel are shown as raw enum slugs. (High)**
The "Roteamento de eventos" table and selects render `r.event_type` and `r.channel` verbatim — `card_assigned`, `card_overdue`, `teams`, `whatsapp` (`integrations/page.tsx:409,410,444,463`). The screenshot confirms "card_assigned" and "teams" appearing literally in the UI. The Geral notification tab already has the proper labels for the *same* events ("Card atribuído", etc., `settings/page.tsx:45-51`) — so correct pt-BR labels exist three files away and are not reused here. This is the most visible polish defect in Wave 4.
*Fix:* import/centralize an `EVENT_LABELS` and `CHANNEL_LABELS` map (the `PROVIDERS` map already does this for providers — extend the same pattern to events and channels).

**W19 — Deleting a credential has no confirmation. (High)**
`handleDeleteCredential` fires immediately on the trash-icon click (`integrations/page.tsx:300`). Removing a Teams/WhatsApp credential silently breaks every routed alert for the sector with only a toast — and the `ConfirmDialog` component is already used two screens over in Marketing. Inconsistent and risky.
*Fix:* wrap the credential delete (and ideally the route delete) in `ConfirmDialog` — "Remover credencial do Teams? Os alertas roteados para este canal deixarão de funcionar."

**W20 — No "testar" / verify action for a saved credential. (High)**
After "Salvar credencial" the user gets only a toast; there is no way to confirm the Teams webhook URL or WhatsApp token actually works until a real event fires in production. LaunchDarkly lets you verify an integration on setup, and webhook configs are validated at creation ([LaunchDarkly — Webhooks](https://docs.launchdarkly.com/home/infrastructure/webhooks)). A typo'd webhook URL fails silently forever here.
*Fix:* add a "Enviar mensagem de teste" button per configured provider that posts a sample payload and reports success/failure inline.

**W21 — Routed channels (Teams/WhatsApp) are disjoint from the in-app/Email notification matrix. (Medium)**
Settings/Geral lets a user route the 5 card events to **In-app / Email**; Settings/Integrações lets an admin route the *same 5 events* to **Teams / WhatsApp**. They are two separate screens, two separate data models (`notification_preferences` vs `notification_channel_routes`), with no cross-reference. A user configuring "where do card alerts go" must know to visit two tabs. There is also no per-route description of what the event means.
*Fix:* longer term, unify into one event×channel matrix (In-app / Email / Teams / WhatsApp) so all routing lives in one grid; short term, add a cross-link note on each tab.

**W22 — Credential capability is hard-coded to "messaging"; the list shows `capability` indirectly only. (Medium)**
`handleSaveCredential` always sends `capability: "messaging"` (`integrations/page.tsx:135`) and the `Credential` interface carries `capability` but the row never displays it. The data model implies multiple capabilities (e.g. email, messaging) but the UI can reach only one — same silent-mismatch class as Wave 3 F12 (currency column).
*Fix:* either surface a capability select or drop the field from the UI surface until multi-capability is real.

**W23 — Adding a route allows duplicate-looking rows and gives no guidance. (Medium)**
`handleAddRoute` upserts `(event, channel)`; the form defaults to the first event + "teams" every time, and there is no indication which event→channel pairs already exist while you pick. A user can repeatedly "Adicionar rota" for the same pair (the upsert dedupes server-side, but the UI gives no feedback that nothing new happened).
*Fix:* disable already-routed pairs in the select, or show "rota já existe" inline.

**W24 — Loading state renders before the permission check. (Low)**
The `loading` branch (`integrations/page.tsx:229`) returns its skeleton *outside* `PermissionGate`, so a user without `integration:manage` briefly sees the "Integrações" skeleton before the fallback replaces it. Minor fl\-of\-unauthorized-content.
*Fix:* move the `PermissionGate` wrapper above the loading branch.

**W25 — Heading hierarchy: page uses `<h1>` while sibling Settings tabs (Geral) also use `<h1>` but the tab strip lives only on Geral.** When navigating Settings sub-tabs the `<h1>` text changes ("Configurações" → "Integrações") which is fine, but the segmented tab control is rendered by `settings/page.tsx` only — `integrations/page.tsx` re-renders its own `<h1>` with no tab strip context. The screenshot for `49` shows "Integrações" with **no tabs visible**, so a user landing here directly cannot navigate back to Geral/Perfil/Administração without the sidebar. (Confirm: the tab strip is in `settings/page.tsx`, not a shared layout.)
*Fix:* move the Settings tab strip into a shared `settings/layout.tsx` so it appears on all four sub-pages.

**W26 — pt-BR copy is correct.** "Integrações", "Provedores configurados", "Roteamento de eventos", "Segredos são armazenados criptografados" — accents and grammar are right.

---

## Cross-cutting

- **X1 — Settings has no shared layout (Medium).** The tab strip is duplicated only inside `settings/page.tsx`; `integrations`, `admin`, `profile` each render a lone `<h1>`. Per the screenshots, sub-pages show no tabs. A `settings/layout.tsx` would fix W25 and remove the `isGlobalAdmin` tab-strip duplication.
- **X2 — Marketing tab bar still not a real tablist (Low, carry-over of Wave 3 C2).** `marketing/layout.tsx` builds Visão Geral … Automações from `<Link>`s with no `role="tablist"`/`aria-selected`. The two new tabs (E-mails, Automações) inherit the gap.
- **X3 — Enum slugs leak in more than one place.** W18 (events/channels) is the worst, but it confirms a pattern: centralize every user-facing enum→label map. The marketing `labels.ts` is the model to follow; integrations should import from a shared notifications label module.
- **X4 — No empty-tenant guidance on the new Marketing screens beyond one sentence.** Both E-mail and Automações empty states are a single icon + sentence. Given these are the most conceptually complex screens in Marketing, a "Como funciona" 2-3 step hint or a sample template would lower the cold-start cost.

---

## Prioritized backlog (value / effort)

| # | Finding | Impact | Effort | Area |
|---|---|---|---|---|
| 1 | W18 — Replace raw enum slugs (`card_assigned`, `teams`) with pt-BR labels in Integrações | High | Low | Settings |
| 2 | W19 — Confirmation dialog on credential delete (reuse `ConfirmDialog`) | High | Low | Settings |
| 3 | W1 — "Enviar teste" + email preview before a real send | High | Low–Med | Marketing/E-mail |
| 4 | W2 — Send to the campaign's selected audience instead of hand-typed addresses | High | Med | Marketing/E-mail |
| 5 | W9 — Run sequence processing on a schedule, not a manual button | High | Med | Marketing/Automações |
| 6 | W20 — "Testar credencial" action that posts a sample message | High | Med | Settings |
| 7 | W10 — Implement (or hide) the `segment_entry` auto-enroll trigger | High | Med | Marketing/Automações |
| 8 | W3 — Reachable HTML body / rich-text editor + 1-2 templates | High | Med–High | Marketing/E-mail |
| 9 | W12 — Surface sequence enrollments (hook already exists) | Medium | Low–Med | Marketing/Automações |
| 10 | W11 — Reorder steps in the sequence steps dialog | Medium | Low | Marketing/Automações |
| 11 | W4 — Per-line recipient validation + dedupe + invalid count | Medium | Low | Marketing/E-mail |
| 12 | W6 — Status filter + search on the e-mail campaign list | Medium | Low | Marketing/E-mail |
| 13 | X1/W25 — Shared `settings/layout.tsx` so tabs show on all sub-pages | Medium | Low | Settings |
| 14 | W16 — Make Dev-Tools overview cards clickable + recent-activity feed (Wave 3 F15) | Medium | Med | Dev-Tools |
| 15 | W21 — Unify in-app/Email/Teams/WhatsApp into one routing matrix | Medium | High | Settings |
| 16 | W5 — Email campaign detail page with delivery/open/click metrics | Medium | Med–High | Marketing/E-mail |
| 17 | W23/W24/W17 — Disable routed pairs; gate loading behind permission; MTTA/MTTR empty text | Low | Low | Settings/Dev-Tools |

---

## Quick wins (high value, low effort)

1. **W18** — swap enum slugs for the pt-BR labels that already exist in `settings/page.tsx` (`EVENT_LABELS`) and a new `CHANNEL_LABELS`. Pure wiring, ~30 min, removes the most embarrassing visible defect.
2. **W19** — wrap the credential `Trash2` button in the `ConfirmDialog` already imported across Marketing. One component, one prop.
3. **W1** — add an "Enviar teste" button reusing `sendEmailCampaign` with a single recipient; biggest safety win for the smallest change.
4. **W10/W11** — add step up/down buttons; disable or hide `segment_entry` until the scheduled enroll job exists, so the UI stops promising automation it does not perform.
5. **W25/X1** — move the Settings tab strip into a `settings/layout.tsx` so Integrações/Perfil/Administração are navigable without the sidebar.
6. **W17** — replace the bare "-" on MTTA/MTTR with "Sem incidentes resolvidos".

---

## Sources

- [Mailchimp — Preview and Test Your Email Campaign](https://mailchimp.com/help/preview-and-test-your-email-campaign/)
- [Mailchimp — Test with Inbox Preview](https://mailchimp.com/help/test-with-inbox-preview/)
- [HubSpot — Workflow Enrollment Triggers](https://knowledge.hubspot.com/workflows/set-your-workflow-enrollment-triggers)
- [HubSpot — Create and edit sequences](https://knowledge.hubspot.com/sequences/create-and-edit-sequences)
- [LaunchDarkly — Webhooks](https://docs.launchdarkly.com/home/infrastructure/webhooks)
- [LaunchDarkly — PagerDuty integration](https://docs.launchdarkly.com/integrations/pagerduty-guardian-edition)
</content>
</invoke>

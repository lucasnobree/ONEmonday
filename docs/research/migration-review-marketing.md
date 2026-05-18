# Pre-merge review — Marketing automation (migration Phase 5)

**Reviewer:** senior-reviewer
**Date:** 2026-05-18
**Scope:** `apps/web/app/(dashboard)/marketing` (`email`, `automations`), `components/marketing`,
`hooks/marketing`, `lib/marketing` (sequence runner), `lib/integrations` (Resend adapter +
email integration), migration `00114_marketing_automation.sql`.

## Verdict: REQUEST CHANGES

The integration layer, RLS, migration, and the pure `sequence-runner` logic are solid and
well-tested. However there is one **blocking** correctness bug: the runner's `send_email`
step reuses `sendEmailCampaign`, which marks the linked campaign `sent` and locks it — so an
automation sequence delivers email to **only its first recipient ever**, and silently no-ops
for everyone after. This defeats the core purpose of a nurture sequence and must be fixed
before merge.

Verification (run from `apps/web`):
- `npx eslint` on the marketing scope — clean.
- `npx tsc --noEmit` — clean.
- `npx vitest run lib/marketing lib/integrations` — 16 files, 131 tests, all pass.

---

## Blocking

### B1. Sequence `send_email` steps deliver to only the first recipient, then silently no-op
`lib/actions/marketing/sequences.ts:364-374` + `lib/actions/marketing/email-campaigns.ts:195,267-276`

The runner performs a `send_email` step by calling `sendEmailCampaign`:

```ts
const result = await sendEmailCampaign({ emailCampaignId: ..., recipients: [...] });
if (!("error" in result)) emailsSent += 1;
```

But `sendEmailCampaign` is a *campaign blast* action, not a per-recipient send. On its first
invocation it:
- moves the campaign to `status = 'sent'` and sets `sent_at` (line 267-276), and
- **overwrites** `recipient_count`/`delivered_count`/`failed_count` with just that one send's
  numbers.

On every subsequent call it hits the guard at line 195
(`if (campaign.status === "sent" || "sending") return { error: "Campanha já enviada" }`).

Consequences:
1. Enrollment #2..N hitting the same `send_email` step receive **no email** — `sendEmailCampaign`
   returns `{ error }` and nothing is sent.
2. The runner only checks `!("error" in result)` for a counter; it does **not** treat the
   error as a failure. The enrollment is still advanced and marked progressed, so the miss is
   completely silent — no `marketing_email_sends` row, no error surfaced.
3. The campaign's roll-up counters reflect only the last manual blast / first sequence send,
   not cumulative reality.

There is also a race: two recipients processed in the same batch can both pass the
`status` guard before the first `update` lands.

**Fix:** the sequence runner must not go through the campaign-blast action. Extract a
per-recipient send primitive (resolve adapter once, `adapter.send()`, insert one
`marketing_email_sends` row) that does **not** mutate `marketing_email_campaigns.status`.
`sendEmailCampaign` should keep the "blast + lock" semantics for the manual "Enviar" button;
the runner should call the new primitive. The `marketing_email_sends` table already supports
this (it is keyed only by `email_campaign_id`, not by a single send run). At minimum, also
make the runner inspect the send result and record a failed/skipped outcome rather than
silently advancing.

---

## Should fix

### S1. Runner ignores the outcome of a `send_email` step
`lib/actions/marketing/sequences.ts:364-377`

Even independent of B1: the runner advances the enrollment unconditionally after a
`send_email` step. If the ESP send fails (bad domain, transport error) the enrollment moves
on and the recipient never gets that email, with no retry and no record on the enrollment.
A `send_email` step that returns `{ error }` should either keep `next_run_at` for a retry or
record the failure visibly. Today a transient ESP outage silently drops sequence emails.

### S2. `evaluateStep` "complete" path can never report a skip-on-final-step distinction — minor, but `recipient_count` semantics
`lib/actions/marketing/email-campaigns.ts:272`

`recipient_count` is set to `parsed.data.recipients.length` on every send. Because B1 funnels
sequence sends through this action with a one-element recipient list, even setting that bug
aside the counter is per-call, not cumulative. Once B1 is fixed with a dedicated primitive
this is moot; flagging so the fix keeps campaign counters meaningful (e.g. increment, don't
overwrite, or drop the counters from the sequence path entirely).

### S3. Runner has no advisory lock — concurrent runs double-process
`lib/actions/marketing/sequences.ts:289-395`

`runDueSequenceSteps` is `SELECT ... WHERE status='active' AND next_run_at<=now` then a
per-row `update`. Two concurrent invocations (two admins clicking "Processar agora", or a
future cron overlapping a manual run) select the same enrollments and both perform the side
effect — a `send_email` step would send twice. The ESP `Idempotency-Key`
(`ec-${campaignId}-${recipient.email}`) protects the *Resend* call from a true duplicate, but
two `marketing_email_sends` rows are still written and counters double-count. Consider a
`SELECT ... FOR UPDATE SKIP LOCKED` RPC, or a per-enrollment "claim" update
(`update ... set next_run_at = far_future where id = ? and next_run_at = ?`) before doing the
side effect. Acceptable to defer for an MVP entrypoint, but document it.

---

## Nits

### N1. `manage` permission grant is effectively dead
`00114_marketing_automation.sql:36,47`

The migration registers a `manage` action for `email_campaign`/`automation` and grants it to
admin/manager. `hasPermission` (`lib/permissions/engine.ts:57-59`) and the SQL
`user_has_permission` only ever match exact `resource+action` pairs — nothing expands
`manage` to a wildcard. The grant is harmless but inert. This mirrors other modules, so it is
consistent; worth a one-line note or eventual cleanup.

### N2. Idempotency key omits a sequence/run discriminator
`lib/actions/marketing/email-campaigns.ts:226`

`idempotencyKey: ec-${campaign.id}-${recipient.email}` means if the same recipient is
legitimately sent the same campaign twice (e.g. enrolled in two sequences that both send
campaign X, or re-blasted), Resend de-duplicates and the second send is dropped. For a
nurture MVP that is arguably desirable, but it is an implicit product decision — worth a
comment stating the intent.

### N3. `parseRecipients` accepts malformed `Name <email>` silently
`components/marketing/email-send-dialog.tsx:34-39`

A line like `Maria <not-an-email` (missing `>`) falls through to `{ email: line }` and is
sent as-is; the server-side Zod `emailSchema` will reject the whole batch with a field error
that is hard to trace to the offending line. Minor UX; server validation still protects
correctness.

### N4. Runner batch is capped at 50 with no continuation signal
`lib/actions/marketing/sequences.ts:38,309`

`RUNNER_BATCH_SIZE = 50`. If more than 50 enrollments are due, the rest wait for the next
invocation. The return payload doesn't indicate "more remain", so an operator clicking
"Processar agora" can't tell they need to click again. Consider returning
`hasMore: enrollments.length === RUNNER_BATCH_SIZE`.

---

## What is solid (no action needed)

- **Resend adapter no-op behaviour** (`resend-adapter.ts:85-93`): correct — when unconfigured
  it never calls the transport, returns `{ ok: true, noop: true }`, and the caller records
  the send as `skipped`. It never fakes a delivery. Verified by tests. Empty-string API key
  is correctly treated as unconfigured.
- **Email send recipient handling**: address validation on the adapter (`to`/`from` must
  contain `@`), Zod `emailSchema` on the server action, `Name <email>` formatting via
  `formatAddress`. Recipient list capped at 5000.
- **`noop` propagation**: `sendEmailCampaign` correctly maps `result.noop` -> status
  `skipped` and surfaces a clear "gateway não configurado" message; the UI shows a warning
  toast rather than a success.
- **Pure `sequence-runner` logic**: no infinite loops — `advance` always moves the pointer
  forward and a pointer past `maxOrder` yields `completed`; `wait`/`send_email`/`skip` all
  advance; gaps and unlinked `send_email` steps are skipped, not stalled; negative
  `waitDays` clamped to 0. Step lookup by `stepOrder` tolerates unsorted input. Well covered
  by `sequence-runner.test.ts` (end-to-end multi-step, gap, empty sequence, negative wait).
- **RLS**: all 5 new tables have `ENABLE ROW LEVEL SECURITY` and full select/insert/update/
  delete policies. `email_campaign`/`automation` resources gate writes via
  `user_has_permission`; `marketing_sequence_steps` (no `sector_id`) correctly derives access
  from its parent sequence via `EXISTS`. Insert policies pin `created_by = auth.uid()`.
- **Runner authorization gate**: `runDueSequenceSteps` requires `perms.isGlobalAdmin` — a
  cross-sector worker entrypoint, consistent with `runOutboxDispatch`. `user_has_permission`
  short-circuits for global admins, so the runner's `marketing_email_sends` inserts pass RLS.
- **Migration**: idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
  `DROP ... IF EXISTS` before each trigger/policy, `ON CONFLICT DO NOTHING` on the permission
  seeds). Sequentially numbered (00114, between 00113 and 00126), additive, does not edit any
  prior migration. FKs and CHECK constraints are sound; counters are `>= 0`; unique
  constraints on `(sequence_id, step_order)` and `(sequence_id, recipient_email)` are correct.
  The `idx_marketing_sequence_enrollments_due` partial index matches the runner's hot query.
- **No N+1 in the runner**: step lists and sequence active-status are cached per sequence id.
- **Tests**: `resend-adapter.test.ts`, `email-registry.test.ts`, `sequence-runner.test.ts`
  exercise real behaviour (no-op mode, error mapping, idempotency header, step evaluation
  edge cases) — meaningful, not coverage padding.

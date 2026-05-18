# Pre-merge review — Integration layer (migration Phase 1)

Scope: `apps/web/lib/integrations/`, `apps/web/app/api/webhooks/`,
`apps/web/app/(dashboard)/settings/integrations/`, integration server actions,
and migrations `00101`–`00103`.

Read-only review. Verification run from `apps/web`:

- `npx tsc --noEmit` — passed, no errors.
- `npx eslint <integration scope>` — passed, no warnings.
- `npx vitest run lib/integrations` — 13 files, 99 tests, all passing.

## Verdict: APPROVE WITH NITS

The layer is well-built and security-conscious: AES-256-GCM encryption is
correct (random 96-bit IV per call, GCM auth tag stored and verified, dev-key
prod guard), webhook signatures use timing-safe comparison over the raw body,
RLS on the three tables is restrictive and admin-gated, the service-role client
is server-only and never exposed, and the no-op-when-unconfigured path never
crashes or fakes a real delivery. No blocking issues. The items below are a
correctness bug worth fixing soon plus polish.

---

## Blocking

None.

---

## Should fix

### S1. Failed webhook handler becomes a permanent silent skip on retry
`apps/web/lib/integrations/webhook.ts:86-126`

`processWebhook` records the event (state `new`) *before* running `handle`. If
`handle` throws, the event row is finalized as `failed` and a 500 is returned,
so the provider (Meta / Asaas / Focus NFe) will redeliver. On redelivery
`recordEvent` hits the `(provider, external_id)` unique index and returns
`duplicate`, so `processWebhook` returns `200 duplicate` at line 105-107 and
**never re-runs the handler** — a transient DB error during the domain side
effect permanently drops the event with no retry and no alert.

Fix: treat a duplicate whose stored `webhook_events.status = 'failed'` as
re-processable. Either (a) have `recordEvent` return the existing row's status
on a `23505`, and in `processWebhook` re-run `handle` when the prior status is
`failed`; or (b) record the event only *after* a successful `handle`, accepting
a small re-processing window (the domain writes are already idempotent —
`finance_invoices` uses `.neq("status","paid")`, `crm_activities` keys on
`external_ref`). Option (a) preserves the audit row and is preferred.

### S2. Settings page ships the encrypted `secret` ciphertext to the browser
`apps/web/app/(dashboard)/settings/integrations/page.tsx:94`

The client component selects the `secret` column directly
(`select("id, provider, capability, is_enabled, secret")`) only to compute
`has_secret: Boolean(c.secret)`. This sends the AES ciphertext + IV + auth tag
to the browser. RLS limits this to integration managers and it is only
ciphertext (not plaintext), so it is not a plaintext leak — but the brief
requires secrets never be returned to the client, and exposing the envelope is
needless attack surface (offline analysis, IV/tag harvesting).

Fix: do not select `secret`. Either select only the non-secret columns and
expose `has_secret` via a server action / a generated boolean column, or add a
DB view / `select` that omits `secret`. A one-line server action that returns
`{ has_secret }` is the cleanest.

### S3. `webhook_events` payload may store plaintext PII / secrets unencrypted
`supabase/migrations/00102_webhook_events.sql:24-25`,
`apps/web/lib/integrations/webhook-ports.ts:22-29`

`payload jsonb` stores the raw inbound webhook body verbatim. WhatsApp inbound
messages contain contact phone numbers and message text; this is acknowledged
("can carry PII payloads") and mitigated by global-admin-only RLS, which is
acceptable. Flagging it so it is a conscious decision: the table has no
retention/TTL policy, so PII accumulates indefinitely. Consider a scheduled
purge of `webhook_events` older than N days (the audit value of a months-old
raw payload is low).

---

## Nit

### N1. `dispatchOutboxRow` marks an unconfigured channel `sent`
`apps/web/lib/integrations/dispatch.ts:106-118`

When no credential row exists at all, the outbox row is marked `status: "sent"`
with `error: "Canal nao configurado (sem credencial)"`. A `sent` row carrying
an `error` string is contradictory and makes a delivery log misleading
(a "sent" count includes never-attempted rows). Behaviour is intentional
(soft no-op for dev), but consider a distinct terminal status such as
`skipped`, or `status: "sent"` with `error: null` and a `noop` marker, so
operational dashboards can tell a real send from a no-op.

### N2. Teams webhook `externalId` falls back to empty string → 400, not idempotent
`apps/web/app/api/webhooks/teams/route.ts:68-71`

Teams Workflow payloads have no canonical event id; the route accepts
`id`/`messageId` and otherwise yields `""`, which `processWebhook` rejects with
`400 bad_request` (line 82-84). A Workflow not configured to send an id will
get a 400 and may retry-storm. Low impact (Teams inbound is a thin
acknowledgement path in Phase 1), but consider deriving a deterministic id
(e.g. SHA-256 of the raw body) as a last resort so idempotency still holds.

### N3. `verifyHmacSignature` empty-secret behaviour is correct but undocumented at call sites
`apps/web/lib/integrations/signature.ts:50-60`; webhook routes

When no credential / no `webhookSecret` is configured, `verifyHmacSignature("",
...)` returns `false`, so `processWebhook` returns `401`. This is the correct
fail-closed behaviour, but a partly-configured provider (credential row exists,
`webhookSecret` missing) silently 401s every inbound call with no operator
signal. Consider logging a one-line warning when a credential exists but the
HMAC secret is absent, to aid setup debugging. Not a security issue.

### N4. `findContactByPhone` suffix match can mis-attribute messages
`apps/web/lib/integrations/crm-inbound.ts:113-141`

Matching on the last 8 digits with `ilike '%suffix%'` plus `endsWith` can match
the wrong contact when two contacts share an 8-digit local number across
different area/country codes. The blast radius is limited (an inbound WhatsApp
note threaded onto the wrong deal, never a data leak across RLS since the
service client writes with the matched contact's `sector_id`). Consider
tightening to a full normalized-number equality once contact phones are
normalized on write.

---

## What was verified as correct

- `crypto.ts` — `aes-256-gcm`, fresh `randomBytes(12)` IV per `encryptSecret`,
  auth tag captured via `getAuthTag()` and enforced via `setAuthTag()` on
  decrypt; `assertProductionKey()` throws in `NODE_ENV=production` on the dev
  key; key format validated as 64 hex chars. Tampered-ciphertext and
  fresh-IV behaviour are unit-tested.
- `signature.ts` — `timingSafeEqual` with a length pre-check that avoids the
  throw-on-mismatch; HMAC computed over the exact raw request body
  (`request.text()` read once before parsing).
- RLS — `integration_credentials`, `notification_channel_routes`,
  `notification_outbox` all `ENABLE ROW LEVEL SECURITY`; global rows gated by
  `is_global_admin()`, sector rows by `user_has_permission(..., 'integration',
  'manage')`; INSERT policies pin `created_by = auth.uid()`. `webhook_events`
  is select-only for global admins; writes go through the RLS-bypassing
  service role, as intended.
- Migrations `00101`–`00103` are additive, idempotent (`IF NOT EXISTS`,
  `DROP POLICY IF EXISTS`, `ON CONFLICT DO NOTHING`), sequentially numbered,
  and do not edit prior migrations.
- Service-role key read from `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_`
  prefix); `hasServiceRoleKey()` gates every webhook route into a safe
  `{ ok: true, noop: true }` response when unset.
- Server actions validate input with Zod and re-check permissions
  server-side; secrets are encrypted before the DB write and the existing
  secret is preserved when the form omits it.
- No secrets are logged: adapter no-op `console.info` calls log only the
  message title, never tokens or URLs.

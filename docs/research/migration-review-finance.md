# Pre-merge review — Finance + fiscal/banking gateways (Migration Phase 4)

**Scope reviewed:** `apps/web/app/(dashboard)/finance` (incl. `reports`, `reconciliation`),
`components/finance`, `hooks/finance`, `lib/finance` (aging, dre, accounting-export, ofx,
reconciliation, money, dates), the Focus NFe / Pluggy / Asaas adapters under
`lib/integrations/`, the fiscal/payments webhook routes, and migrations `00110`–`00113`.

**Commits:** `e1121f2`, `a53b2c4`, `889a056` (merged at `99ab592`).

## Verdict: REQUEST CHANGES

The money invariant, RLS, migration idempotency, the reconciliation double-claim guard, and
the no-op-without-credentials behaviour are all solid and well-tested. **One blocking bug**:
the Asaas payment webhook signature check is wrong and will reject every real Asaas callback
(or, worse, can be made to pass with a static token treated as an HMAC). Two should-fix
items concern webhook robustness. Tooling is clean:

- `npx tsc --noEmit` — clean.
- `npx eslint` (finance/integrations/webhooks) — clean.
- `npx vitest run lib/finance lib/integrations` — **192 passed / 21 files**.

---

## Blocking

### B1. Asaas webhook signature verification is structurally wrong
`apps/web/app/api/webhooks/payments/route.ts:55-60`

```ts
const signatureOk = verifyHmacSignature(
  secret?.webhookSecret ?? "",
  rawBody,
  request.headers.get("x-webhook-signature") ??
    request.headers.get("asaas-access-token")
);
```

Asaas does **not** HMAC-sign the webhook body. Its webhook auth mechanism is a *static*
`asaas-access-token` header whose value the integrator configures in the Asaas panel — it
must be compared, byte-for-byte, against the stored secret. But `verifyHmacSignature`
(`lib/integrations/signature.ts:50`) computes `HMAC-SHA256(webhookSecret, rawBody)` and
compares that digest to the header. A static token will never equal an HMAC of the body, so:

- if `webhookSecret` is configured, **every genuine Asaas callback returns 401** — payments
  silently never reconcile and invoices never flip to `paid`;
- the fiscal route (`webhooks/fiscal/route.ts`) has the same shape but is at least
  internally consistent if Focus NFe is configured to send an HMAC; for Asaas it is simply
  the wrong primitive.

**Fix:** verify the Asaas webhook with a direct constant-time equality:
`safeEqual(secret.authToken ?? "", request.headers.get("asaas-access-token") ?? "")`.
Keep the HMAC path only for a provider that actually signs the body. Store the Asaas value
under a clearly-named key (`authToken`, not `webhookSecret`) and update the loader interface
(`PaymentSecret`) and any integration-settings UI accordingly. Add a webhook-route test that
feeds a valid static token and asserts a 200 + the invoice transition.

---

## Should fix

### S1. Focus NFe webhook idempotency key collapses distinct redeliveries
`apps/web/app/api/webhooks/fiscal/route.ts:71-74`

Focus NFe does not send a per-delivery event id, so the route synthesises
`externalId = ${reference}:${status}`. Idempotency is keyed on `(provider, external_id)`
in `webhook_events`. This is correct for *duplicate* deliveries of the same status, but it
means a second, legitimately different callback for the *same* status (e.g. Focus retries
`erro_autorizacao` then later sends an authoritative `autorizado`) works only because the
status differs — and any provider that re-sends the *same* status with *new* payload data
(updated `mensagem_sefaz`, late `chave_nfe`) will be dropped as a duplicate and the
`finance_fiscal_documents` row never updated. The fiscal status is terminal-ish so the
window is small, but a missed `chave_nfe`/`protocol` update is a real data-loss risk.
**Fix:** include a payload discriminator that actually changes per delivery (Focus sends a
`numero`/`status_sefaz`/timestamp) in the synthesised id, or — cleaner — record by
`(reference, status)` for dedup but still re-apply the domain update on a duplicate when the
payload differs.

### S2. Webhook secret loader ignores `is_enabled`
`apps/web/app/api/webhooks/fiscal/route.ts:34-38` and
`apps/web/app/api/webhooks/payments/route.ts:34-38`

`loadFiscalSecret` / `loadPaymentSecret` filter the credential row on `is_active = true`
only. The Phase-4 `loadFinanceCredential` (`finance-credential-loader.ts:57-59`) — used by
the server actions — correctly filters on **both** `is_active` *and* `is_enabled`. The
result is an inconsistency: an admin who disables a `fiscal`/`payments` credential
(`is_enabled = false`) stops outbound emission/charges but the inbound webhook route keeps
using that credential's secret. **Fix:** add `.eq("is_enabled", true)` to both loaders to
match the rest of the integration layer.

### S3. `parseOfxAmount` mis-parses pt-BR grouped amounts
`apps/web/lib/finance/ofx.ts:46`

```ts
const normalised = raw.trim().replace(/\s/g, "").replace(",", ".");
```

OFX 1.x/2.x mandates `.` as the decimal separator with no grouping, so well-formed files
are fine. But some Brazilian banks export non-conformant OFX with `pt-BR` amounts
(`1.500,00`). For such a value this produces `1.500.00`, `Number(...)` returns `NaN`, and
the whole `<STMTTRN>` is silently skipped (`route` then reports fewer imported rows with no
error). A skipped credit/debit is a missing reconciliation line. **Fix:** reuse the
already-correct dual-format logic in `lib/finance/money.parseCents` (it handles both
`1.234,56` and `1234.56`), or replicate its right-most-separator heuristic here. At minimum
add a test for the `1.500,00` shape so the limitation is explicit.

### S4. `reconcileTransaction` does not re-check the amount
`apps/web/lib/actions/finance/reconciliation.ts:188-255`

The server action validates direction↔kind and same-sector, then writes the match. It never
verifies the transaction's `amount_cents` equals the invoice/expense amount. The matching
*heuristic* (`lib/finance/reconciliation.ts`) enforces exact-amount, but the action accepts
any `invoiceId`/`expenseId` the client sends — a buggy or malicious client can reconcile a
R$10 transaction against a R$10.000 invoice, mis-stating AR. The UI only ever offers
amount-equal candidates, so this is defence-in-depth, not an exploitable hole today. **Fix:**
load the counterpart's `amount_cents` (already a query away in the same block) and reject the
match when it differs from `tx.amount_cents`.

---

## Nit

### N1. `reconcileTransaction` allows re-matching an already-matched transaction
`reconciliation.ts:202` selects `match_status` but never asserts it is `unmatched` before
the update. The DB `chk_bank_tx_match` constraint keeps the row consistent, so the worst
case is silently overwriting an existing match. A guard (`if (tx.match_status === 'matched')
return { error: "Transação já conciliada" }`) would be clearer and would force an explicit
`unreconcile` first.

### N2. Webhook handler side effects are not transactional
`webhooks/payments/route.ts:96-119` updates `finance_payment_charges` and then
`finance_invoices` in two separate statements inside the `handle` callback. If the process
dies between them, the charge is `received` but the invoice is not `paid`. `processWebhook`
will mark the event `failed` and a redelivery is deduped (`webhook_events` unique index), so
the invoice never settles. Low probability, but wrapping the two writes in an RPC / Postgres
function would make the side effect atomic. Same pattern applies to the fiscal route's
single update (already atomic — no action needed there).

### N3. `finance_fiscal_documents` / `finance_payment_charges` have no FK to the gateway provider
`provider` is free text with only a default. The app validates it against the registry, but
a typo written by a future migration/seed would be accepted by the DB. A `CHECK
(provider IN (...))` or a small reference table would harden it. Cosmetic — the registry
`resolve*Adapter` throws on an unknown slug, so a bad value fails loudly at use.

---

## What is solid (verified, no action needed)

- **Money invariant.** `lib/finance/money.ts`, `aging.ts`, `dre.ts`, `accounting-export.ts`
  and both OFX/Pluggy normalisers keep integer cents end-to-end; the only float touch is
  `value * 100` immediately wrapped in `Math.round` (`money.ts:29`, `ofx.ts:51`,
  `pluggy-adapter.ts:59`). `sumCents` reduces integers. No drift path found. DRE/aging share
  totals and have explicit reconcile checks (`dreLinesReconcile`, `agingGrandTotal`).
- **Reconciliation double-claim.** `suggestReconciliation` removes a `high`-confidence
  candidate from the pool before the next transaction (`reconciliation.ts:109-123`);
  directly tested ("does not let two transactions claim the same candidate"). The DB
  `chk_bank_tx_match` constraint enforces exactly-one of `matched_invoice_id` /
  `matched_expense_id`.
- **No-op-without-credentials.** All three adapters gate every network call behind
  `isConfigured()` and return `{ noop: true }` soft results; the fiscal/payment server
  actions persist `status: 'draft'` and surface an honest "gateway não configurado"
  message — no faked emission or charge. Each adapter has an explicit no-op test asserting
  zero transport calls.
- **No faked fiscal compliance.** Migrations 00111/00113 headers, the adapter docs and the
  reports-page copy consistently state ONEmonday does not emit documents / move money and
  that SPED/ECD/ECF + legal liability stay with the accountant. The DRE is labelled
  "gerencial / regime de caixa" and the export is a bridge, not the books.
- **RLS.** New tables (`finance_fiscal_documents`, `finance_bank_transactions`,
  `finance_payment_charges`) enable RLS with select/insert/update/delete policies gated on
  `user_has_permission` against the pre-existing `invoice` / `transaction` resources;
  inserts pin `created_by = auth.uid()`. `webhook_events` is global-admin-read-only and
  written via the service role.
- **Migration idempotency.** 00110–00113 use `CREATE TABLE/INDEX IF NOT EXISTS`,
  `CREATE OR REPLACE FUNCTION`, `DROP … IF EXISTS` before policy/trigger creation, and
  `ADD COLUMN IF NOT EXISTS`. Sequentially numbered, additive, no edits to prior migrations.
- **Crypto.** AES-256-GCM with random IV and auth-tag verification; `assertProductionKey`
  refuses the dev key in production. Service-role secrets only decrypted server-side.
- **Tests.** 192 passing; meaningful edge cases (OFX skipped blocks, tolerance window,
  closest-date ordering, status mapping, no-op gating). Gaps: no webhook-route-level tests
  (see B1/S1) and no pt-BR-grouped OFX amount test (S3).

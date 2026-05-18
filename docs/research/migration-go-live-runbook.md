# ONEmonday — Migration Go-Live Runbook

The migration code is built, reviewed and tested. What remains is **operational**:
provisioning the external provider accounts, loading their credentials, and
validating each area with a dual-run before cancelling the paid vendor. This
runbook is that checklist.

> **Golden rule:** never cancel a vendor before its dual-run (below) passes.
> Every integration ships in a safe **no-op mode** — until a credential is
> configured, nothing is sent and nothing is faked.

---

## 1. Production environment variables

Set these in the production deployment (never commit them):

| Variable | Purpose |
| --- | --- |
| `INTEGRATION_ENCRYPTION_KEY` | 32-byte hex (64 hex chars). Encrypts every credential in `integration_credentials` (AES-256-GCM). Generate once, store in a secret manager, never rotate casually. |
| `SUPABASE_SERVICE_ROLE_KEY` | Lets the webhook routes write past RLS. Without it, webhook routes safely no-op (200). |
| `CRON_SECRET` | Shared secret guarding the `/api/cron/*` trigger routes. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The production Supabase project. |

After deploy, configure the cron base URL (the public app URL) for the
scheduled jobs — see §8.

## 2. Where credentials are configured

All provider credentials are entered in the app — **Configurações → Integrações**
(admin only). They are encrypted at rest; the database never holds plaintext.
Each section below ends with the exact credential to load there.

## 3. Microsoft Teams + WhatsApp (alerts & CRM messaging)

**Teams** — an M365 tenant admin creates a **Power Automate (Workflows)**
HTTP-trigger flow that posts to a Teams channel; copy its webhook URL.
*Configure:* the Teams webhook URL (+ optional inbound shared secret).

**WhatsApp** (Cloud API) — needs: a Meta Business account, a verified
WhatsApp Business phone number, the **Cloud API access token + phone-number
ID**, and Meta-**approved message templates** (required to message a contact
outside the 24h service window). Point the webhook to `/api/webhooks/whatsapp`.
*Configure:* access token, phone-number ID, `appSecret`, `verifyToken`.

## 4. Resend (email — marketing campaigns & CRM email)

Needs: a Resend account, an API key, and a **verified sending domain** with
SPF / DKIM / DMARC DNS records (without it Resend rejects sends). For inbound
CRM email, configure a Resend inbound route to `/api/webhooks/email`.
*Configure:* API key, `fromAddress`/`fromName`, `webhookSecret` (Svix `whsec_…`).

## 5. Focus NFe (fiscal — NF-e / NFS-e)

Needs: a Focus NFe account + API token, and an **A1 e-CNPJ digital
certificate** (~R$220–275/yr) — uploaded **to Focus NFe**, so ONEmonday never
custodies the certificate. **Verify the município(s) the company issues NFS-e
from are on Focus NFe's coverage list** — there is no national NFS-e standard;
this is the single biggest fiscal unknown. Webhook → `/api/webhooks/fiscal`.
*Configure:* Focus NFe API token.

## 6. Pluggy + Asaas (banking & payments)

**Pluggy** (Open Finance) — account + API credentials for bank-transaction
sync. A manual OFX import is always available as a fallback.
**Asaas** (PSP) — a merchant account + API token for boleto/PIX charges.
Asaas authenticates its webhook with a **static `asaas-access-token` header**
(not an HMAC). Webhook → `/api/webhooks/payments`.
*Configure:* Pluggy credentials; Asaas API token + the static webhook token.

## 7. Per-area dual-run validation (do before cancelling each vendor)

| Vendor being replaced | Dual-run before cancelling |
| --- | --- |
| Pipedrive / RD Station CRM | Run a full week of sales in ONEmonday — pipeline, tasks, WhatsApp + email from the deal, a lead captured via a public form and qualified. |
| Sólides (people-ops) | Run one real recruitment process, one evaluation cycle, and one climate survey in ONEmonday. |
| Omie (internal finance) | Run one monthly close in ONEmonday — AP/AR, aging, the management DRE — and have the **accountant sign off** on the export. |
| RD Station Marketing | Send one real campaign + one nurture sequence; confirm deliverability on the verified domain. |

## 8. Scheduled automation

The notification outbox and the marketing sequence runner are triggered by
`pg_cron` jobs that call the `/api/cron/*` routes. In production: set
`CRON_SECRET`, configure the cron jobs' target base URL to the public app URL,
and confirm the jobs are registered (`select * from cron.job`).

## 9. What stays — and why (do NOT plan to cancel these)

- **Folha Flash (payroll)** — eSocial transmission + statutory calculation;
  regulated, permanent fiscal liability. Keep, or move to the accountant.
- **Tangerino (time-clock)** — Portaria 671/2021 requires REP-P certification.
- **Flash benefits card** — a Bacen-regulated fintech card product.
- **Omie's fiscal core / the accountant** — SPED (ECD/ECF), the official
  accounting books, balanço, and tax filings (DAS/guias) remain with a
  certified tool or the contador. ONEmonday owns only internal management.

## 10. Outcome

After the dual-runs pass and credentials are live, the company can retire
**Pipedrive, RD Station CRM, and the Sólides people-management subscription**,
downgrade **Omie to a fiscal-only retention**, and add Teams/WhatsApp/email
alerting it did not have before — real, low-risk cost reduction. The regulated
systems that remain cost less kept than the build-and-compliance risk of
replacing them.

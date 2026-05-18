# Pre-merge review — CRM migration (Phase 2 + communication sub-phase)

**Reviewer:** senior-reviewer standard
**Scope:** `apps/web/app/(dashboard)/crm`, `components/crm`, `hooks/crm`, `lib/crm`,
`lib/actions/crm` (incl. `crm-dispatch`, `crm-events`, `communication`),
`lib/integrations/crm-inbound.ts`, the WhatsApp webhook handler, migrations
`00104`, `00105`, `00126`.
**Commits:** `8d54fc5` → `66b1ac3` (Phase 2 deal ownership / activity-tasks /
list-sort, then communication sub-phase).

## Verdict: APPROVE WITH NITS

The work is solid and well-documented. Migrations are additive and idempotent;
the dispatch seam is correctly best-effort; webhook signature verification and
`external_ref` idempotency are sound; `tsc`, `eslint`, and `vitest run lib/crm`
all pass clean (68 tests). One **Should-fix** in the inbound phone matcher and
a handful of nits. Nothing is merge-blocking.

### Verification run (from `apps/web`)
- `npx tsc --noEmit` — clean.
- `npx eslint` over the full CRM scope — clean.
- `npx vitest run lib/crm lib/integrations/crm-inbound` — 7 files, 68 tests pass.

---

## Blocking

None.

The widened `crm_activities` UPDATE policy (00105) was the headline risk; it
does **not** allow privilege escalation — see "Escalation check" below.

---

## Should fix

### 1. Inbound phone matcher can attach a message to the wrong contact / wrong sector
`apps/web/lib/integrations/crm-inbound.ts:113-141`

`findContactByPhone` queries `crm_contacts` with **no `sector_id` scope** and
accepts a match when `fromDigits.endsWith(digits)` or `digits.endsWith(fromDigits)`.
If any contact's stored `phone` is a short local number (e.g. `99998888`, 8
digits — which the `slice(-8)` suffix gate explicitly permits), *every* inbound
WhatsApp number ending in those 8 digits matches it. Two consequences:

- A received message can be logged onto a **different tenant's** contact/deal
  timeline (cross-sector data leak — the route runs service-role, so RLS does
  not catch it).
- Brazilian mobile numbers commonly differ only by the leading `9`; an 8-digit
  suffix match collides easily even within one sector.

Concrete fixes (any one, or combine):
- Require a minimum match length of the full national number (last 10-11
  digits incl. DDD), not 8.
- When more than one candidate matches, treat it as `unmatched` (ambiguous)
  rather than picking the first.
- If a single global WhatsApp number serves all sectors this is unavoidable,
  but at minimum prefer an exact `digits === fromDigits` match and only fall
  back to suffix matching when exactly one candidate remains.

### 2. `createActivity` does not validate `assignedTo` membership
`apps/web/lib/actions/crm/activities.ts:31-49`

`assignedTo` is a valid UUID (Zod) but is never checked to be a real user with
access to `parsed.data.sectorId`. A caller can assign a task to an arbitrary
user id from another sector; that user then gains UPDATE rights on the row via
the `assigned_to = auth.uid()` clause of the 00105 policy, and an
`crm_activity_due` notification fans out to them. The FK to `users(id)` only
guarantees the user exists, not that they belong to the sector. Add a check
that `assignedTo` has sector access (mirror the `getUserPermissions` lookup, or
verify a `sector_members` row) before insert. Same applies implicitly to
reschedule, but reschedule reuses the stored `assigned_to` so the fix at
create-time covers it.

### 3. `notification_outbox` insert is not sector-membership-validated against the target
`apps/web/lib/actions/crm/crm-dispatch.ts:57-66`

`enqueueCrmEvent` is best-effort and runs in the caller's RLS context (good),
but `target` is passed through untouched from `args.target`. None of the three
deal events currently supply a `target`, so this is latent, not live — but when
a future caller wires a WhatsApp `target`, there is no validation that the
number is legitimate. Worth a comment or a guard before the feature is used.

---

## Nit

### 4. `00126` backfill predicate is convoluted
`supabase/migrations/00126_crm_communication.sql:62-64`

`WHERE occurred_at IS NULL OR occurred_at = created_at IS NOT TRUE` is hard to
read and partly dead: `occurred_at` was just added `NOT NULL DEFAULT now()`, so
it is never NULL. The intent ("set occurred_at = created_at for pre-existing
rows") is just `UPDATE crm_activities SET occurred_at = created_at;` (or scope
to `WHERE occurred_at <> created_at` if you want to skip no-ops). The current
expression `occurred_at = created_at IS NOT TRUE` parses as
`occurred_at = (created_at IS NOT TRUE)` which is a type error against a
timestamptz — this line would **fail on a non-empty table**. Verify against a
seeded DB; if `crm_activities` is empty in all current environments it slipped
through, but it is still wrong SQL.

### 5. Inbound timeline `subject` exposes the raw phone number
`apps/web/lib/integrations/crm-inbound.ts:204`

`subject: \`WhatsApp recebido de ${msg.from}\`` — once the contact is matched,
prefer the contact's name over the raw E.164 digits for the timeline label
(the contact id is already in hand).

### 6. `sendWhatsappMessage` writes the activity *after* the send
`apps/web/lib/actions/crm/communication.ts:71-101`

The docstring (lines 33-38) says the activity row is written FIRST "so a
delivery that succeeds but whose provider response is slow is never lost", but
the code sends first (line 71) and inserts the activity after (line 83). The
behaviour is defensible (don't log a message that failed to send), but the
docstring contradicts the implementation — fix one or the other.

### 7. `closeDealWon` / `closeDealLost` do not emit a stage-change history row
Minor consistency: `moveDealToColumn` appends to `crm_deal_stage_history` and
moving a won deal to the done column (`deals.ts:155-169`) bypasses
`moveDealToColumn`, so the won/lost transition is not in the stage-history
audit log. Not introduced by this phase, but adjacent — note for the backlog.

### 8. `revalidatePath("/")` is very broad
Every CRM action revalidates the entire app root. Pre-existing pattern across
the codebase, not a regression — flagging for a future perf pass.

---

## Escalation check — 00105 widened UPDATE policy (verified safe)

The review focus called out the widened `crm_activities` UPDATE policy. Result:
**no escalation path.**

- The original 00011 policy had `USING` only and **no `WITH CHECK`** — under
  Postgres that means the post-update row was unconstrained. The 00105 policy
  *adds* a `WITH CHECK` clause identical to `USING`. This is a net **tightening**.
- A task assignee passes `USING` via `assigned_to = auth.uid()`. To pass
  `WITH CHECK` the updated row must still satisfy the same predicate, so the
  assignee cannot null out / reassign `assigned_to` away from themselves *and*
  also lack `performed_by`/permission — they would lock themselves out, not
  escalate.
- The assignee *can* edit `sector_id`, `performed_by`, `deal_id` etc. of a row
  they were assigned (the policy gates on identity, not column-level), but that
  is the same surface the original policy already exposed to `performed_by`;
  it is a data-integrity sharp edge, not a privilege escalation. Column-level
  immutability (a trigger pinning `sector_id`/`performed_by`) would be a
  hardening improvement but is out of scope here.
- The 00126 INSERT policy correctly keeps `user_has_permission(... 'create')`
  on both branches and only relaxes `performed_by` for `direction='inbound'`.
- The CHECK `performed_by IS NOT NULL OR direction = 'inbound'` correctly lets
  the webhook insert NULL-performer inbound rows while every user-driven row
  still requires a performer. `logEmail` with `direction='inbound'` still sets
  `performed_by = user.id`, which satisfies the constraint — fine.

## Idempotency / migration hygiene (verified)

- `00104`/`00105`/`00126` are all additive, use `IF NOT EXISTS` / `DROP POLICY
  IF EXISTS`, are sequentially numbered, and do not edit prior migrations.
- `external_ref` unique partial index + the `23505` handling in
  `logInboundWhatsApp` give correct webhook-redelivery idempotency, layered on
  top of the `webhook_events` dedup in `processWebhook`. Good.
- `processWebhook` rejects bad signatures with 401 before recording anything.

## Tests

Meaningful and behaviour-exercising: `crm-events`, `activity-tasks`,
`list-sort`, and `crm-inbound` (parser + fan-out with a stubbed client incl.
unmatched / duplicate paths). Gaps worth a follow-up, not blocking:
- No test for the wrong-contact suffix-collision in `findContactByPhone`
  (Should-fix #1) — add one once the matcher is tightened.
- `enqueueCrmEvent` (`crm-dispatch.ts`) has no direct unit test for its
  route-resolution / `in_app` filtering / best-effort swallow.
</content>
</invoke>

# Support Desk — Feature Gap Analysis

**Date:** 2026-05-15
**Author:** Support Desk module engineer
**Scope:** Wave 1 prioritization for the ONEmonday Support Desk module.

## Method

Reviewed the current Support Desk implementation (`apps/web/app/(dashboard)/support/**`,
`components/support/**`, `hooks/support/**`, `lib/actions/support/**`, migrations 00010 +
00013) against the design spec/plan and against best-in-class helpdesk products: Zendesk,
Freshdesk, Intercom, and Help Scout.

## Current state (what already exists)

- Ticket list + create + detail sheet, dashboard stats, CSV export.
- SLA Rules CRUD, Knowledge Base editor with publish toggle.
- Ticket escalation between sectors (migration 00013) + escalation history timeline.
- SLA breach polling (`check_sla_status` RPC), alert banner, SLA badges on the ticket list.
- Comments tab + activity timeline on the ticket detail sheet.
- Canned Responses **read-only** listing.

## Benchmark — what best-in-class products treat as table stakes

| Capability | Zendesk | Freshdesk | Intercom | Help Scout | ONEmonday today |
|---|---|---|---|---|---|
| Ticket assignment / ownership | yes | yes | yes | yes | **missing** |
| Tags / labels on tickets | yes | yes | yes | yes | **missing** |
| First-response tracking | yes | yes | yes | yes | **partial** (column exists, never written) |
| Reopen resolved ticket | yes | yes | yes | yes | **missing** |
| Canned responses / saved replies / macros | yes | yes | yes | yes | read-only listing, no CRUD |
| SLA timers + breach alerts | yes | yes | yes | yes | yes |
| Knowledge base | yes | yes | yes | yes | yes |
| Escalation | yes | yes | yes | yes | yes |

Industry data: 45% of users rate ticket management as the single most essential helpdesk
feature; 67% of customers expect resolution within 3 hours; macros/saved replies cut
per-ticket cost from ~$22 to ~$0.50–1 (see sources).

## Prioritized gap analysis (P1 = highest value, well-scoped for wave 1)

### P1 — Ticket ownership / assignment *(table stakes)*
No way for an agent to take or be assigned a ticket. Escalation moves a ticket between
sectors, but within a sector there is no concept of "who owns this". Best-in-class tools
make assignment the backbone of workload distribution and SLA accountability.
**Action:** add assign / unassign, surfaced on the detail sheet and list.

### P1 — Ticket tags *(table stakes)*
`support_tickets` has `category`/`subcategory` but no free-form tags. Every benchmarked
product supports multi-tag labelling for grouping, filtering and reporting.
**Action:** new `ticket_tags` table (per-sector tag vocabulary) + `support_ticket_tags`
join table, with tag editing on the detail sheet and a tag filter on the list.

### P1 — First-response tracking + correct SLA breach flags *(bug + table stakes)*
`first_response_at` is in the schema and drives the `check_sla_status` RPC, but **nothing
in the application ever sets it** — it is only populated by sample data. As a result the
SLA "first response" timer never stops. Separately, `resolveTicket` never recomputes
`sla_response_breached` / `sla_resolve_breached`, so the dashboard "SLA Violados" count
and SLA-compliance RPC are wrong for tickets that were overdue when resolved.
**Action:** mark-first-response action (auto-fired on first agent comment + manual button)
and breach computation inside `resolveTicket`.

### P1 — Reopen resolved ticket *(bug-class gap)*
Once `resolved_at` is set there is no path back. If a customer replies after resolution
the ticket is stuck. Research explicitly calls out reopening as a core flow.
**Action:** `reopenTicket` action that clears `resolved_at` and moves the card off the
done column, with a button on the detail sheet.

### P2 — Canned Responses CRUD *(agent efficiency / macros)*
The page only lists responses; there is no create/edit/delete despite `canned_responses`
being fully modelled with RLS in migration 00010. Saved replies are a top-cited
efficiency feature.
**Action:** server actions + form dialog + edit/delete on the page.

### P3 — Deferred to a later wave
- Automation rules / triggers (time-based auto-escalation) — needs a scheduler, out of scope.
- AI reply suggestions — needs an external model integration.
- Multi-channel ingestion (email/chat inbound) — needs infra; spec marks integrations as placeholders.
- CSAT survey delivery to requesters — needs notifications/email.
- Round-robin auto-assignment — depends on assignment landing first (this wave).

## Wave 1 plan (implemented)

1. Migration `00040` — ticket tags (`ticket_tags`, `support_ticket_tags`) + `assignee_id` on `support_tickets`, all with RLS.
2. Fix 100% of Support-module lint errors with real types (no disable comments).
3. First-response tracking + SLA breach computation on resolve.
4. Reopen resolved ticket.
5. Ticket tags CRUD + UI (detail sheet editor, list filter).
6. Canned Responses CRUD.
7. Ticket assignment (assign/unassign to a sector agent).

## Sources

- https://www.happyfox.com/compare/freshdesk-vs-intercom-vs-zendesk/
- https://softabase.com/guides/zendesk-vs-freshdesk-vs-intercom-comparison
- https://www.helpdesk.com/learn/a-guide-to-efficient-ticket-management-in-helpdesk/
- https://www.helpdesk.com/features/
- https://www.helpdesk.com/learn/customer-support-essentials/customer-ticket-assignment-strategies/
- https://www.helpdesk.com/help/how-to-create-and-apply-macros/
- https://tettra.com/article/help-desk-ticket-categories/
- https://www.liveagent.com/customer-support-glossary/ticket-priority/
- https://www.helpscout.com/
- https://www.eesel.ai/blog/help-scout-features
- https://www.supportbench.com/what-is-ticket-escalation-in-customer-support/
- https://hiverhq.com/blog/slas-in-ticketing-software
- https://hiverhq.com/blog/escalation-management
- https://www.gorgias.com/blog/sla-best-practices
- https://www.flowcall.co/blog/best-helpdesk-ticketing-system

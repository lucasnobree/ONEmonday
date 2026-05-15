# Dev-Tools Module — Feature Gap Research

Research that shapes the ONEmonday **Dev-Tools** module (Wave 2). The goal is an
engineering-operations workspace: a focused MVP modelled on the parts of leading
products that deliver the most value with the least surface area.

## Products surveyed

| Product | Category | What it does well |
| --- | --- | --- |
| **Sentry** | Error tracking / alerting | Issue triage, severity, alert rules feeding incident creation. |
| **PagerDuty** | Incident response / on-call | Incident lifecycle, escalation, severity, post-incident review. The H2 2025 release added incident *reopen* — a long-requested lifecycle improvement. |
| **LaunchDarkly** | Feature management | Decouples deploy from release; flag lifecycle (short-lived release flags, kill switches), per-environment targeting, flag ownership tags. |
| **Statuspage / incident.io** | Service health & comms | Service components with health states (operational, degraded, partial/major outage); incidents linked to affected components. |
| **Linear** | Engineering project mgmt | Tight, opinionated workflows; status as a first-class field; low-friction creation. |

## Key findings

1. **Incidents are the hub.** PagerDuty/Sentry/incident.io all treat an incident
   as a first-class record with a *severity*, a *lifecycle* (open → mitigated →
   resolved, with reopen), an owner, and links to the *services* it affects.
   Time-to-acknowledge and time-to-resolve are the headline metrics.
2. **A service/environment registry is the backbone.** Statuspage components
   and a service catalog give every incident, deployment and flag something
   concrete to attach to. Each service has a current health state.
3. **Deployments must be auditable.** A release/deployment log per environment
   (version, environment, status, who shipped it) is the minimum viable CD
   record and is what an incident's "what changed?" question resolves to.
4. **Feature flags decouple deploy from release.** Operational flags / kill
   switches are short-lived, owned, and scoped per environment. A simple
   on/off flag with an environment and an owner already delivers most value.
5. **Lifecycle status is a first-class field everywhere** — consistent,
   colour-coded labels (Linear, Statuspage) beat free-text.

## Prioritised scope for the ONEmonday MVP (this wave)

Sector-scoped, RLS on every table, server-action + Zod validated, mirroring the
Support/Legal modules.

### P0 — shipped this wave

1. **Service registry** (`dev_services`) — the catalog of deployable services
   with a name, environment, repository URL, criticality and a live health
   state. Backbone for the other entities.
2. **Incident tracker** (`dev_incidents`) — incident records with severity
   (sev1–sev4), lifecycle status (investigating → identified → monitoring →
   resolved), an optional affected service, acknowledged/resolved timestamps,
   and a derived "is open" view. MTTA/MTTR-style metrics on the dashboard.
3. **Deployment log** (`dev_deployments`) — append-style record of releases:
   service, environment, version, status (pending/succeeded/failed/rolled_back)
   and who shipped it.
4. **Feature flags** (`dev_feature_flags`) — per-service on/off flags with a
   key, environment, rollout percentage and an owner.
5. **Dashboard** — open incidents by severity, service health mix, recent
   deployments, active flag count.

### P1 — deliberate follow-ups for a later wave

- On-call schedules and escalation policies (PagerDuty-style).
- Post-incident review / postmortem documents with action items.
- Incident timeline / status updates feed and external status page.
- Deployment ↔ incident correlation ("what changed before this incident").
- Flag targeting rules / segments and percentage-rollout automation.
- Webhook ingestion from real CI/CD and error-tracking tools.

## Sources

- PagerDuty H2 2025 release (incident reopen, lifecycle): https://www.pagerduty.com/blog/product/product-launch-2025-h2/
- Sentry + PagerDuty incident automation: https://sentry.io/integrations/pagerduty/ and https://blog.sentry.io/escalate-critical-issues-with-pagerduty-and-sentry/
- LaunchDarkly release-management best practices (flag lifecycle, kill switches): https://launchdarkly.com/blog/release-management-flags-best-practices/
- LaunchDarkly deployment & release strategies (ring / percentage rollouts): https://launchdarkly.com/docs/guides/infrastructure/deployment-strategies
- LaunchDarkly operational flags best practices: https://launchdarkly.com/blog/operational-flags-best-practices/
- Atlassian Statuspage — status & incident impact calculation (component health): https://support.atlassian.com/statuspage/docs/top-level-status-and-incident-impact-calculations/
- incident.io status pages overview (components, incident types): https://docs.incident.io/status-pages/overview

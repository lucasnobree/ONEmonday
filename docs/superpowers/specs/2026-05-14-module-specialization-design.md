# Module Specialization — Design Spec

**Date:** 2026-05-14
**Status:** Approved
**Scope:** Enhance all 3 active modules (Support Desk, CRM, HR) with specialized features, new migrations, and enriched dashboards.

---

## Overview

The ONEmonday MVP has full CRUD across Support Desk, CRM, and HR modules. This spec covers the next layer: specialized features that make each module production-ready. Work is split into 3 independent streams that can be implemented in parallel.

### Migrations

- `00013_support_escalation.sql` — Support Desk escalation + notifications
- `00014_crm_proposals_pipeline.sql` — CRM pipeline defaults + deal probability lock
- `00015_hr_documents_orgchart.sql` — HR employee documents

### Architecture Principles

- Follow existing patterns: server actions (zod → auth → permission → supabase → revalidate), React Query hooks, shadcn/ui components
- All UI text in pt-BR
- RLS on all new tables
- No external integrations (email, WhatsApp) — placeholders only

---

## Module 1: Support Desk

### 1.1 SLA Rules CRUD

**Current state:** Page `/support/sla-rules` exists but is a stub. Table `sla_rules` exists with columns: id, sector_id, name, priority, category, first_response_minutes, resolution_minutes, business_hours_only, is_active, created_at, updated_at.

**Implementation:**

- **Page** (`/support/sla-rules`): Table listing all rules for current sector. Columns: Name, Priority, Category, First Response, Resolution, Business Hours, Active. Empty state with CTA.
- **SlaRuleFormDialog**: Create/edit dialog. Fields:
  - `name` (text, required)
  - `priority` (select: low/medium/high/urgent)
  - `category` (text, optional)
  - `first_response_minutes` (number, required)
  - `resolution_minutes` (number, required)
  - `business_hours_only` (checkbox, default true)
  - `is_active` (checkbox, default true)
- **Server actions** (`lib/actions/support/sla-rules.ts`):
  - `createSlaRule(formData)` — validate with zod, insert into sla_rules
  - `updateSlaRule(id, formData)` — validate, update
  - `deleteSlaRule(id)` — delete with confirmation
  - `toggleSlaRule(id, is_active)` — toggle active status
- **Hook** (`hooks/support/use-sla-rules.ts`): React Query fetching sla_rules by sector_id
- **Display**: Format minutes as human-readable ("2h", "4h", "24h", "3d")

### 1.2 Knowledge Base Editor

**Current state:** Page `/support/knowledge-base` lists articles. Table `kb_articles` exists with: id, sector_id, title, content, category, status (draft/published), author_id, created_at, updated_at.

**Implementation:**

- **Page** (`/support/knowledge-base`): Enhanced listing with status filter tabs (All/Published/Draft), search by title, category badges.
- **KBArticleFormSheet**: Full-width sheet for create/edit. Fields:
  - `title` (text, required)
  - `category` (text with suggestions from existing categories)
  - `status` (select: draft/published)
  - `content` (textarea with markdown support — use a simple textarea with markdown preview toggle, no rich editor library)
- **Server actions** (`lib/actions/support/kb-articles.ts`):
  - `createKBArticle(formData)`
  - `updateKBArticle(id, formData)`
  - `deleteKBArticle(id)`
  - `toggleKBArticleStatus(id)` — toggle draft/published
- **Hook**: `use-kb-articles.ts` already exists — extend with status filter parameter
- **Markdown preview**: Simple toggle between edit (textarea) and preview (render markdown as HTML using a lightweight approach — dangerouslySetInnerHTML with basic markdown-to-html conversion, or just styled pre/code blocks)

### 1.3 Ticket Escalation

**Migration 00013** adds:

```sql
-- Add escalation tracking to support_tickets
ALTER TABLE support_tickets
  ADD COLUMN escalated_to_sector_id uuid REFERENCES sectors(id),
  ADD COLUMN escalated_at timestamptz,
  ADD COLUMN escalated_by uuid REFERENCES users(id),
  ADD COLUMN escalation_reason text;

-- Escalation history log
CREATE TABLE ticket_escalation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  from_sector_id uuid NOT NULL REFERENCES sectors(id),
  to_sector_id uuid NOT NULL REFERENCES sectors(id),
  escalated_by uuid NOT NULL REFERENCES users(id),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ticket_escalation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view escalation logs for their sectors"
  ON ticket_escalation_log FOR SELECT
  USING (
    from_sector_id IN (SELECT sector_id FROM sector_members WHERE user_id = auth.uid())
    OR to_sector_id IN (SELECT sector_id FROM sector_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Members can create escalation logs"
  ON ticket_escalation_log FOR INSERT
  WITH CHECK (
    from_sector_id IN (SELECT sector_id FROM sector_members WHERE user_id = auth.uid())
  );
```

**Implementation:**

- **EscalateTicketDialog**: Dialog triggered from TicketDetailSheet. Fields:
  - `to_sector_id` (select from sectors the user has access to, excluding current)
  - `reason` (textarea, required)
- **Server action** (`lib/actions/support/escalate.ts`):
  - `escalateTicket(ticketId, toSectorId, reason)` — updates ticket, inserts log entry, revalidates
- **TicketDetailSheet**: Show escalation badge if escalated. Show escalation history section with timeline.
- **Tickets list**: Badge "Escalado" on escalated tickets. Filter option for escalated tickets.

### 1.4 SLA Breach Notifications

**Migration 00013** also adds:

```sql
CREATE TABLE support_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('sla_warning', 'sla_breach')),
  message text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE support_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notifications for their sector tickets"
  ON support_notifications FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE sector_id IN (SELECT sector_id FROM sector_members WHERE user_id = auth.uid())
    )
  );

-- RPC to check SLA status
CREATE OR REPLACE FUNCTION check_sla_status()
RETURNS TABLE (
  ticket_id uuid,
  ticket_title text,
  priority text,
  sla_type text,
  deadline_at timestamptz,
  remaining_pct numeric
) LANGUAGE sql STABLE AS $$
  SELECT
    st.id,
    st.title,
    st.priority,
    CASE
      WHEN st.first_response_at IS NULL THEN 'first_response'
      ELSE 'resolution'
    END,
    CASE
      WHEN st.first_response_at IS NULL THEN st.sla_first_response_at
      ELSE st.sla_resolve_at
    END,
    CASE
      WHEN st.first_response_at IS NULL AND st.sla_first_response_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (st.sla_first_response_at - now())) /
             NULLIF(EXTRACT(EPOCH FROM (st.sla_first_response_at - st.created_at)), 0) * 100
      WHEN st.sla_resolve_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (st.sla_resolve_at - now())) /
             NULLIF(EXTRACT(EPOCH FROM (st.sla_resolve_at - st.created_at)), 0) * 100
      ELSE NULL
    END
  FROM support_tickets st
  WHERE st.status NOT IN ('resolved', 'closed')
    AND (st.sla_first_response_at IS NOT NULL OR st.sla_resolve_at IS NOT NULL)
    AND st.sector_id IN (SELECT sector_id FROM sector_members WHERE user_id = auth.uid());
$$;
```

**Implementation:**

- **Hook** (`hooks/support/use-sla-status.ts`): Calls `check_sla_status()` RPC, polls every 60s
- **SLA Alert Banner**: Component at top of `/support` dashboard. Shows count of tickets at risk (remaining_pct < 25%) and breached (remaining_pct <= 0). Click navigates to filtered ticket list.
- **Ticket list/cards**: SLA indicator badge:
  - Green: > 50% remaining
  - Yellow: 25-50% remaining
  - Red: < 25% remaining
  - Gray with strikethrough: breached (0% or negative)

---

## Module 2: CRM

### 2.1 Proposals UI

**Current state:** Table `crm_proposals` exists with: id, deal_id, sector_id, title, description, total_value, valid_until, status (draft/sent/accepted/rejected/expired), created_by, created_at, updated_at.

**Migration 00014** adds:

```sql
-- Proposal line items
CREATE TABLE crm_proposal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES crm_proposals(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0
);

ALTER TABLE crm_proposal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage proposal items via proposal access"
  ON crm_proposal_items FOR ALL
  USING (
    proposal_id IN (
      SELECT id FROM crm_proposals
      WHERE sector_id IN (SELECT sector_id FROM sector_members WHERE user_id = auth.uid())
    )
  );
```

**Implementation:**

- **Page** (`/crm/proposals`): New sub-route. Table listing proposals with columns: Title, Deal, Value, Valid Until, Status. Filters by status. Empty state with CTA.
- **Layout**: Add "Propostas" link to CRM sub-navigation between "Pipeline" and "Activities"
- **ProposalFormDialog**: Create/edit dialog. Fields:
  - `deal_id` (select from open deals in sector)
  - `title` (text, required)
  - `description` (textarea)
  - `valid_until` (date picker)
  - `status` (select: draft/sent/accepted/rejected)
  - Line items: dynamic array of {description, quantity, unit_price} with add/remove. Total auto-calculated.
- **ProposalDetailSheet**: Shows proposal info, line items table with subtotals, status timeline, action buttons (Send, Accept, Reject based on current status).
- **Server actions** (`lib/actions/crm/proposals.ts`):
  - `createProposal(formData)` — insert proposal + items in transaction
  - `updateProposal(id, formData)` — update proposal + upsert items
  - `updateProposalStatus(id, status)` — status transition with validation
  - `deleteProposal(id)` — only if status = draft
- **Hook** (`hooks/crm/use-proposals.ts`): Fetch proposals by sector with status filter
- **DealDetailSheet**: Add "Propostas" section showing linked proposals with status badges

### 2.2 Pipeline Stage Defaults & Probability Automation

**Migration 00014** also adds:

```sql
-- Pipeline stage defaults for probability automation
CREATE TABLE crm_pipeline_stage_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  stage_name text NOT NULL,
  default_probability integer NOT NULL DEFAULT 0 CHECK (default_probability BETWEEN 0 AND 100),
  position integer NOT NULL DEFAULT 0,
  UNIQUE(sector_id, stage_name)
);

ALTER TABLE crm_pipeline_stage_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view stage defaults for their sectors"
  ON crm_pipeline_stage_defaults FOR SELECT
  USING (sector_id IN (SELECT sector_id FROM sector_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can manage stage defaults"
  ON crm_pipeline_stage_defaults FOR ALL
  USING (sector_id IN (SELECT sector_id FROM sector_members WHERE user_id = auth.uid()));

-- Add probability lock to deals
ALTER TABLE crm_deals ADD COLUMN probability_locked boolean NOT NULL DEFAULT false;
```

**Implementation:**

- **Pipeline Settings**: Section in `/crm` settings or inline in pipeline page. Simple table: stage name → default probability (%). Editable inline.
- **Server action**: `updateStageDefaults(sectorId, stages[])` — upsert stage defaults
- **moveDealToColumn** (existing action): After moving, if `probability_locked = false`, update probability to stage default. If no default exists, leave unchanged.
- **DealDetailSheet**: Probability field shows lock icon. Clicking locks/unlocks manual override.

### 2.3 Enriched Activity History

**No migration needed** — uses existing `crm_activities` table.

**Implementation:**

- **ActivityCreateDialog**: Enhanced fields based on type:
  - `email`: add `from_email`, `to_email` fields
  - `meeting`: add `location` field
  - All types: `notes` field expanded to textarea (already exists)
- **Activity timeline**: In DealDetailSheet and ContactDetailSheet, show activity content preview (truncated notes, email from/to). Distinct icons and colors per type:
  - call: Phone/blue
  - email: Mail/purple
  - meeting: Calendar/green
  - note: StickyNote/yellow
  - task: CheckSquare/gray
- **Page** `/crm/activities`: Add type filter buttons (already partially exists). Add date range filter.

### 2.4 Enriched CRM Dashboard

**No migration needed** — queries from existing tables.

**Implementation** — add 3 new sections to `/crm` page:

- **Pipeline funnel**: Horizontal stacked bar showing deal count per stage. Uses existing board columns + crm_deals data. Simple div-based bars, no chart library.
- **Top sellers**: Ranked list of top 5 deal owners by total won value. Query: group crm_deals by owner where stage = won, sum value, order desc, limit 5. Show avatar + name + total.
- **Closing soon**: List of deals with `expected_close_date` within next 7 days. Show deal name, company, value, days remaining. Click navigates to deal.

---

## Module 3: HR (RH Portal)

### 3.1 Onboarding Workflow

**Current state:** Tables `hr_onboarding_templates`, `hr_onboarding_instances`, `hr_onboarding_items` exist. Page `/hr/onboarding` exists but is basic.

**Implementation:**

- **Templates tab**: List of onboarding templates with CRUD.
  - **OnboardingTemplateFormDialog**: Fields: name, target_position (text), items (dynamic array of {title, description, responsible_role, due_days_offset}).
  - Server actions: `createOnboardingTemplate()`, `updateOnboardingTemplate()`, `deleteOnboardingTemplate()`
- **Instances tab**: Active onboarding instances with progress bars.
  - **Start onboarding**: From EmployeeProfileSheet, button "Iniciar Onboarding" → select template → creates instance with calculated due dates (hire_date + due_days_offset for each item).
  - **OnboardingDetailSheet**: Checklist with toggle per item. Shows: item title, responsible, due date, completed date. Progress bar at top. Overdue items highlighted in red.
  - Server actions: `startOnboarding(employeeId, templateId)`, `toggleOnboardingItem(itemId, completed)`, `completeOnboarding(instanceId)`
- **Hook** (`hooks/hr/use-onboarding.ts`): Already exists — extend with template CRUD and instance detail queries
- **Page**: Tab switcher between "Ativos" (instances) and "Templates"

### 3.2 Time-Off Balance Calculation

**No migration needed** — tables `hr_time_off_balances`, `hr_time_off_requests` exist.

**Migration 00015** adds RPC:

```sql
CREATE OR REPLACE FUNCTION get_employee_time_off_balance(p_employee_id uuid, p_year integer)
RETURNS TABLE (
  policy_id uuid,
  policy_name text,
  total_days numeric,
  used_days numeric,
  pending_days numeric,
  available_days numeric
) LANGUAGE sql STABLE AS $$
  SELECT
    p.id,
    p.name,
    COALESCE(b.total_days, 0),
    COALESCE(
      (SELECT SUM(r.days_count) FROM hr_time_off_requests r
       WHERE r.employee_id = p_employee_id
         AND r.policy_id = p.id
         AND r.status = 'approved'
         AND EXTRACT(YEAR FROM r.start_date) = p_year),
      0
    ),
    COALESCE(
      (SELECT SUM(r.days_count) FROM hr_time_off_requests r
       WHERE r.employee_id = p_employee_id
         AND r.policy_id = p.id
         AND r.status = 'pending'
         AND EXTRACT(YEAR FROM r.start_date) = p_year),
      0
    ),
    COALESCE(b.total_days, 0)
    - COALESCE(
        (SELECT SUM(r.days_count) FROM hr_time_off_requests r
         WHERE r.employee_id = p_employee_id
           AND r.policy_id = p.id
           AND r.status IN ('approved', 'pending')
           AND EXTRACT(YEAR FROM r.start_date) = p_year),
        0
      )
  FROM hr_time_off_policies p
  LEFT JOIN hr_time_off_balances b ON b.policy_id = p.id AND b.employee_id = p_employee_id AND b.year = p_year
  WHERE p.sector_id IN (SELECT sector_id FROM sector_members WHERE user_id = auth.uid());
$$;
```

**Implementation:**

- **EmployeeProfileSheet**: New "Ferias" section showing balance cards per policy: total, used, pending, available. Color-coded (green if > 50% available, yellow 25-50%, red < 25%).
- **Time-off page** (`/hr/time-off`): Add column "Saldo" to request list showing requester's remaining balance.
- **Hook** (`hooks/hr/use-time-off-balance.ts`): Calls RPC with employee_id and current year.

### 3.3 Employee Documents

**Migration 00015** adds:

```sql
CREATE TABLE hr_employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  category text NOT NULL CHECK (category IN ('contract', 'id', 'certificate', 'other')),
  uploaded_by uuid NOT NULL REFERENCES users(id),
  sector_id uuid NOT NULL REFERENCES sectors(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hr_employee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view documents for their sector employees"
  ON hr_employee_documents FOR SELECT
  USING (sector_id IN (SELECT sector_id FROM sector_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can upload documents"
  ON hr_employee_documents FOR INSERT
  WITH CHECK (sector_id IN (SELECT sector_id FROM sector_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can delete documents"
  ON hr_employee_documents FOR DELETE
  USING (sector_id IN (SELECT sector_id FROM sector_members WHERE user_id = auth.uid()));

-- Supabase Storage bucket (created via dashboard or seed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('hr-documents', 'hr-documents', false);
```

**Implementation:**

- **EmployeeProfileSheet**: New "Documentos" section. Upload button (file input), list of documents grouped by category. Each item shows: name, category badge, upload date, download/delete buttons.
- **Server actions** (`lib/actions/hr/documents.ts`):
  - `uploadDocument(employeeId, file, category)` — upload to Supabase Storage, insert metadata
  - `deleteDocument(documentId)` — delete from Storage + metadata
- **Hook** (`hooks/hr/use-employee-documents.ts`): Fetch documents by employee_id
- **Categories**: Contrato, Documento, Certificado, Outro (pt-BR labels mapped from db values)

### 3.4 Organizational Chart

**No migration needed** — uses existing `hr_employees.manager_id` for hierarchy.

**Implementation:**

- **Page** (`/hr/org-chart`): New sub-route added to HR layout navigation.
- **Layout**: Add "Organograma" link to HR sub-navigation
- **OrgChart component**: Recursive tree view built from employees. Query all employees for sector, build tree in-memory using manager_id relationships.
  - Each node: Card with avatar placeholder (initials), name, position, department badge
  - Expand/collapse children
  - Click opens EmployeeProfileSheet
  - Root nodes: employees with no manager
- **Hook** (`hooks/hr/use-org-chart.ts`): Fetch all employees for sector, build tree structure client-side
- **Filter**: Department select to filter subtree
- **Empty state**: "Nenhum colaborador cadastrado" with link to employees page

### 3.5 Enriched HR Dashboard

**No migration needed** — queries from existing tables.

**Implementation** — add 4 new sections to `/hr` page:

- **Department distribution**: Horizontal bar chart showing employee count per department. Simple div-based bars.
- **Birthdays this month**: List of employees with birthdays in current month (requires `birth_date` — if column doesn't exist, skip this; use hire_date anniversaries as "Aniversarios de empresa" instead).
- **Active onboardings**: Cards showing onboarding instances in progress with employee name, template, progress bar, days remaining.
- **Upcoming time-off**: List of approved time-off requests starting within next 7 days. Show employee name, dates, policy type.

---

## Cross-Cutting Concerns

### Navigation Updates
- CRM layout: add "Propostas" link
- HR layout: add "Organograma" link

### Type Generation
After migrations, run `supabase gen types typescript` to update `types/database.ts`.

### Testing
Each module should be manually testable with sample data. Existing `sample-data.sql` may need extension for new tables.

---

## File Impact Summary

### New Files (~30)
**Support (10):**
- `lib/actions/support/sla-rules.ts`
- `lib/actions/support/kb-articles.ts`
- `lib/actions/support/escalate.ts`
- `hooks/support/use-sla-rules.ts`
- `hooks/support/use-sla-status.ts`
- `components/support/sla-rule-form-dialog.tsx`
- `components/support/kb-article-form-sheet.tsx`
- `components/support/escalate-ticket-dialog.tsx`
- `components/support/sla-alert-banner.tsx`
- Migration `00013_support_escalation.sql`

**CRM (8):**
- `app/(dashboard)/crm/proposals/page.tsx`
- `lib/actions/crm/proposals.ts`
- `hooks/crm/use-proposals.ts`
- `components/crm/proposal-form-dialog.tsx`
- `components/crm/proposal-detail-sheet.tsx`
- `components/crm/pipeline-funnel.tsx`
- `lib/actions/crm/stage-defaults.ts`
- Migration `00014_crm_proposals_pipeline.sql`

**HR (8):**
- `app/(dashboard)/hr/org-chart/page.tsx`
- `lib/actions/hr/documents.ts`
- `lib/actions/hr/onboarding.ts`
- `hooks/hr/use-org-chart.ts`
- `hooks/hr/use-employee-documents.ts`
- `hooks/hr/use-time-off-balance.ts`
- `components/hr/onboarding-template-form-dialog.tsx`
- `components/hr/onboarding-detail-sheet.tsx`
- Migration `00015_hr_documents_orgchart.sql`

### Modified Files (~15)
- Support: tickets page, ticket detail sheet, support dashboard, knowledge-base page, sla-rules page, layout
- CRM: deal detail sheet, activity create dialog, crm dashboard, crm layout, move-deal action
- HR: employee profile sheet, time-off page, hr dashboard, hr layout, onboarding page

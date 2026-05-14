# Module Specialization — Design Spec

**Date:** 2026-05-14
**Status:** Approved
**Scope:** Enhance all 3 active modules (Support Desk, CRM, HR) with specialized features, new migrations, and enriched dashboards.

---

## Overview

The ONEmonday MVP has full CRUD across Support Desk, CRM, and HR modules. This spec covers the next layer: specialized features that make each module production-ready. Work is split into 3 independent streams that can be implemented in parallel.

### Migrations

- `00013_support_escalation.sql` — Support Desk escalation + notifications
- `00014_crm_proposals_pipeline.sql` — CRM proposal items, pipeline defaults, deal probability lock
- `00015_hr_documents.sql` — HR employee documents, time-off balance RPC, storage bucket

### Architecture Principles

- Follow existing patterns: server actions (zod -> auth -> permission -> supabase -> revalidate), React Query hooks, shadcn/ui components
- All UI text in pt-BR
- RLS on all new tables using `user_has_sector_access()` and `user_sector_roles` (NOT `sector_members` which doesn't exist)
- RLS policies: separate per operation (SELECT, INSERT, UPDATE, DELETE) following existing pattern
- No external integrations (email, WhatsApp) — placeholders only

---

## Module 1: Support Desk

### 1.1 SLA Rules CRUD

**Current state:** Page `/support/sla-rules` already has a functional listing with table, empty state, loading skeleton, badges, and hour formatting (~160 lines). Table `sla_rules` has columns: id, sector_id, name, priority (critical/high/medium/low), category, `response_time_hours` (int), `resolve_time_hours` (int), business_hours_only, is_active, created_at. Note: values are in HOURS not minutes.

**Implementation:**

- **Page** (`/support/sla-rules`): ADD create/edit/delete/toggle buttons to existing page. Do NOT rewrite — enhance incrementally.
- **SlaRuleFormDialog**: Create/edit dialog. Fields:
  - `name` (text, required)
  - `priority` (select: critical/high/medium/low — NOT `urgent`, which violates the CHECK constraint)
  - `category` (text, optional)
  - `response_time_hours` (number, required, label: "Tempo de primeira resposta (horas)")
  - `resolve_time_hours` (number, required, label: "Tempo de resolucao (horas)")
  - `business_hours_only` (checkbox, default true)
  - `is_active` (checkbox, default true)
- **Server actions** (`lib/actions/support/sla-rules.ts`):
  - `createSlaRule(formData)` — validate with zod, insert into sla_rules
  - `updateSlaRule(id, formData)` — validate, update
  - `deleteSlaRule(id)` — delete with confirmation
  - `toggleSlaRule(id, is_active)` — toggle active status
- **Hook** (`hooks/support/use-sla-rules.ts`): React Query fetching sla_rules by sector_id (check if already exists in the page, extract if so)
- **Display**: Format hours as human-readable ("2h", "8h", "24h", "2d")

### 1.2 Knowledge Base Editor

**Current state:** Page `/support/knowledge-base` lists articles. Table `kb_articles` has: id, sector_id, title, content, category, tags (text[]), author_id, `is_published` (boolean, NOT a status string), view_count, is_active, created_at, updated_at.

**Implementation:**

- **Page** (`/support/knowledge-base`): Enhanced listing with filter tabs (Todos/Publicados/Rascunhos) using `is_published` boolean, search by title, category badges.
- **KBArticleFormSheet**: Full-width sheet for create/edit. Fields:
  - `title` (text, required)
  - `category` (text with suggestions from existing categories)
  - `is_published` (checkbox, label: "Publicado")
  - `content` (textarea with markdown support — simple textarea with preview toggle, no rich editor library)
- **Server actions** (`lib/actions/support/kb-articles.ts`):
  - `createKBArticle(formData)` — sets author_id = current user
  - `updateKBArticle(id, formData)`
  - `deleteKBArticle(id)` — soft delete (is_active = false)
  - `toggleKBArticlePublished(id)` — toggle is_published boolean
- **Hook**: `use-kb-articles.ts` already exists — extend with `is_published` filter parameter
- **Markdown preview**: Simple toggle between edit (textarea) and preview (render content with basic formatting — whitespace preserved, line breaks converted)

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

CREATE POLICY "escalation_log_select" ON ticket_escalation_log
  FOR SELECT TO authenticated
  USING (
    from_sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid())
    OR to_sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "escalation_log_insert" ON ticket_escalation_log
  FOR INSERT TO authenticated
  WITH CHECK (
    from_sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid())
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

CREATE POLICY "support_notifications_select" ON support_notifications
  FOR SELECT TO authenticated
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "support_notifications_update" ON support_notifications
  FOR UPDATE TO authenticated
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid())
    )
  );

-- RPC to check SLA status
-- NOTE: support_tickets does NOT have title, priority, or status columns.
-- title and priority live on the linked `cards` table (via card_id).
-- Status is derived from board_columns via cards.column_id.
-- SLA columns are `sla_response_due_at` and `sla_resolve_due_at` (NOT sla_first_response_at/sla_resolve_at).
CREATE OR REPLACE FUNCTION check_sla_status()
RETURNS TABLE (
  ticket_id uuid,
  ticket_title text,
  priority text,
  sla_type text,
  deadline_at timestamptz,
  remaining_pct numeric
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    st.id,
    c.title,
    c.priority,
    CASE
      WHEN st.first_response_at IS NULL THEN 'first_response'
      ELSE 'resolution'
    END,
    CASE
      WHEN st.first_response_at IS NULL THEN st.sla_response_due_at
      ELSE st.sla_resolve_due_at
    END,
    CASE
      WHEN st.first_response_at IS NULL AND st.sla_response_due_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (st.sla_response_due_at - now())) /
             NULLIF(EXTRACT(EPOCH FROM (st.sla_response_due_at - st.created_at)), 0) * 100
      WHEN st.sla_resolve_due_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (st.sla_resolve_due_at - now())) /
             NULLIF(EXTRACT(EPOCH FROM (st.sla_resolve_due_at - st.created_at)), 0) * 100
      ELSE NULL
    END
  FROM support_tickets st
  JOIN cards c ON c.id = st.card_id
  WHERE st.resolved_at IS NULL
    AND st.is_active = true
    AND c.is_active = true
    AND (st.sla_response_due_at IS NOT NULL OR st.sla_resolve_due_at IS NOT NULL)
    AND st.sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid());
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

**Current state:** Table `crm_proposals` exists with: id, deal_id, sector_id, title, `content` (NOT description), `value` (NOT total_value), status (draft/sent/`viewed`/accepted/rejected/expired), `sent_at`, `expires_at` (NOT valid_until), created_by, is_active, created_at, updated_at.

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

CREATE POLICY "proposal_items_select" ON crm_proposal_items
  FOR SELECT TO authenticated
  USING (
    proposal_id IN (
      SELECT id FROM crm_proposals
      WHERE sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "proposal_items_insert" ON crm_proposal_items
  FOR INSERT TO authenticated
  WITH CHECK (
    proposal_id IN (
      SELECT id FROM crm_proposals
      WHERE sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "proposal_items_update" ON crm_proposal_items
  FOR UPDATE TO authenticated
  USING (
    proposal_id IN (
      SELECT id FROM crm_proposals
      WHERE sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "proposal_items_delete" ON crm_proposal_items
  FOR DELETE TO authenticated
  USING (
    proposal_id IN (
      SELECT id FROM crm_proposals
      WHERE sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid())
    )
  );
```

**Implementation:**

- **Page** (`/crm/proposals`): New sub-route. Table listing proposals with columns: Title, Deal, Value, Expires At, Status. Filters by status (including `viewed`). Empty state with CTA.
- **Layout**: Add "Propostas" link to CRM sub-navigation between "Pipeline" and "Activities"
- **ProposalFormDialog**: Create/edit dialog. Fields:
  - `deal_id` (select from open deals in sector)
  - `title` (text, required)
  - `content` (textarea — this is the real column name)
  - `expires_at` (date picker — this is the real column name)
  - `status` (select: draft/sent/viewed/accepted/rejected — include `viewed`)
  - Line items: dynamic array of {description, quantity, unit_price} with add/remove. Total auto-calculated and synced to `value` column.
- **ProposalDetailSheet**: Shows proposal info, line items table with subtotals, `sent_at` timestamp, status timeline, action buttons (Send, Accept, Reject based on current status).
- **Server actions** (`lib/actions/crm/proposals.ts`):
  - `createProposal(formData)` — insert proposal + items, set created_by = current user
  - `updateProposal(id, formData)` — update proposal + upsert items, recalculate `value`
  - `updateProposalStatus(id, status)` — status transition with validation, set `sent_at` when status = sent
  - `deleteProposal(id)` — soft delete (is_active = false), only if status = draft
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

CREATE POLICY "stage_defaults_select" ON crm_pipeline_stage_defaults
  FOR SELECT TO authenticated
  USING (sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()));

CREATE POLICY "stage_defaults_insert" ON crm_pipeline_stage_defaults
  FOR INSERT TO authenticated
  WITH CHECK (sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()));

CREATE POLICY "stage_defaults_update" ON crm_pipeline_stage_defaults
  FOR UPDATE TO authenticated
  USING (sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()));

CREATE POLICY "stage_defaults_delete" ON crm_pipeline_stage_defaults
  FOR DELETE TO authenticated
  USING (sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()));

-- Add probability lock to deals
ALTER TABLE crm_deals ADD COLUMN probability_locked boolean NOT NULL DEFAULT false;
```

**Implementation:**

- **Pipeline Settings**: Section in `/crm` settings or inline in pipeline page. Simple table: stage name -> default probability (%). Editable inline.
- **Server action**: `updateStageDefaults(sectorId, stages[])` — upsert stage defaults
- **moveDealToColumn** (existing action): After moving, if `probability_locked = false`, update probability to stage default. If no default exists, leave unchanged.
- **DealDetailSheet**: Probability field shows lock icon. Clicking locks/unlocks manual override.

### 2.3 Enriched Activity History

**No new columns** — extra fields (from_email, to_email, location) stored in the existing `description`/notes text field using a structured prefix pattern (e.g., "De: x@y.com | Para: z@w.com\n---\nContent"). No migration needed.

**Implementation:**

- **ActivityCreateDialog**: Enhanced fields based on type (stored serialized in description):
  - `email`: show `from_email`, `to_email` text inputs. Serialize into description.
  - `meeting`: show `location` text input. Serialize into description.
  - All types: `notes` field expanded to textarea (already exists)
- **Activity timeline**: In DealDetailSheet and ContactDetailSheet, show activity content preview (truncated notes, parse email from/to if present). Distinct icons and colors per type:
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
- **Top performers**: Ranked list of top 5 by total won deal value. Since `crm_deals` has no `owner_id` column, use `cards.created_by` (via deal's card_id) as the deal creator. Query: join crm_deals -> cards, group by cards.created_by where deal stage = won, sum value, order desc, limit 5. Show avatar + name + total.
- **Closing soon**: List of deals with `expected_close_date` within next 7 days. Show deal name, company, value, days remaining. Click navigates to deal.

---

## Module 3: HR (RH Portal)

### 3.1 Onboarding Workflow

**Current state:** Tables exist. `hr_onboarding_templates` has: id, sector_id, name, target_position, `items` (jsonb DEFAULT '[]' — items are stored as JSON array, NOT separate rows). `hr_onboarding_instances` has: id, template_id, employee_id, sector_id, status, started_at, completed_at. `hr_onboarding_items` has: id, instance_id, title, description, responsible_id, due_date, completed, completed_at, position. Page `/hr/onboarding` exists but is basic.

**Implementation:**

- **Templates tab**: List of onboarding templates with CRUD.
  - **OnboardingTemplateFormDialog**: Fields: name, target_position (text), items (dynamic array of {title, description, responsible_role, due_days_offset} — stored as jsonb in `items` column, NOT as separate rows).
  - Server actions: `createOnboardingTemplate()`, `updateOnboardingTemplate()`, `deleteOnboardingTemplate()`
- **Instances tab**: Active onboarding instances with progress bars.
  - **Start onboarding**: From EmployeeProfileSheet, button "Iniciar Onboarding" -> select template -> creates instance with calculated due dates (hire_date + due_days_offset for each item). Items from template jsonb are expanded into `hr_onboarding_items` rows.
  - **OnboardingDetailSheet**: Checklist with toggle per item. Shows: item title, responsible, due date, completed date. Progress bar at top. Overdue items highlighted in red.
  - Server actions: `startOnboarding(employeeId, templateId)`, `toggleOnboardingItem(itemId, completed)`, `completeOnboarding(instanceId)`
- **Hook** (`hooks/hr/use-onboarding.ts`): Already exists (69 lines with `useOnboardingInstances` and `useCompleteOnboardingItem`) — extend with template CRUD and instance detail queries
- **Page**: Tab switcher between "Ativos" (instances) and "Templates"

### 3.2 Time-Off Balance Calculation

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
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id,
    p.name,
    COALESCE(b.total_days, 0)::numeric,
    COALESCE(
      (SELECT SUM(r.days_count)::numeric FROM hr_time_off_requests r
       WHERE r.employee_id = p_employee_id
         AND r.policy_id = p.id
         AND r.status = 'approved'
         AND EXTRACT(YEAR FROM r.start_date) = p_year),
      0
    ),
    COALESCE(
      (SELECT SUM(r.days_count)::numeric FROM hr_time_off_requests r
       WHERE r.employee_id = p_employee_id
         AND r.policy_id = p.id
         AND r.status = 'pending'
         AND EXTRACT(YEAR FROM r.start_date) = p_year),
      0
    ),
    COALESCE(b.total_days, 0)::numeric
    - COALESCE(
        (SELECT SUM(r.days_count)::numeric FROM hr_time_off_requests r
         WHERE r.employee_id = p_employee_id
           AND r.policy_id = p.id
           AND r.status IN ('approved', 'pending')
           AND EXTRACT(YEAR FROM r.start_date) = p_year),
        0
      )
  FROM hr_time_off_policies p
  LEFT JOIN hr_time_off_balances b ON b.policy_id = p.id AND b.employee_id = p_employee_id AND b.year = p_year
  WHERE p.sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid());
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

CREATE POLICY "hr_documents_select" ON hr_employee_documents
  FOR SELECT TO authenticated
  USING (sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()));

CREATE POLICY "hr_documents_insert" ON hr_employee_documents
  FOR INSERT TO authenticated
  WITH CHECK (sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()));

CREATE POLICY "hr_documents_update" ON hr_employee_documents
  FOR UPDATE TO authenticated
  USING (sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()));

CREATE POLICY "hr_documents_delete" ON hr_employee_documents
  FOR DELETE TO authenticated
  USING (sector_id IN (SELECT sector_id FROM user_sector_roles WHERE user_id = auth.uid()));

-- Supabase Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('hr-documents', 'hr-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: allow authenticated users to manage files in their sector path
CREATE POLICY "hr_docs_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'hr-documents');

CREATE POLICY "hr_docs_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hr-documents');

CREATE POLICY "hr_docs_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'hr-documents');
```

**Implementation:**

- **EmployeeProfileSheet**: New "Documentos" section. Upload button (file input), list of documents grouped by category. Each item shows: name, category badge, upload date, download/delete buttons.
- **Server actions** (`lib/actions/hr/documents.ts`):
  - `uploadDocument(employeeId, file, category)` — upload to Supabase Storage bucket `hr-documents`, insert metadata row
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
- **Birthdays this month**: List of employees with birthdays in current month. Column `birth_date` exists in `hr_employees`. If no employees have birth_date filled, show hire_date anniversaries ("Aniversarios de empresa") as fallback.
- **Active onboardings**: Cards showing onboarding instances in progress with employee name, template, progress bar, days remaining.
- **Upcoming time-off**: List of approved time-off requests starting within next 7 days. Show employee name, dates, policy type.

---

## Cross-Cutting Concerns

### Navigation Updates
- CRM layout: add "Propostas" link between "Pipeline" and "Atividades"
- HR layout: add "Organograma" link after "Onboarding"

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

**HR (9):**
- `app/(dashboard)/hr/org-chart/page.tsx`
- `lib/actions/hr/documents.ts`
- `lib/actions/hr/onboarding.ts`
- `hooks/hr/use-org-chart.ts`
- `hooks/hr/use-employee-documents.ts`
- `hooks/hr/use-time-off-balance.ts`
- `components/hr/onboarding-template-form-dialog.tsx`
- `components/hr/onboarding-detail-sheet.tsx`
- Migration `00015_hr_documents.sql`

### Modified Files (~15)
- Support: tickets page, ticket detail sheet, support dashboard, knowledge-base page, sla-rules page, support layout
- CRM: deal detail sheet, activity create dialog, crm dashboard, crm layout, move-deal action
- HR: employee profile sheet, time-off page, hr dashboard, hr layout, onboarding page

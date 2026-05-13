# ONEmonday MVP — Design Spec

**Date:** 2026-05-12
**Author:** Lucas Nobre + Claude
**Status:** Reviewed — All Issues Fixed

---

## 1. Overview

### What

Internal project/task management platform replacing Monday.com for a 100-employee company. First module of the ONEplatform ecosystem (ONEmonday + ONEhub).

### Why

- Reduce SaaS costs (Monday.com license for 100 users)
- Centralize sector-specific workflows in a single platform
- Enable cross-sector interactions (support escalating cards to dev, etc.)
- Prepare modular architecture for future ONEhub modules (analytics, CRM, dev-tools)

### Scope — MVP

**In scope:**
- Kanban boards with drag-and-drop (per sector)
- Cards with priority, assignees, tags, checklists, comments, attachments
- Cross-sector card escalation (support → dev, etc.)
- RBAC permissions per sector per role
- Projects grouping cards
- Dashboard with metrics per sector
- List and timeline views
- Notifications (in-app + email via Supabase Edge Functions)
- Module system with coming_soon state for future ONEhub modules

**Out of scope (future modules):**
- Workflow automations (when card moves → trigger action)
- Custom fields per board
- Recurring cards
- Time tracking
- Public forms / external submission
- Analytics module (PostHog replacement)
- CRM module
- MFA / SSO
- Mobile app

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19 + shadcn/ui + Tailwind CSS 4 |
| Drag-and-drop | dnd-kit |
| Tables | TanStack Table |
| Charts | Recharts v3 (or Tremor for rapid dashboards) |
| Forms | React Hook Form + Zod |
| Data fetching | TanStack React Query |
| Backend | Supabase (PostgreSQL 15 + Auth + Realtime + Storage + Edge Functions) |
| Realtime | Supabase Realtime (Broadcast for kanban, Postgres Changes for notifications) |
| Deploy | Vercel (frontend) + Supabase Cloud (backend) |

---

## 3. Architecture

### Monolithic Modular

Single Next.js app where each sector is an access-controlled area, not a separate codebase. Future ONEhub modules plug in as new routes without restructuring.

```
ONEplatform/
├── apps/web/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── invite/
│   │   │   └── recovery/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx            # Auth guard + sidebar + realtime setup
│   │   │   ├── page.tsx              # Global dashboard
│   │   │   ├── boards/
│   │   │   ├── projects/
│   │   │   ├── settings/
│   │   │   └── [sector]/
│   │   │       ├── page.tsx          # Sector dashboard
│   │   │       ├── boards/
│   │   │       ├── projects/
│   │   │       └── [module]/         # Future ONEhub modules
│   │   │           └── page.tsx
│   │   └── api/                      # Route Handlers (when needed)
│   ├── components/
│   │   ├── ui/                       # shadcn/ui primitives
│   │   ├── shared/                   # Composites (card-item, permission-gate, etc.)
│   │   ├── boards/                   # Kanban feature components
│   │   ├── projects/                 # Project feature components
│   │   └── dashboards/              # Dashboard feature components
│   ├── lib/
│   │   ├── supabase/                 # Client, server, middleware configs
│   │   ├── permissions/              # RBAC engine (hasPermission, PermissionGate)
│   │   ├── realtime/                 # Subscription helpers
│   │   └── utils/                    # Shared utilities
│   ├── hooks/                        # Custom React hooks
│   └── types/                        # Shared TypeScript types
├── supabase/
│   ├── migrations/                   # SQL migrations
│   ├── functions/                    # Edge Functions (Deno)
│   └── seed.sql                      # Initial data (sectors, roles, default permissions, modules)
├── docs/
│   └── superpowers/specs/
└── package.json
```

### Server vs Client boundary

- **Server Components (default):** layouts, page shells, data fetching, permission checks
- **Client Components (explicit):** kanban board (dnd-kit), forms, realtime subscriptions, interactive filters
- **Edge Functions:** operations requiring service_role (invite, cross-sector escalation, email notifications)
- **Server Actions:** mutations that benefit from server-side validation without needing a full API route

### Data fetching pattern

```
React Query (fetch + cache + loading/error states)
  ↕ synced with
Supabase Realtime (invalidates React Query cache on events)
```

React Query handles initial fetch and cache. Realtime events invalidate specific query keys, triggering refetch. Single source of truth without dual state management.

---

## 4. Component Architecture

Three-layer design system. Upper layers only use lower layers, never the reverse.

### Layer 1 — Primitives (shadcn/ui)

No business logic. Appearance and UI behavior only. Customized once via Tailwind config tokens.

`button, input, select, dialog, dropdown-menu, badge, avatar, tooltip, skeleton, data-table, popover, sheet, tabs, toast, command`

### Layer 2 — Composites (product patterns)

Reusable across sectors and modules. Changes here propagate everywhere.

| Component | Purpose |
|-----------|---------|
| `card-item` | Generic card (kanban, lists) |
| `card-item-actions` | Card action menu (edit, move, delete, escalate) |
| `page-header` | Title + breadcrumb + actions |
| `empty-state` | Standardized empty state |
| `confirm-dialog` | Reusable confirmation modal |
| `user-avatar-group` | Assignee avatar stack |
| `status-badge` | Status with mapped colors |
| `filter-bar` | Generic filter bar |
| `search-input` | Search with debounce |
| `activity-feed` | Activity/history timeline |
| `file-upload` | Standardized upload (Supabase Storage) |
| `permission-gate` | Renders children only if user has permission |
| `module-gate` | Renders children only if module is enabled for sector |
| `notification-bell` | Notification indicator + dropdown |
| `card-list-view` | Card rendered as table row (for list view) |

### Layer 3 — Features (domain-specific)

Specific to each module. Use composites and primitives. Receive data via props or hooks, never access Supabase directly.

```
boards/: board-view, board-column, board-card, board-card-detail, board-filters
projects/: project-list, project-timeline, project-detail
dashboards/: sector-stats, charts, metric-cards
```

### Design consistency rules

- **Semantic tokens only:** `text-primary`, `text-muted-foreground` — never magic values like `text-[#3b82f6]`
- **Standardized props:** all list components follow `{ items, onSelect, isLoading, emptyMessage }`
- **Three states mandatory:** every data component handles loading (skeleton), error, and empty states
- **Forms:** always react-hook-form + Zod — never bare HTML validation

---

## 5. Data Model

### Reusable trigger

```sql
-- Auto-update updated_at on every UPDATE (applied to all mutable tables)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Core entities

```sql
-- Users
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text UNIQUE NOT NULL,
  full_name       text NOT NULL,
  avatar_url      text,
  is_global_admin boolean DEFAULT false,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Sectors
CREATE TABLE sectors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  icon        text,
  color       text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE TRIGGER trg_sectors_updated_at BEFORE UPDATE ON sectors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Roles
CREATE TABLE roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  level       int NOT NULL,  -- admin=100, manager=80, analyst=50, intern=20
  scope       text DEFAULT 'sector' CHECK (scope IN ('sector', 'global')),
  is_system   boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- User-Sector-Role assignment
CREATE TABLE user_sector_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  sector_id   uuid NOT NULL REFERENCES sectors(id),
  role_id     uuid NOT NULL REFERENCES roles(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, sector_id)
);

-- Modules (ONEmonday, future ONEhub modules)
-- status is the single source of truth (no separate is_active to avoid ambiguity)
CREATE TABLE modules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  name            text NOT NULL,
  description     text,
  icon            text,
  status          text DEFAULT 'active' CHECK (status IN ('active', 'coming_soon', 'disabled')),
  category        text CHECK (category IN ('core', 'hub')),
  version         text DEFAULT '1.0.0',
  settings_schema jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

-- Which modules each sector has access to
CREATE TABLE sector_modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id   uuid NOT NULL REFERENCES sectors(id),
  module_id   uuid NOT NULL REFERENCES modules(id),
  is_enabled  boolean DEFAULT false,
  config      jsonb DEFAULT '{}',
  UNIQUE(sector_id, module_id)
);

-- Permissions (module resolved via module_id — single permission table, no duplication)
CREATE TABLE permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id   uuid NOT NULL REFERENCES modules(id),
  resource    text NOT NULL,
  action      text NOT NULL,
  UNIQUE(module_id, resource, action)
);

-- Role-Permission mapping (join with permissions.module_id resolves module)
CREATE TABLE role_permissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         uuid NOT NULL REFERENCES roles(id),
  permission_id   uuid NOT NULL REFERENCES permissions(id),
  UNIQUE(role_id, permission_id)
);
```

### Boards and Cards

```sql
CREATE TABLE boards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  visibility  text DEFAULT 'sector' CHECK (visibility IN ('sector', 'cross_sector', 'global')),
  is_default  boolean DEFAULT false,
  created_by  uuid REFERENCES users(id),
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE TRIGGER trg_boards_updated_at BEFORE UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Board-Sector N:N (boards can span multiple sectors)
CREATE TABLE board_sectors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    uuid NOT NULL REFERENCES boards(id),
  sector_id   uuid NOT NULL REFERENCES sectors(id),
  UNIQUE(board_id, sector_id)
);

CREATE TABLE board_columns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id        uuid NOT NULL REFERENCES boards(id),
  name            text NOT NULL,
  color           text,
  position        int NOT NULL,
  wip_limit       int,
  is_done_column  boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE TRIGGER trg_board_columns_updated_at BEFORE UPDATE ON board_columns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE card_templates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id           uuid REFERENCES sectors(id),
  name                text NOT NULL,
  default_title       text,
  default_description text,
  default_priority    text DEFAULT 'medium',
  default_checklist   jsonb DEFAULT '[]',
  created_by          uuid NOT NULL REFERENCES users(id),
  is_active           boolean DEFAULT true,
  created_at          timestamptz DEFAULT now()
);

CREATE TABLE cards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id        uuid NOT NULL REFERENCES boards(id),
  column_id       uuid NOT NULL REFERENCES board_columns(id),
  sector_id       uuid NOT NULL REFERENCES sectors(id),
  title           text NOT NULL,
  description     text,
  position        int NOT NULL,
  priority        text DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  start_date      date,
  due_date        date,
  completed_at    timestamptz,
  parent_card_id  uuid REFERENCES cards(id),
  template_id     uuid REFERENCES card_templates(id) ON DELETE SET NULL,
  created_by      uuid NOT NULL REFERENCES users(id),
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE TRIGGER trg_cards_updated_at BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Constraint: cards.sector_id must exist in board_sectors for the card's board
-- (enforced via trigger since CHECK constraints cannot reference other tables)
CREATE OR REPLACE FUNCTION validate_card_sector()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM board_sectors
    WHERE board_id = NEW.board_id AND sector_id = NEW.sector_id
  ) THEN
    RAISE EXCEPTION 'Card sector_id must match one of the board sectors';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_validate_card_sector
  BEFORE INSERT OR UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION validate_card_sector();

CREATE TABLE card_assignees (
  card_id     uuid NOT NULL REFERENCES cards(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  PRIMARY KEY (card_id, user_id)
);

CREATE TABLE tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  color       text NOT NULL,
  sector_id   uuid REFERENCES sectors(id),
  is_active   boolean DEFAULT true,
  UNIQUE(name, sector_id)  -- prevent duplicate tag names within same sector
);

CREATE TABLE card_tags (
  card_id     uuid NOT NULL REFERENCES cards(id),
  tag_id      uuid NOT NULL REFERENCES tags(id),
  PRIMARY KEY (card_id, tag_id)
);

CREATE TABLE card_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     uuid NOT NULL REFERENCES cards(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  content     text NOT NULL,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE TRIGGER trg_card_comments_updated_at BEFORE UPDATE ON card_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE card_attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     uuid NOT NULL REFERENCES cards(id),
  file_url    text NOT NULL,
  file_name   text NOT NULL,
  file_size   int NOT NULL,
  mime_type   text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE card_checklists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     uuid NOT NULL REFERENCES cards(id),
  title       text NOT NULL,
  position    int NOT NULL
);

CREATE TABLE checklist_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id    uuid NOT NULL REFERENCES card_checklists(id) ON DELETE CASCADE,
  content         text NOT NULL,
  is_completed    boolean DEFAULT false,
  completed_by    uuid REFERENCES users(id),
  position        int NOT NULL
);

CREATE TABLE card_activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     uuid NOT NULL REFERENCES cards(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  action      text NOT NULL,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE card_cross_references (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_card_id  uuid NOT NULL REFERENCES cards(id),
  target_card_id  uuid NOT NULL REFERENCES cards(id),
  reference_type  text NOT NULL CHECK (reference_type IN ('escalation', 'related', 'blocks', 'blocked_by')),
  status          text DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_by      uuid NOT NULL REFERENCES users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE TRIGGER trg_cross_refs_updated_at BEFORE UPDATE ON card_cross_references
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Projects

```sql
CREATE TABLE projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  status      text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  start_date  date,
  target_date date,
  created_by  uuid NOT NULL REFERENCES users(id),
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE project_sectors (
  project_id  uuid NOT NULL REFERENCES projects(id),
  sector_id   uuid NOT NULL REFERENCES sectors(id),
  PRIMARY KEY (project_id, sector_id)
);

CREATE TABLE project_cards (
  project_id  uuid NOT NULL REFERENCES projects(id),
  card_id     uuid NOT NULL REFERENCES cards(id),
  PRIMARY KEY (project_id, card_id)
);
```

### Notifications

```sql
-- Polymorphic resource reference (no FK — cleanup via periodic Edge Function)
CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id),
  type            text NOT NULL,
  title           text NOT NULL,
  content         text,
  resource_type   text NOT NULL,
  resource_id     uuid NOT NULL,
  is_read         boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);
-- Cleanup strategy: Edge Function runs weekly, deletes notifications
-- where resource no longer exists (soft-deleted or removed)

CREATE TABLE notification_preferences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  type        text NOT NULL,
  channel     text DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'both', 'none')),
  UNIQUE(user_id, type)
);

CREATE TABLE invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  sector_id   uuid NOT NULL REFERENCES sectors(id),
  role_id     uuid NOT NULL REFERENCES roles(id),
  invited_by  uuid NOT NULL REFERENCES users(id),
  status      text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(email, sector_id, status)  -- prevent duplicate pending invites to same sector
);

-- Saved views (board_id null = sector-level or global view)
CREATE TABLE saved_views (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  board_id    uuid REFERENCES boards(id),
  sector_id   uuid REFERENCES sectors(id),  -- clarifies scope when board_id is null
  name        text NOT NULL,
  filters     jsonb NOT NULL DEFAULT '{}',
  is_default  boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);
```

### Indexes

```sql
-- Cards: primary query patterns
CREATE INDEX idx_cards_board_column ON cards(board_id, column_id, position);
CREATE INDEX idx_cards_sector ON cards(sector_id, is_active);
CREATE INDEX idx_cards_created_by ON cards(created_by);
CREATE INDEX idx_cards_due_date ON cards(due_date) WHERE due_date IS NOT NULL AND is_active = true;

-- Activity log: card timeline queries
CREATE INDEX idx_activity_card_time ON card_activity_log(card_id, created_at DESC);

-- Notifications: user inbox
CREATE INDEX idx_notifications_user_inbox ON notifications(user_id, is_read, created_at DESC);

-- User-sector-roles: permission lookups
CREATE INDEX idx_usr_user ON user_sector_roles(user_id);
CREATE INDEX idx_usr_sector ON user_sector_roles(sector_id);

-- Board-sectors: board lookup by sector
CREATE INDEX idx_board_sectors_sector ON board_sectors(sector_id);

-- Card assignees: find cards assigned to user
CREATE INDEX idx_card_assignees_user ON card_assignees(user_id);

-- Cross references: find related cards
CREATE INDEX idx_cross_refs_source ON card_cross_references(source_card_id);
CREATE INDEX idx_cross_refs_target ON card_cross_references(target_card_id);

-- Comments: card comment threads
CREATE INDEX idx_comments_card ON card_comments(card_id, created_at DESC) WHERE is_active = true;

-- Tags: lookup by sector
CREATE INDEX idx_tags_sector ON tags(sector_id) WHERE is_active = true;
```

---

## 6. Permission Matrix (MVP)

### ONEmonday module — resource/action pairs

| Resource | Actions | Admin | Manager | Analyst | Intern |
|----------|---------|-------|---------|---------|--------|
| board | create, read, update, delete, export | all | all | read, export | read |
| board_column | create, read, update, delete, manage | all | all | read | read |
| card | create, read, update, delete, move, assign, escalate | all | all | create, read, update, move, assign | create, read |
| card_comment | create, read, update, delete | all | all | create, read, update (own) | create, read |
| card_attachment | create, read, delete | all | all | create, read | read |
| card_checklist | create, read, update, delete | all | all | create, read, update | read |
| card_template | create, read, update, delete | all | all | read | read |
| project | create, read, update, delete | all | all | read | read |
| dashboard | read, export | all | all | read | read |
| settings | read, update | all | read | - | - |
| user | invite, read, update, deactivate | all | invite, read | read | - |
| notification | read, update | own | own | own | own |
| saved_view | create, read, update, delete | own | own | own | own |

"own" = user can only act on their own resources.

---

## 7. Realtime Strategy

### Channel architecture

| Channel | Trigger | Delivery | Who broadcasts |
|---------|---------|----------|----------------|
| `board:{board_id}` | Card moved, created, updated, deleted | Broadcast | Server Action after successful mutation |
| `card:{card_id}` | Comment added, assignee changed, checklist updated | Broadcast | Server Action after successful mutation |
| `user:{user_id}:inbox` | New notification | Postgres Changes (INSERT on notifications) | Automatic (DB trigger) |
| `sector:{sector_id}` | New escalation received | Broadcast | Edge Function handling escalation |

### Why Broadcast over Postgres Changes for kanban

Broadcast is pub/sub messaging — lighter, no CDC (change data capture) overhead. When a user moves a card, the server broadcasts the event directly. Other clients receive the position update and apply it without re-querying the database. Postgres Changes is only used for notifications (where we need guaranteed delivery tied to INSERT).

### Conflict resolution

Card position updates are **transactional per column**. A single RPC call updates all card positions in the affected column(s). This prevents partial position updates.

```
User A drags card to column B → optimistic update → RPC: reorder_cards(column_id, card_positions[])
User B drags same card to column C → optimistic update → RPC: reorder_cards(column_id, card_positions[])

Server processes A first:
  → RPC checks board.updated_at matches client's version
  → Updates positions + board.updated_at
  → Broadcasts to board:{board_id}

Server processes B:
  → RPC checks board.updated_at → MISMATCH (A already updated it)
  → Returns conflict error
  → Client B receives broadcast from A → rollback optimistic update
  → Toast: "Card moved to 'column B' by User A"
  → Card snaps to correct position
```

Column-level version check via `board.updated_at` ensures atomic batch position updates.

### Email notifications

Delivered via Supabase Edge Function triggered by Postgres webhook on `notifications` INSERT:
1. Check `notification_preferences` for the user + notification type
2. If channel is `email` or `both`, render email template and send via Supabase built-in email (or Resend/SendGrid if volume requires it)
3. Templates are server-side only, content is sanitized before rendering

---

## 8. Auth and Security

### Authentication flow

Supabase Auth (GoTrue):

1. Admin creates invite → Edge Function sends email with magic link
2. User clicks link → sets password → first access (redirected to password setup, not dashboard)
3. Login with email/password → JWT session with auto-refresh
4. Password recovery via email

Edge cases handled (from Effort ONE experience):
- Capture invite hash BEFORE Supabase SDK initializes (SDK clears URL hash)
- Validate sector + role assignment BEFORE sending invite
- Handle "another user logged in" when clicking invite link → force logout first
- Handle expired invite links gracefully with re-invite option

### Defense-in-depth (3 layers)

**Layer 1 — RLS (PostgreSQL):**
- Every table with sector_id has row-level security policies
- SELECT: user belongs to sector via user_sector_roles OR is_global_admin
- INSERT/UPDATE: user has matching permission in role_permissions
- DELETE: blocked at RLS level (soft delete enforced)

**Layer 2 — API Guard (Server-side):**
- Every Server Action / Route Handler verifies:
  1. Valid session via `getUser()` (never `getSession()` alone)
  2. `hasPermission(userId, sectorId, resource, action)` check
  3. Explicit `sector_id` filter even when RLS already filters
- Rate limiting on public endpoints (login, recovery, invite acceptance)

**Layer 3 — UI (Client-side):**
- `<PermissionGate>` hides elements user cannot access
- `<ModuleGate>` hides modules not enabled for sector
- Route protection via Next.js middleware
- Never trusts UI-only — always validates server-side

### Middleware routing

```
Request → Next.js Middleware
  → No session → redirect /login
  → Has session → check route:
    → /settings/* → requires role.level >= 100 (admin)
    → /[sector]/* → requires user_sector_roles entry for sector (or is_global_admin)
    → /[sector]/[module]/* → requires sector_modules.is_enabled = true
    → Module status = coming_soon → redirect to "Coming Soon" page
```

### Input validation and sanitization

- All inputs validated with Zod schemas before reaching database
- Rich text (card descriptions): HTML sanitized to prevent XSS
- File uploads: type and size validation in Supabase Storage policies
- Email notification templates: sanitized before rendering (prevents XSS via email)

---

## 9. Dashboard Metrics (MVP)

### Metrics per sector

| Metric | Query strategy |
|--------|---------------|
| Total cards (by status) | `COUNT(*) GROUP BY column.is_done_column` on cards WHERE sector_id + is_active |
| Cards created this week | `COUNT(*)` on cards WHERE created_at >= start_of_week |
| Cards completed this week | `COUNT(*)` on cards WHERE completed_at >= start_of_week |
| Average time to complete | `AVG(completed_at - created_at)` on cards WHERE completed_at IS NOT NULL |
| Cards by priority | `COUNT(*) GROUP BY priority` |
| Overdue cards | `COUNT(*)` WHERE due_date < now() AND completed_at IS NULL |
| Cards per assignee | JOIN card_assignees, GROUP BY user_id |
| Escalations received/sent | `COUNT(*)` on card_cross_references by sector |

For 100 users with expected volume (~5k-20k cards/year), direct queries with proper indexes perform well without materialized views. If performance degrades, add materialized views refreshed via `pg_cron` every 5 minutes.

---

## 10. MVP Module Registry

Initial seed data:

| Module | Slug | Status | Category |
|--------|------|--------|----------|
| ONEmonday | `onemonday` | active | core |
| Analytics | `analytics` | coming_soon | hub |
| CRM | `crm` | coming_soon | hub |
| Support Desk | `support-desk` | coming_soon | hub |
| Dev Tools | `dev-tools` | coming_soon | hub |
| HR Portal | `hr-portal` | coming_soon | hub |

Modules with `coming_soon` appear in the sidebar with a lock icon and "Em breve" tooltip. When a module is developed:
1. Create the route files in `app/(dashboard)/[sector]/[module]/`
2. Insert permissions for the module in the `permissions` table
3. Update module status to `active`
4. Enable via `sector_modules` per sector

No redeployment needed for enabling — it's a database flag.

---

## 11. Decisions Log

| Decision | Rationale |
|----------|-----------|
| Next.js 16 + Supabase | Solo dev needs max productivity. Supabase eliminates weeks of auth/realtime/storage work. |
| shadcn/ui over MUI/Ant Design | Native Tailwind integration, zero runtime overhead, works with Server Components, you own the code. |
| Single-tenant with sector isolation | Company-internal tool. No need for multi-tenant complexity. RLS isolates by sector. |
| Soft delete everywhere | Audit trail and data recovery. Never hard delete domain entities. |
| Broadcast over Postgres Changes for kanban | Lower overhead, faster delivery for high-frequency position updates. |
| Denormalized sector_id on cards | Query performance for sector-level dashboards and filters. Integrity enforced via trigger. |
| Module system from day one | Architecture prepared for ONEhub expansion without restructuring. |
| is_global_admin flag | Avoids creating user_sector_roles entries for every sector for admin users. |
| Column-level conflict resolution | Transactional position updates with board.updated_at version check. Simpler than OT, robust enough for task management. |
| Single role_permissions table | permissions.module_id resolves module context. No redundant role_module_permissions table. |
| modules.status instead of is_active | Single source of truth for module state. Prevents contradictory states. |
| Polymorphic notifications | Accepted trade-off. Weekly cleanup Edge Function handles orphaned references. |

---

## 12. What This Design Intentionally Excludes

These are **not** oversights. They are conscious scope decisions for the MVP:

- **Workflow automations** — High complexity, low MVP value. Add as module later.
- **Custom fields** — Requires dynamic schema. Premature for MVP.
- **Recurring cards** — Cron-based, add when card system is stable.
- **Time tracking** — Future ONEhub module.
- **Public forms** — Future feature.
- **MFA / SSO** — Future security enhancement.
- **Mobile app** — PWA covers basic mobile needs for now.
- **Offline support** — Not critical for internal tool with stable connection.
- **i18n** — Single company, Brazilian Portuguese only.
- **Materialized views** — Direct queries with indexes sufficient for expected volume. Add if performance requires.

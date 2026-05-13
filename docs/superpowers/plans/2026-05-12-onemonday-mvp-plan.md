# ONEmonday MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal project management platform (Monday.com replacement) for 100 employees with kanban boards, RBAC per sector, cross-sector escalation, and module system for future expansion.

**Architecture:** Monolithic modular Next.js 16 app with Supabase as backend (PostgreSQL + Auth + Realtime + Storage). Three-layer component architecture (primitives → composites → features). RLS + API guards + UI gates for defense-in-depth security.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Supabase, shadcn/ui, Tailwind CSS 4, dnd-kit, TanStack Table, TanStack React Query, Recharts, React Hook Form, Zod

**Spec:** `docs/superpowers/specs/2026-05-12-onemonday-mvp-design.md`

---

## Phase 1: Project Scaffolding

### Task 1: Initialize Next.js project with Supabase

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `.env.local.example`
- Create: `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`

- [ ] **Step 1: Create Next.js 16 project**

```bash
cd c:/Users/Nobre/Desktop/ONEmonday
npx create-next-app@latest apps/web --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --turbopack
```

- [ ] **Step 2: Install core dependencies**

```bash
cd apps/web
npm install @supabase/supabase-js @supabase/ssr @tanstack/react-query @tanstack/react-table react-hook-form @hookform/resolvers zod recharts @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install -D supabase
```

- [ ] **Step 3: Initialize shadcn/ui**

```bash
npx shadcn@latest init -d
```

Select: New York style, Zinc base color, CSS variables.

- [ ] **Step 4: Add essential shadcn/ui components**

```bash
npx shadcn@latest add button input select dialog dropdown-menu badge avatar tooltip skeleton popover sheet tabs toast command separator card label textarea
```

- [ ] **Step 5: Create `.env.local.example`**

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 6: Initialize git repository**

```bash
cd c:/Users/Nobre/Desktop/ONEmonday
git init
```

Create `.gitignore` with: `node_modules`, `.next`, `.env.local`, `.env*.local`

- [ ] **Step 7: Verify dev server starts**

```bash
cd apps/web
npm run dev
```

Expected: App running at localhost:3000.

- [ ] **Step 8: Commit**

```bash
git add apps/web/.gitignore apps/web/package.json apps/web/next.config.ts apps/web/tsconfig.json apps/web/tailwind.config.ts apps/web/app apps/web/components.json apps/web/lib apps/web/components .gitignore .env.local.example
git commit -m "feat: scaffold Next.js 16 + shadcn/ui + Tailwind CSS 4 project"
```

---

### Task 2: Configure Supabase client utilities

**Files:**
- Create: `apps/web/lib/supabase/client.ts`
- Create: `apps/web/lib/supabase/server.ts`
- Create: `apps/web/lib/supabase/middleware.ts`

- [ ] **Step 1: Create browser client**

```typescript
// apps/web/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create server client**

```typescript
// apps/web/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — ignore
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create middleware helper**

```typescript
// apps/web/lib/supabase/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes that don't require auth
  const publicRoutes = ["/login", "/invite", "/recovery"];
  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isPublicRoute && request.nextUrl.pathname !== "/invite") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 4: Create middleware.ts**

```typescript
// apps/web/middleware.ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/supabase apps/web/middleware.ts
git commit -m "feat: configure Supabase client (browser, server, middleware)"
```

---

### Task 3: Configure React Query provider

**Files:**
- Create: `apps/web/lib/react-query/provider.tsx`
- Create: `apps/web/lib/react-query/client.ts`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Create query client config**

```typescript
// apps/web/lib/react-query/client.ts
import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
      },
    },
  });
}
```

- [ ] **Step 2: Create provider component**

```tsx
// apps/web/lib/react-query/provider.tsx
"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { makeQueryClient } from "./client";

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

- [ ] **Step 3: Wrap app layout with provider**

Update `apps/web/app/layout.tsx` to wrap children with `<ReactQueryProvider>` and add `<Toaster />` from shadcn/ui.

- [ ] **Step 4: Verify app still runs**

```bash
cd apps/web && npm run dev
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/react-query apps/web/app/layout.tsx
git commit -m "feat: configure React Query provider"
```

---

## Phase 2: Database Schema

### Task 4: Initialize Supabase and create core migrations

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/00001_core_tables.sql`
- Create: `supabase/migrations/00002_boards_cards.sql`
- Create: `supabase/migrations/00003_projects_notifications.sql`
- Create: `supabase/migrations/00004_indexes.sql`
- Create: `supabase/seed.sql`

- [ ] **Step 1: Initialize Supabase locally**

```bash
cd c:/Users/Nobre/Desktop/ONEmonday
npx supabase init
```

- [ ] **Step 2: Create migration 00001 — core tables**

Create `supabase/migrations/00001_core_tables.sql` with:
- `update_updated_at()` trigger function
- `users` table + trigger
- `sectors` table + trigger
- `roles` table
- `user_sector_roles` table
- `modules` table
- `sector_modules` table
- `permissions` table
- `role_permissions` table
- Enable RLS on all tables

Copy exact SQL from spec sections 5.1 (Reusable trigger) and 5.2 (Core entities).

- [ ] **Step 3: Create migration 00002 — boards and cards**

Create `supabase/migrations/00002_boards_cards.sql` with:
- `boards` table + trigger
- `board_sectors` table
- `board_columns` table + trigger
- `card_templates` table
- `cards` table + trigger + `validate_card_sector()` trigger
- `card_assignees`, `tags`, `card_tags` tables
- `card_comments` table + trigger
- `card_attachments`, `card_checklists`, `checklist_items` tables
- `card_activity_log` table
- `card_cross_references` table + trigger
- Enable RLS on all tables

Copy exact SQL from spec section 5.3 (Boards and Cards).

- [ ] **Step 4: Create migration 00003 — projects and notifications**

Create `supabase/migrations/00003_projects_notifications.sql` with:
- `projects` table + trigger
- `project_sectors`, `project_cards` tables
- `notifications`, `notification_preferences` tables
- `invites` table
- `saved_views` table
- Enable RLS on all tables

Copy exact SQL from spec sections 5.4 and 5.5.

- [ ] **Step 5: Create migration 00004 — indexes**

Create `supabase/migrations/00004_indexes.sql` with all indexes from spec section 5.6.

- [ ] **Step 6: Create seed.sql**

```sql
-- Default roles
INSERT INTO roles (name, slug, level, scope, is_system) VALUES
  ('Administrador', 'admin', 100, 'global', true),
  ('Gerente', 'manager', 80, 'sector', true),
  ('Analista', 'analyst', 50, 'sector', true),
  ('Estagiario', 'intern', 20, 'sector', true);

-- Default sectors
INSERT INTO sectors (name, slug, icon, color) VALUES
  ('Desenvolvimento', 'dev', 'Code', '#818cf8'),
  ('Suporte', 'suporte', 'MessageSquare', '#fbbf24'),
  ('Comercial', 'comercial', 'Layers', '#34d399'),
  ('RH', 'rh', 'Users', '#f472b6');

-- Modules
INSERT INTO modules (slug, name, description, icon, status, category) VALUES
  ('onemonday', 'ONEmonday', 'Gestao de tarefas e projetos', 'LayoutGrid', 'active', 'core'),
  ('analytics', 'Analytics', 'Metricas e dashboards avancados', 'BarChart3', 'coming_soon', 'hub'),
  ('crm', 'CRM', 'Gestao de relacionamento com clientes', 'Users', 'coming_soon', 'hub'),
  ('support-desk', 'Support Desk', 'Central de atendimento', 'Headphones', 'coming_soon', 'hub'),
  ('dev-tools', 'Dev Tools', 'Ferramentas para desenvolvimento', 'Terminal', 'coming_soon', 'hub'),
  ('hr-portal', 'RH Portal', 'Gestao de pessoas', 'UserCog', 'coming_soon', 'hub');

-- Enable ONEmonday for all sectors
INSERT INTO sector_modules (sector_id, module_id, is_enabled)
SELECT s.id, m.id, true
FROM sectors s, modules m
WHERE m.slug = 'onemonday';

-- Permissions for ONEmonday module
INSERT INTO permissions (module_id, resource, action)
SELECT m.id, r.resource, r.action
FROM modules m,
(VALUES
  ('board', 'create'), ('board', 'read'), ('board', 'update'), ('board', 'delete'), ('board', 'export'),
  ('board_column', 'create'), ('board_column', 'read'), ('board_column', 'update'), ('board_column', 'delete'), ('board_column', 'manage'),
  ('card', 'create'), ('card', 'read'), ('card', 'update'), ('card', 'delete'), ('card', 'move'), ('card', 'assign'), ('card', 'escalate'),
  ('card_comment', 'create'), ('card_comment', 'read'), ('card_comment', 'update'), ('card_comment', 'delete'),
  ('card_attachment', 'create'), ('card_attachment', 'read'), ('card_attachment', 'delete'),
  ('card_checklist', 'create'), ('card_checklist', 'read'), ('card_checklist', 'update'), ('card_checklist', 'delete'),
  ('card_template', 'create'), ('card_template', 'read'), ('card_template', 'update'), ('card_template', 'delete'),
  ('project', 'create'), ('project', 'read'), ('project', 'update'), ('project', 'delete'),
  ('dashboard', 'read'), ('dashboard', 'export'),
  ('settings', 'read'), ('settings', 'update'),
  ('user', 'invite'), ('user', 'read'), ('user', 'update'), ('user', 'deactivate'),
  ('notification', 'read'), ('notification', 'update'),
  ('saved_view', 'create'), ('saved_view', 'read'), ('saved_view', 'update'), ('saved_view', 'delete')
) AS r(resource, action)
WHERE m.slug = 'onemonday';

-- Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'admin';

-- Manager gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'manager';

-- Analyst permissions (subset)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON true
WHERE r.slug = 'analyst'
AND (
  (p.resource = 'board' AND p.action IN ('read', 'export'))
  OR (p.resource = 'board_column' AND p.action = 'read')
  OR (p.resource = 'card' AND p.action IN ('create', 'read', 'update', 'move', 'assign'))
  OR (p.resource = 'card_comment' AND p.action IN ('create', 'read', 'update'))
  OR (p.resource = 'card_attachment' AND p.action IN ('create', 'read'))
  OR (p.resource = 'card_checklist' AND p.action IN ('create', 'read', 'update'))
  OR (p.resource = 'card_template' AND p.action = 'read')
  OR (p.resource = 'project' AND p.action = 'read')
  OR (p.resource = 'dashboard' AND p.action = 'read')
  OR (p.resource = 'user' AND p.action = 'read')
  OR (p.resource IN ('notification', 'saved_view'))
);

-- Intern permissions (minimal)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON true
WHERE r.slug = 'intern'
AND (
  (p.resource = 'board' AND p.action = 'read')
  OR (p.resource = 'board_column' AND p.action = 'read')
  OR (p.resource = 'card' AND p.action IN ('create', 'read'))
  OR (p.resource = 'card_comment' AND p.action IN ('create', 'read'))
  OR (p.resource = 'card_attachment' AND p.action = 'read')
  OR (p.resource = 'card_checklist' AND p.action = 'read')
  OR (p.resource = 'card_template' AND p.action = 'read')
  OR (p.resource = 'project' AND p.action = 'read')
  OR (p.resource = 'dashboard' AND p.action = 'read')
  OR (p.resource IN ('notification', 'saved_view'))
);
```

- [ ] **Step 7: Start Supabase locally and verify migrations**

```bash
npx supabase start
npx supabase db reset
```

Expected: All migrations run, seed data inserted, no errors.

- [ ] **Step 8: Commit**

```bash
git add supabase/
git commit -m "feat: database schema — core tables, boards, cards, projects, notifications, indexes, seed"
```

---

### Task 5: Create RLS policies

**Files:**
- Create: `supabase/migrations/00005_rls_policies.sql`

- [ ] **Step 1: Write RLS policies for all tables**

Key pattern for sector-isolated tables:

```sql
-- Helper function: check if user belongs to sector
CREATE OR REPLACE FUNCTION user_has_sector_access(p_sector_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_global_admin = true
  ) OR EXISTS (
    SELECT 1 FROM user_sector_roles
    WHERE user_id = auth.uid() AND sector_id = p_sector_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: check permission
CREATE OR REPLACE FUNCTION user_has_permission(p_sector_id uuid, p_resource text, p_action text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_global_admin = true
  ) OR EXISTS (
    SELECT 1 FROM user_sector_roles usr
    JOIN role_permissions rp ON rp.role_id = usr.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE usr.user_id = auth.uid()
    AND usr.sector_id = p_sector_id
    AND p.resource = p_resource
    AND p.action = p_action
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Write policies for: `users`, `sectors`, `roles`, `user_sector_roles`, `boards` (via `board_sectors`), `cards`, `card_comments`, `card_assignees`, `tags`, `card_tags`, `card_attachments`, `card_checklists`, `checklist_items`, `card_activity_log`, `card_cross_references`, `projects`, `project_sectors`, `project_cards`, `notifications` (own only), `notification_preferences` (own only), `invites`, `saved_views` (own only), `modules` (read-only for all authenticated), `sector_modules`, `permissions` (read-only), `role_permissions` (read-only), `board_sectors`, `board_columns`, `card_templates`.

- [ ] **Step 2: Run migration**

```bash
npx supabase db reset
```

Expected: All migrations run, RLS policies applied, no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00005_rls_policies.sql
git commit -m "feat: RLS policies with helper functions for sector access and permissions"
```

---

## Phase 3: Auth and RBAC

### Task 6: Build auth pages (login, invite, recovery)

**Files:**
- Create: `apps/web/app/(auth)/layout.tsx`
- Create: `apps/web/app/(auth)/login/page.tsx`
- Create: `apps/web/app/(auth)/recovery/page.tsx`
- Create: `apps/web/app/(auth)/invite/page.tsx`
- Create: `apps/web/lib/validations/auth.ts`

- [ ] **Step 1: Create Zod schemas for auth**

```typescript
// apps/web/lib/validations/auth.ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "Minimo 6 caracteres"),
});

export const recoverySchema = z.object({
  email: z.string().email("Email invalido"),
});

export const setPasswordSchema = z.object({
  password: z.string().min(8, "Minimo 8 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas nao conferem",
  path: ["confirmPassword"],
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RecoveryInput = z.infer<typeof recoverySchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
```

- [ ] **Step 2: Create auth layout (centered card)**

Simple layout with centered card for auth pages. No sidebar.

- [ ] **Step 3: Create login page**

Form with email + password using react-hook-form + Zod. Calls `supabase.auth.signInWithPassword()`. Redirects to `/` on success. Link to recovery page.

- [ ] **Step 4: Create recovery page**

Form with email. Calls `supabase.auth.resetPasswordForEmail()`. Success message.

- [ ] **Step 5: Create invite page**

Captures hash from URL BEFORE SDK init. Handles: valid invite → set password form, expired → re-invite message, another user logged in → force logout first.

- [ ] **Step 6: Verify login flow works**

Create a test user in Supabase dashboard. Login, verify redirect to dashboard.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/\(auth\) apps/web/lib/validations/auth.ts
git commit -m "feat: auth pages — login, recovery, invite with edge case handling"
```

---

### Task 7: Build RBAC permission engine

**Files:**
- Create: `apps/web/lib/permissions/engine.ts`
- Create: `apps/web/lib/permissions/types.ts`
- Create: `apps/web/components/shared/permission-gate.tsx`
- Create: `apps/web/components/shared/module-gate.tsx`
- Create: `apps/web/hooks/use-permissions.ts`

- [ ] **Step 1: Define permission types**

```typescript
// apps/web/lib/permissions/types.ts
export type Resource =
  | "board" | "board_column" | "card" | "card_comment"
  | "card_attachment" | "card_checklist" | "card_template"
  | "project" | "dashboard" | "settings" | "user"
  | "notification" | "saved_view";

export type Action =
  | "create" | "read" | "update" | "delete"
  | "move" | "assign" | "escalate" | "export"
  | "manage" | "invite" | "deactivate";

export interface UserPermissions {
  userId: string;
  isGlobalAdmin: boolean;
  sectorRoles: {
    sectorId: string;
    sectorSlug: string;
    roleId: string;
    roleSlug: string;
    roleLevel: number;
    permissions: { resource: Resource; action: Action }[];
  }[];
}
```

- [ ] **Step 2: Create server-side permission engine**

```typescript
// apps/web/lib/permissions/engine.ts
import { createClient } from "@/lib/supabase/server";
import type { UserPermissions, Resource, Action } from "./types";

export async function getUserPermissions(userId: string): Promise<UserPermissions> {
  const supabase = await createClient();
  // Query user + user_sector_roles + role_permissions + permissions
  // Return structured UserPermissions object
}

export function hasPermission(
  permissions: UserPermissions,
  sectorId: string,
  resource: Resource,
  action: Action
): boolean {
  if (permissions.isGlobalAdmin) return true;
  const sectorRole = permissions.sectorRoles.find(
    (sr) => sr.sectorId === sectorId
  );
  if (!sectorRole) return false;
  return sectorRole.permissions.some(
    (p) => p.resource === resource && p.action === action
  );
}
```

- [ ] **Step 3: Create PermissionGate component**

```tsx
// apps/web/components/shared/permission-gate.tsx
"use client";

import { usePermissions } from "@/hooks/use-permissions";
import type { Resource, Action } from "@/lib/permissions/types";

interface PermissionGateProps {
  sectorId: string;
  resource: Resource;
  action: Action;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({
  sectorId, resource, action, children, fallback = null,
}: PermissionGateProps) {
  const { hasPermission } = usePermissions();
  if (!hasPermission(sectorId, resource, action)) return fallback;
  return children;
}
```

- [ ] **Step 4: Create ModuleGate component**

Similar pattern, checks `sector_modules.is_enabled` and `modules.status`.

- [ ] **Step 5: Create usePermissions hook**

Fetches permissions via React Query, caches them. Provides `hasPermission()` helper.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/permissions apps/web/components/shared/permission-gate.tsx apps/web/components/shared/module-gate.tsx apps/web/hooks/use-permissions.ts
git commit -m "feat: RBAC permission engine + PermissionGate + ModuleGate components"
```

---

## Phase 4: Layout and Navigation

### Task 8: Build dashboard layout with sidebar

**Files:**
- Create: `apps/web/app/(dashboard)/layout.tsx`
- Create: `apps/web/components/shared/sidebar.tsx`
- Create: `apps/web/components/shared/sidebar-item.tsx`
- Create: `apps/web/components/shared/page-header.tsx`
- Create: `apps/web/hooks/use-current-user.ts`
- Create: `apps/web/hooks/use-sectors.ts`

- [ ] **Step 1: Create useCurrentUser hook**

Fetches authenticated user + their profile from `users` table. Cached via React Query.

- [ ] **Step 2: Create useSectors hook**

Fetches sectors the current user has access to (via `user_sector_roles` or `is_global_admin`). Also fetches modules per sector.

- [ ] **Step 3: Build sidebar component**

Following the mockup design:
- Logo (ONEmonday)
- "Geral" section: Dashboard, Boards, Projetos, Timeline
- "Setores" section: dynamically rendered from `useSectors()`, with badge showing card count
- Coming soon modules with lock icon
- "Sistema" section: Configuracoes (admin only via PermissionGate)
- User avatar + name at bottom

- [ ] **Step 4: Build page-header component**

Title + breadcrumb + actions slot. Reusable across all pages.

- [ ] **Step 5: Create dashboard layout**

Server Component that wraps sidebar + content area. Auth guard via `getUser()`.

- [ ] **Step 6: Create placeholder dashboard page**

`apps/web/app/(dashboard)/page.tsx` — simple "Dashboard" text for now.

- [ ] **Step 7: Verify layout renders with sidebar**

Login → see sidebar with sectors → navigate between placeholder pages.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/\(dashboard\) apps/web/components/shared/sidebar.tsx apps/web/components/shared/sidebar-item.tsx apps/web/components/shared/page-header.tsx apps/web/hooks/use-current-user.ts apps/web/hooks/use-sectors.ts
git commit -m "feat: dashboard layout with dynamic sidebar, sectors, module gates"
```

---

## Phase 5: Boards and Kanban

### Task 9: Board CRUD and listing

**Files:**
- Create: `apps/web/app/(dashboard)/[sector]/boards/page.tsx`
- Create: `apps/web/app/(dashboard)/[sector]/boards/[boardId]/page.tsx`
- Create: `apps/web/hooks/use-boards.ts`
- Create: `apps/web/lib/actions/boards.ts`
- Create: `apps/web/lib/validations/boards.ts`
- Create: `apps/web/components/boards/board-list.tsx`
- Create: `apps/web/components/boards/board-create-dialog.tsx`

- [ ] **Step 1: Create Zod schema for boards**

```typescript
// apps/web/lib/validations/boards.ts
import { z } from "zod";

export const createBoardSchema = z.object({
  name: z.string().min(1, "Nome obrigatorio").max(100),
  description: z.string().max(500).optional(),
  visibility: z.enum(["sector", "cross_sector", "global"]).default("sector"),
  sectorIds: z.array(z.string().uuid()).min(1, "Selecione ao menos um setor"),
});
```

- [ ] **Step 2: Create Server Actions for boards**

`apps/web/lib/actions/boards.ts`: `createBoard()`, `updateBoard()`, `deleteBoard()` (soft delete). Each validates with Zod, checks permissions via `hasPermission()`, executes Supabase query.

- [ ] **Step 3: Create useBoards hook**

Fetches boards for a sector via React Query. Returns `{ boards, isLoading, error }`.

- [ ] **Step 4: Build board list page**

Lists boards as cards. "Novo Board" button gated by `PermissionGate`. Empty state when no boards.

- [ ] **Step 5: Build board create dialog**

Form with name, description, visibility, sector selection. Uses react-hook-form + Zod.

- [ ] **Step 6: Verify board CRUD works end-to-end**

Create a board, see it in the list, verify it appears in the correct sector.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/\(dashboard\)/\[sector\]/boards apps/web/hooks/use-boards.ts apps/web/lib/actions/boards.ts apps/web/lib/validations/boards.ts apps/web/components/boards/board-list.tsx apps/web/components/boards/board-create-dialog.tsx
git commit -m "feat: board CRUD — list, create, update, soft delete with permissions"
```

---

### Task 10: Kanban board view with drag-and-drop

**Files:**
- Create: `apps/web/components/boards/board-view.tsx`
- Create: `apps/web/components/boards/board-column.tsx`
- Create: `apps/web/components/boards/board-card.tsx`
- Create: `apps/web/hooks/use-board-data.ts`
- Create: `apps/web/lib/actions/cards.ts`
- Create: `apps/web/lib/validations/cards.ts`

- [ ] **Step 1: Create Zod schemas for cards**

```typescript
// apps/web/lib/validations/cards.ts
import { z } from "zod";

export const createCardSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  columnId: z.string().uuid(),
  boardId: z.string().uuid(),
  sectorId: z.string().uuid(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  dueDate: z.string().optional(),
});

export const reorderCardsSchema = z.object({
  boardId: z.string().uuid(),
  columnId: z.string().uuid(),
  cardPositions: z.array(z.object({
    cardId: z.string().uuid(),
    position: z.number().int().min(0),
    columnId: z.string().uuid(),
  })),
  boardUpdatedAt: z.string(), // version check
});
```

- [ ] **Step 2: Create card Server Actions**

`createCard()`, `updateCard()`, `deleteCard()` (soft delete), `reorderCards()` (transactional with version check via `board.updated_at`).

- [ ] **Step 3: Create useBoardData hook**

Fetches board with columns + cards + assignees + tags for a single board. Organizes data by column for the kanban view.

- [ ] **Step 4: Build board-card component**

Displays: tags, title, assignee avatars, priority indicator, due date. Hover effect. Click opens detail.

- [ ] **Step 5: Build board-column component**

Column header (name, dot, count, WIP limit indicator). Droppable area via dnd-kit `useDroppable`. List of `board-card` components. "Add card" button at bottom.

- [ ] **Step 6: Build board-view component**

Horizontal grid of columns. Uses dnd-kit `DndContext`, `SortableContext`. Handles `onDragEnd` → optimistic update → `reorderCards()` server action → broadcast.

- [ ] **Step 7: Wire up board page**

`apps/web/app/(dashboard)/[sector]/boards/[boardId]/page.tsx` renders `board-view` with data from `useBoardData`.

- [ ] **Step 8: Verify drag-and-drop works**

Create cards, drag between columns, verify positions persist on refresh.

- [ ] **Step 9: Commit**

```bash
git add apps/web/components/boards/board-view.tsx apps/web/components/boards/board-column.tsx apps/web/components/boards/board-card.tsx apps/web/hooks/use-board-data.ts apps/web/lib/actions/cards.ts apps/web/lib/validations/cards.ts apps/web/app/\(dashboard\)/\[sector\]/boards/\[boardId\]
git commit -m "feat: kanban board with dnd-kit drag-and-drop, optimistic updates, column reordering"
```

---

### Task 11: Card detail modal (comments, checklists, attachments)

**Files:**
- Create: `apps/web/components/boards/board-card-detail.tsx`
- Create: `apps/web/components/shared/activity-feed.tsx`
- Create: `apps/web/components/shared/file-upload.tsx`
- Create: `apps/web/components/shared/user-avatar-group.tsx`
- Create: `apps/web/hooks/use-card-detail.ts`
- Create: `apps/web/lib/actions/comments.ts`
- Create: `apps/web/lib/actions/checklists.ts`
- Create: `apps/web/lib/actions/attachments.ts`

- [ ] **Step 1: Create Server Actions for comments, checklists, attachments**

Each with Zod validation and permission checks.

- [ ] **Step 2: Create useCardDetail hook**

Fetches full card data: comments, checklists with items, attachments, activity log, cross references.

- [ ] **Step 3: Build user-avatar-group component**

Stack of circular avatars with initials. Shows "+N" when more than 3.

- [ ] **Step 4: Build activity-feed component**

Timeline of card events. Each entry: avatar, action description, timestamp.

- [ ] **Step 5: Build file-upload component**

Drag-and-drop file area. Uploads to Supabase Storage. Shows progress. Validates type/size.

- [ ] **Step 6: Build card detail modal (Sheet)**

Full card detail in a side Sheet (shadcn/ui). Sections:
- Title (editable inline)
- Description (rich text, editable)
- Status/priority/due date
- Assignees (add/remove)
- Tags
- Checklists (add items, toggle completion)
- Attachments (upload, download, delete)
- Comments (add, list)
- Activity log
- Cross references (if any)

- [ ] **Step 7: Wire up modal opening from board-card click**

- [ ] **Step 8: Verify full card interaction flow**

Create card → open detail → add comment → add checklist → upload file → verify activity log.

- [ ] **Step 9: Commit**

```bash
git add apps/web/components/boards/board-card-detail.tsx apps/web/components/shared/activity-feed.tsx apps/web/components/shared/file-upload.tsx apps/web/components/shared/user-avatar-group.tsx apps/web/hooks/use-card-detail.ts apps/web/lib/actions/comments.ts apps/web/lib/actions/checklists.ts apps/web/lib/actions/attachments.ts
git commit -m "feat: card detail — comments, checklists, attachments, activity log"
```

---

## Phase 6: Cross-Sector and Views

### Task 12: Cross-sector card escalation

**Files:**
- Create: `apps/web/components/boards/escalate-dialog.tsx`
- Create: `apps/web/lib/actions/escalation.ts`
- Create: `supabase/functions/handle-escalation/index.ts`

- [ ] **Step 1: Create escalation Server Action**

Creates target card in destination sector board, creates `card_cross_reference`, logs activity on both cards, sends notification to target sector.

- [ ] **Step 2: Create Edge Function for escalation notification**

Broadcasts to `sector:{target_sector_id}` channel. Creates notification for sector managers.

- [ ] **Step 3: Build escalate dialog**

Select target sector → select board → set priority → add description → confirm. Gated by `PermissionGate(resource: 'card', action: 'escalate')`.

- [ ] **Step 4: Show cross-reference badges on cards**

"Escalado → Dev" badge on source card. "Origem: Suporte #142" on target card.

- [ ] **Step 5: Verify end-to-end escalation**

Suporte creates card → escalates to Dev → Dev sees card with link back → resolve in Dev → Suporte notified.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/boards/escalate-dialog.tsx apps/web/lib/actions/escalation.ts supabase/functions/handle-escalation
git commit -m "feat: cross-sector card escalation with bidirectional references and notifications"
```

---

### Task 13: List view and timeline view

**Files:**
- Create: `apps/web/components/boards/board-list-view.tsx`
- Create: `apps/web/components/boards/board-timeline-view.tsx`
- Create: `apps/web/components/shared/card-list-view.tsx`

- [ ] **Step 1: Build card-list-view component (table row)**

TanStack Table row: title, sector tag, assignee, status, priority, due date. Sortable columns. Filterable.

- [ ] **Step 2: Build board-list-view**

Full TanStack Table with sort, filter, pagination. Search input. Export button (gated).

- [ ] **Step 3: Build board-timeline-view**

Simple horizontal timeline (Gantt-like) using cards with `start_date` and `due_date`. Render as horizontal bars grouped by column.

- [ ] **Step 4: Wire up view tabs**

Board page tabs: Kanban | Lista | Timeline. State managed via URL search params.

- [ ] **Step 5: Verify all views show same data**

Create cards with dates → see in kanban → switch to list → switch to timeline → same cards.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/boards/board-list-view.tsx apps/web/components/boards/board-timeline-view.tsx apps/web/components/shared/card-list-view.tsx
git commit -m "feat: list view (TanStack Table) and timeline view for boards"
```

---

## Phase 7: Projects and Dashboard

### Task 14: Projects module

**Files:**
- Create: `apps/web/app/(dashboard)/[sector]/projects/page.tsx`
- Create: `apps/web/app/(dashboard)/[sector]/projects/[projectId]/page.tsx`
- Create: `apps/web/components/projects/project-list.tsx`
- Create: `apps/web/components/projects/project-detail.tsx`
- Create: `apps/web/hooks/use-projects.ts`
- Create: `apps/web/lib/actions/projects.ts`
- Create: `apps/web/lib/validations/projects.ts`

- [ ] **Step 1: Create Zod schemas and Server Actions for projects**

CRUD with permission checks. Link/unlink cards to projects.

- [ ] **Step 2: Build project list page**

Cards showing: name, status, sector badges, progress (cards done / total), dates.

- [ ] **Step 3: Build project detail page**

Project info + list of linked cards (reuses card-list-view). Add card to project action.

- [ ] **Step 4: Verify project flow**

Create project → link cards → see progress update → change project status.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(dashboard\)/\[sector\]/projects apps/web/components/projects apps/web/hooks/use-projects.ts apps/web/lib/actions/projects.ts apps/web/lib/validations/projects.ts
git commit -m "feat: projects — CRUD, card linking, progress tracking"
```

---

### Task 15: Sector dashboard with metrics

**Files:**
- Create: `apps/web/app/(dashboard)/[sector]/page.tsx`
- Create: `apps/web/app/(dashboard)/page.tsx` (global dashboard)
- Create: `apps/web/components/dashboards/sector-stats.tsx`
- Create: `apps/web/components/dashboards/metric-card.tsx`
- Create: `apps/web/components/dashboards/cards-by-priority-chart.tsx`
- Create: `apps/web/components/dashboards/cards-by-assignee-chart.tsx`
- Create: `apps/web/hooks/use-dashboard-metrics.ts`

- [ ] **Step 1: Create useDashboardMetrics hook**

Fetches all metrics from spec section 9 (total cards, in progress, completed, overdue, by priority, by assignee, escalations).

- [ ] **Step 2: Build metric-card component**

Label, value, change indicator (up/down with color).

- [ ] **Step 3: Build charts**

`cards-by-priority-chart` (Recharts donut), `cards-by-assignee-chart` (Recharts bar). Both receive data via props.

- [ ] **Step 4: Build sector-stats component**

Composes metric cards + charts into a dashboard grid.

- [ ] **Step 5: Build sector dashboard page**

Renders sector-stats for the current sector.

- [ ] **Step 6: Build global dashboard page**

Aggregated metrics across all sectors the user has access to.

- [ ] **Step 7: Verify dashboards render with real data**

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/\(dashboard\)/\[sector\]/page.tsx apps/web/app/\(dashboard\)/page.tsx apps/web/components/dashboards apps/web/hooks/use-dashboard-metrics.ts
git commit -m "feat: sector and global dashboards with metrics and charts"
```

---

## Phase 8: Notifications and Realtime

### Task 16: Notification system

**Files:**
- Create: `apps/web/components/shared/notification-bell.tsx`
- Create: `apps/web/hooks/use-notifications.ts`
- Create: `apps/web/lib/actions/notifications.ts`
- Create: `supabase/functions/send-email-notification/index.ts`
- Create: `supabase/migrations/00006_notification_trigger.sql`

- [ ] **Step 1: Create DB trigger for notification email**

Postgres trigger on `notifications` INSERT → calls Edge Function via `pg_net`.

- [ ] **Step 2: Create Edge Function for email delivery**

Checks `notification_preferences`. If `email` or `both`, sends email via Supabase built-in (or Resend).

- [ ] **Step 3: Create useNotifications hook**

Fetches unread notifications. Subscribes to `user:{userId}:inbox` via Postgres Changes. Real-time badge count.

- [ ] **Step 4: Build notification-bell component**

Bell icon with unread count badge. Dropdown with notification list. Mark as read on click. "Marcar todas como lidas" action.

- [ ] **Step 5: Create notification Server Actions**

`markAsRead()`, `markAllAsRead()`, `updatePreferences()`.

- [ ] **Step 6: Integrate notification creation into existing actions**

Add notification creation to: card assignment, card comment, card escalation, card due soon.

- [ ] **Step 7: Verify notification flow**

Assign card → notification appears in bell → click → mark as read.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/shared/notification-bell.tsx apps/web/hooks/use-notifications.ts apps/web/lib/actions/notifications.ts supabase/functions/send-email-notification supabase/migrations/00006_notification_trigger.sql
git commit -m "feat: notification system — in-app + email, realtime via Postgres Changes"
```

---

### Task 17: Realtime kanban updates

**Files:**
- Create: `apps/web/lib/realtime/board-channel.ts`
- Create: `apps/web/lib/realtime/use-board-realtime.ts`
- Modify: `apps/web/components/boards/board-view.tsx`
- Modify: `apps/web/lib/actions/cards.ts`

- [ ] **Step 1: Create board channel helper**

```typescript
// apps/web/lib/realtime/board-channel.ts
import { createClient } from "@/lib/supabase/client";

export function subscribeToBoardChannel(
  boardId: string,
  onCardEvent: (payload: BoardEvent) => void
) {
  const supabase = createClient();
  return supabase.channel(`board:${boardId}`)
    .on("broadcast", { event: "card_update" }, ({ payload }) => {
      onCardEvent(payload as BoardEvent);
    })
    .subscribe();
}
```

- [ ] **Step 2: Create useBoardRealtime hook**

Subscribes to board channel. On event, invalidates React Query cache for the board → triggers refetch.

- [ ] **Step 3: Add broadcast to card Server Actions**

After successful card mutation (create, update, move, delete), broadcast event to `board:{boardId}`.

- [ ] **Step 4: Integrate realtime into board-view**

Board view calls `useBoardRealtime(boardId)`. Cards update live when other users make changes.

- [ ] **Step 5: Test with two browser tabs**

Open same board in two tabs. Move card in tab A → see update in tab B.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/realtime apps/web/components/boards/board-view.tsx apps/web/lib/actions/cards.ts
git commit -m "feat: realtime kanban — broadcast card events, live updates across tabs"
```

---

## Phase 9: Settings and User Management

### Task 18: Settings and user management

**Files:**
- Create: `apps/web/app/(dashboard)/settings/page.tsx`
- Create: `apps/web/app/(dashboard)/settings/users/page.tsx`
- Create: `apps/web/app/(dashboard)/settings/sectors/page.tsx`
- Create: `apps/web/app/(dashboard)/settings/roles/page.tsx`
- Create: `apps/web/components/settings/user-list.tsx`
- Create: `apps/web/components/settings/invite-user-dialog.tsx`
- Create: `apps/web/lib/actions/users.ts`
- Create: `apps/web/lib/actions/invites.ts`
- Create: `supabase/functions/send-invite/index.ts`

- [ ] **Step 1: Create invite Edge Function**

Generates invite link via `supabase.auth.admin.generateLink({ type: 'invite' })`. Sends email. Creates `invites` row.

- [ ] **Step 2: Create user Server Actions**

List users, update user role, deactivate user (soft delete), resend invite.

- [ ] **Step 3: Build user list page**

TanStack Table: name, email, sectors, role, status, actions. Gated by admin PermissionGate.

- [ ] **Step 4: Build invite dialog**

Form: email, select sector, select role. Validates email not already invited. Calls Edge Function.

- [ ] **Step 5: Build sectors management page**

List sectors, create, edit (name, icon, color), deactivate. Admin only.

- [ ] **Step 6: Build settings layout with tabs**

Settings page with sub-navigation: Usuarios | Setores | Roles | Geral.

- [ ] **Step 7: Verify full user lifecycle**

Invite user → user accepts → logs in → assigned to sector → admin changes role → admin deactivates.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/\(dashboard\)/settings apps/web/components/settings apps/web/lib/actions/users.ts apps/web/lib/actions/invites.ts supabase/functions/send-invite
git commit -m "feat: settings — user management, invites, sector management"
```

---

## Phase 10: Polish and Ship

### Task 19: Shared components and empty states

**Files:**
- Create: `apps/web/components/shared/empty-state.tsx`
- Create: `apps/web/components/shared/confirm-dialog.tsx`
- Create: `apps/web/components/shared/search-input.tsx`
- Create: `apps/web/components/shared/filter-bar.tsx`
- Create: `apps/web/components/shared/status-badge.tsx`

- [ ] **Step 1: Build remaining shared components**

Each component following the design consistency rules: semantic tokens, standardized props, three states.

- [ ] **Step 2: Integrate empty states across all pages**

Board list, card list, projects, dashboard — all show `empty-state` when no data.

- [ ] **Step 3: Add search and filter to board views**

Search cards by title, filter by priority, assignee, tag, due date.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/shared
git commit -m "feat: shared components — empty states, search, filters, status badges"
```

---

### Task 20: Coming soon module gates

**Files:**
- Create: `apps/web/app/(dashboard)/[sector]/[module]/page.tsx`
- Modify: `apps/web/components/shared/sidebar.tsx`

- [ ] **Step 1: Create coming soon placeholder page**

```tsx
// apps/web/app/(dashboard)/[sector]/[module]/page.tsx
// Shows module name, description, lock icon, "Em breve" message
```

- [ ] **Step 2: Add lock icons to sidebar for coming_soon modules**

Modules with `status: coming_soon` show with lock icon and reduced opacity.

- [ ] **Step 3: Verify module gates work**

Click on "Analytics" in sidebar → see coming soon page. Cannot bypass via URL.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/\[sector\]/\[module\] apps/web/components/shared/sidebar.tsx
git commit -m "feat: module gates — coming soon pages with lock icons in sidebar"
```

---

### Task 21: Final integration testing and cleanup

- [ ] **Step 1: Test full user journey**

Admin invites user → user logs in → navigates to sector → creates board → creates cards → drags cards → adds comments → escalates to another sector → target sector sees card → resolves → source sector notified → dashboard reflects changes.

- [ ] **Step 2: Test permission boundaries**

Intern cannot delete cards. Analyst cannot access settings. Manager can invite. Admin sees everything.

- [ ] **Step 3: Test realtime**

Two users on same board → card moves reflect live.

- [ ] **Step 4: Remove unused files and clean up**

Remove any placeholder files, unused imports, TODO comments.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: ONEmonday MVP — integration tested, cleanup complete"
```

---

## Task Dependency Map

```
Task 1 (scaffold) → Task 2 (supabase client) → Task 3 (react query)
                  → Task 4 (migrations) → Task 5 (RLS)
Task 2 + 5 → Task 6 (auth pages)
Task 6 → Task 7 (RBAC engine)
Task 7 → Task 8 (layout/sidebar)
Task 8 → Task 9 (board CRUD)
Task 9 → Task 10 (kanban DnD) → Task 11 (card detail)
Task 11 → Task 12 (escalation) → Task 13 (list/timeline views)
Task 8 → Task 14 (projects)
Task 8 → Task 15 (dashboard)
Task 10 → Task 16 (notifications) → Task 17 (realtime)
Task 7 → Task 18 (settings)
Task 13 → Task 19 (shared components polish)
Task 8 → Task 20 (module gates)
Task 12-20 → Task 21 (integration test)
```

**Parallelizable:** Tasks 14, 15, 18, 20 can run in parallel once Task 8 is complete.

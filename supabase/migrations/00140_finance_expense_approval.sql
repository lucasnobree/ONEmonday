-- Migration 00140: Expense approval workflow (Despesas — aprovação).
-- Deferred Finance backlog item E2: any user who could create an expense
-- recorded it directly; there was no submitter -> approver -> paid routing.
--
-- This migration:
--  1. Extends the finance_expenses.status CHECK to add the approval states
--     `submitted`, `approved`, `rejected` alongside the existing
--     `pending` / `paid` / `void`.
--  2. Adds approval-tracking columns (approved_by, approved_at, rejection_reason).
--  3. Registers an `approve` permission action for the `expense` resource so
--     approving is a distinct capability from editing, granted to managers and
--     admins only.
--
-- State machine (enforced in the server-action layer):
--   pending  --submit-->  submitted
--   submitted --approve--> approved   --pay--> paid
--   submitted --reject-->  rejected
--   approved --pay--> paid
-- `pending` is retained as the default for quick informal entries; an expense
-- can also be marked paid/void directly as before (backwards compatible).
-- Idempotent: safe to re-run.

-- =============================================
-- 1. Extend the status CHECK constraint
-- =============================================
ALTER TABLE finance_expenses
  DROP CONSTRAINT IF EXISTS finance_expenses_status_check;
ALTER TABLE finance_expenses
  ADD CONSTRAINT finance_expenses_status_check
  CHECK (status IN ('pending', 'submitted', 'approved',
                     'rejected', 'paid', 'void'));

-- =============================================
-- 2. Approval-tracking columns
-- =============================================
ALTER TABLE finance_expenses
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id);
ALTER TABLE finance_expenses
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE finance_expenses
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- =============================================
-- 3. Register the `approve` action for the `expense` resource
-- =============================================
INSERT INTO permissions (module_id, resource, action)
SELECT m.id, 'expense', 'approve'
FROM modules m
WHERE m.slug = 'finance'
ON CONFLICT (module_id, resource, action) DO NOTHING;

-- Grant `expense:approve` to admin and manager roles only — approving is a
-- control function, distinct from creating/editing an expense.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
JOIN modules m ON p.module_id = m.id
WHERE r.slug IN ('admin', 'manager')
AND m.slug = 'finance'
AND p.resource = 'expense'
AND p.action = 'approve'
ON CONFLICT (role_id, permission_id) DO NOTHING;

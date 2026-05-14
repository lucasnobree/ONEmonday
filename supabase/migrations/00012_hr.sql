-- =============================================
-- HR Module Tables
-- =============================================

-- 1. hr_employees
CREATE TABLE hr_employees (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id        uuid NOT NULL REFERENCES sectors(id),
  user_id          uuid REFERENCES users(id),
  full_name        text NOT NULL,
  email            text NOT NULL,
  phone            text,
  position         text,
  department       text,
  hire_date        date NOT NULL,
  birth_date       date,
  manager_id       uuid REFERENCES hr_employees(id),
  employment_type  text NOT NULL DEFAULT 'full_time'
                   CHECK (employment_type IN ('full_time', 'part_time', 'contractor', 'intern')),
  status           text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'on_leave', 'terminated')),
  termination_date date,
  notes            text,
  is_active        boolean DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE TRIGGER trg_hr_employees_updated_at BEFORE UPDATE ON hr_employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. hr_time_off_policies
CREATE TABLE hr_time_off_policies (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id            uuid NOT NULL REFERENCES sectors(id),
  name                 text NOT NULL,
  days_per_year        int NOT NULL,
  requires_approval    boolean DEFAULT true,
  max_consecutive_days int,
  is_active            boolean DEFAULT true,
  created_at           timestamptz DEFAULT now()
);

-- 3. hr_time_off_requests
CREATE TABLE hr_time_off_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      uuid NOT NULL REFERENCES hr_employees(id),
  sector_id        uuid NOT NULL REFERENCES sectors(id),
  policy_id        uuid NOT NULL REFERENCES hr_time_off_policies(id),
  start_date       date NOT NULL,
  end_date         date NOT NULL,
  days_count       int NOT NULL,
  reason           text,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by      uuid REFERENCES users(id),
  approved_at      timestamptz,
  rejection_reason text,
  is_active        boolean DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE TRIGGER trg_hr_time_off_requests_updated_at BEFORE UPDATE ON hr_time_off_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. hr_time_off_balances
CREATE TABLE hr_time_off_balances (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  uuid NOT NULL REFERENCES hr_employees(id),
  policy_id    uuid NOT NULL REFERENCES hr_time_off_policies(id),
  year         int NOT NULL,
  total_days   int NOT NULL,
  used_days    int NOT NULL DEFAULT 0,
  pending_days int NOT NULL DEFAULT 0,
  UNIQUE(employee_id, policy_id, year)
);

-- 5. hr_job_openings
CREATE TABLE hr_job_openings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id         uuid NOT NULL REFERENCES sectors(id),
  board_id          uuid REFERENCES boards(id),
  title             text NOT NULL,
  department        text,
  description       text,
  requirements      text,
  employment_type   text NOT NULL DEFAULT 'full_time'
                    CHECK (employment_type IN ('full_time', 'part_time', 'contractor', 'intern')),
  location          text,
  salary_range      text,
  status            text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'paused', 'closed', 'filled')),
  hiring_manager_id uuid NOT NULL REFERENCES users(id),
  max_candidates    int,
  is_active         boolean DEFAULT true,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
CREATE TRIGGER trg_hr_job_openings_updated_at BEFORE UPDATE ON hr_job_openings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6. hr_candidates
CREATE TABLE hr_candidates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id          uuid NOT NULL REFERENCES cards(id) UNIQUE,
  job_opening_id   uuid NOT NULL REFERENCES hr_job_openings(id),
  sector_id        uuid NOT NULL REFERENCES sectors(id),
  full_name        text NOT NULL,
  email            text NOT NULL,
  phone            text,
  resume_url       text,
  linkedin_url     text,
  source           text,
  current_company  text,
  current_position text,
  expected_salary  numeric(15, 2),
  notes            text,
  rating           int CHECK (rating >= 1 AND rating <= 5),
  rejection_reason text,
  is_active        boolean DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE TRIGGER trg_hr_candidates_updated_at BEFORE UPDATE ON hr_candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. hr_onboarding_templates
CREATE TABLE hr_onboarding_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id   uuid NOT NULL REFERENCES sectors(id),
  position    text,
  name        text NOT NULL,
  description text,
  items       jsonb DEFAULT '[]',
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE TRIGGER trg_hr_onboarding_templates_updated_at BEFORE UPDATE ON hr_onboarding_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 8. hr_onboarding_instances
CREATE TABLE hr_onboarding_instances (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  uuid NOT NULL REFERENCES hr_employees(id),
  template_id  uuid NOT NULL REFERENCES hr_onboarding_templates(id),
  sector_id    uuid NOT NULL REFERENCES sectors(id),
  start_date   date NOT NULL DEFAULT CURRENT_DATE,
  status       text NOT NULL DEFAULT 'in_progress'
               CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  completed_at timestamptz,
  created_at   timestamptz DEFAULT now()
);

-- 9. hr_onboarding_items
CREATE TABLE hr_onboarding_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id uuid NOT NULL REFERENCES hr_onboarding_instances(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  due_date      date,
  is_completed  boolean DEFAULT false,
  completed_at  timestamptz,
  completed_by  uuid REFERENCES users(id),
  assigned_to   uuid REFERENCES users(id),
  position      int NOT NULL
);

-- =============================================
-- Enable RLS
-- =============================================
ALTER TABLE hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_time_off_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_time_off_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_job_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_onboarding_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_onboarding_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Indexes
-- =============================================

-- hr_employees
CREATE INDEX idx_hr_employees_sector_id ON hr_employees(sector_id);
CREATE INDEX idx_hr_employees_user_id ON hr_employees(user_id);
CREATE INDEX idx_hr_employees_manager_id ON hr_employees(manager_id);
CREATE INDEX idx_hr_employees_status ON hr_employees(status);
CREATE INDEX idx_hr_employees_hire_date ON hr_employees(hire_date);

-- hr_time_off_policies
CREATE INDEX idx_hr_time_off_policies_sector_id ON hr_time_off_policies(sector_id);

-- hr_time_off_requests
CREATE INDEX idx_hr_time_off_requests_employee_id ON hr_time_off_requests(employee_id);
CREATE INDEX idx_hr_time_off_requests_sector_id ON hr_time_off_requests(sector_id);
CREATE INDEX idx_hr_time_off_requests_policy_id ON hr_time_off_requests(policy_id);
CREATE INDEX idx_hr_time_off_requests_status ON hr_time_off_requests(status);
CREATE INDEX idx_hr_time_off_requests_dates ON hr_time_off_requests(start_date, end_date);

-- hr_time_off_balances
CREATE INDEX idx_hr_time_off_balances_employee_id ON hr_time_off_balances(employee_id);

-- hr_job_openings
CREATE INDEX idx_hr_job_openings_sector_id ON hr_job_openings(sector_id);
CREATE INDEX idx_hr_job_openings_board_id ON hr_job_openings(board_id);
CREATE INDEX idx_hr_job_openings_status ON hr_job_openings(status);

-- hr_candidates
CREATE INDEX idx_hr_candidates_card_id ON hr_candidates(card_id);
CREATE INDEX idx_hr_candidates_job_opening_id ON hr_candidates(job_opening_id);
CREATE INDEX idx_hr_candidates_sector_id ON hr_candidates(sector_id);

-- hr_onboarding_templates
CREATE INDEX idx_hr_onboarding_templates_sector_id ON hr_onboarding_templates(sector_id);

-- hr_onboarding_instances
CREATE INDEX idx_hr_onboarding_instances_employee_id ON hr_onboarding_instances(employee_id);
CREATE INDEX idx_hr_onboarding_instances_sector_id ON hr_onboarding_instances(sector_id);
CREATE INDEX idx_hr_onboarding_instances_status ON hr_onboarding_instances(status);

-- hr_onboarding_items
CREATE INDEX idx_hr_onboarding_items_onboarding_id ON hr_onboarding_items(onboarding_id);
CREATE INDEX idx_hr_onboarding_items_assigned_to ON hr_onboarding_items(assigned_to);

-- =============================================
-- RLS Policies
-- =============================================

-- hr_employees
CREATE POLICY "hr_employees_select" ON hr_employees
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_sector_roles usr WHERE usr.user_id = auth.uid() AND usr.sector_id = hr_employees.sector_id)
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_global_admin = true)
  );

CREATE POLICY "hr_employees_insert" ON hr_employees
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'hr_employee', 'create'));

CREATE POLICY "hr_employees_update" ON hr_employees
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'hr_employee', 'update'));

-- hr_time_off_policies
CREATE POLICY "hr_time_off_policies_select" ON hr_time_off_policies
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_sector_roles usr WHERE usr.user_id = auth.uid() AND usr.sector_id = hr_time_off_policies.sector_id)
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_global_admin = true)
  );

CREATE POLICY "hr_time_off_policies_insert" ON hr_time_off_policies
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'hr_time_off', 'create'));

CREATE POLICY "hr_time_off_policies_update" ON hr_time_off_policies
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'hr_time_off', 'update'));

-- hr_time_off_requests
CREATE POLICY "hr_time_off_requests_select" ON hr_time_off_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_sector_roles usr WHERE usr.user_id = auth.uid() AND usr.sector_id = hr_time_off_requests.sector_id)
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_global_admin = true)
  );

CREATE POLICY "hr_time_off_requests_insert" ON hr_time_off_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'hr_time_off', 'create'));

CREATE POLICY "hr_time_off_requests_update" ON hr_time_off_requests
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'hr_time_off', 'update'));

-- hr_time_off_balances
CREATE POLICY "hr_time_off_balances_select" ON hr_time_off_balances
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hr_employees e
      WHERE e.id = hr_time_off_balances.employee_id
      AND (
        EXISTS (SELECT 1 FROM user_sector_roles usr WHERE usr.user_id = auth.uid() AND usr.sector_id = e.sector_id)
        OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_global_admin = true)
      )
    )
  );

CREATE POLICY "hr_time_off_balances_insert" ON hr_time_off_balances
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hr_employees e
      WHERE e.id = employee_id
      AND user_has_permission(e.sector_id, 'hr_time_off', 'create')
    )
  );

CREATE POLICY "hr_time_off_balances_update" ON hr_time_off_balances
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hr_employees e
      WHERE e.id = employee_id
      AND user_has_permission(e.sector_id, 'hr_time_off', 'update')
    )
  );

-- hr_job_openings
CREATE POLICY "hr_job_openings_select" ON hr_job_openings
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_sector_roles usr WHERE usr.user_id = auth.uid() AND usr.sector_id = hr_job_openings.sector_id)
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_global_admin = true)
  );

CREATE POLICY "hr_job_openings_insert" ON hr_job_openings
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'hr_recruitment', 'create'));

CREATE POLICY "hr_job_openings_update" ON hr_job_openings
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'hr_recruitment', 'update'));

-- hr_candidates
CREATE POLICY "hr_candidates_select" ON hr_candidates
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_sector_roles usr WHERE usr.user_id = auth.uid() AND usr.sector_id = hr_candidates.sector_id)
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_global_admin = true)
  );

CREATE POLICY "hr_candidates_insert" ON hr_candidates
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'hr_recruitment', 'create'));

CREATE POLICY "hr_candidates_update" ON hr_candidates
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'hr_recruitment', 'update'));

-- hr_onboarding_templates
CREATE POLICY "hr_onboarding_templates_select" ON hr_onboarding_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_sector_roles usr WHERE usr.user_id = auth.uid() AND usr.sector_id = hr_onboarding_templates.sector_id)
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_global_admin = true)
  );

CREATE POLICY "hr_onboarding_templates_insert" ON hr_onboarding_templates
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'hr_onboarding', 'create'));

CREATE POLICY "hr_onboarding_templates_update" ON hr_onboarding_templates
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'hr_onboarding', 'update'));

-- hr_onboarding_instances
CREATE POLICY "hr_onboarding_instances_select" ON hr_onboarding_instances
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_sector_roles usr WHERE usr.user_id = auth.uid() AND usr.sector_id = hr_onboarding_instances.sector_id)
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_global_admin = true)
  );

CREATE POLICY "hr_onboarding_instances_insert" ON hr_onboarding_instances
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'hr_onboarding', 'create'));

CREATE POLICY "hr_onboarding_instances_update" ON hr_onboarding_instances
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'hr_onboarding', 'update'));

-- hr_onboarding_items
CREATE POLICY "hr_onboarding_items_select" ON hr_onboarding_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hr_onboarding_instances oi
      WHERE oi.id = hr_onboarding_items.onboarding_id
      AND (
        EXISTS (SELECT 1 FROM user_sector_roles usr WHERE usr.user_id = auth.uid() AND usr.sector_id = oi.sector_id)
        OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_global_admin = true)
      )
    )
  );

CREATE POLICY "hr_onboarding_items_insert" ON hr_onboarding_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hr_onboarding_instances oi
      WHERE oi.id = onboarding_id
      AND user_has_permission(oi.sector_id, 'hr_onboarding', 'update')
    )
  );

CREATE POLICY "hr_onboarding_items_update" ON hr_onboarding_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hr_onboarding_instances oi
      WHERE oi.id = onboarding_id
      AND user_has_permission(oi.sector_id, 'hr_onboarding', 'update')
    )
  );

CREATE POLICY "hr_onboarding_items_delete" ON hr_onboarding_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hr_onboarding_instances oi
      WHERE oi.id = onboarding_id
      AND user_has_permission(oi.sector_id, 'hr_onboarding', 'update')
    )
  );

-- =============================================
-- RPC: get_hr_dashboard_stats
-- =============================================
CREATE OR REPLACE FUNCTION get_hr_dashboard_stats(p_sector_id uuid)
RETURNS json AS $$
DECLARE
  v_total_employees   int;
  v_on_leave_count    int;
  v_upcoming_time_off int;
  v_open_positions    int;
  v_active_onboardings int;
BEGIN
  -- Total active employees in sector
  SELECT count(*) INTO v_total_employees
  FROM hr_employees
  WHERE sector_id = p_sector_id
    AND status != 'terminated'
    AND is_active = true;

  -- Currently on leave
  SELECT count(*) INTO v_on_leave_count
  FROM hr_employees
  WHERE sector_id = p_sector_id
    AND status = 'on_leave'
    AND is_active = true;

  -- Approved time-off starting within next 30 days
  SELECT count(*) INTO v_upcoming_time_off
  FROM hr_time_off_requests
  WHERE sector_id = p_sector_id
    AND status = 'approved'
    AND start_date BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '30 days'
    AND is_active = true;

  -- Open job positions
  SELECT count(*) INTO v_open_positions
  FROM hr_job_openings
  WHERE sector_id = p_sector_id
    AND status = 'open'
    AND is_active = true;

  -- Active onboarding instances
  SELECT count(*) INTO v_active_onboardings
  FROM hr_onboarding_instances
  WHERE sector_id = p_sector_id
    AND status = 'in_progress';

  RETURN json_build_object(
    'total_employees',   v_total_employees,
    'on_leave_count',    v_on_leave_count,
    'upcoming_time_off', v_upcoming_time_off,
    'open_positions',    v_open_positions,
    'active_onboardings', v_active_onboardings
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

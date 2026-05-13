-- =============================================
-- Helper functions for RLS
-- =============================================

-- Check if user belongs to a sector (or is global admin)
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

-- Check if user has a specific permission in a sector (or is global admin)
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

-- Check if user is global admin
CREATE OR REPLACE FUNCTION is_global_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_global_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- users
-- =============================================
-- All authenticated users can read active users
CREATE POLICY "users_select" ON users
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Users can update their own profile
CREATE POLICY "users_update_own" ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Global admins can update any user
CREATE POLICY "users_update_admin" ON users
  FOR UPDATE TO authenticated
  USING (is_global_admin())
  WITH CHECK (is_global_admin());

-- Only global admins can insert users (via invite flow)
CREATE POLICY "users_insert_admin" ON users
  FOR INSERT TO authenticated
  WITH CHECK (is_global_admin());

-- =============================================
-- sectors
-- =============================================
-- All authenticated users can read active sectors
CREATE POLICY "sectors_select" ON sectors
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Only global admins can manage sectors
CREATE POLICY "sectors_insert" ON sectors
  FOR INSERT TO authenticated
  WITH CHECK (is_global_admin());

CREATE POLICY "sectors_update" ON sectors
  FOR UPDATE TO authenticated
  USING (is_global_admin())
  WITH CHECK (is_global_admin());

-- =============================================
-- roles (read-only for all authenticated)
-- =============================================
CREATE POLICY "roles_select" ON roles
  FOR SELECT TO authenticated
  USING (true);

-- Only global admins can manage roles
CREATE POLICY "roles_insert" ON roles
  FOR INSERT TO authenticated
  WITH CHECK (is_global_admin());

CREATE POLICY "roles_update" ON roles
  FOR UPDATE TO authenticated
  USING (is_global_admin())
  WITH CHECK (is_global_admin());

-- =============================================
-- user_sector_roles
-- =============================================
-- Users can see roles in sectors they belong to
CREATE POLICY "usr_select" ON user_sector_roles
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

-- Only admins/managers can assign roles
CREATE POLICY "usr_insert" ON user_sector_roles
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'user', 'invite'));

CREATE POLICY "usr_update" ON user_sector_roles
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'user', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'user', 'update'));

CREATE POLICY "usr_delete" ON user_sector_roles
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'user', 'deactivate'));

-- =============================================
-- modules (read-only for all authenticated)
-- =============================================
CREATE POLICY "modules_select" ON modules
  FOR SELECT TO authenticated
  USING (true);

-- Only global admins can manage modules
CREATE POLICY "modules_insert" ON modules
  FOR INSERT TO authenticated
  WITH CHECK (is_global_admin());

CREATE POLICY "modules_update" ON modules
  FOR UPDATE TO authenticated
  USING (is_global_admin())
  WITH CHECK (is_global_admin());

-- =============================================
-- sector_modules
-- =============================================
CREATE POLICY "sector_modules_select" ON sector_modules
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

CREATE POLICY "sector_modules_manage" ON sector_modules
  FOR ALL TO authenticated
  USING (is_global_admin())
  WITH CHECK (is_global_admin());

-- =============================================
-- permissions (read-only for all authenticated)
-- =============================================
CREATE POLICY "permissions_select" ON permissions
  FOR SELECT TO authenticated
  USING (true);

-- =============================================
-- role_permissions (read-only for all authenticated)
-- =============================================
CREATE POLICY "role_permissions_select" ON role_permissions
  FOR SELECT TO authenticated
  USING (true);

-- Only global admins can manage
CREATE POLICY "role_permissions_manage" ON role_permissions
  FOR ALL TO authenticated
  USING (is_global_admin())
  WITH CHECK (is_global_admin());

-- =============================================
-- boards (access via board_sectors)
-- =============================================
CREATE POLICY "boards_select" ON boards
  FOR SELECT TO authenticated
  USING (
    is_active = true AND (
      is_global_admin() OR
      EXISTS (
        SELECT 1 FROM board_sectors bs
        WHERE bs.board_id = id
        AND user_has_sector_access(bs.sector_id)
      )
    )
  );

CREATE POLICY "boards_insert" ON boards
  FOR INSERT TO authenticated
  WITH CHECK (
    is_global_admin() OR
    EXISTS (
      SELECT 1 FROM user_sector_roles usr
      JOIN role_permissions rp ON rp.role_id = usr.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE usr.user_id = auth.uid()
      AND p.resource = 'board' AND p.action = 'create'
    )
  );

CREATE POLICY "boards_update" ON boards
  FOR UPDATE TO authenticated
  USING (
    is_global_admin() OR
    EXISTS (
      SELECT 1 FROM board_sectors bs
      WHERE bs.board_id = id
      AND user_has_permission(bs.sector_id, 'board', 'update')
    )
  )
  WITH CHECK (
    is_global_admin() OR
    EXISTS (
      SELECT 1 FROM board_sectors bs
      WHERE bs.board_id = id
      AND user_has_permission(bs.sector_id, 'board', 'update')
    )
  );

-- =============================================
-- board_sectors
-- =============================================
CREATE POLICY "board_sectors_select" ON board_sectors
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

CREATE POLICY "board_sectors_insert" ON board_sectors
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'board', 'create'));

CREATE POLICY "board_sectors_delete" ON board_sectors
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'board', 'delete'));

-- =============================================
-- board_columns
-- =============================================
CREATE POLICY "board_columns_select" ON board_columns
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boards b
      JOIN board_sectors bs ON bs.board_id = b.id
      WHERE b.id = board_id AND b.is_active = true
      AND user_has_sector_access(bs.sector_id)
    )
  );

CREATE POLICY "board_columns_insert" ON board_columns
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM board_sectors bs
      WHERE bs.board_id = board_id
      AND user_has_permission(bs.sector_id, 'board_column', 'create')
    )
  );

CREATE POLICY "board_columns_update" ON board_columns
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM board_sectors bs
      WHERE bs.board_id = board_id
      AND user_has_permission(bs.sector_id, 'board_column', 'update')
    )
  );

CREATE POLICY "board_columns_delete" ON board_columns
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM board_sectors bs
      WHERE bs.board_id = board_id
      AND user_has_permission(bs.sector_id, 'board_column', 'delete')
    )
  );

-- =============================================
-- card_templates
-- =============================================
CREATE POLICY "card_templates_select" ON card_templates
  FOR SELECT TO authenticated
  USING (
    is_active = true AND (
      sector_id IS NULL OR user_has_sector_access(sector_id)
    )
  );

CREATE POLICY "card_templates_insert" ON card_templates
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'card_template', 'create'));

CREATE POLICY "card_templates_update" ON card_templates
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'card_template', 'update'));

CREATE POLICY "card_templates_delete" ON card_templates
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'card_template', 'delete'));

-- =============================================
-- cards
-- =============================================
CREATE POLICY "cards_select" ON cards
  FOR SELECT TO authenticated
  USING (is_active = true AND user_has_sector_access(sector_id));

CREATE POLICY "cards_insert" ON cards
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'card', 'create'));

CREATE POLICY "cards_update" ON cards
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'card', 'update'));

-- No DELETE policy — soft delete only (update is_active = false)

-- =============================================
-- card_assignees
-- =============================================
CREATE POLICY "card_assignees_select" ON card_assignees
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = card_id AND c.is_active = true
      AND user_has_sector_access(c.sector_id)
    )
  );

CREATE POLICY "card_assignees_insert" ON card_assignees
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = card_id
      AND user_has_permission(c.sector_id, 'card', 'assign')
    )
  );

CREATE POLICY "card_assignees_delete" ON card_assignees
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = card_id
      AND user_has_permission(c.sector_id, 'card', 'assign')
    )
  );

-- =============================================
-- tags
-- =============================================
CREATE POLICY "tags_select" ON tags
  FOR SELECT TO authenticated
  USING (
    is_active = true AND (
      sector_id IS NULL OR user_has_sector_access(sector_id)
    )
  );

CREATE POLICY "tags_manage" ON tags
  FOR ALL TO authenticated
  USING (
    sector_id IS NULL AND is_global_admin()
    OR user_has_permission(sector_id, 'board', 'update')
  )
  WITH CHECK (
    sector_id IS NULL AND is_global_admin()
    OR user_has_permission(sector_id, 'board', 'update')
  );

-- =============================================
-- card_tags
-- =============================================
CREATE POLICY "card_tags_select" ON card_tags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = card_id AND c.is_active = true
      AND user_has_sector_access(c.sector_id)
    )
  );

CREATE POLICY "card_tags_insert" ON card_tags
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = card_id
      AND user_has_permission(c.sector_id, 'card', 'update')
    )
  );

CREATE POLICY "card_tags_delete" ON card_tags
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = card_id
      AND user_has_permission(c.sector_id, 'card', 'update')
    )
  );

-- =============================================
-- card_comments
-- =============================================
CREATE POLICY "card_comments_select" ON card_comments
  FOR SELECT TO authenticated
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = card_id AND c.is_active = true
      AND user_has_sector_access(c.sector_id)
    )
  );

CREATE POLICY "card_comments_insert" ON card_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = card_id
      AND user_has_permission(c.sector_id, 'card_comment', 'create')
    )
  );

-- Users can update their own comments; admins/managers can update any
CREATE POLICY "card_comments_update" ON card_comments
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = card_id
      AND user_has_permission(c.sector_id, 'card_comment', 'delete')
    )
  );

-- =============================================
-- card_attachments
-- =============================================
CREATE POLICY "card_attachments_select" ON card_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = card_id AND c.is_active = true
      AND user_has_sector_access(c.sector_id)
    )
  );

CREATE POLICY "card_attachments_insert" ON card_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = card_id
      AND user_has_permission(c.sector_id, 'card_attachment', 'create')
    )
  );

CREATE POLICY "card_attachments_delete" ON card_attachments
  FOR DELETE TO authenticated
  USING (
    (uploaded_by = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = card_id
      AND user_has_permission(c.sector_id, 'card_attachment', 'delete')
    )
  );

-- =============================================
-- card_checklists
-- =============================================
CREATE POLICY "card_checklists_select" ON card_checklists
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = card_id AND c.is_active = true
      AND user_has_sector_access(c.sector_id)
    )
  );

CREATE POLICY "card_checklists_insert" ON card_checklists
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = card_id
      AND user_has_permission(c.sector_id, 'card_checklist', 'create')
    )
  );

CREATE POLICY "card_checklists_update" ON card_checklists
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = card_id
      AND user_has_permission(c.sector_id, 'card_checklist', 'update')
    )
  );

CREATE POLICY "card_checklists_delete" ON card_checklists
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = card_id
      AND user_has_permission(c.sector_id, 'card_checklist', 'delete')
    )
  );

-- =============================================
-- checklist_items
-- =============================================
CREATE POLICY "checklist_items_select" ON checklist_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM card_checklists cl
      JOIN cards c ON c.id = cl.card_id
      WHERE cl.id = checklist_id AND c.is_active = true
      AND user_has_sector_access(c.sector_id)
    )
  );

CREATE POLICY "checklist_items_insert" ON checklist_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM card_checklists cl
      JOIN cards c ON c.id = cl.card_id
      WHERE cl.id = checklist_id
      AND user_has_permission(c.sector_id, 'card_checklist', 'update')
    )
  );

CREATE POLICY "checklist_items_update" ON checklist_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM card_checklists cl
      JOIN cards c ON c.id = cl.card_id
      WHERE cl.id = checklist_id
      AND user_has_permission(c.sector_id, 'card_checklist', 'update')
    )
  );

CREATE POLICY "checklist_items_delete" ON checklist_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM card_checklists cl
      JOIN cards c ON c.id = cl.card_id
      WHERE cl.id = checklist_id
      AND user_has_permission(c.sector_id, 'card_checklist', 'delete')
    )
  );

-- =============================================
-- card_activity_log
-- =============================================
CREATE POLICY "activity_log_select" ON card_activity_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = card_id AND c.is_active = true
      AND user_has_sector_access(c.sector_id)
    )
  );

-- Insert only by system (via SECURITY DEFINER functions or service_role)
CREATE POLICY "activity_log_insert" ON card_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =============================================
-- card_cross_references
-- =============================================
CREATE POLICY "cross_refs_select" ON card_cross_references
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cards c
      WHERE (c.id = source_card_id OR c.id = target_card_id)
      AND c.is_active = true
      AND user_has_sector_access(c.sector_id)
    )
  );

CREATE POLICY "cross_refs_insert" ON card_cross_references
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = source_card_id
      AND user_has_permission(c.sector_id, 'card', 'escalate')
    )
  );

CREATE POLICY "cross_refs_update" ON card_cross_references
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cards c
      WHERE (c.id = source_card_id OR c.id = target_card_id)
      AND user_has_permission(c.sector_id, 'card', 'update')
    )
  );

-- =============================================
-- projects
-- =============================================
CREATE POLICY "projects_select" ON projects
  FOR SELECT TO authenticated
  USING (
    is_active = true AND (
      is_global_admin() OR
      EXISTS (
        SELECT 1 FROM project_sectors ps
        WHERE ps.project_id = id
        AND user_has_sector_access(ps.sector_id)
      )
    )
  );

CREATE POLICY "projects_insert" ON projects
  FOR INSERT TO authenticated
  WITH CHECK (
    is_global_admin() OR
    EXISTS (
      SELECT 1 FROM user_sector_roles usr
      JOIN role_permissions rp ON rp.role_id = usr.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE usr.user_id = auth.uid()
      AND p.resource = 'project' AND p.action = 'create'
    )
  );

CREATE POLICY "projects_update" ON projects
  FOR UPDATE TO authenticated
  USING (
    is_global_admin() OR
    EXISTS (
      SELECT 1 FROM project_sectors ps
      WHERE ps.project_id = id
      AND user_has_permission(ps.sector_id, 'project', 'update')
    )
  );

-- =============================================
-- project_sectors
-- =============================================
CREATE POLICY "project_sectors_select" ON project_sectors
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

CREATE POLICY "project_sectors_insert" ON project_sectors
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'project', 'create'));

CREATE POLICY "project_sectors_delete" ON project_sectors
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'project', 'delete'));

-- =============================================
-- project_cards
-- =============================================
CREATE POLICY "project_cards_select" ON project_cards
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN project_sectors ps ON ps.project_id = p.id
      WHERE p.id = project_id AND p.is_active = true
      AND user_has_sector_access(ps.sector_id)
    )
  );

CREATE POLICY "project_cards_insert" ON project_cards
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_sectors ps
      WHERE ps.project_id = project_id
      AND user_has_permission(ps.sector_id, 'project', 'update')
    )
  );

CREATE POLICY "project_cards_delete" ON project_cards
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_sectors ps
      WHERE ps.project_id = project_id
      AND user_has_permission(ps.sector_id, 'project', 'update')
    )
  );

-- =============================================
-- notifications (own only)
-- =============================================
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Insert by system (service_role or SECURITY DEFINER)
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- =============================================
-- notification_preferences (own only)
-- =============================================
CREATE POLICY "notification_prefs_select" ON notification_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notification_prefs_insert" ON notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notification_prefs_update" ON notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================
-- invites
-- =============================================
CREATE POLICY "invites_select" ON invites
  FOR SELECT TO authenticated
  USING (
    user_has_permission(sector_id, 'user', 'invite')
    OR email = (SELECT email FROM users WHERE id = auth.uid())
  );

CREATE POLICY "invites_insert" ON invites
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(sector_id, 'user', 'invite'));

CREATE POLICY "invites_update" ON invites
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(sector_id, 'user', 'invite')
    OR email = (SELECT email FROM users WHERE id = auth.uid())
  );

-- =============================================
-- saved_views (own only)
-- =============================================
CREATE POLICY "saved_views_select" ON saved_views
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "saved_views_insert" ON saved_views
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "saved_views_update" ON saved_views
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "saved_views_delete" ON saved_views
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

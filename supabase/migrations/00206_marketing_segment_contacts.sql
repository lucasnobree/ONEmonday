-- Migration 00206: Marketing audience-segment contacts.
-- Wave 5 backlog item W2 — "send an email campaign to the attached audience
-- segment". Before this migration `marketing_audience_segments` carried only an
-- `estimated_size` integer: a segment had no resolvable recipients, so the
-- e-mail send dialog forced hand-pasting every address even when a segment was
-- attached to the campaign.
--
-- This adds `marketing_segment_contacts` — one row per (segment, email) — so a
-- segment is a real, enumerable recipient list. The e-mail send path resolves
-- the campaign's `segment_id` to these rows server-side; the manual textarea
-- stays as an override / fallback.
--
-- Monetary values: none. Idempotent: safe to re-run.

-- =============================================
-- marketing_segment_contacts — recipients belonging to an audience segment
-- =============================================
CREATE TABLE IF NOT EXISTS marketing_segment_contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id  uuid NOT NULL REFERENCES marketing_audience_segments(id)
              ON DELETE CASCADE,
  -- Denormalised sector_id — every contact belongs to the segment's sector.
  -- Kept on the row so RLS can authorise without a join.
  sector_id   uuid NOT NULL REFERENCES sectors(id),
  email       text NOT NULL CHECK (length(email) BETWEEN 3 AND 320),
  name        text CHECK (name IS NULL OR length(name) <= 200),
  created_by  uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One contact per (segment, lower-cased email) — a segment never holds the
-- same address twice; case-insensitive so "A@x.com" and "a@x.com" collide.
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketing_segment_contacts_email
  ON marketing_segment_contacts (segment_id, lower(email));

CREATE INDEX IF NOT EXISTS idx_marketing_segment_contacts_segment
  ON marketing_segment_contacts (segment_id);
CREATE INDEX IF NOT EXISTS idx_marketing_segment_contacts_sector
  ON marketing_segment_contacts (sector_id);

DROP TRIGGER IF EXISTS trg_marketing_segment_contacts_updated_at
  ON marketing_segment_contacts;
CREATE TRIGGER trg_marketing_segment_contacts_updated_at
  BEFORE UPDATE ON marketing_segment_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- RLS — a contact inherits its segment's authorisation. We reuse the existing
-- `audience_segment` permission resource: managing a segment's contacts is the
-- same capability as managing the segment itself.
-- =============================================
ALTER TABLE marketing_segment_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_segment_contacts_select"
  ON marketing_segment_contacts;
CREATE POLICY "marketing_segment_contacts_select" ON marketing_segment_contacts
  FOR SELECT TO authenticated
  USING (user_has_sector_access(sector_id));

DROP POLICY IF EXISTS "marketing_segment_contacts_insert"
  ON marketing_segment_contacts;
CREATE POLICY "marketing_segment_contacts_insert" ON marketing_segment_contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    user_has_permission(sector_id, 'audience_segment', 'update')
  );

DROP POLICY IF EXISTS "marketing_segment_contacts_update"
  ON marketing_segment_contacts;
CREATE POLICY "marketing_segment_contacts_update" ON marketing_segment_contacts
  FOR UPDATE TO authenticated
  USING (user_has_permission(sector_id, 'audience_segment', 'update'))
  WITH CHECK (user_has_permission(sector_id, 'audience_segment', 'update'));

DROP POLICY IF EXISTS "marketing_segment_contacts_delete"
  ON marketing_segment_contacts;
CREATE POLICY "marketing_segment_contacts_delete" ON marketing_segment_contacts
  FOR DELETE TO authenticated
  USING (user_has_permission(sector_id, 'audience_segment', 'delete'));

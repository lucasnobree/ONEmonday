-- =============================================================
-- 00016 — Card completion tracking
--
-- Bug fix: cards.completed_at was never populated. Cards moved into
-- a "done" column (board_columns.is_done_column = true) stayed with
-- completed_at = NULL, so dashboard metrics that depend on it
-- ("completed this week", "average time to complete") were always
-- wrong. The reorder_cards RPC only updated column_id/position.
--
-- Fix: a BEFORE INSERT OR UPDATE trigger keeps completed_at in sync
-- with the card's current column. Moving into a done column stamps
-- completed_at = now(); moving out clears it. Idempotent.
-- =============================================================

CREATE OR REPLACE FUNCTION sync_card_completed_at()
RETURNS TRIGGER AS $$
DECLARE
  v_is_done boolean;
BEGIN
  -- Only re-evaluate when the column actually changes (or on insert).
  IF TG_OP = 'UPDATE' AND NEW.column_id IS NOT DISTINCT FROM OLD.column_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(is_done_column, false) INTO v_is_done
  FROM board_columns
  WHERE id = NEW.column_id;

  IF v_is_done THEN
    -- Entering a done column: stamp completion if not already set.
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
  ELSE
    -- Leaving a done column (or never in one): clear completion.
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_card_completed_at ON cards;
CREATE TRIGGER trg_sync_card_completed_at
  BEFORE INSERT OR UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION sync_card_completed_at();

-- Backfill: stamp completion for cards already sitting in a done column.
UPDATE cards c
SET completed_at = COALESCE(c.completed_at, c.updated_at, c.created_at)
FROM board_columns bc
WHERE bc.id = c.column_id
  AND bc.is_done_column = true
  AND c.completed_at IS NULL;

-- Clear stale completion for cards that are NOT in a done column.
UPDATE cards c
SET completed_at = NULL
FROM board_columns bc
WHERE bc.id = c.column_id
  AND COALESCE(bc.is_done_column, false) = false
  AND c.completed_at IS NOT NULL;

-- Index supporting the "completed this week" dashboard metric.
CREATE INDEX IF NOT EXISTS idx_cards_completed_at
  ON cards (completed_at)
  WHERE completed_at IS NOT NULL AND is_active = true;

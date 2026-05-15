-- =============================================
-- Migration 00017: race-free WIP limit enforcement
-- Replaces the application-level check-then-insert in createCard (which two
-- concurrent requests could both pass) with a BEFORE INSERT trigger that
-- locks the target column row, so concurrent inserts into the same column
-- are serialized and the limit can never be exceeded.
-- Idempotent: safe to re-run.
-- =============================================

CREATE OR REPLACE FUNCTION enforce_card_wip_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  -- Lock the target column row: a second concurrent insert into the same
  -- column blocks here until the first transaction commits, then re-counts.
  SELECT wip_limit INTO v_limit
  FROM board_columns
  WHERE id = NEW.column_id
  FOR UPDATE;

  -- No limit configured (NULL) -> nothing to enforce.
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM cards
  WHERE column_id = NEW.column_id
    AND is_active = true;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'WIP_LIMIT_EXCEEDED: column % is at its WIP limit of %',
      NEW.column_id, v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Only active cards count toward (and are subject to) the limit.
DROP TRIGGER IF EXISTS trg_enforce_card_wip_limit ON cards;
CREATE TRIGGER trg_enforce_card_wip_limit
  BEFORE INSERT ON cards
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION enforce_card_wip_limit();

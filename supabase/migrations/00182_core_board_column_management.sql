-- =============================================
-- Migration 00182: Core — board column management RPCs
-- Implements the deferred Core Wave 4 backlog (docs/research/
-- ux-audit-core-wave4.md item #7 "Column management UI"). Columns could
-- previously only be created by the seed / createBoard default. This
-- migration adds two RPCs the new column-management UI needs:
--   * `reorder_board_columns` — atomically rewrites the `position` of every
--     column on a board from a caller-supplied ordering, so a drag-reorder
--     never leaves duplicate or gapped positions.
--   * `delete_board_column` — deletes a column ONLY when it holds no active
--     cards, so cards can never be orphaned (cards.column_id is NOT NULL with
--     an FK to board_columns). A non-empty column returns a structured error
--     the UI surfaces as "mova os cards antes de excluir".
--
-- Both pin `search_path = public, pg_temp` and re-check the caller's
-- `board_column` permission, mirroring the existing board_columns RLS.
--
-- Idempotent: safe to run more than once.
-- =============================================

-- ---------------------------------------------
-- reorder_board_columns(p_board_id, p_column_ids)
-- p_column_ids is the full, ordered list of the board's column ids. Position
-- becomes the array index. Rejects a list that does not exactly match the
-- board's current column set so a stale client cannot drop a column.
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION reorder_board_columns(
  p_board_id   uuid,
  p_column_ids uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_can_update boolean;
  v_actual_count int;
BEGIN
  -- Permission: must hold board_column.update in one of the board's sectors.
  SELECT EXISTS (
    SELECT 1 FROM board_sectors bs
    WHERE bs.board_id = p_board_id
    AND user_has_permission(bs.sector_id, 'board_column', 'update')
  ) INTO v_can_update;

  IF NOT v_can_update THEN
    RETURN json_build_object('success', false, 'error', 'forbidden');
  END IF;

  -- The supplied list must be exactly the board's current column set.
  SELECT count(*) INTO v_actual_count
  FROM board_columns
  WHERE board_id = p_board_id;

  IF v_actual_count <> array_length(p_column_ids, 1)
     OR EXISTS (
       SELECT 1 FROM board_columns
       WHERE board_id = p_board_id
       AND id <> ALL (p_column_ids)
     ) THEN
    RETURN json_build_object('success', false, 'error', 'column_set_mismatch');
  END IF;

  -- Rewrite positions from the supplied ordering.
  UPDATE board_columns bc
  SET position = ord.idx - 1
  FROM (
    SELECT unnest(p_column_ids) AS id,
           generate_subscripts(p_column_ids, 1) AS idx
  ) ord
  WHERE bc.id = ord.id AND bc.board_id = p_board_id;

  RETURN json_build_object('success', true);
END;
$$;

-- ---------------------------------------------
-- delete_board_column(p_column_id)
-- Deletes a column only when it has no active cards. Returns the count of
-- blocking cards so the UI can explain why the delete was refused.
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION delete_board_column(p_column_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_board_id   uuid;
  v_can_delete boolean;
  v_card_count int;
BEGIN
  SELECT board_id INTO v_board_id
  FROM board_columns
  WHERE id = p_column_id;

  IF v_board_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_found');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM board_sectors bs
    WHERE bs.board_id = v_board_id
    AND user_has_permission(bs.sector_id, 'board_column', 'delete')
  ) INTO v_can_delete;

  IF NOT v_can_delete THEN
    RETURN json_build_object('success', false, 'error', 'forbidden');
  END IF;

  -- A board must always keep at least one column.
  IF (SELECT count(*) FROM board_columns WHERE board_id = v_board_id) <= 1 THEN
    RETURN json_build_object('success', false, 'error', 'last_column');
  END IF;

  SELECT count(*) INTO v_card_count
  FROM cards
  WHERE column_id = p_column_id AND is_active = true;

  IF v_card_count > 0 THEN
    RETURN json_build_object(
      'success', false, 'error', 'has_cards', 'card_count', v_card_count
    );
  END IF;

  DELETE FROM board_columns WHERE id = p_column_id;

  -- Close the position gap left by the removed column.
  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY position) - 1 AS new_pos
    FROM board_columns
    WHERE board_id = v_board_id
  )
  UPDATE board_columns bc
  SET position = ranked.new_pos
  FROM ranked
  WHERE bc.id = ranked.id;

  RETURN json_build_object('success', true);
END;
$$;

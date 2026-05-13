-- Reorder cards within a column (atomic position update with conflict detection)
CREATE OR REPLACE FUNCTION reorder_cards(
  p_board_id uuid,
  p_column_id uuid,
  p_card_positions jsonb,  -- array of {card_id: uuid, position: int}
  p_expected_board_updated_at timestamptz
)
RETURNS jsonb AS $$
DECLARE
  v_current_updated_at timestamptz;
  v_card jsonb;
BEGIN
  -- Check version (conflict detection)
  SELECT updated_at INTO v_current_updated_at
  FROM boards WHERE id = p_board_id
  FOR UPDATE;

  IF v_current_updated_at != p_expected_board_updated_at THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'conflict',
      'current_updated_at', v_current_updated_at
    );
  END IF;

  -- Update each card's position and column
  FOR v_card IN SELECT * FROM jsonb_array_elements(p_card_positions)
  LOOP
    UPDATE cards
    SET
      column_id = p_column_id,
      position = (v_card->>'position')::int,
      updated_at = now()
    WHERE id = (v_card->>'card_id')::uuid
    AND board_id = p_board_id;
  END LOOP;

  -- Bump board version
  UPDATE boards SET updated_at = now() WHERE id = p_board_id;

  RETURN jsonb_build_object(
    'success', true,
    'updated_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

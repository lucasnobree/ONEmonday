-- Security fixes migration

-- (a) Change reorder_cards from SECURITY DEFINER to SECURITY INVOKER
-- so RLS policies are respected when users call this function.
CREATE OR REPLACE FUNCTION reorder_cards(
  p_board_id uuid,
  p_column_id uuid,
  p_card_positions jsonb,
  p_expected_board_updated_at timestamptz
)
RETURNS jsonb AS $$
DECLARE
  v_current_updated_at timestamptz;
  v_card jsonb;
BEGIN
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

  UPDATE boards SET updated_at = now() WHERE id = p_board_id;

  RETURN jsonb_build_object(
    'success', true,
    'updated_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- (b) Tighten storage upload policy to restrict uploads to user-owned paths.
-- The upload path must start with auth.uid() to prevent users from writing
-- to arbitrary paths in the bucket.
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
CREATE POLICY "Users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'card-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- (c) Tighten notifications INSERT policy.
-- Users can only create notifications targeting themselves.
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TABLE boards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  visibility  text DEFAULT 'sector' CHECK (visibility IN ('sector', 'cross_sector', 'global')),
  is_default  boolean DEFAULT false,
  created_by  uuid REFERENCES users(id),
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE TRIGGER trg_boards_updated_at BEFORE UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Board-Sector N:N
CREATE TABLE board_sectors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    uuid NOT NULL REFERENCES boards(id),
  sector_id   uuid NOT NULL REFERENCES sectors(id),
  UNIQUE(board_id, sector_id)
);

CREATE TABLE board_columns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id        uuid NOT NULL REFERENCES boards(id),
  name            text NOT NULL,
  color           text,
  position        int NOT NULL,
  wip_limit       int,
  is_done_column  boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE TRIGGER trg_board_columns_updated_at BEFORE UPDATE ON board_columns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE card_templates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id           uuid REFERENCES sectors(id),
  name                text NOT NULL,
  default_title       text,
  default_description text,
  default_priority    text DEFAULT 'medium',
  default_checklist   jsonb DEFAULT '[]',
  created_by          uuid NOT NULL REFERENCES users(id),
  is_active           boolean DEFAULT true,
  created_at          timestamptz DEFAULT now()
);

CREATE TABLE cards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id        uuid NOT NULL REFERENCES boards(id),
  column_id       uuid NOT NULL REFERENCES board_columns(id),
  sector_id       uuid NOT NULL REFERENCES sectors(id),
  title           text NOT NULL,
  description     text,
  position        int NOT NULL,
  priority        text DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  start_date      date,
  due_date        date,
  completed_at    timestamptz,
  parent_card_id  uuid REFERENCES cards(id),
  template_id     uuid REFERENCES card_templates(id) ON DELETE SET NULL,
  created_by      uuid NOT NULL REFERENCES users(id),
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE TRIGGER trg_cards_updated_at BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Constraint: cards.sector_id must exist in board_sectors for the card's board
CREATE OR REPLACE FUNCTION validate_card_sector()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM board_sectors
    WHERE board_id = NEW.board_id AND sector_id = NEW.sector_id
  ) THEN
    RAISE EXCEPTION 'Card sector_id must match one of the board sectors';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_validate_card_sector
  BEFORE INSERT OR UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION validate_card_sector();

CREATE TABLE card_assignees (
  card_id     uuid NOT NULL REFERENCES cards(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  PRIMARY KEY (card_id, user_id)
);

CREATE TABLE tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  color       text NOT NULL,
  sector_id   uuid REFERENCES sectors(id),
  is_active   boolean DEFAULT true,
  UNIQUE(name, sector_id)
);

CREATE TABLE card_tags (
  card_id     uuid NOT NULL REFERENCES cards(id),
  tag_id      uuid NOT NULL REFERENCES tags(id),
  PRIMARY KEY (card_id, tag_id)
);

CREATE TABLE card_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     uuid NOT NULL REFERENCES cards(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  content     text NOT NULL,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE TRIGGER trg_card_comments_updated_at BEFORE UPDATE ON card_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE card_attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     uuid NOT NULL REFERENCES cards(id),
  file_url    text NOT NULL,
  file_name   text NOT NULL,
  file_size   int NOT NULL,
  mime_type   text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE card_checklists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     uuid NOT NULL REFERENCES cards(id),
  title       text NOT NULL,
  position    int NOT NULL
);

CREATE TABLE checklist_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id    uuid NOT NULL REFERENCES card_checklists(id) ON DELETE CASCADE,
  content         text NOT NULL,
  is_completed    boolean DEFAULT false,
  completed_by    uuid REFERENCES users(id),
  position        int NOT NULL
);

CREATE TABLE card_activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     uuid NOT NULL REFERENCES cards(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  action      text NOT NULL,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE card_cross_references (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_card_id  uuid NOT NULL REFERENCES cards(id),
  target_card_id  uuid NOT NULL REFERENCES cards(id),
  reference_type  text NOT NULL CHECK (reference_type IN ('escalation', 'related', 'blocks', 'blocked_by')),
  status          text DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_by      uuid NOT NULL REFERENCES users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE TRIGGER trg_cross_refs_updated_at BEFORE UPDATE ON card_cross_references
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS on all tables
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_cross_references ENABLE ROW LEVEL SECURITY;

CREATE TABLE projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  status      text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  start_date  date,
  target_date date,
  created_by  uuid NOT NULL REFERENCES users(id),
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE project_sectors (
  project_id  uuid NOT NULL REFERENCES projects(id),
  sector_id   uuid NOT NULL REFERENCES sectors(id),
  PRIMARY KEY (project_id, sector_id)
);

CREATE TABLE project_cards (
  project_id  uuid NOT NULL REFERENCES projects(id),
  card_id     uuid NOT NULL REFERENCES cards(id),
  PRIMARY KEY (project_id, card_id)
);

-- Polymorphic resource reference (no FK — cleanup via periodic Edge Function)
CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id),
  type            text NOT NULL,
  title           text NOT NULL,
  content         text,
  resource_type   text NOT NULL,
  resource_id     uuid NOT NULL,
  is_read         boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE notification_preferences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  type        text NOT NULL,
  channel     text DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'both', 'none')),
  UNIQUE(user_id, type)
);

CREATE TABLE invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  sector_id   uuid NOT NULL REFERENCES sectors(id),
  role_id     uuid NOT NULL REFERENCES roles(id),
  invited_by  uuid NOT NULL REFERENCES users(id),
  status      text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(email, sector_id, status)
);

-- Saved views (board_id null = sector-level or global view)
CREATE TABLE saved_views (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  board_id    uuid REFERENCES boards(id),
  sector_id   uuid REFERENCES sectors(id),
  name        text NOT NULL,
  filters     jsonb NOT NULL DEFAULT '{}',
  is_default  boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

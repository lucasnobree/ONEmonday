-- Auto-update updated_at on every UPDATE (applied to all mutable tables)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Users
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text UNIQUE NOT NULL,
  full_name       text NOT NULL,
  avatar_url      text,
  is_global_admin boolean DEFAULT false,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Sectors
CREATE TABLE sectors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  icon        text,
  color       text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE TRIGGER trg_sectors_updated_at BEFORE UPDATE ON sectors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Roles
CREATE TABLE roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  level       int NOT NULL,  -- admin=100, manager=80, analyst=50, intern=20
  scope       text DEFAULT 'sector' CHECK (scope IN ('sector', 'global')),
  is_system   boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- User-Sector-Role assignment
CREATE TABLE user_sector_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  sector_id   uuid NOT NULL REFERENCES sectors(id),
  role_id     uuid NOT NULL REFERENCES roles(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, sector_id)
);

-- Modules (ONEmonday, future ONEhub modules)
CREATE TABLE modules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  name            text NOT NULL,
  description     text,
  icon            text,
  status          text DEFAULT 'active' CHECK (status IN ('active', 'coming_soon', 'disabled')),
  category        text CHECK (category IN ('core', 'hub')),
  version         text DEFAULT '1.0.0',
  settings_schema jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

-- Which modules each sector has access to
CREATE TABLE sector_modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id   uuid NOT NULL REFERENCES sectors(id),
  module_id   uuid NOT NULL REFERENCES modules(id),
  is_enabled  boolean DEFAULT false,
  config      jsonb DEFAULT '{}',
  UNIQUE(sector_id, module_id)
);

-- Permissions
CREATE TABLE permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id   uuid NOT NULL REFERENCES modules(id),
  resource    text NOT NULL,
  action      text NOT NULL,
  UNIQUE(module_id, resource, action)
);

-- Role-Permission mapping
CREATE TABLE role_permissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         uuid NOT NULL REFERENCES roles(id),
  permission_id   uuid NOT NULL REFERENCES permissions(id),
  UNIQUE(role_id, permission_id)
);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sector_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sector_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

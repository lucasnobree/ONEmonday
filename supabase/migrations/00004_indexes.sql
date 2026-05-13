-- Cards: primary query patterns
CREATE INDEX idx_cards_board_column ON cards(board_id, column_id, position);
CREATE INDEX idx_cards_sector ON cards(sector_id, is_active);
CREATE INDEX idx_cards_created_by ON cards(created_by);
CREATE INDEX idx_cards_due_date ON cards(due_date) WHERE due_date IS NOT NULL AND is_active = true;

-- Activity log: card timeline queries
CREATE INDEX idx_activity_card_time ON card_activity_log(card_id, created_at DESC);

-- Notifications: user inbox
CREATE INDEX idx_notifications_user_inbox ON notifications(user_id, is_read, created_at DESC);

-- User-sector-roles: permission lookups
CREATE INDEX idx_usr_user ON user_sector_roles(user_id);
CREATE INDEX idx_usr_sector ON user_sector_roles(sector_id);

-- Board-sectors: board lookup by sector
CREATE INDEX idx_board_sectors_sector ON board_sectors(sector_id);

-- Card assignees: find cards assigned to user
CREATE INDEX idx_card_assignees_user ON card_assignees(user_id);

-- Cross references: find related cards
CREATE INDEX idx_cross_refs_source ON card_cross_references(source_card_id);
CREATE INDEX idx_cross_refs_target ON card_cross_references(target_card_id);

-- Comments: card comment threads
CREATE INDEX idx_comments_card ON card_comments(card_id, created_at DESC) WHERE is_active = true;

-- Tags: lookup by sector
CREATE INDEX idx_tags_sector ON tags(sector_id) WHERE is_active = true;

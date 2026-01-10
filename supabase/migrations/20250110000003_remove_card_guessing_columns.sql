-- Remove card guessing columns from card_guessing table
-- Keep only kitchen/memory related columns

ALTER TABLE card_guessing
DROP COLUMN IF EXISTS wins,
DROP COLUMN IF EXISTS losses,
DROP COLUMN IF EXISTS guesses,
DROP COLUMN IF EXISTS actuals;

-- Rename table to better reflect its purpose
ALTER TABLE card_guessing RENAME TO kitchen_memories;

-- Add comment to document the table's new purpose
COMMENT ON TABLE kitchen_memories IS 'Stores AI-generated kitchen object memories with images, descriptions, and editable memories';

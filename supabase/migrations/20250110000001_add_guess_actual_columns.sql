-- Add guess and actual columns to card_guessing table
-- These columns store arrays of card values for each round

ALTER TABLE card_guessing
ADD COLUMN IF NOT EXISTS guesses TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS actuals TEXT[] DEFAULT '{}';

-- Add comment to document the columns
COMMENT ON COLUMN card_guessing.guesses IS 'Array of user guesses in format "rank-suit" (e.g., "A-hearts")';
COMMENT ON COLUMN card_guessing.actuals IS 'Array of actual cards in format "rank-suit" (e.g., "K-spades")';

-- Create the card_guessing table for storing game session history
-- session_id is now the primary key (no separate id column)
CREATE TABLE IF NOT EXISTS card_guessing (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE card_guessing ENABLE ROW LEVEL SECURITY;

-- Allow public access for now (no users yet)
CREATE POLICY "Allow public read" ON card_guessing FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON card_guessing FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON card_guessing FOR UPDATE USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_card_guessing_session_id ON card_guessing(session_id);

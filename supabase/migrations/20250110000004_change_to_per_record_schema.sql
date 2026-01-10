-- Change schema: each memory is now its own record with session_id as a grouping key
-- session_id is no longer unique - multiple memories can share the same session_id

-- First, drop the existing table and recreate with new schema
DROP TABLE IF EXISTS kitchen_memories;

CREATE TABLE kitchen_memories (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL,
  kitchen_image TEXT DEFAULT '',
  kitchen_description TEXT DEFAULT '',
  kitchen_memory TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on session_id for fast lookups of all memories in a session
CREATE INDEX idx_kitchen_memories_session_id ON kitchen_memories(session_id);

-- Enable RLS
ALTER TABLE kitchen_memories ENABLE ROW LEVEL SECURITY;

-- Allow public access (no authentication required)
CREATE POLICY "Allow public read" ON kitchen_memories FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON kitchen_memories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON kitchen_memories FOR UPDATE USING (true);

COMMENT ON TABLE kitchen_memories IS 'Stores individual AI-generated kitchen memories. Multiple records can share the same session_id.';
COMMENT ON COLUMN kitchen_memories.session_id IS 'Groups memories by browser session - not unique, multiple memories per session';
COMMENT ON COLUMN kitchen_memories.kitchen_image IS 'Base64-encoded image of the kitchen object';
COMMENT ON COLUMN kitchen_memories.kitchen_description IS 'AI-generated description of the kitchen object';
COMMENT ON COLUMN kitchen_memories.kitchen_memory IS 'AI-generated nostalgic memory (editable by user)';

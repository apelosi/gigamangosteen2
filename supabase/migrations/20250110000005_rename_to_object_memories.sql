-- Rename table from kitchen_memories to object_memories
ALTER TABLE kitchen_memories RENAME TO object_memories;

-- Rename columns
ALTER TABLE object_memories RENAME COLUMN kitchen_image TO object_image_base64;
ALTER TABLE object_memories RENAME COLUMN kitchen_description TO object_description;
ALTER TABLE object_memories RENAME COLUMN kitchen_memory TO object_memory;

-- Update the index name to match the new table name
DROP INDEX IF EXISTS idx_kitchen_memories_session_id;
CREATE INDEX idx_object_memories_session_id ON object_memories(session_id);

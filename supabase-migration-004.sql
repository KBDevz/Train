-- Migration 004: Change goal from single text to text array for multiple goals

-- Convert existing goal column from text to text[]
ALTER TABLE user_profiles ALTER COLUMN goal TYPE text[] USING ARRAY[goal];

-- Update default
ALTER TABLE user_profiles ALTER COLUMN goal SET DEFAULT ARRAY['general']::text[];

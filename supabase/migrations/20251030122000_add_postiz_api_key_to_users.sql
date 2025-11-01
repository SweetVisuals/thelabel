-- Add Postiz API key to users table
ALTER TABLE users ADD COLUMN postiz_api_key TEXT;

-- Add comment for documentation
COMMENT ON COLUMN users.postiz_api_key IS 'User''s Postiz public API key for posting to social media platforms';
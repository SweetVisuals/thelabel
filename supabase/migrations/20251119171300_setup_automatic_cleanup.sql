-- Setup automatic cleanup for consolidated images using pg_cron
-- This migration enables pg_cron and schedules daily cleanup of old consolidated images

-- Enable pg_cron extension if available
-- Note: pg_cron might need to be enabled in Supabase dashboard or via support
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage of pg_cron to authenticated users (if needed)
-- GRANT USAGE ON SCHEMA cron TO authenticated;

-- Schedule daily cleanup of consolidated images older than 14 days
-- This will run at 2 AM UTC every day
SELECT cron.schedule(
  'cleanup-old-consolidated-images',
  '0 2 * * *', -- Daily at 2 AM UTC
  'SELECT delete_old_consolidated_images(14);'
);

-- Alternative: If pg_cron is not available, you can run this manually or set up external cron
-- To run cleanup manually: SELECT delete_old_consolidated_images(14);

-- To unschedule the job (if needed):
-- SELECT cron.unschedule('cleanup-old-consolidated-images');

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- Note: If pg_cron is not enabled in your Supabase project,
-- you can still run the cleanup function manually or set up
-- an external cron job that calls the Supabase REST API
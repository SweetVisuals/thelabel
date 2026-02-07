-- Enable necessary extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Create the cron job
-- Schedule: Every 10 minutes (*/10 * * * *)
-- We schedule frequently to ensure batches are processed as soon as their time window opens.
-- The Edge Function handles rate limiting (10 posts per 70 mins) internally.
--
-- IMPORTANT: You must replace <SERVICE_ROLE_KEY> with your actual Supabase Service Role Key.
-- This key is found in Project Settings -> API -> Service Role Key.
-- The Project Ref (wtsckulmgegamnovlrbf) has been auto-populated from your .env file.

select
  cron.schedule(
    'process-job-queue',
    '*/10 * * * *',
    $$
    select
      net.http_post(
          url:='https://wtsckulmgegamnovlrbf.supabase.co/functions/v1/process-job-queue',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0c2NrdWxtZ2VnYW1ub3ZscmJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY4MjI4NiwiZXhwIjoyMDc3MjU4Mjg2fQ.3zn6e1-IAu-JbkK8ZRa5Et3cyKUhW7yCU7cwHmUZkqM"}'::jsonb
      ) as request_id;
    $$
  );

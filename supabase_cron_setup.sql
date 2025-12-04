-- Enable the pg_cron extension
create extension if not exists pg_cron with schema extensions;

-- Schedule the job queue processor to run every minute
-- NOTE: You need to replace 'YOUR_PROJECT_REF' and 'YOUR_ANON_KEY' or 'SERVICE_ROLE_KEY'
-- However, usually internal postgres functions can invoke edge functions via http extension or net extension
-- A simpler way for Supabase is to use the UI or the HTTP extension within a cron job.

-- Option 1: Using pg_net to call the Edge Function
select
  cron.schedule(
    'process-job-queue-every-minute',
    '* * * * *', -- Every minute
    $$
    select
      net.http_post(
          url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-job-queue',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
  );

-- To unschedule:
-- select cron.unschedule('process-job-queue-every-minute');

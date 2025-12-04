# How to Enable Background Batch Processing

To run batch jobs even when the browser tab is closed, we use **Supabase Edge Functions** triggered by a **Cron Job**.

## Prerequisites
1.  Supabase CLI installed and logged in.
2.  A Supabase project.

## Step 1: Deploy the Edge Function
I have created the function code in `supabase/functions/process-job-queue/index.ts`.

Run this command in your terminal to deploy it:
```bash
npx supabase functions deploy process-job-queue --no-verify-jwt
```
*(Note: You might need to link your project first with `npx supabase link --project-ref your-project-ref`)*

## Step 2: Set Environment Variables
The function needs your Postiz API Key to schedule posts.

Run this command (replace with your actual key):
```bash
npx supabase secrets set POSTIZ_API_KEY=your_postiz_api_key
```

## Step 3: Enable the Cron Job
I have created a SQL script to set up the cron job: `supabase_cron_setup.sql`.

1.  Open your Supabase Dashboard -> SQL Editor.
2.  Copy the content of `supabase_cron_setup.sql`.
3.  **IMPORTANT**: Replace `YOUR_PROJECT_REF` and `YOUR_SERVICE_ROLE_KEY` in the script with your actual values.
    *   Project Ref: Found in your project URL (e.g., `https://xyz.supabase.co` -> `xyz`)
    *   Service Role Key: Found in Project Settings -> API.
4.  Run the SQL.

## How it Works
*   **Every minute**, Supabase checks for pending jobs.
*   If a job is found and its `scheduled_start_time` has passed, the Edge Function picks it up.
*   The function schedules **ALL** posts in that batch with Postiz immediately, using the calculated future times.
*   This means once a batch is picked up, it is fully offloaded to Postiz, and you don't need to keep the tab open.

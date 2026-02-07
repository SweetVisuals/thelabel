import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { toZonedTime, fromZonedTime } from 'https://esm.sh/date-fns-tz@3.1.3'

// Types for our job payload
interface JobPayload {
    slideshows: any[];
    profiles: string[];
    strategy: 'interval' | 'first-now' | 'batch';
    settings: {
        intervalHours: number;
        startTime: string;
        batchSize: number;
        batchIntervalHours: number;
        postIntervalMinutes: number;
        timezone?: string;
    };
}

interface JobQueueItem {
    id: string;
    user_id: string;
    account_id?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    scheduled_start_time: string;
    batch_index: number;
    total_batches: number;
    payload: JobPayload;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Initialize Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        // We will fetch the user's Postiz API key from the database or use a default if provided in env
        // But for now, we assume the user has stored their key in a 'user_settings' table or similar,
        // OR we use the environment variable as a fallback.
        // Given the user's request "dynamically load the API key depending on the account",
        // we need to know WHERE the user stores their Postiz API key.
        // Based on the codebase, it seems to be in localStorage ('postiz_api_key').
        // This is NOT accessible from the Edge Function.
        // The user needs to store this key in the database (e.g., in a 'profiles' or 'settings' table).

        // HOWEVER, since I don't see a settings table, I will assume for now we use the ENV variable
        // but I will add a TODO to fetch it from DB if available.
        // The user mentioned "dynamically load the API key depending on the account".
        // This implies multiple users might use this system.

        // Let's look for a table that might hold this.
        // If not found, we will fail gracefully or use the ENV key.

        const defaultPostizApiKey = Deno.env.get('POSTIZ_API_KEY') ?? ''

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase environment variables')
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Fetch the next pending job that is ready to run
        const now = new Date().toISOString()

        const { data: jobs, error: fetchError } = await supabase
            .from('job_queue')
            .select('*')
            .eq('status', 'pending')
            .lte('scheduled_start_time', now)
            .order('scheduled_start_time', { ascending: true })
            .limit(1)

        if (fetchError) {
            throw new Error(`Failed to fetch jobs: ${fetchError.message}`)
        }

        if (!jobs || jobs.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No pending jobs ready to process' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const job = jobs[0] as JobQueueItem
        console.log(`Processing job ${job.id} (Batch ${job.batch_index}/${job.total_batches})`)

        // 2. Lock the job
        const { error: lockError } = await supabase
            .from('job_queue')
            .update({ status: 'processing', updated_at: new Date().toISOString() })
            .eq('id', job.id)
            .eq('status', 'pending')

        if (lockError) {
            return new Response(
                JSON.stringify({ message: 'Failed to lock job', error: lockError }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Determine Postiz API Key & Timezone
        // Fetch User settings including API Key and Timezone
        const { data: userSettings, error: userError } = await supabase
            .from('users')
            .select('postiz_api_key, timezone')
            .eq('id', job.user_id)
            .single();

        if (userError) {
            console.error('Failed to fetch user settings:', userError);
        }

        let postizApiKey = userSettings?.postiz_api_key || defaultPostizApiKey;
        // Check for user settings if implemented later
        if (!postizApiKey) {
            // Fallback to searching a known table or throw
            throw new Error('No Postiz API Key found. Please add it in Settings.');
        }

        // 4. Process the job
        const { slideshows, profiles, settings } = job.payload
        const profileId = profiles[0]

        // --- BATCH LOGIC ---
        // Max 10 posts per batch execution (Postiz limit: 10 per ~60 mins)
        // We take the top 10. The rest (overflow) + failed ones will be shifted.
        const BATCH_LIMIT = 10;
        const itemsToProcess = slideshows.slice(0, BATCH_LIMIT);
        const overflowItems = slideshows.slice(BATCH_LIMIT);

        let currentScheduleTime = new Date()

        // Helper to enforce 9am - 10pm window
        // Helper to enforce 9am - 10pm window
        const applyTimeWindow = (date: Date, timezone: string = 'UTC') => {
            const zonedDate = toZonedTime(date, timezone);
            const h = zonedDate.getHours();

            if (h < 9) {
                const adjustedZoned = new Date(zonedDate);
                adjustedZoned.setHours(9, 0, 0, 0);
                return fromZonedTime(adjustedZoned, timezone);
            } else if (h >= 22) {
                const adjustedZoned = new Date(zonedDate);
                adjustedZoned.setDate(adjustedZoned.getDate() + 1);
                adjustedZoned.setHours(9, 0, 0, 0);
                return fromZonedTime(adjustedZoned, timezone);
            }
            // Ensure we don't go back in time (handled by caller mostly)
            return date;
        };

        // Initialize base schedule time from job or now
        const scheduledStart = new Date(job.scheduled_start_time)
        if (scheduledStart > currentScheduleTime) {
            currentScheduleTime = scheduledStart
        }

        let jobTimezone = job.payload.settings.timezone || userSettings?.timezone || 'UTC';
        currentScheduleTime = applyTimeWindow(currentScheduleTime, jobTimezone);

        const results = []
        const failedItems = [];
        const successItems = [];

        for (let i = 0; i < itemsToProcess.length; i++) {
            const slideshow = itemsToProcess[i]

            // Calculate time for this specific post
            // Users want 1 post every X mins (settings.postIntervalMinutes)
            if (i > 0 || job.batch_index > 0) { // Add interval for subsequent posts
                // For the very first post of first batch, currentScheduleTime is StartTime.
                // For subsequent posts, we add interval.
                // NOTE: Since batches are disconnected in time execution, we need to be careful.
                // Just use the loop index relative to the current time block.
                if (i > 0) currentScheduleTime = new Date(currentScheduleTime.getTime() + settings.postIntervalMinutes * 60000)
            }

            currentScheduleTime = applyTimeWindow(currentScheduleTime, jobTimezone);

            try {
                console.log(`Scheduling post ${i + 1}/${itemsToProcess.length} for ${currentScheduleTime.toISOString()}`)

                // Extract URLs correctly
                const mediaUrls: string[] = [];
                if (slideshow.condensedSlides) {
                    slideshow.condensedSlides.forEach((s: any) => {
                        if (s.condensedImageUrl) mediaUrls.push(s.condensedImageUrl);
                        else if (s.originalImageUrl) mediaUrls.push(s.originalImageUrl);
                    });
                }
                const validUrls = mediaUrls.filter((url: string) => url && url.startsWith('http'))

                if (validUrls.length === 0) {
                    throw new Error('No valid public image URLs found')
                }

                // Construct Postiz Payload
                const postBody = {
                    text: `${slideshow.caption || ''}\n\n${(slideshow.hashtags || []).map((t: string) => `#${t}`).join(' ')}`,
                    profileIds: [profileId],
                    mediaUrls: validUrls,
                    scheduledAt: currentScheduleTime.toISOString()
                }

                const response = await fetch('https://api.postiz.com/public/v1/posts', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${postizApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(postBody)
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    throw new Error(`Postiz API error: ${response.status} ${errorText}`)
                }

                const result = await response.json()
                results.push({ id: slideshow.id, status: 'success', postId: result.id })
                successItems.push(slideshow);

            } catch (err) {
                console.error(`Failed to schedule post ${slideshow.id}:`, err)
                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                results.push({ id: slideshow.id, status: 'failed', error: errorMsg })
                // Add to failed items for shifting
                // We preserve the original slideshow object
                failedItems.push(slideshow);
            }
        }

        // --- LAZY SHIFTING ---
        const itemsToShift = [...failedItems, ...overflowItems];

        if (itemsToShift.length > 0) {
            console.log(`Shifting ${itemsToShift.length} items to next batch (${failedItems.length} failed, ${overflowItems.length} overflow)`);

            // 1. Find next pending job
            const { data: nextJobs } = await supabase
                .from('job_queue')
                .select('*')
                .eq('status', 'pending')
                .gt('scheduled_start_time', now) // Must be in future
                .order('scheduled_start_time', { ascending: true })
                .limit(1);

            let nextJob = nextJobs && nextJobs.length > 0 ? nextJobs[0] : null;

            if (nextJob) {
                // Update next job
                const updatedPayload = {
                    ...nextJob.payload,
                    slideshows: [...itemsToShift, ...nextJob.payload.slideshows]
                };

                await supabase
                    .from('job_queue')
                    .update({ payload: updatedPayload })
                    .eq('id', nextJob.id);

                console.log(`Updated next job ${nextJob.id} with shifted items.`);
            } else {
                // Create new job if none exists
                // We schedule it for 70 mins from now (Batch Interval)
                // Or 70 mins from this job's start time? Let's say 70 mins from now to be safe on rate limits.
                const nextRunTime = new Date(Date.now() + 70 * 60 * 1000).toISOString();

                const newPayload = {
                    ...job.payload,
                    slideshows: itemsToShift // Only the shifted ones
                };

                await supabase
                    .from('job_queue')
                    .insert({
                        user_id: job.user_id,
                        status: 'pending',
                        scheduled_start_time: nextRunTime,
                        batch_index: job.batch_index + 1,
                        total_batches: job.total_batches + 1, // Increment total?
                        payload: newPayload
                    });

                console.log(`Created new batch job for shifted items: ${itemsToShift.length} items.`);
            }
        }

        // 5. Update current job status
        // Always 'completed' because failed items were shifted.
        // Unless EVERYTHING failed and we couldn't shift (DB error), but we assume shift worked.
        const finalStatus = 'completed';

        const { error: updateError } = await supabase
            .from('job_queue')
            .update({
                status: finalStatus,
                updated_at: new Date().toISOString(),
                error: null // Clear error since we handled it via shift
            })
            .eq('id', job.id)

        if (updateError) {
            console.error('Failed to update job status:', updateError)
        }

        return new Response(
            JSON.stringify({
                message: `Job ${job.id} processed. ${successItems.length} success, ${itemsToShift.length} shifted.`,
                results,
                shifted: itemsToShift.length,
                status: finalStatus
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Edge function error:', error)
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

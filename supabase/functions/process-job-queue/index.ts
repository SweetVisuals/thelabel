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
    return date;
};

const logJob = async (supabase: any, jobId: string | null, level: string, message: string, details?: any) => {
    console.log(`[${level.toUpperCase()}] ${message}`);
    await supabase.from('job_logs').insert({
        job_id: jobId,
        level,
        message,
        details
    });
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const defaultPostizApiKey = Deno.env.get('POSTIZ_API_KEY') ?? ''

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase environment variables')
        }

        // 1. Fetch up to 5 pending jobs ready to run
        const now = new Date().toISOString()
        const { data: jobs, error: fetchError } = await supabase
            .from('job_queue')
            .select('*')
            .eq('status', 'pending')
            .lte('scheduled_start_time', now)
            .order('scheduled_start_time', { ascending: true })
            .limit(5)

        if (fetchError) {
            throw new Error(`Failed to fetch jobs: ${fetchError.message}`)
        }

        if (!jobs || jobs.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No pending jobs ready to process' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const stats = { processed: 0, skipped: 0, failed: 0 };

        for (const job of jobs) {
            // 2. Lock the job
            const { data: lockedData, error: lockError } = await supabase
                .from('job_queue')
                .update({ status: 'processing' }) // We don't have updated_at, so just status
                .eq('id', job.id)
                .eq('status', 'pending')
                .select()

            if (lockError || !lockedData || lockedData.length === 0) {
                console.log(`Job ${job.id} already locked or failed to lock. Skipping.`);
                stats.skipped++;
                continue;
            }

            await logJob(supabase, job.id, 'info', `Processing batch ${job.batch_index}/${job.total_batches}`);

            try {
                // 3. Determine Postiz API Key & Timezone
                const { data: userSettings, error: userError } = await supabase
                    .from('users')
                    .select('postiz_api_key, timezone')
                    .eq('id', job.user_id)
                    .single();

                let postizApiKey = userSettings?.postiz_api_key || defaultPostizApiKey;
                if (!postizApiKey) {
                    throw new Error('No Postiz API Key found in settings.');
                }

                const { slideshows, profiles, settings } = job.payload;
                const profileId = profiles[0];
                const jobTimezone = job.payload.settings.timezone || userSettings?.timezone || 'UTC';

                const BATCH_LIMIT = 10;
                const itemsToProcess = slideshows.slice(0, BATCH_LIMIT);
                const overflowItems = slideshows.slice(BATCH_LIMIT);

                let currentScheduleTime = new Date();
                const scheduledStart = new Date(job.scheduled_start_time);
                if (scheduledStart > currentScheduleTime) {
                    currentScheduleTime = scheduledStart;
                }
                currentScheduleTime = applyTimeWindow(currentScheduleTime, jobTimezone);

                const successItems = [];
                const failedItems = [];

                for (let i = 0; i < itemsToProcess.length; i++) {
                    const slideshow = itemsToProcess[i];
                    if (i > 0) {
                        currentScheduleTime = new Date(currentScheduleTime.getTime() + settings.postIntervalMinutes * 60000);
                    }
                    currentScheduleTime = applyTimeWindow(currentScheduleTime, jobTimezone);

                    try {
                        const validUrls = (slideshow.condensedSlides || [])
                            .map((s: any) => s.condensedImageUrl || s.originalImageUrl)
                            .filter((url: string) => url && url.startsWith('http'));

                        if (validUrls.length === 0) throw new Error('No valid images');

                        const response = await fetch('https://api.postiz.com/public/v1/posts', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${postizApiKey}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                text: `${slideshow.caption || ''}\n\n${(slideshow.hashtags || []).map((t: string) => `#${t}`).join(' ')}`,
                                profileIds: [profileId],
                                mediaUrls: validUrls,
                                scheduledAt: currentScheduleTime.toISOString()
                            })
                        });

                        if (!response.ok) throw new Error(`Postiz failed: ${response.status} ${await response.text()}`);

                        successItems.push(slideshow.id);
                    } catch (err) {
                        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                        console.error(`Slide ${slideshow.id} failed:`, err);
                        await logJob(supabase, job.id, 'error', `Slide failed: ${errorMsg}`);
                        failedItems.push(slideshow);
                    }
                }

                // Shifting Logic
                const itemsToShift = [...failedItems, ...overflowItems];
                if (itemsToShift.length > 0) {
                    await logJob(supabase, job.id, 'warning', `Shifting ${itemsToShift.length} items to NEW batch (${failedItems.length} failed, ${overflowItems.length} overflow)`);

                    // Find the absolute last scheduled job to append after
                    const { data: lastJobs } = await supabase
                        .from('job_queue')
                        .select('scheduled_start_time, batch_index')
                        .order('scheduled_start_time', { ascending: false })
                        .limit(1);

                    const lastJob = lastJobs?.[0];
                    let nextRunTime = new Date(Date.now() + 70 * 60 * 1000); // Default: 70 mins from now
                    let nextBatchIndex = (job.batch_index || 0) + 1;

                    if (lastJob) {
                        const lastTime = new Date(lastJob.scheduled_start_time);
                        // If last job is in future, schedule 70 mins after it
                        if (lastTime > new Date()) {
                            nextRunTime = new Date(lastTime.getTime() + 70 * 60 * 1000);
                        }
                        if (lastJob.batch_index) nextBatchIndex = lastJob.batch_index + 1;
                    }

                    await supabase.from('job_queue').insert({
                        user_id: job.user_id,
                        account_id: job.account_id,
                        status: 'pending',
                        scheduled_start_time: nextRunTime.toISOString(),
                        batch_index: nextBatchIndex,
                        total_batches: (job.total_batches || 0) + 1,
                        payload: { ...job.payload, slideshows: itemsToShift }
                    });

                    await logJob(supabase, job.id, 'info', `Created new batch ${nextBatchIndex} for shifted items.`);
                }

                await supabase.from('job_queue').update({ status: 'completed' }).eq('id', job.id);
                await logJob(supabase, job.id, 'info', `Successfully processed batch. ${successItems.length} posts scheduled.`);
                stats.processed++;

            } catch (jobErr) {
                const errorMsg = jobErr instanceof Error ? jobErr.message : 'Unknown error';
                console.error(`Batch ${job.id} failed:`, jobErr);
                await logJob(supabase, job.id, 'error', `Batch failed: ${errorMsg}`);
                await supabase.from('job_queue').update({ status: 'failed', error: errorMsg }).eq('id', job.id);
                stats.failed++;
            }
        }

        return new Response(JSON.stringify({ message: 'Batch processing complete', stats }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Edge function fatal error:', error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

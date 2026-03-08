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
                const postIntervalMinutes = Number(settings.postIntervalMinutes) || 240;

                const BATCH_LIMIT = 10;
                const itemsToProcess = slideshows.slice(0, BATCH_LIMIT);
                const overflowItems = slideshows.slice(BATCH_LIMIT);

                await logJob(supabase, job.id, 'info', `Starting batch processing (${itemsToProcess.length} items to process). Interval: ${postIntervalMinutes}m, TZ: ${jobTimezone}`);

                // Use the settings.startTime as the STRICT starting point for the content schedule.
                let currentScheduleTime = new Date(job.payload.settings.startTime);

                // Track the very last scheduled time to calculate the overflow start time
                let lastScheduledTimeInBatch = new Date(currentScheduleTime);

                // Initial check only if we are taking the fresh start time
                if (!itemsToProcess[0]?.forcedScheduleTime) {
                    currentScheduleTime = applyTimeWindow(currentScheduleTime, jobTimezone);
                }

                const successItems = [];
                const failedItems = [];

                for (let i = 0; i < itemsToProcess.length; i++) {
                    const slideshow = itemsToProcess[i];
                    console.log(`[Item ${i + 1}/${itemsToProcess.length}] Preparing slideshow ${slideshow.id}`);

                    // Determine the specific time for THIS item
                    let thisItemScheduleTime: Date;

                    if (slideshow.forcedScheduleTime) {
                        thisItemScheduleTime = new Date(slideshow.forcedScheduleTime);
                        await logJob(supabase, job.id, 'info', `Item ${i + 1} using FORCED retry time: ${thisItemScheduleTime.toISOString()}`);
                    } else if (slideshow.scheduledTime) {
                        thisItemScheduleTime = new Date(slideshow.scheduledTime);
                        await logJob(supabase, job.id, 'info', `Item ${i + 1} using PRE-CALCULATED time: ${thisItemScheduleTime.toISOString()}`);
                    } else {
                        // Standard Interval Logic
                        if (i > 0) {
                            currentScheduleTime = new Date(currentScheduleTime.getTime() + postIntervalMinutes * 60000);
                        }
                        currentScheduleTime = applyTimeWindow(currentScheduleTime, jobTimezone);
                        thisItemScheduleTime = new Date(currentScheduleTime);
                    }

                    // Update tracker
                    lastScheduledTimeInBatch = new Date(thisItemScheduleTime);

                    console.log(`[Item ${i + 1}] Schedule Time: ${thisItemScheduleTime.toISOString()}`);
                    await logJob(supabase, job.id, 'info', `Item ${i + 1} scheduled for: ${thisItemScheduleTime.toISOString()} (${jobTimezone})`);

                    try {
                        const validUrls = (slideshow.condensedSlides || [])
                            .map((s: any) => s.condensedImageUrl || s.originalImageUrl)
                            .filter((url: string) => url && url.startsWith('http'));

                        if (validUrls.length === 0) throw new Error('No valid images');

                        // 1. Upload images to Postiz
                        const uploadedMedia = [];
                        console.log(`[Item ${i + 1}] Found ${validUrls.length} images to upload.`);

                        for (const url of validUrls) {
                            let attempts = 0;
                            let success = false;
                            console.log(`[Item ${i + 1}] Uploading: ${url.substring(0, 50)}...`);

                            while (attempts < 5 && !success) {
                                const delayMs = attempts === 0 ? 1000 : 2000 * Math.pow(2, attempts);
                                await new Promise(r => setTimeout(r, delayMs));

                                try {
                                    const uploadRes = await fetch('https://api.postiz.com/public/v1/upload-from-url', {
                                        method: 'POST',
                                        headers: {
                                            'Authorization': postizApiKey.trim(),
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({ url })
                                    });

                                    if (uploadRes.status === 429) {
                                        const retryAfter = uploadRes.headers.get('Retry-After');
                                        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
                                        console.warn(`Rate limit hit for ${url}. Waiting ${waitTime}ms...`);
                                        await new Promise(r => setTimeout(r, waitTime));
                                        attempts++;
                                        continue;
                                    }

                                    if (!uploadRes.ok) {
                                        const errorText = await uploadRes.text();
                                        console.error(`Upload failed for ${url}: ${uploadRes.status} ${errorText}`);
                                        throw new Error(`Image upload failed: ${uploadRes.status}`);
                                    }

                                    const uploadData = await uploadRes.json();
                                    const uploadedPath = uploadData.path || uploadData.url;

                                    if (!uploadedPath) throw new Error('Image upload returned no path');

                                    uploadedMedia.push({
                                        id: `img_${Date.now()}_${uploadedMedia.length}`,
                                        path: uploadedPath
                                    });
                                    success = true;

                                } catch (uploadErr) {
                                    console.error(`Attempt ${attempts + 1} failed for ${url}:`, uploadErr);
                                    attempts++;
                                    if (attempts >= 5) {
                                        throw new Error(`Failed to upload image after 5 attempts: ${uploadErr instanceof Error ? uploadErr.message : 'Unknown error'}`);
                                    }
                                }
                            }
                        }

                        console.log(`[Item ${i + 1}] All images uploaded. Creating Postiz post...`);

                        // 2. Create Post with uploaded images
                        const response = await fetch('https://api.postiz.com/public/v1/posts', {
                            method: 'POST',
                            headers: {
                                'Authorization': postizApiKey.trim(),
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                type: 'schedule',
                                date: thisItemScheduleTime.toISOString(),
                                shortLink: false,
                                tags: [],
                                posts: [{
                                    integration: {
                                        id: profileId
                                    },
                                    value: [{
                                        content: slideshow.caption
                                            ? `${slideshow.caption} ${(slideshow.hashtags || []).map((t: string) => t.startsWith('#') ? t : `#${t}`).join(' ')}`
                                            : (slideshow.hashtags || []).map((t: string) => t.startsWith('#') ? t : `#${t}`).join(' '),
                                        image: uploadedMedia.map((media: any) => ({
                                            id: media.id,
                                            path: media.path
                                        }))
                                    }],
                                    group: `slideshow_${Date.now()}`,
                                    settings: {
                                        shortLink: false,
                                        privacy_level: 'PUBLIC_TO_EVERYONE',
                                        duet: false,
                                        stitch: false,
                                        comment: true,
                                        autoAddMusic: 'no',
                                        brand_content_toggle: false,
                                        brand_organic_toggle: false,
                                        content_posting_method: 'DIRECT_POST'
                                    }
                                }]
                            })
                        });

                        if (!response.ok) throw new Error(`Postiz failed: ${response.status} ${await response.text()}`);

                        console.log(`[Item ${i + 1}] Success! Post scheduled.`);
                        await logJob(supabase, job.id, 'info', `Slide ${i + 1}/${itemsToProcess.length} scheduled successfully: ${slideshow.title || slideshow.id}`);
                        successItems.push(slideshow.id);
                    } catch (err) {
                        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                        console.error(`Slide ${slideshow.id} failed:`, err);
                        await logJob(supabase, job.id, 'error', `Slide failed: ${errorMsg}`);
                        // Attach the INTENDED time so we can retry it there
                        failedItems.push({ ...slideshow, forcedScheduleTime: thisItemScheduleTime.toISOString() });
                    }
                }

                // Shifting Logic - SPLIT for Retries vs Overflow

                // 1. Handle Failed Items (Retries) - Schedule ASAP
                if (failedItems.length > 0) {
                    await logJob(supabase, job.id, 'warning', `Re-queueing ${failedItems.length} failed items for immediate retry.`);

                    // We schedule these to run fairly soon to fill the gaps
                    const retryRunTime = new Date(Date.now() + 5 * 60 * 1000); // 5 mins from now

                    await supabase.from('job_queue').insert({
                        user_id: job.user_id,
                        account_id: job.account_id,
                        status: 'pending',
                        scheduled_start_time: retryRunTime.toISOString(),
                        batch_index: (job.batch_index || 0), // Keep same index or marked as retry?
                        total_batches: (job.total_batches || 0),
                        payload: {
                            ...job.payload,
                            slideshows: failedItems,
                            // We don't change settings.startTime because forcedScheduleTime overrides it
                        }
                    });
                }

                // 2. Handle Overflow Items - Schedule for NEXT Interval block
                if (overflowItems.length > 0) {
                    await logJob(supabase, job.id, 'info', `Scheduling ${overflowItems.length} overflow items for next batch.`);

                    // Calculate immediate overflow runtime so it doesn't wait an entire 70-min gap
                    // This prevents items pushing so far into the future that their pre-calculated timestamps
                    // end up in the "past", causing Postiz to drop them all instantaneously.
                    let nextRunTime = new Date(Date.now() + 60 * 1000); // 1 minute from now
                    let nextBatchIndex = (job.batch_index || 0) + 1;

                    // Calculate the start time for the content in the NEXT batch.
                    // It should start ONE interval after the LAST item (successful or failed) in THIS batch.
                    const nextBatchStartTime = new Date(lastScheduledTimeInBatch.getTime() + postIntervalMinutes * 60000);
                    const adjustedNextStartTime = applyTimeWindow(nextBatchStartTime, jobTimezone);

                    await supabase.from('job_queue').insert({
                        user_id: job.user_id,
                        account_id: job.account_id,
                        status: 'pending',
                        scheduled_start_time: nextRunTime.toISOString(),
                        batch_index: nextBatchIndex,
                        total_batches: (job.total_batches || 0) + 1,
                        payload: {
                            ...job.payload,
                            slideshows: overflowItems,
                            settings: {
                                ...job.payload.settings,
                                startTime: adjustedNextStartTime.toISOString()
                            }
                        }
                    });

                    await logJob(supabase, job.id, 'info', `Created new overflow batch ${nextBatchIndex}. Content Start: ${adjustedNextStartTime.toISOString()}`);
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

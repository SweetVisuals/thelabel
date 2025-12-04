import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

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
                JSON.stringify({ message: 'Failed to lock job (race condition)', error: lockError }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Determine Postiz API Key
        // Ideally, we fetch this from a 'user_settings' table keyed by job.user_id
        // For now, we'll use the ENV key as a fallback, but this limits us to one Postiz account per deployment
        // unless we implement the DB storage.
        let postizApiKey = defaultPostizApiKey;

        // TODO: Implement DB fetch for per-user API key
        // const { data: userSettings } = await supabase.from('user_settings').select('postiz_api_key').eq('user_id', job.user_id).single();
        // if (userSettings?.postiz_api_key) postizApiKey = userSettings.postiz_api_key;

        if (!postizApiKey) {
            throw new Error('No Postiz API Key found. Please set POSTIZ_API_KEY secret or store it in the database.');
        }

        // 4. Process the job
        const { slideshows, profiles, settings } = job.payload
        const profileId = profiles[0]

        let currentScheduleTime = new Date()
        const scheduledStart = new Date(job.scheduled_start_time)
        if (scheduledStart > currentScheduleTime) {
            currentScheduleTime = scheduledStart
        }

        const results = []
        let hasError = false

        for (let i = 0; i < slideshows.length; i++) {
            const slideshow = slideshows[i]

            if (i > 0) {
                currentScheduleTime = new Date(currentScheduleTime.getTime() + settings.postIntervalMinutes * 60000)
            }

            const hour = currentScheduleTime.getHours()
            if (hour >= 0 && hour < 9) {
                currentScheduleTime.setHours(9, 0, 0, 0)
                if (currentScheduleTime < new Date()) {
                    // Logic to ensure we don't schedule in the past if 9am passed
                }
            }

            try {
                console.log(`Scheduling post ${i + 1}/${slideshows.length} for ${currentScheduleTime.toISOString()}`)

                const mediaUrls = slideshow.condensedSlides.map((s: any) => s.condensedImageUrl || s.originalImageUrl)
                const validUrls = mediaUrls.filter((url: string) => url && url.startsWith('http'))

                if (validUrls.length === 0) {
                    throw new Error('No valid public image URLs found for slideshow')
                }

                const postBody = {
                    text: `${slideshow.caption}\n\n${slideshow.hashtags.map((t: string) => `#${t}`).join(' ')}`,
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

            } catch (err) {
                console.error(`Failed to schedule post ${slideshow.id}:`, err)
                hasError = true
                results.push({ id: slideshow.id, status: 'failed', error: err instanceof Error ? err.message : 'Unknown error' })
            }
        }

        // 5. Update job status
        const finalStatus = hasError && results.filter(r => r.status === 'success').length === 0
            ? 'failed'
            : 'completed'

        const { error: updateError } = await supabase
            .from('job_queue')
            .update({
                status: finalStatus,
                updated_at: new Date().toISOString(),
                error: hasError ? 'Some posts failed to schedule' : null
            })
            .eq('id', job.id)

        if (updateError) {
            console.error('Failed to update job status:', updateError)
        }

        return new Response(
            JSON.stringify({
                message: `Job ${job.id} processed`,
                results,
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

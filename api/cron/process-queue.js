import { createClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wtsckulmgegamnovlrbf.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0c2NrdWxtZ2VnYW1ub3ZscmJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2ODIyODYsImV4cCI6MjA3NzI1ODI4Nn0.Vg7GovepSgB5SmKW35R4k8Dt08vicbNHy5LBHy6QzEc';
const POSTIZ_API_BASE = 'https://api.postiz.com/public/v1';

const supabase = createClient(supabaseUrl, supabaseKey);

export const config = {
    runtime: 'edge',
};

export async function GET(request) {
    // Check for authorization header from Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.CRON_SECRET) {
        // Optional: enforce auth if CRON_SECRET is set
        // return new Response('Unauthorized', { status: 401 });
    }

    try {
        // 1. Check for pending jobs scheduled for now or past
        const now = new Date().toISOString();
        const { data: jobs, error } = await supabase
            .from('job_queue')
            .select('*')
            .eq('status', 'pending')
            .lte('scheduled_start_time', now)
            .limit(2); // Process 2 batches at a time to keep within execution limits

        if (error) {
            console.error('Failed to fetch jobs:', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        if (!jobs || jobs.length === 0) {
            return new Response(JSON.stringify({ message: 'No pending jobs' }), { status: 200 });
        }

        const results = [];

        // 2. Process each job
        for (const job of jobs) {
            try {
                // Attempt to lock the job
                const { error: lockError } = await supabase
                    .from('job_queue')
                    .update({ status: 'processing' })
                    .eq('id', job.id)
                    .eq('status', 'pending'); // Ensure it's still pending

                if (lockError) {
                    console.log(`Job ${job.id} already locked or failed to lock`);
                    continue;
                }

                const { slideshows, profiles } = job.payload;

                // Fetch user's API key
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('postiz_api_key')
                    .eq('id', job.user_id)
                    .single();

                if (userError || !userData?.postiz_api_key) {
                    throw new Error('Postiz API key not found for user');
                }

                const apiKey = userData.postiz_api_key;
                const profileId = profiles[0]; // Assuming single profile

                let successCount = 0;
                let failCount = 0;
                const processedSlideshows = [];

                // Process slideshows in this batch
                for (const slideshow of slideshows) {
                    try {
                        // Check if already uploaded (idempotency check)
                        if (slideshow.lastUploadStatus === 'success') {
                            successCount++;
                            continue;
                        }

                        // 1. Upload images to Postiz
                        const postizMedia = [];
                        for (const slide of slideshow.condensedSlides) {
                            const imageUrl = slide.condensedImageUrl || slide.originalImageUrl;
                            if (!imageUrl) continue;

                            // Upload to Postiz
                            const uploadRes = await fetch(`${POSTIZ_API_BASE}/upload-from-url`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': apiKey,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ url: imageUrl })
                            });

                            if (!uploadRes.ok) {
                                const errText = await uploadRes.text();
                                throw new Error(`Upload failed: ${uploadRes.status} ${errText}`);
                            }

                            const uploadData = await uploadRes.json();
                            postizMedia.push({ id: uploadData.id || uploadData.url, path: uploadData.path || uploadData.url });
                        }

                        if (postizMedia.length === 0) {
                            throw new Error('No images uploaded successfully');
                        }

                        // 2. Create Post
                        const caption = `${slideshow.caption}\n\n${slideshow.hashtags.map(t => `#${t}`).join(' ')}`;

                        const postBody = {
                            type: 'now',
                            shortLink: false,
                            tags: [],
                            posts: [{
                                integration: { id: profileId },
                                value: [{
                                    content: caption,
                                    image: postizMedia.map(m => ({ id: m.id, path: m.path }))
                                }],
                                group: `slideshow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
                        };

                        const postRes = await fetch(`${POSTIZ_API_BASE}/posts`, {
                            method: 'POST',
                            headers: {
                                'Authorization': apiKey,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(postBody)
                        });

                        if (!postRes.ok) {
                            const errText = await postRes.text();
                            throw new Error(`Post creation failed: ${postRes.status} ${errText}`);
                        }

                        successCount++;

                        // Update slideshow status in DB (optional but good for UI consistency)
                        // We'll just track it here for the job result

                    } catch (err) {
                        console.error(`Failed to process slideshow ${slideshow.id}:`, err);
                        failCount++;
                    }
                }

                // Mark job as completed
                await supabase.from('job_queue').update({
                    status: failCount > 0 && successCount === 0 ? 'failed' : 'completed',
                    error: failCount > 0 ? `Failed ${failCount} posts` : null
                }).eq('id', job.id);

                results.push({ id: job.id, status: 'completed', success: successCount, failed: failCount });

            } catch (err) {
                console.error(`Job ${job.id} failed:`, err);
                await supabase.from('job_queue').update({ status: 'failed', error: err.message }).eq('id', job.id);
                results.push({ id: job.id, status: 'failed', error: err.message });
            }
        }

        return new Response(JSON.stringify({ processed: results }), { status: 200 });

    } catch (error) {
        console.error('Cron job error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

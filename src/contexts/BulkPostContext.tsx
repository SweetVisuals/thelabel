import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { SlideshowMetadata } from '../types';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { postizAPI } from '../lib/postiz';
import { addMinutes, addHours } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const applyScheduleConstraints = (baseTime: Date, timezone: string = 'UTC'): Date => {
    // Convert baseTime (which is a JS Date with a specific timestamp) to the user's timezone
    // toZonedTime returns a Date object representing the time in the target timezone
    const zonedDate = toZonedTime(baseTime, timezone);
    const hour = zonedDate.getHours();

    // If post falls between 10pm (22:00) and midnight, move to 9am next day
    if (hour >= 22) {
        const adjustedZoned = new Date(zonedDate);
        adjustedZoned.setDate(adjustedZoned.getDate() + 1);
        adjustedZoned.setHours(9, 0, 0, 0);
        return fromZonedTime(adjustedZoned, timezone);
    }

    // If post falls between midnight and 9am, move to 9am same day
    if (hour >= 0 && hour < 9) {
        const adjustedZoned = new Date(zonedDate);
        adjustedZoned.setHours(9, 0, 0, 0);
        return fromZonedTime(adjustedZoned, timezone);
    }

    return baseTime;
};

interface JobPayload {
    slideshows: SlideshowMetadata[];
    profiles: string[];
    strategy: 'interval' | 'first-now' | 'batch';
    settings: {
        intervalHours: number;
        startTime: string; // ISO string for JSON serialization
        batchSize: number;
        postIntervalMinutes: number;
        timezone?: string;
    };
}

export interface JobQueueItem {
    id: string;
    user_id: string;
    account_id?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    scheduled_start_time: string;
    batch_index: number;
    total_batches: number;
    payload: JobPayload;
    created_at: string;
    updated_at: string;
    error?: string;
}



interface BulkPostContextType {
    jobQueue: JobQueueItem[];
    lastScheduledTime: Date | null;
    startBulkPost: (
        slideshows: SlideshowMetadata[],
        profiles: string[],
        strategy: 'interval' | 'first-now' | 'batch',
        settings: {
            intervalHours: number;
            startTime: Date;
            batchSize: number;
            postIntervalMinutes: number;
        }
    ) => Promise<void>;
    refreshQueue: () => Promise<void>;
    rescheduleQueue: () => Promise<void>;
    nextBatchStartTime: Date | null;
}

const BulkPostContext = createContext<BulkPostContextType | undefined>(undefined);

export const useBulkPost = () => {
    const context = useContext(BulkPostContext);
    if (!context) {
        throw new Error('useBulkPost must be used within a BulkPostProvider');
    }
    return context;
};

export const BulkPostProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [jobQueue, setJobQueue] = useState<JobQueueItem[]>([]);
    const [lastScheduledTime, setLastScheduledTime] = useState<Date | null>(null);
    const [userTimezone, setUserTimezone] = useState('UTC');

    // Load initial queue and subscribe to changes
    const fetchQueue = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch user timezone
        const { data: userData } = await supabase
            .from('users')
            .select('timezone')
            .eq('id', user.id)
            .single();

        if (userData?.timezone) {
            setUserTimezone(userData.timezone);
        }

        const { data, error } = await supabase
            .from('job_queue')
            .select('*')
            .eq('user_id', user.id)
            .in('status', ['pending', 'processing', 'failed', 'completed'])
            .order('scheduled_start_time', { ascending: true });

        if (error) {
            console.error('Failed to fetch job queue:', error);
        } else {
            setJobQueue(data || []);
            updateLastScheduledTime(data || []);
        }
    }, []);

    useEffect(() => {
        fetchQueue();

        const subscription = supabase
            .channel('job_queue_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'job_queue'
                },
                (payload) => {
                    console.log('Job queue change received:', payload);
                    fetchQueue();
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [fetchQueue]);

    // Calculate the projected end time of the entire queue
    const updateLastScheduledTime = (queue: JobQueueItem[]) => {
        if (queue.length === 0) {
            setLastScheduledTime(null);
            return;
        }

        // Find the last job in the queue
        const lastJob = queue[queue.length - 1];
        const payload = lastJob.payload;
        const startTime = new Date(lastJob.scheduled_start_time);

        // Calculate duration of this specific job/batch
        const totalItems = payload.slideshows.length;
        const postIntervalMinutes = payload.settings.postIntervalMinutes;
        const intervalHours = payload.settings.intervalHours;

        let durationMinutes = 0;

        if (payload.strategy === 'batch') {
            // Since we split batches into separate jobs, a "batch job" is just one batch
            // Duration is just (Items - 1) * PostInterval
            durationMinutes = (totalItems - 1) * postIntervalMinutes;
        } else {
            // Interval strategy
            durationMinutes = (totalItems - 1) * (intervalHours * 60);
        }

        const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
        setLastScheduledTime(endTime);
    };

    // Poll for pending jobs that are ready to run - REMOVED (Backend processing only)

    // Helper to wait with UI feedback - REMOVED (Backend processing only)

    // postSingleSlideshow - REMOVED (Backend processing only)

    // processJob - REMOVED (Backend processing only)

    const startBulkPost = useCallback(async (
        slideshows: SlideshowMetadata[],
        profiles: string[],
        strategy: 'interval' | 'first-now' | 'batch',
        settings: {
            intervalHours: number;
            startTime: Date;
            batchSize: number;
            postIntervalMinutes: number;
        }
    ) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            toast.error('You must be logged in to schedule posts');
            return;
        }

        // --- SYNC API KEY TO DATABASE ---
        try {
            const apiKey = postizAPI.getApiKey();
            if (apiKey) {
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ postiz_api_key: apiKey.trim() })
                    .eq('id', user.id);

                if (updateError) {
                    console.error('Failed to sync Postiz API key:', updateError);
                    // Don't block scheduling if sync fails, but warn?
                    // Proceeding anyway as it might have been set before.
                } else {
                    console.log('Synced Postiz API key to database');
                }
            } else {
                console.warn('No Postiz API key found in local storage to sync');
            }
        } catch (e) {
            console.error('Error syncing API key:', e);
        }
        // --------------------------------

        const jobsToInsert = [];
        let currentStartTime = new Date(settings.startTime);
        // Zero out seconds and milliseconds to prevent drift and messy times
        currentStartTime.setSeconds(0, 0);

        if (strategy === 'batch') {
            const batchSize = settings.batchSize;
            const totalBatches = Math.ceil(slideshows.length / batchSize);

            // Base time for JOB PROCESSING
            // We want batches to process every 70 minutes starting from NOW (so the first one goes immediately)
            const baseProcessingTime = new Date();

            // Track the scheduled time for posts across batches
            // Initial value is the User's selected Start Time.
            let currentPostTime = new Date(settings.startTime);
            currentPostTime.setSeconds(0, 0);

            for (let i = 0; i < totalBatches; i++) {
                const batchSlideshows = slideshows.slice(i * batchSize, (i + 1) * batchSize);

                // Job Processing Time
                // First batch processes immediately, subsequent ones wait 70 mins * index
                const scheduledProcessingTime = addMinutes(baseProcessingTime, i * 70);

                // Post Start Time for THIS batch is the current logical time we've reached
                const batchPostStartTime = new Date(currentPostTime);

                // Advance currentPostTime for the NEXT batch by simulating this batch's posts
                // This ensures Batch 2 starts exactly where Batch 1 left off + interval
                for (let j = 0; j < batchSlideshows.length; j++) {
                    // 1. Apply constraints to the current slot (e.g. if we landed on 11pm, move to 9am)
                    currentPostTime = applyScheduleConstraints(currentPostTime, userTimezone);

                    // 2. Move time forward for the NEXT post (or the start of the next batch)
                    const effectiveInterval = settings.postIntervalMinutes || 240;
                    currentPostTime = addMinutes(currentPostTime, effectiveInterval);
                }

                const payload: JobPayload = {
                    slideshows: batchSlideshows,
                    profiles,
                    strategy: 'batch', // Keep as batch so processor knows to use postIntervalMinutes
                    settings: {
                        ...settings,
                        startTime: batchPostStartTime.toISOString(),
                        timezone: userTimezone
                    }
                };

                jobsToInsert.push({
                    user_id: user.id,
                    account_id: profiles[0],
                    status: 'pending',
                    scheduled_start_time: scheduledProcessingTime.toISOString(),
                    batch_index: i + 1,
                    total_batches: totalBatches,
                    payload
                });
            }
        } else {
            // Interval or First-Now strategy - treat as single job
            const payload: JobPayload = {
                slideshows,
                profiles,
                strategy,
                settings: {
                    ...settings,
                    startTime: settings.startTime.toISOString(),
                    timezone: userTimezone
                }
            };

            jobsToInsert.push({
                user_id: user.id,
                account_id: profiles[0],
                status: 'pending',
                scheduled_start_time: settings.startTime.toISOString(),
                batch_index: 1,
                total_batches: 1,
                payload
            });
        }

        const { error } = await supabase
            .from('job_queue')
            .insert(jobsToInsert);

        if (error) {
            console.error('Failed to queue jobs:', error);
            toast.error('Failed to add jobs to queue');
        } else {
            toast.success(`Active batch started! ${jobsToInsert.length} batches queued for background processing.`);
            await fetchQueue();

            // Trigger the processor Edge Function immediately so we don't wait for the cron
            try {
                const { data: { session } } = await supabase.auth.getSession();
                fetch('https://wtsckulmgegamnovlrbf.supabase.co/functions/v1/process-job-queue', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session?.access_token || ''}`,
                        'Content-Type': 'application/json'
                    }
                }).catch(e => console.warn('Background trigger fired (async)'));
            } catch (triggerError) {
                console.warn('Failed to fire immediate background trigger:', triggerError);
            }
        }
    }, [fetchQueue]);





    const rescheduleQueue = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch all pending jobs
        const { data: jobs, error } = await supabase
            .from('job_queue')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'pending');

        if (error || !jobs || jobs.length === 0) {
            toast.error('No pending jobs to reschedule');
            return;
        }

        // Fetch last completed/processing job to find where we left off
        const { data: lastJobs } = await supabase
            .from('job_queue')
            .select('scheduled_start_time, status, batch_index')
            .eq('user_id', user.id)
            .in('status', ['completed', 'processing'])
            .order('scheduled_start_time', { ascending: false })
            .limit(1);

        let currentProcessingTime = new Date();
        const lastJob = lastJobs?.[0];

        // If a job is currently processing or recently completed, start 70 mins after it
        if (lastJob) {
            const lastTime = new Date(lastJob.scheduled_start_time);
            const nextPossibleTime = addMinutes(lastTime, 70);
            if (nextPossibleTime > currentProcessingTime) {
                currentProcessingTime = nextPossibleTime;
            } else {
                // If last job was long ago, just start from now + buffer
                currentProcessingTime = addMinutes(new Date(), 2);
            }
        } else {
            // First time ever? Start now + buffer
            currentProcessingTime = addMinutes(new Date(), 2);
        }

        // RESPECT FUTURE USER SCHEDULE
        // If the first pending job is scheduled for the future, don't pull it back to "now".
        const earliestPendingJob = jobs.reduce((earliest, job) => {
            const jobTime = new Date(job.scheduled_start_time);
            return (!earliest || jobTime < new Date(earliest.scheduled_start_time)) ? job : earliest;
        }, null as any);

        if (earliestPendingJob) {
            const pendingTime = new Date(earliestPendingJob.scheduled_start_time);
            if (pendingTime > addMinutes(currentProcessingTime, 5)) {
                console.log(`Preserving future schedule: jumping to ${pendingTime.toISOString()}`);
                currentProcessingTime = pendingTime;
            }
        }

        // SPLIT LARGE BATCHES LOGIC
        // If we find any job with > 10 items, we split it to prevent timeouts.
        let hasSplit = false;

        for (const job of jobs) {
            const slideshows = job.payload.slideshows || [];
            const BATCH_LIMIT = 10;

            if (slideshows.length > BATCH_LIMIT) {
                console.log(`Splitting large batch ${job.id} with ${slideshows.length} items`);
                hasSplit = true;

                const totalChunks = Math.ceil(slideshows.length / BATCH_LIMIT);
                const baseBatchIndex = job.batch_index;
                const baseSettings = job.payload.settings;

                const baseTime = new Date(job.scheduled_start_time);

                // Create new jobs for chunks
                for (let i = 0; i < totalChunks; i++) {
                    const chunkSlides = slideshows.slice(i * BATCH_LIMIT, (i + 1) * BATCH_LIMIT);

                    const newPayload = {
                        ...job.payload,
                        strategy: 'batch', // Force batch strategy for chunks
                        slideshows: chunkSlides,
                        settings: {
                            ...baseSettings,
                            batchSize: BATCH_LIMIT
                        }
                    };

                    // Preserve schedule for the first chunk, offset others
                    const chunkTime = i === 0 ? baseTime : addMinutes(baseTime, i * 70);

                    await supabase.from('job_queue').insert({
                        user_id: user.id,
                        account_id: job.account_id,
                        status: 'pending',
                        scheduled_start_time: chunkTime.toISOString(),
                        batch_index: baseBatchIndex + i,
                        total_batches: (job.total_batches || 0) + totalChunks - 1,
                        payload: newPayload
                    });
                }

                // Delete the original large job
                await supabase.from('job_queue').delete().eq('id', job.id);
            }
        }

        if (hasSplit) {
            toast.success('Large batches detected and split into smaller chunks. Recalibrating...');
            // Re-fetch jobs to get the new split ones
            const { data: refreshedJobs } = await supabase
                .from('job_queue')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'pending');

            if (refreshedJobs) {
                // Update our local reference to sorted jobs
                // We need to re-sort them to ensure order
                // The batch_index might be messy now, so we should re-index them based on creation time or ID?
                // Actually, just sort by created_at to preserve insertion order of chunks
                jobs.length = 0; // Clear array
                jobs.push(...refreshedJobs);
            }
        }

        // Sort pending jobs strictly by batch_index to fix sequential issues (Batch 4 before 11)
        // If we split, we rely on the new batch_index or created_at
        const sortedJobs = [...jobs].sort((a, b) => {
            // Primary sort: batch_index
            const batchDiff = (a.batch_index || 0) - (b.batch_index || 0);
            if (batchDiff !== 0) return batchDiff;
            // Secondary sort: created_at (for split chunks)
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        // Also track post time
        let currentPostTime = new Date(currentProcessingTime);
        currentPostTime.setSeconds(0, 0);

        console.log(`Rescheduling ${sortedJobs.length} jobs starting from ${currentProcessingTime.toISOString()}`);

        for (let i = 0; i < sortedJobs.length; i++) {
            const job = sortedJobs[i];
            let settings = { ...job.payload.settings };

            if (!settings.postIntervalMinutes || isNaN(settings.postIntervalMinutes)) {
                settings.postIntervalMinutes = 1;
            }

            const batchPostStartTime = new Date(currentPostTime);
            settings.startTime = batchPostStartTime.toISOString();

            const slideshows = job.payload.slideshows || [];
            const strategy = job.payload.strategy;

            for (let j = 0; j < slideshows.length; j++) {
                currentPostTime = applyScheduleConstraints(currentPostTime, userTimezone);
                if (strategy === 'batch') {
                    currentPostTime = addMinutes(currentPostTime, settings.postIntervalMinutes);
                } else {
                    currentPostTime = addHours(currentPostTime, settings.intervalHours || 1);
                }
            }

            const updatePayload = {
                scheduled_start_time: currentProcessingTime.toISOString(),
                batch_index: i + 1, // Re-normalize batch index strictly 1, 2, 3...
                payload: {
                    ...job.payload,
                    settings
                }
            };

            const { error: updateError } = await supabase
                .from('job_queue')
                .update(updatePayload)
                .eq('id', job.id);

            if (updateError) {
                console.error(`Failed to reschedule job ${job.id}:`, updateError);
            }

            // Move to next processing window (70 mins)
            currentProcessingTime = addMinutes(currentProcessingTime, 70);
        };

        toast.success('Queue rescheduled successfully');
        fetchQueue();
    };

    const nextBatchStartTime = useMemo(() => {
        const pendingJobs = jobQueue.filter(j => j.status === 'pending');
        if (pendingJobs.length === 0) return null;

        // Sort by scheduled_start_time to find the next one
        const sorted = [...pendingJobs].sort((a, b) =>
            new Date(a.scheduled_start_time).getTime() - new Date(b.scheduled_start_time).getTime()
        );

        return new Date(sorted[0].scheduled_start_time);
    }, [jobQueue]);

    return (
        <BulkPostContext.Provider value={{
            jobQueue,
            lastScheduledTime,
            startBulkPost,
            refreshQueue: fetchQueue,
            rescheduleQueue,
            nextBatchStartTime
        }}>
            {children}
        </BulkPostContext.Provider>
    );
};

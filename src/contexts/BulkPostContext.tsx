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
                    .update({ postiz_api_key: apiKey })
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

            // Track the scheduled time for posts across batches
            let currentPostTime = new Date(settings.startTime);
            currentPostTime.setSeconds(0, 0);

            // Base time for JOB PROCESSING
            // We want batches to process every 66 minutes starting from now
            const baseProcessingTime = new Date();

            for (let i = 0; i < totalBatches; i++) {
                const batchSlideshows = slideshows.slice(i * batchSize, (i + 1) * batchSize);

                // Job Processing Time
                // First batch processes immediately (or as close as possible), subsequent ones wait 70 mins (1h 10m) * index
                // This provides a buffer over the 1h 7m Postiz limit
                const scheduledProcessingTime = addMinutes(baseProcessingTime, i * 70);

                // Post Start Time for this batch
                const batchPostStartTime = new Date(currentPostTime);

                // Advance currentPostTime for the next batch by simulating this batch's posts
                for (let j = 0; j < batchSlideshows.length; j++) {
                    currentPostTime = applyScheduleConstraints(currentPostTime, userTimezone);
                    currentPostTime = addMinutes(currentPostTime, settings.postIntervalMinutes);
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
            // Removed immediate local processing call
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
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .order('batch_index', { ascending: true });

        if (error || !jobs || jobs.length === 0) return;

        let currentProcessingTime = new Date();
        // Add a small buffer so the first one isn't "in the past" immediately if processing takes time
        currentProcessingTime = addMinutes(currentProcessingTime, 1);

        // Also track post time
        let currentPostTime = new Date(currentProcessingTime);
        currentPostTime.setSeconds(0, 0);

        console.log(`Rescheduling ${jobs.length} jobs starting from ${currentProcessingTime.toISOString()}`);

        for (let i = 0; i < jobs.length; i++) {
            const job = jobs[i];
            // Create a deep copy of settings to avoid reference issues
            let settings = { ...job.payload.settings };

            // [FIX] Removed forced reset of postIntervalMinutes. 
            // We now respect the user's settings or the existing job settings.
            if (!settings.postIntervalMinutes || isNaN(settings.postIntervalMinutes)) {
                settings.postIntervalMinutes = 1;
            }

            // Capture start time for this batch's posts
            const batchPostStartTime = new Date(currentPostTime);

            // Update settings with new start time
            settings.startTime = batchPostStartTime.toISOString();

            // Simulate schedule to advance currentPostTime
            const slideshows = job.payload.slideshows || [];
            const strategy = job.payload.strategy;

            for (let j = 0; j < slideshows.length; j++) {
                currentPostTime = applyScheduleConstraints(currentPostTime, userTimezone);
                if (strategy === 'batch') {
                    currentPostTime = addMinutes(currentPostTime, settings.postIntervalMinutes);
                } else {
                    // Interval strategy
                    currentPostTime = addHours(currentPostTime, settings.intervalHours || 1);
                }
            }

            // Update the job
            const updatePayload = {
                scheduled_start_time: currentProcessingTime.toISOString(),
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

            // Increment time for next job processing (66 minutes)
            currentProcessingTime = addMinutes(currentProcessingTime, 66);
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

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { SlideshowMetadata } from '../types';
import { postizUploadService } from '../lib/postizUploadService';
import { slideshowService } from '../lib/slideshowService';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { addMinutes, addHours } from 'date-fns';

interface JobPayload {
    slideshows: SlideshowMetadata[];
    profiles: string[];
    strategy: 'interval' | 'first-now' | 'batch';
    settings: {
        intervalHours: number;
        startTime: string; // ISO string for JSON serialization
        batchSize: number;
        batchIntervalHours: number;
        postIntervalMinutes: number;
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

interface PostingSchedule {
    slideshowId: string;
    slideshowTitle: string;
    scheduledTime: Date;
    status: 'pending' | 'posting' | 'success' | 'error';
    postId?: string;
    error?: string;
}

interface BulkPostContextType {
    isPosting: boolean;
    isPaused: boolean;
    nextResumeTime: Date | null;
    postingSchedule: PostingSchedule[]; // Current active job schedule
    statusMessage: string;
    jobQueue: JobQueueItem[];
    lastScheduledTime: Date | null;
    currentJobId: string | null;
    currentBatchIndex: number;
    totalBatches: number;
    startBulkPost: (
        slideshows: SlideshowMetadata[],
        profiles: string[],
        strategy: 'interval' | 'first-now' | 'batch',
        settings: {
            intervalHours: number;
            startTime: Date;
            batchSize: number;
            batchIntervalHours: number;
            postIntervalMinutes: number;
        }
    ) => Promise<void>;
    stopBulkPost: () => void;
    refreshQueue: () => Promise<void>;
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
    const [isPosting, setIsPosting] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [nextResumeTime, setNextResumeTime] = useState<Date | null>(null);
    const [postingSchedule, setPostingSchedule] = useState<PostingSchedule[]>([]);
    const [statusMessage, setStatusMessage] = useState('');
    const [jobQueue, setJobQueue] = useState<JobQueueItem[]>([]);
    const [lastScheduledTime, setLastScheduledTime] = useState<Date | null>(null);
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);
    const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
    const [totalBatches, setTotalBatches] = useState(0);

    const stopProcessingRef = useRef(false);

    // Load initial queue and subscribe to changes
    const fetchQueue = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('job_queue')
            .select('*')
            .eq('user_id', user.id)
            .in('status', ['pending', 'processing', 'failed'])
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

    // Poll for pending jobs that are ready to run
    useEffect(() => {
        const checkQueue = async () => {
            if (isPosting) return; // Already processing a job

            const now = new Date();
            const readyJob = jobQueue.find(job =>
                job.status === 'pending' && new Date(job.scheduled_start_time) <= now
            );

            if (readyJob) {
                console.log('Found ready job:', readyJob.id);
                processJob(readyJob);
            }
        };

        const interval = setInterval(checkQueue, 1000); // Check every second
        return () => clearInterval(interval);
    }, [jobQueue, isPosting]);

    // Helper to wait with UI feedback
    const waitWithFeedback = async (ms: number) => {
        const resumeAt = new Date(Date.now() + ms);
        setNextResumeTime(resumeAt);
        setIsPaused(true);
        setStatusMessage(`Waiting for next batch... Resuming at ${resumeAt.toLocaleTimeString()}`);

        return new Promise<void>((resolve, reject) => {
            const checkInterval = setInterval(() => {
                if (stopProcessingRef.current) {
                    clearInterval(checkInterval);
                    reject(new Error('Processing stopped by user'));
                }
                if (Date.now() >= resumeAt.getTime()) {
                    clearInterval(checkInterval);
                    setIsPaused(false);
                    setNextResumeTime(null);
                    setStatusMessage('Resuming processing...');
                    resolve();
                }
            }, 1000);
        });
    };

    const postSingleSlideshow = async (
        slideshow: SlideshowMetadata,
        profileId: string,
        scheduledAt?: Date,
        postNow: boolean = false
    ): Promise<{ success: boolean; postId?: string; error?: string }> => {
        try {
            const captionText = slideshowService.formatCaptionForBuffer(slideshow.caption, slideshow.hashtags);
            const postizMedia = await postizUploadService.uploadImagesToPostizStorage(slideshow);

            if (postizMedia.length === 0) {
                throw new Error('No images were successfully uploaded to Postiz storage');
            }

            const result = await postizUploadService.createPostWithUploadedImages(
                captionText,
                profileId,
                postizMedia,
                scheduledAt,
                postNow
            );

            return { success: true, postId: result.postId };
        } catch (error) {
            console.error(`Failed to post slideshow ${slideshow.title}:`, error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return { success: false, error: errorMessage };
        }
    };

    const processJob = useCallback(async (job: JobQueueItem) => {
        if (isPosting) return;

        try {
            // 1. Lock the job
            const { error: lockError } = await supabase
                .from('job_queue')
                .update({ status: 'processing' })
                .eq('id', job.id)
                .eq('status', 'pending');

            if (lockError) {
                console.error('Failed to lock job:', lockError);
                return;
            }

            setIsPosting(true);
            setCurrentJobId(job.id);
            setCurrentBatchIndex(job.batch_index);
            setTotalBatches(job.total_batches);
            stopProcessingRef.current = false;
            setStatusMessage(`Starting job ${job.id} (Batch ${job.batch_index}/${job.total_batches})...`);

            const { slideshows, profiles, strategy, settings } = job.payload;
            const { intervalHours, postIntervalMinutes, batchIntervalHours } = settings;

            // Generate Schedule for this specific job/batch
            const schedule: PostingSchedule[] = [];
            let currentTime = new Date(); // Start processing now

            const applyScheduleConstraints = (baseTime: Date): Date => {
                const hour = baseTime.getHours();

                // If post falls between 10pm (22:00) and midnight, move to 9am next day
                if (hour >= 22) {
                    const adjustedTime = new Date(baseTime);
                    adjustedTime.setDate(adjustedTime.getDate() + 1);
                    adjustedTime.setHours(9, 0, 0, 0);
                    return adjustedTime;
                }

                // If post falls between midnight and 9am, move to 9am same day
                if (hour >= 0 && hour < 9) {
                    const adjustedTime = new Date(baseTime);
                    adjustedTime.setHours(9, 0, 0, 0);
                    return adjustedTime;
                }

                return baseTime;
            };

            // Since we've split batches, 'batch' strategy here just means "post these items with postIntervalMinutes"
            // 'interval' strategy means "post these items with intervalHours"
            // 'first-now' is handled by the first batch having start time = now, and subsequent items having interval

            let currentScheduledTime = new Date(currentTime);

            for (let i = 0; i < slideshows.length; i++) {
                currentScheduledTime = applyScheduleConstraints(currentScheduledTime);

                schedule.push({
                    slideshowId: slideshows[i].id,
                    slideshowTitle: slideshows[i].title,
                    scheduledTime: new Date(currentScheduledTime),
                    status: 'pending'
                });

                if (strategy === 'batch') {
                    currentScheduledTime = addMinutes(currentScheduledTime, postIntervalMinutes);
                } else {
                    currentScheduledTime = addHours(currentScheduledTime, intervalHours);
                }
            }

            setPostingSchedule(schedule);

            let successfulCount = 0;
            let hasError = false;
            const failedSlideshows: SlideshowMetadata[] = [];

            for (let i = 0; i < schedule.length; i++) {
                if (stopProcessingRef.current) break;

                const scheduleItem = schedule[i];

                setPostingSchedule(prev => prev.map((item, index) =>
                    index === i ? { ...item, status: 'posting' } : item
                ));
                setStatusMessage(`Posting ${i + 1}/${schedule.length}: ${scheduleItem.slideshowTitle}`);

                const slideshow = slideshows.find(s => s.id === scheduleItem.slideshowId);
                if (!slideshow) continue;

                // For 'first-now', the first item of the first batch should be immediate
                // But since we split jobs, we need to know if this is the VERY first item of the VERY first batch
                // However, the job's scheduled_start_time handles the "when to start" part.
                // If the job is scheduled for NOW, we post now.
                // We don't need special 'postNow' flag for API unless we really want to bypass scheduling
                // But here we are "processing" which means we are doing the actions NOW.
                // So we always send "postNow=true" to Postiz? 
                // Wait, if we send "postNow=true", Postiz posts immediately.
                // If we send a date, Postiz schedules it.
                // The user wants to "schedule" batches.
                // But the requirement was "Sequential Batch Scheduling... each new batch starts only after the previous one has completed".
                // And "We can't schedule future posts immedietly because it still requires the postiz API".
                // So we are acting as the scheduler. We tell Postiz to post NOW.

                // Use the calculated schedule time for this item
                // If the time is in the past or very close to now (within 1 min), we can post immediately
                // Otherwise we schedule it
                const now = new Date();
                const scheduledTime = scheduleItem.scheduledTime;
                const shouldPostNow = scheduledTime.getTime() <= now.getTime() + 60000; // 1 min buffer

                const result = await postSingleSlideshow(
                    slideshow,
                    profiles[0],
                    shouldPostNow ? undefined : scheduledTime,
                    shouldPostNow
                );

                if (result.success) {
                    setPostingSchedule(prev => prev.map((item, index) =>
                        index === i ? { ...item, status: 'success', postId: result.postId } : item
                    ));
                    successfulCount++;
                    await slideshowService.incrementUploadCount(slideshow.id);
                    await slideshowService.updateSlideshowStatus(slideshow.id, 'success');
                } else {
                    hasError = true;
                    await slideshowService.updateSlideshowStatus(slideshow.id, 'failed');
                    const isRateLimit = result.error && (
                        result.error.toLowerCase().includes('rate limit') ||
                        result.error.toLowerCase().includes('too many requests')
                    );

                    if (isRateLimit) {
                        setPostingSchedule(prev => prev.map((item, index) =>
                            index === i ? { ...item, status: 'pending', error: 'Rate limit hit' } : item
                        ));
                        try {
                            // Wait 1 hour for rate limits
                            await waitWithFeedback(60 * 60 * 1000);
                            i--; // Retry
                            continue;
                        } catch (e) {
                            break;
                        }
                    } else {
                        setPostingSchedule(prev => prev.map((item, index) =>
                            index === i ? { ...item, status: 'error', error: result.error } : item
                        ));
                        failedSlideshows.push(slideshow);
                    }
                }

                // No waiting between items - we are scheduling them all at once
                // The only delay is the upload time itself
            }

            // Handle Retries for Failed Slideshows
            if (failedSlideshows.length > 0) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    // Calculate retry time: Start of next batch or batchInterval from now
                    const retryTime = addHours(new Date(), batchIntervalHours || 1.5);

                    const retryPayload: JobPayload = {
                        slideshows: failedSlideshows,
                        profiles,
                        strategy: 'batch',
                        settings: {
                            ...settings,
                            startTime: retryTime.toISOString()
                        }
                    };

                    await supabase.from('job_queue').insert({
                        user_id: user.id,
                        account_id: profiles[0],
                        status: 'pending',
                        scheduled_start_time: retryTime.toISOString(),
                        batch_index: job.batch_index + 1, // Append to next index logically
                        total_batches: job.total_batches,
                        payload: retryPayload
                    });

                    toast.error(`Rescheduled ${failedSlideshows.length} failed posts for next batch slot`);
                }
            }

            // Mark job as completed or failed
            await supabase
                .from('job_queue')
                .update({
                    status: hasError && successfulCount < schedule.length ? 'failed' : 'completed',
                    error: hasError ? 'Some posts failed (retried)' : null
                })
                .eq('id', job.id);

            toast.success(`Batch ${job.batch_index}/${job.total_batches} completed`);

        } catch (error) {
            console.error('Job processing error:', error);
            await supabase
                .from('job_queue')
                .update({
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error'
                })
                .eq('id', job.id);
            toast.error('Job failed');
        } finally {
            setIsPosting(false);
            setCurrentJobId(null);
            setCurrentBatchIndex(0);
            setTotalBatches(0);
            setIsPaused(false);
            setNextResumeTime(null);
            stopProcessingRef.current = false;
            setPostingSchedule([]);
            setStatusMessage('');
            fetchQueue(); // Refresh queue immediately
        }
    }, [isPosting, fetchQueue]);

    const startBulkPost = useCallback(async (
        slideshows: SlideshowMetadata[],
        profiles: string[],
        strategy: 'interval' | 'first-now' | 'batch',
        settings: {
            intervalHours: number;
            startTime: Date;
            batchSize: number;
            batchIntervalHours: number;
            postIntervalMinutes: number;
        }
    ) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            toast.error('You must be logged in to schedule posts');
            return;
        }

        const jobsToInsert = [];
        let currentStartTime = new Date(settings.startTime);

        if (strategy === 'batch') {
            const batchSize = settings.batchSize;
            const totalBatches = Math.ceil(slideshows.length / batchSize);

            for (let i = 0; i < totalBatches; i++) {
                const batchSlideshows = slideshows.slice(i * batchSize, (i + 1) * batchSize);

                // Calculate start time for this batch
                // First batch starts at startTime
                // Subsequent batches start after:
                // Previous Batch Start + (ItemsInPrevBatch * PostInterval) + BatchInterval

                if (i > 0) {
                    const prevBatchSize = slideshows.slice((i - 1) * batchSize, i * batchSize).length;
                    const prevBatchDurationMinutes = (prevBatchSize - 1) * settings.postIntervalMinutes;
                    // Add duration of previous batch + buffer
                    currentStartTime = addMinutes(currentStartTime, prevBatchDurationMinutes);
                    currentStartTime = addHours(currentStartTime, settings.batchIntervalHours);
                }

                const payload: JobPayload = {
                    slideshows: batchSlideshows,
                    profiles,
                    strategy: 'batch', // Keep as batch so processor knows to use postIntervalMinutes
                    settings: {
                        ...settings,
                        startTime: currentStartTime.toISOString()
                    }
                };

                jobsToInsert.push({
                    user_id: user.id,
                    account_id: profiles[0],
                    status: 'pending',
                    scheduled_start_time: currentStartTime.toISOString(),
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
                    startTime: settings.startTime.toISOString()
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
            toast.success(`Added ${jobsToInsert.length} batches to queue`);
            await fetchQueue();

            // Trigger immediate processing of first batch if scheduled for now
            const now = new Date();
            const firstJob = jobsToInsert[0];
            if (firstJob && new Date(firstJob.scheduled_start_time) <= now) {
                // Fetch the newly inserted jobs to get their IDs
                const { data: insertedJobs } = await supabase
                    .from('job_queue')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(jobsToInsert.length);

                if (insertedJobs && insertedJobs.length > 0) {
                    const jobToProcess = insertedJobs.find(j =>
                        new Date(j.scheduled_start_time) <= now
                    );
                    if (jobToProcess) {
                        console.log('Starting first batch immediately:', jobToProcess.id);
                        processJob(jobToProcess);
                    }
                }
            }
        }
    }, [fetchQueue, processJob]);

    const stopBulkPost = () => {
        stopProcessingRef.current = true;
    };

    return (
        <BulkPostContext.Provider value={{
            isPosting,
            isPaused,
            nextResumeTime,
            postingSchedule,
            statusMessage,
            jobQueue,
            lastScheduledTime,
            currentJobId,
            currentBatchIndex,
            totalBatches,
            startBulkPost,
            stopBulkPost,
            refreshQueue: fetchQueue
        }}>
            {children}
        </BulkPostContext.Provider>
    );
};

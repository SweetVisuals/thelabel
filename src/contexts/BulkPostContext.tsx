import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { SlideshowMetadata } from '../types';
import { postizUploadService } from '../lib/postizUploadService';
import { slideshowService } from '../lib/slideshowService';

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
    postingSchedule: PostingSchedule[];
    statusMessage: string;
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
    // const { user } = useAuth(); // Unused
    const [isPosting, setIsPosting] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [nextResumeTime, setNextResumeTime] = useState<Date | null>(null);
    const [postingSchedule, setPostingSchedule] = useState<PostingSchedule[]>([]);
    const [statusMessage, setStatusMessage] = useState('');

    const stopProcessingRef = useRef(false);

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
        if (isPosting) return;

        setIsPosting(true);
        stopProcessingRef.current = false;
        setStatusMessage('Initializing bulk post...');

        // Generate Schedule
        const schedule: PostingSchedule[] = [];
        let currentTime = new Date(settings.startTime);
        const { intervalHours, batchSize, batchIntervalHours, postIntervalMinutes } = settings;

        // ... (Reuse schedule generation logic from BulkPostizPoster) ...
        // Simplified for brevity, assuming the passed schedule or generating it here is fine.
        // For now, let's replicate the generation logic quickly or assume the caller passes it?
        // Better to generate it here to keep it consistent.

        const applyScheduleConstraints = (baseTime: Date): Date => {
            const hour = baseTime.getHours();
            if (hour >= 0 && hour < 9) {
                const adjustedTime = new Date(baseTime);
                adjustedTime.setHours(9, 0, 0, 0);
                return adjustedTime;
            }
            return baseTime;
        };

        const { addHours, addMinutes } = await import('date-fns');

        if (strategy === 'first-now') {
            schedule.push({
                slideshowId: slideshows[0].id,
                slideshowTitle: slideshows[0].title,
                scheduledTime: new Date(),
                status: 'pending'
            });
            for (let i = 1; i < slideshows.length; i++) {
                currentTime = addHours(currentTime, intervalHours);
                currentTime = applyScheduleConstraints(currentTime);
                schedule.push({
                    slideshowId: slideshows[i].id,
                    slideshowTitle: slideshows[i].title,
                    scheduledTime: new Date(currentTime),
                    status: 'pending'
                });
            }
        } else if (strategy === 'batch') {
            // Continuous scheduling logic matching BulkPostizPoster
            let currentScheduledTime = new Date(settings.startTime);

            for (let i = 0; i < slideshows.length; i++) {
                // const batchIndex = Math.floor(i / batchSize); // Unused variable

                // Apply constraints to the current scheduled time
                currentScheduledTime = applyScheduleConstraints(currentScheduledTime);

                schedule.push({
                    slideshowId: slideshows[i].id,
                    slideshowTitle: slideshows[i].title,
                    scheduledTime: new Date(currentScheduledTime),
                    status: 'pending'
                });

                // Advance time for the next post
                currentScheduledTime = addMinutes(currentScheduledTime, postIntervalMinutes);
            }
        } else {
            for (let i = 0; i < slideshows.length; i++) {
                currentTime = applyScheduleConstraints(currentTime);
                schedule.push({
                    slideshowId: slideshows[i].id,
                    slideshowTitle: slideshows[i].title,
                    scheduledTime: new Date(currentTime),
                    status: 'pending'
                });
                currentTime = addHours(currentTime, intervalHours);
            }
        }

        setPostingSchedule(schedule);

        try {
            let successfulCount = 0;

            for (let i = 0; i < schedule.length; i++) {
                if (stopProcessingRef.current) break;

                // Proactive Batch Throttling
                // Wait ONLY between batches, not before the first one
                if (strategy === 'batch' && i > 0 && i % batchSize === 0) {
                    await waitWithFeedback(batchIntervalHours * 60 * 60 * 1000);
                }

                const scheduleItem = schedule[i];

                // Update status locally
                setPostingSchedule(prev => prev.map((item, index) =>
                    index === i ? { ...item, status: 'posting' } : item
                ));
                setStatusMessage(`Posting ${i + 1}/${schedule.length}: ${scheduleItem.slideshowTitle}`);

                const slideshow = slideshows.find(s => s.id === scheduleItem.slideshowId);
                if (!slideshow) continue;

                const shouldPostNow = strategy === 'first-now' && i === 0;
                const scheduledAt = shouldPostNow ? undefined : scheduleItem.scheduledTime;

                const result = await postSingleSlideshow(slideshow, profiles[0], scheduledAt, shouldPostNow);

                if (result.success) {
                    setPostingSchedule(prev => prev.map((item, index) =>
                        index === i ? { ...item, status: 'success', postId: result.postId } : item
                    ));
                    successfulCount++;

                    // No wait here for batch strategy - we want to send the whole batch immediately
                    // The batch throttling is handled at the start of the loop
                } else {
                    const isRateLimit = result.error && (
                        result.error.toLowerCase().includes('rate limit') ||
                        result.error.toLowerCase().includes('too many requests')
                    );

                    if (isRateLimit) {
                        setPostingSchedule(prev => prev.map((item, index) =>
                            index === i ? { ...item, status: 'pending', error: 'Rate limit hit' } : item
                        ));

                        try {
                            await waitWithFeedback(Math.max(batchIntervalHours, 1) * 60 * 60 * 1000);
                            i--;
                            continue;
                        } catch (e) {
                            break;
                        }
                    } else {
                        setPostingSchedule(prev => prev.map((item, index) =>
                            index === i ? { ...item, status: 'error', error: result.error } : item
                        ));
                    }
                }
            }

            setStatusMessage(successfulCount === schedule.length ? 'All posts scheduled successfully!' : 'Bulk post finished with errors.');

        } catch (error) {
            console.error('Bulk post error:', error);
            setStatusMessage('Error during bulk post.');
        } finally {
            setIsPosting(false);
            setIsPaused(false);
            setNextResumeTime(null);
            stopProcessingRef.current = false;
        }
    }, [isPosting]);

    const stopBulkPost = () => {
        stopProcessingRef.current = true;
        setIsPosting(false);
        setIsPaused(false);
        setNextResumeTime(null);
        setStatusMessage('Processing stopped.');
    };

    return (
        <BulkPostContext.Provider value={{
            isPosting,
            isPaused,
            nextResumeTime,
            postingSchedule,
            statusMessage,
            startBulkPost,
            stopBulkPost
        }}>
            {children}
        </BulkPostContext.Provider>
    );
};

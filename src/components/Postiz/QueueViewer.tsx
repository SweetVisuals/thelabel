import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, ListOrdered, Loader2, CheckCircle, AlertCircle, Clock, Trash2, RefreshCw, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { Button } from '../ui/button';
import { Progress } from '@/components/ui/progress';
import { useBulkPost } from '../../contexts/BulkPostContext';
import { cn } from '@/lib/utils';
import { postizAPI } from '../../lib/postiz';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { addMinutes, addHours } from 'date-fns';

interface QueueViewerProps {
    onClose: () => void;
}

export const QueueViewer: React.FC<QueueViewerProps> = ({ onClose }) => {
    const { jobQueue, refreshQueue, currentJobId, postingSchedule, rescheduleQueue, stopBulkPost } = useBulkPost();
    // Force re-deploy
    const [profiles, setProfiles] = useState<any[]>([]);
    const [expandedJobs, setExpandedJobs] = useState<string[]>([]);

    // Calculate total stats
    const totalPosts = jobQueue.reduce((acc, job) => acc + (job.payload.slideshows?.length || 0), 0);
    const totalBatches = jobQueue.length;
    const pendingPosts = jobQueue
        .filter(j => j.status === 'pending' || j.status === 'processing')
        .reduce((acc, job) => acc + (job.payload.slideshows?.length || 0), 0);

    const toggleExpandAll = () => {
        if (expandedJobs.length === jobQueue.length) {
            setExpandedJobs([]);
        } else {
            setExpandedJobs(jobQueue.map(j => j.id));
        }
    };


    const applyScheduleConstraints = (baseTime: Date): Date => {
        const hour = baseTime.getHours();
        if (hour >= 22) {
            const adjustedTime = new Date(baseTime);
            adjustedTime.setDate(adjustedTime.getDate() + 1);
            adjustedTime.setHours(9, 0, 0, 0);
            return adjustedTime;
        }
        if (hour >= 0 && hour < 9) {
            const adjustedTime = new Date(baseTime);
            adjustedTime.setHours(9, 0, 0, 0);
            return adjustedTime;
        }
        return baseTime;
    };

    const getPostTime = (job: any, index: number) => {
        const { strategy, settings } = job.payload;
        let currentTime = new Date(settings.startTime);
        const intervalHours = settings.intervalHours || 1;
        const postIntervalMinutes = settings.postIntervalMinutes || 1;

        for (let i = 0; i <= index; i++) {
            currentTime = applyScheduleConstraints(currentTime);

            if (i === index) return currentTime;

            if (strategy === 'batch') {
                currentTime = addMinutes(currentTime, postIntervalMinutes);
            } else {
                currentTime = addHours(currentTime, intervalHours);
            }
        }
        return currentTime;
    };

    useEffect(() => {
        loadProfiles();
    }, []);

    const loadProfiles = async () => {
        try {
            const connectedProfiles = await postizAPI.getProfiles();
            setProfiles(connectedProfiles);
        } catch (error) {
            console.error('Failed to load profiles:', error);
        }
    };

    const getProfileName = (profileId: string) => {
        const profile = profiles.find(p => p.id === profileId);
        return profile ? profile.displayName : 'Unknown Account';
    };

    const handleDeleteJob = async (jobId: string) => {
        try {
            const { error } = await supabase
                .from('job_queue')
                .delete()
                .eq('id', jobId);

            if (error) throw error;
            toast.success('Job removed from queue');
            refreshQueue(); // Refresh the context
        } catch (error) {
            console.error('Failed to delete job:', error);
            toast.error('Failed to delete job');
        }
    };

    const handleClearCompleted = async () => {
        try {
            const { error } = await supabase
                .from('job_queue')
                .delete()
                .in('status', ['completed', 'failed']);

            if (error) throw error;
            toast.success('Cleared completed jobs');
            refreshQueue();
        } catch (error) {
            console.error('Failed to clear jobs:', error);
            toast.error('Failed to clear jobs');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <motion.div
                className="bg-[#09090b] w-full max-w-4xl max-h-[80vh] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
                    <h3 className="text-xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent flex items-center">
                        <ListOrdered className="w-5 h-5 mr-3 text-primary" />
                        Background Job Queue
                    </h3>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={refreshQueue} className="hover:bg-white/10">
                            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                        </Button>
                        <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-white/10 rounded-full">
                            <X className="w-5 h-5 text-muted-foreground" />
                        </Button>
                    </div>
                </div>

                {/* Summary Header */}
                <div className="px-6 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4 text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4" />
                            <span className="text-white font-medium">{totalBatches}</span> Batches
                        </div>
                        <div className="w-px h-4 bg-white/10" />
                        <div className="flex items-center gap-2">
                            <ListOrdered className="w-4 h-4" />
                            <span className="text-white font-medium">{totalPosts}</span> Total Posts
                        </div>
                        <div className="w-px h-4 bg-white/10" />
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span className="text-blue-400 font-medium">{pendingPosts}</span> Pending
                        </div>
                    </div>

                    {jobQueue.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleExpandAll}
                            className="text-xs h-7 hover:bg-white/10"
                        >
                            {expandedJobs.length === jobQueue.length ? (
                                <>
                                    <ChevronDown className="w-3 h-3 mr-1.5" /> Collapse All
                                </>
                            ) : (
                                <>
                                    <ChevronRight className="w-3 h-3 mr-1.5" /> Expand All ({jobQueue.length})
                                </>
                            )}
                        </Button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {jobQueue.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed border-white/10 rounded-xl">
                            <ListOrdered className="w-12 h-12 mb-4 opacity-20" />
                            <p>No jobs in the queue</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {jobQueue.map((job) => (
                                <div key={job.id} className="relative flex flex-col bg-black/40 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all">
                                    <div
                                        className={cn(
                                            "flex items-center justify-between p-4 cursor-pointer transition-colors",
                                            expandedJobs.includes(job.id) ? "bg-white/5" : "hover:bg-white/[0.02]"
                                        )}
                                        onClick={() => {
                                            // Allow expanding any job to see details
                                            setExpandedJobs(prev => prev.includes(job.id) ? prev.filter(id => id !== job.id) : [...prev, job.id]);
                                        }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center border",
                                                job.status === 'completed' ? "bg-green-500/10 border-green-500/20 text-green-500" :
                                                    job.status === 'processing' ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                                                        job.status === 'failed' ? "bg-red-500/10 border-red-500/20 text-red-500" :
                                                            "bg-white/5 border-white/10 text-muted-foreground"
                                            )}>
                                                {job.status === 'completed' ? <CheckCircle className="w-5 h-5" /> :
                                                    job.status === 'processing' ? <Loader2 className="w-5 h-5 animate-spin" /> :
                                                        job.status === 'failed' ? <AlertCircle className="w-5 h-5" /> :
                                                            <Clock className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={cn(
                                                        "text-sm font-bold px-2 py-0.5 rounded text-black",
                                                        job.status === 'completed' ? "bg-green-500" :
                                                            job.status === 'processing' ? "bg-blue-500" :
                                                                "bg-white"
                                                    )}>
                                                        Batch {job.batch_index}/{job.total_batches}
                                                    </span>
                                                    <span className="text-sm font-medium text-white/90">
                                                        • {job.payload.slideshows.length} Posts
                                                    </span>
                                                </div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                    <span>{getProfileName(job.payload.profiles[0])}</span>
                                                    <span>•</span>
                                                    <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                                        {job.payload.strategy}
                                                    </span>
                                                    <span>•</span>
                                                    <span>Scheduled: {new Date(job.scheduled_start_time).toLocaleString()}</span>
                                                    {job.status === 'pending' && new Date(job.scheduled_start_time) > new Date() && (
                                                        <span className="text-blue-400 ml-2">
                                                            (Starts in {(() => {
                                                                const diffMins = Math.ceil((new Date(job.scheduled_start_time).getTime() - new Date().getTime()) / 60000);
                                                                const hours = Math.floor(diffMins / 60);
                                                                const mins = diffMins % 60;
                                                                if (hours > 0) return `${hours}h ${mins}m`;
                                                                return `${mins} mins`;
                                                            })()})
                                                        </span>
                                                    )}
                                                </div>
                                                {job.error && (
                                                    <div className="text-xs text-red-400 mt-1">
                                                        Error: {job.error}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {expandedJobs.includes(job.id) ? (
                                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                            )}

                                            {job.status !== 'processing' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteJob(job.id);
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded View for Pending Jobs */}
                                    {expandedJobs.includes(job.id) && job.status !== 'processing' && (
                                        <div className="px-4 pb-4 border-t border-white/10 bg-black/20">
                                            <div className="text-xs text-muted-foreground my-3 font-medium flex items-center gap-2">
                                                <ListOrdered className="w-3.5 h-3.5" />
                                                <span>Posts in this batch</span>
                                                <div className="h-px bg-white/10 flex-1" />
                                            </div>
                                            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                                {job.payload.slideshows.map((slideshow, sIdx) => (
                                                    <div key={slideshow.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs bg-white/5 border border-white/10">
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <span className="text-muted-foreground font-mono">#{sIdx + 1}</span>
                                                            <span className="truncate text-white/90">{slideshow.title}</span>
                                                            <span className="text-muted-foreground ml-2 text-[10px] bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                                                {getPostTime(job, sIdx).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Detailed Progress for Processing Job */}
                                    {expandedJobs.includes(job.id) && job.status === 'processing' && (
                                        <div className="px-4 pb-4 border-t border-white/10 bg-black/20">
                                            {/* Check if this is being processed locally (we have a schedule) or remotely */}
                                            {job.id === currentJobId && postingSchedule.length > 0 ? (
                                                <>
                                                    <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
                                                        <div className="flex gap-2 items-center">
                                                            <span className="font-medium">Batch Progress (Local)</span>
                                                            <span className="font-mono">
                                                                {postingSchedule.filter(s => s.status === 'success' || s.status === 'error').length}/{postingSchedule.length}
                                                            </span>
                                                        </div>
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            className="h-6 w-6 rounded-full"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                stopBulkPost();
                                                            }}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                    <Progress
                                                        value={(postingSchedule.filter(s => s.status === 'success' || s.status === 'error').length / Math.max(postingSchedule.length, 1)) * 100}
                                                        className="h-2 bg-white/5 mb-3"
                                                    />
                                                    {/* Individual Post Status */}
                                                    <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                                                        {postingSchedule.map((post, postIdx) => (
                                                            <div
                                                                key={post.slideshowId}
                                                                className={cn(
                                                                    "flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors",
                                                                    post.status === 'success' ? "bg-green-500/10 border border-green-500/20" :
                                                                        post.status === 'error' ? "bg-red-500/10 border border-red-500/20" :
                                                                            post.status === 'posting' ? "bg-blue-500/10 border border-blue-500/20" :
                                                                                "bg-white/5 border border-white/10"
                                                                )}
                                                            >
                                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                    <span className="text-muted-foreground font-mono">#{postIdx + 1}</span>
                                                                    <span className="truncate text-white/90">{post.slideshowTitle}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {post.status === 'success' && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                                                                    {post.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                                                                    {post.status === 'posting' && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
                                                                    {post.status === 'pending' && <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-4 text-muted-foreground space-y-2">
                                                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                                    <span className="text-xs">Processing in background (Server)...</span>
                                                    <span className="text-[10px] opacity-70">Progress will update on completion</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-white/5 flex justify-between items-center">
                    <div className="text-xs text-muted-foreground">
                        Background jobs run every minute. Keep your API key saved in settings.
                    </div>
                    <div className="flex gap-2">
                        {jobQueue.some(j => j.status === 'pending') && (
                            <Button variant="outline" size="sm" onClick={rescheduleQueue} className="border-white/10 hover:bg-white/5 text-blue-400 hover:text-blue-300">
                                <Clock className="w-4 h-4 mr-2" /> Reschedule All
                            </Button>
                        )}
                        {jobQueue.some(j => ['completed', 'failed'].includes(j.status)) && (
                            <Button variant="outline" size="sm" onClick={handleClearCompleted} className="border-white/10 hover:bg-white/5">
                                Clear Completed
                            </Button>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, AlertCircle, CheckCircle, Loader2, Send, Settings, Layers, CalendarDays, User, Play, ListOrdered } from 'lucide-react';
import { Button } from '../ui/button';
import { SlideshowMetadata, PostizProfile } from '../../types';
import { cn } from '@/lib/utils';
import { postizAPI } from '../../lib/postiz';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { addHours, addMinutes } from 'date-fns';
import { DateTimePicker } from '../ui/datetime-picker';
import { useBulkPost } from '../../contexts/BulkPostContext';

interface BulkPostizPosterProps {
  slideshows: SlideshowMetadata[];
  onClose: () => void;
  onPostSuccess?: (postIds: string[]) => void;
}

export const BulkPostizPoster: React.FC<BulkPostizPosterProps> = ({
  slideshows,
  onClose,
  onPostSuccess
}) => {
  const { startBulkPost, isPosting: isGlobalPosting, jobQueue, lastScheduledTime } = useBulkPost();
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [profiles, setProfiles] = useState<PostizProfile[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);

  // Strategy State
  const [postingStrategy, setPostingStrategy] = useState<'interval' | 'first-now' | 'batch'>('interval');
  const [intervalHours, setIntervalHours] = useState(1.5);
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [startAfterLastBatch, setStartAfterLastBatch] = useState(false);

  // Batch State
  // Batch State
  // const [batchSize, setBatchSize] = useState<number | string>(10);
  const batchSize = 10; // Fixed as per requirements

  const [postIntervalMinutes, setPostIntervalMinutes] = useState<number | string>(1);

  // Validation State
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load Profiles
  useEffect(() => {
    loadProfiles();
  }, []);

  // Update start time when "Start after last batch" is toggled
  useEffect(() => {
    if (startAfterLastBatch && lastScheduledTime) {
      // Add 1.5 hours buffer by default as requested
      const nextStart = addMinutes(lastScheduledTime, 90);
      setStartTime(nextStart);
    } else if (!startAfterLastBatch) {
      setStartTime(new Date());
    }
  }, [startAfterLastBatch, lastScheduledTime]);

  const loadProfiles = async () => {
    try {
      const connectedProfiles = await postizAPI.getProfiles();
      const tiktokProfiles = connectedProfiles.filter(p => p.provider === 'tiktok');
      setProfiles(tiktokProfiles);
      if (tiktokProfiles.length > 0) {
        setSelectedProfiles([tiktokProfiles[0].id]);
      }
    } catch (error) {
      console.error('Failed to load profiles:', error);
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  const handleProfileToggle = (profileId: string) => {
    setSelectedProfiles(prev => {
      if (prev.includes(profileId)) {
        return prev.filter(id => id !== profileId);
      }
      return [...prev, profileId];
    });
  };

  const handleSelectAll = () => {
    if (selectedProfiles.length === profiles.length) {
      setSelectedProfiles([]);
    } else {
      setSelectedProfiles(profiles.map(p => p.id));
    }
  };

  // Generate Schedule Preview (Local only)
  const previewSchedule = useMemo(() => {
    const schedule: any[] = [];
    let currentTime = new Date(startTime);

    const applyScheduleConstraints = (baseTime: Date): Date => {
      let date = new Date(baseTime);
      let hour = date.getHours();

      // If before 9am, move to 9am today
      if (hour < 9) {
        date.setHours(9, 0, 0, 0);
      }
      // If after 10pm (22:00), move to 9am TOMORROW
      else if (hour >= 22) {
        date.setDate(date.getDate() + 1);
        date.setHours(9, 0, 0, 0);
      }

      // Double check - if we moved to tomorrow, make sure we didn't go back in time relative to baseTime (rare edge case)
      if (date < baseTime) {
        date = new Date(baseTime); // fallback
      }
      return date;
    };

    if (postingStrategy === 'first-now') {
      schedule.push({
        slideshowTitle: slideshows[0]?.title || 'Slideshow 1',
        scheduledTime: new Date(),
        isImmediate: true
      });
      for (let i = 1; i < slideshows.length; i++) {
        currentTime = addHours(currentTime, intervalHours);
        currentTime = applyScheduleConstraints(currentTime);
        schedule.push({
          slideshowTitle: slideshows[i]?.title || `Slideshow ${i + 1}`,
          scheduledTime: new Date(currentTime),
          isImmediate: false
        });
      }
    } else if (postingStrategy === 'batch') {
      // Continuous scheduling logic
      let currentScheduledTime = new Date(startTime);
      // Ensure start time respects constraints
      currentScheduledTime = applyScheduleConstraints(currentScheduledTime);

      const safeBatchSize = 10; // Enforce 10 as per requirements
      const safePostIntervalMinutes = Number(postIntervalMinutes) || 240; // Default to 240 mins (4 hours) as per request

      for (let i = 0; i < slideshows.length; i++) {
        const batchIndex = Math.floor(i / safeBatchSize);
        const indexInBatch = i % safeBatchSize;

        // Calculate batch info for display
        let batchInfo = null;
        if (indexInBatch === 0) {
          // Batches sent every 70 mins (1h 10m) to allow buffer over the 1h 7m limit
          const batchSendTime = addMinutes(startTime, batchIndex * 70);
          batchInfo = { number: batchIndex + 1, time: batchSendTime };
        }

        schedule.push({
          slideshowTitle: slideshows[i]?.title || `Slideshow ${i + 1}`,
          scheduledTime: new Date(currentScheduledTime),
          isImmediate: false,
          batchInfo
        });

        // Advance time for the next post
        currentScheduledTime = addMinutes(currentScheduledTime, safePostIntervalMinutes);
        // Re-apply constraints after adding time
        currentScheduledTime = applyScheduleConstraints(currentScheduledTime);
      }
    } else {
      for (let i = 0; i < slideshows.length; i++) {
        currentTime = applyScheduleConstraints(currentTime);
        schedule.push({
          slideshowTitle: slideshows[i]?.title || `Slideshow ${i + 1}`,
          scheduledTime: new Date(currentTime),
          isImmediate: false
        });
        currentTime = addHours(currentTime, intervalHours);
      }
    }
    return schedule;
  }, [slideshows, postingStrategy, intervalHours, startTime, batchSize, postIntervalMinutes]);

  const handleSchedule = () => {
    if (selectedProfiles.length === 0) {
      setValidationError('Please select at least one profile');
      return;
    }

    // Start background process
    startBulkPost(
      slideshows,
      selectedProfiles,
      postingStrategy,
      {
        intervalHours,
        startTime,
        batchSize: Number(batchSize) || 1,
        postIntervalMinutes: Number(postIntervalMinutes) || 0
      }
    );

    if (onPostSuccess) {
      onPostSuccess(slideshows.map(s => s.id));
    }

    // Close modal immediately
    onClose();
  };

  // Helper to get profile name
  const getProfileName = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    return profile ? profile.displayName : 'Unknown Account';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <motion.div
        className="bg-[#09090b] w-full max-w-6xl max-h-[90vh] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <h3 className="text-xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent flex items-center">
            <Send className="w-5 h-5 mr-3 text-primary" />
            Bulk Post to TikTok ({slideshows.length})
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-white/10 rounded-full">
            <X className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* LEFT COLUMN: Strategy & Preview (4 cols) */}
            <div className="lg:col-span-4 space-y-6">

              {/* Strategy Section */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider flex items-center">
                  <Settings className="w-3 h-3 mr-2" />
                  Strategy
                </h4>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setPostingStrategy('interval')}
                    className={cn(
                      "p-2 rounded-xl border text-center transition-all duration-200 relative overflow-hidden group flex flex-col items-center justify-center h-20",
                      postingStrategy === 'interval'
                        ? "border-primary/50 bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.1)]"
                        : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                    )}
                  >
                    <Calendar className={cn(
                      "w-4 h-4 mb-1.5 transition-colors",
                      postingStrategy === 'interval' ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="font-medium text-xs">Interval</span>
                    {postingStrategy === 'interval' && (
                      <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full" />
                    )}
                  </button>

                  <button
                    onClick={() => setPostingStrategy('batch')}
                    className={cn(
                      "p-2 rounded-xl border text-center transition-all duration-200 relative overflow-hidden group flex flex-col items-center justify-center h-20",
                      postingStrategy === 'batch'
                        ? "border-primary/50 bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.1)]"
                        : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                    )}
                  >
                    <Layers className={cn(
                      "w-4 h-4 mb-1.5 transition-colors",
                      postingStrategy === 'batch' ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="font-medium text-xs">Batch</span>
                    {postingStrategy === 'batch' && (
                      <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full" />
                    )}
                  </button>

                  <button
                    onClick={() => setPostingStrategy('first-now')}
                    className={cn(
                      "p-2 rounded-xl border text-center transition-all duration-200 relative overflow-hidden group flex flex-col items-center justify-center h-20",
                      postingStrategy === 'first-now'
                        ? "border-primary/50 bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.1)]"
                        : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                    )}
                  >
                    <Play className={cn(
                      "w-4 h-4 mb-1.5 transition-colors",
                      postingStrategy === 'first-now' ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="font-medium text-xs">1 Now</span>
                    {postingStrategy === 'first-now' && (
                      <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full" />
                    )}
                  </button>
                </div>

                {/* Settings Panel */}
                <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
                  {postingStrategy === 'batch' ? (
                    <div className="space-y-4">
                      {/* Fixed Batch Size Note */}
                      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                        <div className="flex items-start">
                          <Layers className="w-4 h-4 text-blue-400 mt-0.5 mr-2" />
                          <div>
                            <p className="text-xs font-medium text-blue-200">Automatic Batching Active</p>
                            <p className="text-[10px] text-blue-200/70 mt-1">
                              System will automatically send 10 posts every 70 minutes to respect limits.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground block ml-1">Interval Between Posts (Mins)</label>
                        <input
                          type="number"
                          min={1}
                          value={postIntervalMinutes}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') setPostIntervalMinutes('');
                            else setPostIntervalMinutes(parseInt(val));
                          }}
                          placeholder="240"
                          className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-xl focus:border-primary/50 focus:outline-none text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground ml-1">e.g. 240 mins = 4 hours between each post going live</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground block ml-1">Interval Between Posts</label>
                      <Select
                        value={intervalHours.toString()}
                        onValueChange={(value) => setIntervalHours(Number(value))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select interval" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.5">30 minutes</SelectItem>
                          <SelectItem value="1">1 hour</SelectItem>
                          <SelectItem value="1.5">1.5 hours</SelectItem>
                          <SelectItem value="2">2 hours</SelectItem>
                          <SelectItem value="3">3 hours</SelectItem>
                          <SelectItem value="4">4 hours</SelectItem>
                          <SelectItem value="6">6 hours</SelectItem>
                          <SelectItem value="12">12 hours</SelectItem>
                          <SelectItem value="24">24 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground block ml-1">Start Date & Time</label>
                      {lastScheduledTime && (
                        <button
                          onClick={() => setStartAfterLastBatch(!startAfterLastBatch)}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full transition-colors border",
                            startAfterLastBatch
                              ? "bg-primary/20 text-primary border-primary/30"
                              : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
                          )}
                        >
                          Start after last batch
                        </button>
                      )}
                    </div>
                    <DateTimePicker date={startTime} setDate={setStartTime} disabled={startAfterLastBatch} />
                    {startAfterLastBatch && lastScheduledTime && (
                      <p className="text-[10px] text-primary/80 ml-1">
                        Starts 1.5h after previous batch ends ({addMinutes(lastScheduledTime, 90).toLocaleTimeString()})
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Schedule Preview */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider flex items-center">
                  <CalendarDays className="w-3 h-3 mr-2" />
                  Schedule Preview
                </h4>
                <div className="bg-black/40 rounded-xl border border-white/10 overflow-hidden shadow-inner max-h-60 overflow-y-auto custom-scrollbar">
                  <div className="p-3 space-y-2">
                    {previewSchedule.map((item, index) => (
                      <React.Fragment key={index}>
                        {item.batchInfo && (
                          <div className="flex items-center text-xs font-semibold text-primary/70 mt-4 mb-2 first:mt-0 sticky top-0 bg-black/90 backdrop-blur py-1 z-10 border-b border-white/5">
                            <Layers className="w-3 h-3 mr-1.5" />
                            Batch {item.batchInfo.number}
                            <span className="mx-2 text-muted-foreground/50">•</span>
                            <span className="text-muted-foreground font-normal">
                              Starts {item.batchInfo.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                        <div
                          className="flex items-center p-2 rounded-lg border text-xs transition-all duration-300 bg-white/5 border-white/5"
                        >
                          <span className="font-mono text-muted-foreground mr-2">#{index + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium">{item.slideshowTitle}</div>
                            <div className="text-muted-foreground flex items-center mt-0.5">
                              <Clock className="w-3 h-3 mr-1" />
                              {item.isImmediate ? 'Now' : item.scheduledTime.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Accounts & Queue (8 cols) */}
            <div className="lg:col-span-8 space-y-4 flex flex-col">

              {/* Queue Status */}
              {jobQueue.length > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-4">
                  <h4 className="font-medium text-sm text-blue-200 uppercase tracking-wider flex items-center mb-3">
                    <ListOrdered className="w-4 h-4 mr-2" />
                    Active Job Queue ({jobQueue.length})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                    {jobQueue.map((job, idx) => (
                      <div key={job.id} className="flex items-center justify-between text-xs bg-black/20 p-2 rounded border border-white/5">
                        <div className="flex items-center space-x-3">
                          <span className="font-mono text-muted-foreground">#{idx + 1}</span>
                          <div className="flex flex-col">
                            <span className="font-medium text-white/90">
                              {job.payload.slideshows.length} Posts • {job.payload.strategy === 'batch' ? 'Batch Mode' : 'Interval Mode'}
                            </span>
                            <div className="flex items-center space-x-2 text-muted-foreground">
                              <span>Account: {getProfileName(job.payload.profiles[0])}</span>
                              {job.total_batches > 1 && (
                                <>
                                  <span>•</span>
                                  <span className="text-primary/80">Batch {job.batch_index}/{job.total_batches}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-muted-foreground">
                            Starts: {new Date(job.scheduled_start_time).toLocaleString()}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full uppercase text-[10px] font-bold",
                            job.status === 'processing' ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                          )}>
                            {job.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider flex items-center">
                  <User className="w-3 h-3 mr-2" />
                  Select Accounts ({selectedProfiles.length}/{profiles.length})
                </h4>
                {profiles.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    className="h-7 text-xs hover:bg-white/10"
                  >
                    {selectedProfiles.length === profiles.length ? 'Deselect All' : 'Select All'}
                  </Button>
                )}
              </div>

              <div className="flex-1 bg-white/5 rounded-xl border border-white/10 p-4 min-h-[300px]">
                {isLoadingProfiles ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
                    <p>Loading accounts...</p>
                  </div>
                ) : profiles.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-white/10 rounded-lg">
                    <AlertCircle className="w-10 h-10 text-yellow-500 mb-3 opacity-50" />
                    <p>No TikTok accounts found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {profiles.map((profile) => (
                      <motion.label
                        key={profile.id}
                        className={cn(
                          "flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 relative overflow-hidden group",
                          selectedProfiles.includes(profile.id)
                            ? "border-primary/50 bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.1)]"
                            : "border-white/10 bg-black/20 hover:bg-white/5 hover:border-white/20"
                        )}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center transition-colors flex-shrink-0",
                          selectedProfiles.includes(profile.id)
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/50 group-hover:border-white/50"
                        )}>
                          {selectedProfiles.includes(profile.id) && <CheckCircle className="w-3.5 h-3.5" />}
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedProfiles.includes(profile.id)}
                          onChange={() => handleProfileToggle(profile.id)}
                          className="hidden"
                        />
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {profile.avatar ? (
                            <img
                              src={profile.avatar}
                              alt={profile.displayName}
                              className="w-8 h-8 rounded-full ring-2 ring-white/10 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center ring-2 ring-white/10 flex-shrink-0">
                              <User className="w-4 h-4 text-white/70" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-foreground truncate">{profile.displayName}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              @{profile.username}
                            </div>
                          </div>
                        </div>
                      </motion.label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-white/5 flex flex-col gap-4">
          <AnimatePresence>
            {validationError && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="p-4 rounded-xl border bg-red-500/10 border-red-500/30 text-red-200 flex items-center space-x-3"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{validationError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-4">
            <Button
              onClick={handleSchedule}
              disabled={selectedProfiles.length === 0}
              className="flex-1 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white shadow-lg shadow-primary/25 h-12 text-base font-medium rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Send className="w-5 h-5 mr-2" />
              {isGlobalPosting ? 'Add to Queue' : `Schedule ${slideshows.length} Posts`}
            </Button>

            <Button
              variant="ghost"
              onClick={onClose}
              className="h-12 px-8 rounded-xl hover:bg-white/10 border border-transparent hover:border-white/10"
            >
              Cancel
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
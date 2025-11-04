import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { 
  Calendar, 
  Clock, 
  Send, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  User, 
  CalendarDays,
  Image,
  FileText,
  Hash,
  Eye,
  Settings,
  Plus,
  Minus,
  Play
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PostizProfile,
  PostizSlideshowData,
  SlideshowMetadata
} from '../../types';
import { postizAPI } from '../../lib/postiz';
import { slideshowService } from '../../lib/slideshowService';
import { postizUploadService } from '../../lib/postizUploadService';

interface BulkPostizPosterProps {
  slideshows: SlideshowMetadata[];
  onPostSuccess?: (postIds: string[]) => void;
  onClose?: () => void;
}

interface PostingSchedule {
  slideshowId: string;
  slideshowTitle: string;
  scheduledTime: Date;
  status: 'pending' | 'posting' | 'success' | 'error';
  postId?: string;
  error?: string;
}

export const BulkPostizPoster: React.FC<BulkPostizPosterProps> = ({
  slideshows,
  onPostSuccess,
  onClose
}) => {
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [profiles, setProfiles] = useState<PostizProfile[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  
  // Posting strategy state
  const [postingStrategy, setPostingStrategy] = useState<'interval' | 'first-now'>('interval');
  const [intervalHours, setIntervalHours] = useState(1);
  const [startTime, setStartTime] = useState(() => {
    // Default to 1 hour from now
    const now = new Date();
    now.setHours(now.getHours() + 1);
    return now.toISOString().slice(0, 16); // Format for datetime-local input
  });

  // Posting schedule state
  const [postingSchedule, setPostingSchedule] = useState<PostingSchedule[]>([]);
  const [currentPostIndex, setCurrentPostIndex] = useState(0);

  // Auto-hide notifications
  const [postResult, setPostResult] = useState<{
    success: boolean;
    message: string;
    completedPosts: number;
    totalPosts: number;
  } | null>(null);

  useEffect(() => {
    loadProfiles();
    generatePostingSchedule();
  }, [slideshows, postingStrategy, intervalHours, startTime]);

  const loadProfiles = async () => {
    setIsLoadingProfiles(true);
    try {
      const loadedProfiles = await postizAPI.getProfiles();
      
      // Filter for TikTok profiles
      const tiktokProfiles = loadedProfiles.filter(profile => {
        const provider = profile.provider?.toLowerCase() || '';
        const displayName = profile.displayName?.toLowerCase() || '';
        const username = profile.username?.toLowerCase() || '';
        
        const isTikTok = provider.includes('tiktok') ||
                        displayName.includes('tiktok') ||
                        username.includes('tiktok') ||
                        provider === 'tt' ||
                        displayName.includes('tt') ||
                        provider === 'social';
        
        return isTikTok;
      });
      
      const finalProfiles = tiktokProfiles.length > 0 ? tiktokProfiles : loadedProfiles;
      
      if (finalProfiles.length === 0) {
        setPostResult({
          success: false,
          message: 'No accounts found. Please check your Postiz API key and ensure accounts are connected.',
          completedPosts: 0,
          totalPosts: 0
        });
      }
      
      setProfiles(finalProfiles);
      
      // Auto-select first profile if only one exists
      if (finalProfiles.length === 1) {
        setSelectedProfiles([finalProfiles[0].id]);
      }
    } catch (error) {
      setPostResult({
        success: false,
        message: (error instanceof Error && error.message.includes('CORS'))
          ? 'CORS issue detected. The browser was blocking requests to Postiz API. This has been fixed with a proxy solution.'
          : 'Failed to load TikTok profiles. Please check your API key.',
        completedPosts: 0,
        totalPosts: 0
      });
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  const generatePostingSchedule = () => {
    if (!startTime) return;

    const schedule: PostingSchedule[] = [];

    if (postingStrategy === 'first-now') {
      // First post now, rest at intervals from first post time
      const now = new Date();
      schedule.push({
        slideshowId: slideshows[0].id,
        slideshowTitle: slideshows[0].title,
        scheduledTime: now,
        status: 'pending'
      });

      // Generate subsequent posts from first post time (now)
      let currentTime = new Date(now);

      for (let i = 1; i < slideshows.length; i++) {
        // Move to next interval
        currentTime = new Date(currentTime.getTime() + (intervalHours * 60 * 60 * 1000));

        // Apply time constraints and continue from adjusted time
        currentTime = applyScheduleConstraints(currentTime);

        // If after 10pm, move to next day at 9am
        if (currentTime.getHours() > 22) {
          currentTime.setDate(currentTime.getDate() + 1);
          currentTime.setHours(9, 0, 0, 0);
        }

        schedule.push({
          slideshowId: slideshows[i].id,
          slideshowTitle: slideshows[i].title,
          scheduledTime: currentTime,
          status: 'pending'
        });
      }
    } else {
      // All posts scheduled at intervals from start time
      let currentTime = new Date(startTime);

      for (let i = 0; i < slideshows.length; i++) {
        // Apply time constraints and continue from adjusted time
        currentTime = applyScheduleConstraints(currentTime);

        // If after 10pm, move to next day at 9am
        if (currentTime.getHours() > 22) {
          currentTime.setDate(currentTime.getDate() + 1);
          currentTime.setHours(9, 0, 0, 0);
        }

        schedule.push({
          slideshowId: slideshows[i].id,
          slideshowTitle: slideshows[i].title,
          scheduledTime: currentTime,
          status: 'pending'
        });

        // Move to next interval
        currentTime = new Date(currentTime.getTime() + (intervalHours * 60 * 60 * 1000));
      }
    }

    setPostingSchedule(schedule);
  };

  const applyScheduleConstraints = (baseTime: Date): Date => {
    const hour = baseTime.getHours();
    
    // If scheduled time falls in the forbidden window (12am-9am)
    if (hour >= 0 && hour < 9) {
      // Move to 9am on the same day
      const adjustedTime = new Date(baseTime);
      adjustedTime.setHours(9, 0, 0, 0);
      return adjustedTime;
    }
    
    return baseTime;
  };

  const handleProfileToggle = (profileId: string) => {
    setSelectedProfiles(prev => 
      prev.includes(profileId) 
        ? prev.filter(id => id !== profileId)
        : [...prev, profileId]
    );
  };

  const handleSelectAll = () => {
    if (selectedProfiles.length === profiles.length) {
      setSelectedProfiles([]);
    } else {
      setSelectedProfiles(profiles.map(p => p.id));
    }
  };

  const validateForm = (): string | null => {
    if (slideshows.length === 0) return 'No slideshows selected';
    
    if (selectedProfiles.length === 0) {
      return 'Please select at least one TikTok account';
    }

    // Check if all slideshows have condensed slides
    const invalidSlideshows = slideshows.filter(s => !s.condensedSlides || s.condensedSlides.length === 0);
    if (invalidSlideshows.length > 0) {
      return `${invalidSlideshows.length} slideshow(s) have no images to post`;
    }

    // Validate start time for interval scheduling
    if (postingStrategy === 'interval') {
      const startDate = new Date(startTime);
      if (startDate <= new Date()) {
        return 'Start time must be in the future for scheduled posting';
      }
    }

    return null;
  };

  const postSingleSlideshow = async (
    slideshow: SlideshowMetadata, 
    scheduledAt?: Date,
    postNow: boolean = false
  ): Promise<{ success: boolean; postId?: string; error?: string }> => {
    try {
      console.log(`📤 Posting slideshow: ${slideshow.title}`, {
        scheduledAt: scheduledAt?.toISOString(),
        postNow,
        profiles: selectedProfiles,
        originalCaption: slideshow.caption // Log original for debugging
      });

      const captionText = slideshowService.formatCaptionForBuffer(slideshow.caption, slideshow.hashtags);
      
      // Upload images to Postiz storage
      const postizMedia = await postizUploadService.uploadImagesToPostizStorage(slideshow);
      
      if (postizMedia.length === 0) {
        throw new Error('No images were successfully uploaded to Postiz storage');
      }

      // Log slideshow preparation for debugging
      console.log(`🎬 Posting slideshow: ${slideshow.title}`, {
        aspectRatio: slideshow.aspectRatio,
        slidesCount: slideshow.condensedSlides.length,
        captionLength: captionText.length,
        uploadedImages: postizMedia.length
      });

      // Create the post using Postiz image gallery URLs
      const result = await postizUploadService.createPostWithUploadedImages(
        captionText,
        selectedProfiles[0], // Use first selected profile
        postizMedia,
        scheduledAt,
        postNow
      );

      console.log(`✅ Successfully posted slideshow: ${slideshow.title}`, {
        postId: result.postId,
        aspectRatio: slideshow.aspectRatio
      });

      return {
        success: true,
        postId: result.postId
      };

    } catch (error) {
      console.error(`Failed to post slideshow ${slideshow.title}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  const handleBulkPost = async () => {
    const validationError = validateForm();
    if (validationError) {
      setPostResult({ 
        success: false, 
        message: validationError, 
        completedPosts: 0, 
        totalPosts: slideshows.length 
      });
      return;
    }

    setIsPosting(true);
    setCurrentPostIndex(0);

    try {
      let completedCount = 0;
      const postIds: string[] = [];

      for (let i = 0; i < postingSchedule.length; i++) {
        const scheduleItem = postingSchedule[i];
        setCurrentPostIndex(i);
        
        // Update status to posting
        setPostingSchedule(prev => prev.map((item, index) => 
          index === i ? { ...item, status: 'posting' as const } : item
        ));

        // Find the slideshow
        const slideshow = slideshows.find(s => s.id === scheduleItem.slideshowId);
        if (!slideshow) {
          throw new Error(`Slideshow not found: ${scheduleItem.slideshowId}`);
        }

        // Determine if this should be posted now or scheduled
        const shouldPostNow = postingStrategy === 'first-now' && i === 0;
        const scheduledAt = shouldPostNow ? undefined : scheduleItem.scheduledTime;

        // Post the slideshow
        const result = await postSingleSlideshow(slideshow, scheduledAt, shouldPostNow);

        if (result.success) {
          // Update status to success
          setPostingSchedule(prev => prev.map((item, index) => 
            index === i ? { 
              ...item, 
              status: 'success' as const, 
              postId: result.postId 
            } : item
          ));
          postIds.push(result.postId!);
        } else {
          // Update status to error
          setPostingSchedule(prev => prev.map((item, index) => 
            index === i ? { 
              ...item, 
              status: 'error' as const, 
              error: result.error 
            } : item
          ));
        }

        completedCount++;

        // Update overall progress
        setPostResult({
          success: completedCount === slideshows.length,
          message: completedCount === slideshows.length 
            ? `🎉 Successfully posted all ${completedCount} slideshow(s)!`
            : `📤 Posted ${completedCount}/${slideshows.length} slideshow(s)...`,
          completedPosts: completedCount,
          totalPosts: slideshows.length
        });
      }

      if (onPostSuccess && postIds.length > 0) {
        onPostSuccess(postIds);
      }

    } catch (error: any) {
      console.error('Bulk posting failed:', error);
      setPostResult({
        success: false,
        message: `❌ Bulk posting failed: ${error.message}`,
        completedPosts: currentPostIndex,
        totalPosts: slideshows.length
      });
    } finally {
      setIsPosting(false);
    }
  };

  const getSchedulePreview = () => {
    return postingSchedule.map((item, index) => {
      const isNow = postingStrategy === 'first-now' && index === 0;
      const timeStr = isNow ? 'Now' : item.scheduledTime.toLocaleString();
      
      return {
        ...item,
        displayTime: timeStr,
        isImmediate: isNow
      };
    });
  };

  if (slideshows.length === 0) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-8 h-8 mx-auto text-yellow-500 mb-2" />
        <p className="text-muted-foreground">No slideshows selected</p>
      </div>
    );
  }

  return (
    <div className="max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border/50 pb-2 -mx-4 px-4 py-2 z-10 shadow-lg">
        <h3 className="text-lg font-semibold text-foreground flex items-center">
          <Send className="w-5 h-5 mr-2 text-primary" />
          Bulk Post to TikTok ({slideshows.length})
        </h3>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all duration-200">
            ×
          </Button>
        )}
      </div>

      {/* Slideshows Overview */}
      <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 shadow-xl overflow-hidden mb-4 hover-lift">
        {/* Header */}
        <div className="bg-card/50 px-4 py-3 border-b border-border/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="flex items-center justify-center w-8 h-8 bg-primary/20 rounded-lg">
                <Image className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground">Bulk Posts ({slideshows.length})</h4>
                <p className="text-xs text-muted-foreground">
                  Ready for scheduling
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-emerald-500">Captions Preserved</span>
            </div>
          </div>
        </div>

        {/* Slideshows Grid */}
        <div className="p-4">
          <div className="grid grid-cols-1 gap-2">
            {slideshows.map((slideshow, index) => (
              <div key={slideshow.id} className="bg-accent/20 rounded-lg border border-border/30 p-3 hover:bg-accent/30 transition-all duration-200 hover-lift">
                <div className="flex items-center space-x-3">
                  {/* Image Preview */}
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-accent/30 border border-border/50 flex items-center justify-center overflow-hidden">
                      {slideshow.condensedSlides && slideshow.condensedSlides[0] ? (
                        <img
                          src={slideshow.condensedSlides[0].condensedImageUrl || slideshow.condensedSlides[0].originalImageUrl}
                          alt="Slide preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Play className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h5 className="font-medium text-foreground truncate text-sm" title={slideshow.title}>
                          {slideshow.title}
                        </h5>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {slideshow.condensedSlides?.length || 0} slides
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {slideshow.aspectRatio}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-muted-foreground">#{index + 1}</span>
                        <div className="w-2 h-2 bg-emerald-500 rounded-full pulse-glow"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Footer */}
        <div className="bg-accent/20 px-4 py-3 border-t border-border/30">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-3 text-muted-foreground">
              <span>Total Slides: {slideshows.reduce((sum, s) => sum + (s.condensedSlides?.length || 0), 0)}</span>
              <span>•</span>
              <span>Aspect Ratios: {Array.from(new Set(slideshows.map(s => s.aspectRatio))).join(', ')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* TikTok Profiles Selection */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-foreground flex items-center">
            <User className="w-4 h-4 mr-2 text-primary" />
            TikTok Accounts ({profiles.length})
          </h4>
          {profiles.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground hover-lift transition-all duration-200"
            >
              {selectedProfiles.length === profiles.length ? 'Deselect All' : 'Select All'}
            </Button>
          )}
        </div>

        {isLoadingProfiles ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin mr-2 text-primary" />
            <span className="text-sm text-muted-foreground">Loading accounts...</span>
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-4">
            <AlertCircle className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              No accounts found
            </p>
            <p className="text-xs text-muted-foreground">
              Connect accounts in Postiz dashboard
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {profiles.map((profile) => (
              <label
                key={profile.id}
                className={cn(
                  "flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 hover-lift",
                  selectedProfiles.includes(profile.id)
                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/25"
                    : "border-border/50 hover:border-primary/50 hover:bg-accent/30"
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedProfiles.includes(profile.id)}
                  onChange={() => handleProfileToggle(profile.id)}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-primary focus:ring-2"
                />
                <div className="flex items-center space-x-3 flex-1">
                  {profile.avatar && (
                    <img
                      src={profile.avatar}
                      alt={profile.displayName}
                      className="w-6 h-6 rounded-full border border-border/50"
                    />
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-foreground text-sm">{profile.displayName}</div>
                    <div className="text-xs text-muted-foreground">
                      @{profile.username}
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Posting Strategy */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 bg-primary/20 rounded-lg">
            <Settings className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-foreground">Posting Strategy</h4>
            <p className="text-xs text-muted-foreground">Choose how to schedule posts</p>
          </div>
        </div>
        
        {/* Strategy Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => setPostingStrategy('interval')}
            className={cn(
              "p-4 rounded-lg border-2 text-left transition-all duration-200 hover-lift",
              postingStrategy === 'interval'
                ? "border-primary bg-primary/10 shadow-lg shadow-primary/25"
                : "border-border/50 hover:border-primary/50 hover:bg-accent/30"
            )}
          >
            <div className="flex items-center space-x-2 mb-2">
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200",
                postingStrategy === 'interval'
                  ? "bg-primary shadow-lg"
                  : "bg-accent/50 group-hover:bg-primary/20"
              )}>
                <Calendar className={cn(
                  "w-4 h-4 transition-colors duration-200",
                  postingStrategy === 'interval' ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"
                )} />
              </div>
              <div>
                <h5 className="font-medium text-foreground text-sm">Schedule All</h5>
                <p className="text-xs text-muted-foreground">Time intervals from start</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <CheckCircle className="w-3 h-3 text-emerald-500" />
              <span>Automated scheduling</span>
            </div>
          </button>

          <button
            onClick={() => setPostingStrategy('first-now')}
            className={cn(
              "p-4 rounded-lg border-2 text-left transition-all duration-200 hover-lift",
              postingStrategy === 'first-now'
                ? "border-primary bg-primary/10 shadow-lg shadow-primary/25"
                : "border-border/50 hover:border-primary/50 hover:bg-accent/30"
            )}
          >
            <div className="flex items-center space-x-2 mb-2">
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200",
                postingStrategy === 'first-now'
                  ? "bg-primary shadow-lg"
                  : "bg-accent/50 group-hover:bg-primary/20"
              )}>
                <Play className={cn(
                  "w-4 h-4 transition-colors duration-200",
                  postingStrategy === 'first-now' ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"
                )} />
              </div>
              <div>
                <h5 className="font-medium text-foreground text-sm">Post 1 Now</h5>
                <p className="text-xs text-muted-foreground">Immediate + schedule rest</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <CheckCircle className="w-3 h-3 text-emerald-500" />
              <span>Instant engagement</span>
            </div>
          </button>
        </div>

        {/* Interval Settings */}
        <div className="bg-accent/20 rounded-lg border border-border/50 p-4 hover-lift">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Interval Between Posts</label>
              <select
                value={intervalHours}
                onChange={(e) => setIntervalHours(Number(e.target.value))}
                className="w-full px-3 py-2 bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-sm input-modern"
              >
                <option value={0.5}>30 minutes</option>
                <option value={1}>1 hour</option>
                <option value={1.5}>1.5 hours</option>
                <option value={2}>2 hours</option>
                <option value={2.5}>2.5 hours</option>
                <option value={3}>3 hours</option>
                <option value={4}>4 hours</option>
                <option value={6}>6 hours</option>
                <option value={12}>12 hours</option>
                <option value={24}>24 hours</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Optimal: 3-6 hours
              </p>
            </div>

            {postingStrategy === 'interval' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">Start Time</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-3 py-2 bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-sm input-modern"
                />
                <p className="text-xs text-muted-foreground">
                  Schedule start time
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schedule Preview */}
      <div className="space-y-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 bg-primary/20 rounded-lg">
            <Eye className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-foreground">Schedule Preview</h4>
            <p className="text-xs text-muted-foreground">Review timeline before posting</p>
          </div>
        </div>
        
        {/* Schedule Constraints Notice */}
        <div className="bg-accent/20 border border-border/50 rounded-lg p-3 hover-lift">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-6 h-6 bg-primary/20 rounded-lg flex items-center justify-center">
              <Clock className="w-3 h-3 text-primary" />
            </div>
            <div>
              <div className="font-medium text-foreground mb-2 text-sm">Schedule Rules</div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div>• Posts every {intervalHours} hours (9am-10pm)</div>
                <div>• Posts after 10pm → next day at 9am</div>
                <div>• No posts 12am-9am</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Schedule Timeline */}
        <div className="bg-accent/20 rounded-lg border border-border/50 p-4 hover-lift">
          {getSchedulePreview().length === 0 ? (
            <div className="text-center py-6">
              <AlertCircle className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
              <h5 className="font-medium text-foreground mb-2 text-sm">No Posts Scheduled</h5>
              <p className="text-xs text-muted-foreground">
                Adjust settings to schedule posts
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {getSchedulePreview().map((item, index) => (
                <div key={item.slideshowId} className="bg-card/50 rounded-lg border border-border/30 p-3 hover:bg-accent/20 transition-all duration-200 hover-lift">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center justify-center w-6 h-6 bg-primary/20 rounded-lg">
                        <span className="text-xs font-medium text-primary">{index + 1}</span>
                      </div>
                      <div>
                        <h6 className="font-medium text-foreground text-xs">{item.slideshowTitle}</h6>
                        <div className="flex items-center space-x-1 mt-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {item.isImmediate ? 'Post now' : item.displayTime}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {item.status === 'pending' && (
                        <div className="flex items-center space-x-1 text-emerald-500">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full pulse-glow"></div>
                          <span className="text-xs">Pending</span>
                        </div>
                      )}
                      {item.status === 'posting' && (
                        <div className="flex items-center space-x-1 text-primary">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span className="text-xs">Posting</span>
                        </div>
                      )}
                      {item.status === 'success' && (
                        <div className="flex items-center space-x-1 text-emerald-500">
                          <CheckCircle className="w-3 h-3" />
                          <span className="text-xs">Success</span>
                        </div>
                      )}
                      {item.status === 'error' && (
                        <div className="flex items-center space-x-1 text-destructive">
                          <AlertCircle className="w-3 h-3" />
                          <span className="text-xs">Error</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Skipped Posts Notice */}
        {slideshows.length > postingSchedule.length && (
          <div className="bg-accent/20 border border-border/50 rounded-lg p-3 hover-lift">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="font-medium text-foreground text-sm">Posts Adjusted</div>
                <div className="text-xs text-muted-foreground">
                  {slideshows.length - postingSchedule.length} post(s) moved to next day 9am
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Post Result */}
      {postResult && (
        <div className={cn(
          "p-3 rounded-lg border space-y-2",
          postResult.success
            ? "bg-green-900/20 border-green-700 text-green-200"
            : "bg-red-900/20 border-red-700 text-red-200"
        )}>
          <div className="flex items-center space-x-2">
            {postResult.success ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">
              {postResult.success ? 'Success!' : 'Error'}
            </span>
          </div>

          <div className="text-sm">
            {postResult.message}
          </div>

          {postResult.completedPosts > 0 && postResult.totalPosts > 0 && (
            <div className="text-xs text-slate-400">
              Progress: {postResult.completedPosts}/{postResult.totalPosts} completed
            </div>
          )}
        </div>
      )}

      <Separator />

      {/* Action Buttons - Sticky at bottom */}
      <div className="sticky bottom-0 bg-card/95 backdrop-blur-sm border-t border-border/50 pt-4 -mx-4 px-4 shadow-xl">
        <div className="flex gap-3">
          <Button
            onClick={handleBulkPost}
            disabled={isPosting || selectedProfiles.length === 0 || slideshows.length === 0}
            className="flex-1 btn-modern bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium py-2 shadow-lg hover:shadow-xl transition-all duration-300"
          >
            {isPosting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Posting ({currentPostIndex + 1}/{slideshows.length})...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                {postingStrategy === 'first-now' ? 'Post & Schedule' : 'Schedule All Posts'}
              </>
            )}
          </Button>

          {onClose && (
            <Button variant="outline" onClick={onClose} className="px-4 border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground hover-lift transition-all duration-200">
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
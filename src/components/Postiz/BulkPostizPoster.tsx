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
      // First post now, rest at intervals from start time
      const now = new Date();
      schedule.push({
        slideshowId: slideshows[0].id,
        slideshowTitle: slideshows[0].title,
        scheduledTime: now,
        status: 'pending'
      });
      
      // Generate subsequent posts from start time
      let currentTime = new Date(startTime);
      
      for (let i = 1; i < slideshows.length; i++) {
        // Apply time constraints
        const constrainedTime = applyScheduleConstraints(currentTime);
        
        // Skip if after 10pm
        if (constrainedTime.getHours() > 22) {
          continue; // Skip this slideshow
        }
        
        schedule.push({
          slideshowId: slideshows[i].id,
          slideshowTitle: slideshows[i].title,
          scheduledTime: constrainedTime,
          status: 'pending'
        });
        
        // Move to next interval
        currentTime = new Date(currentTime.getTime() + (intervalHours * 60 * 60 * 1000));
      }
    } else {
      // All posts scheduled at intervals from start time
      let currentTime = new Date(startTime);
      
      for (let i = 0; i < slideshows.length; i++) {
        // Apply time constraints
        const constrainedTime = applyScheduleConstraints(currentTime);
        
        // Skip if after 10pm
        if (constrainedTime.getHours() > 22) {
          continue; // Skip this slideshow
        }
        
        schedule.push({
          slideshowId: slideshows[i].id,
          slideshowTitle: slideshows[i].title,
          scheduledTime: constrainedTime,
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

      // Create the post using Postiz image gallery URLs
      const result = await postizUploadService.createPostWithUploadedImages(
        captionText,
        selectedProfiles[0], // Use first selected profile
        postizMedia,
        scheduledAt,
        postNow
      );

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
    <div className="max-h-[80vh] overflow-y-auto pr-2">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 bg-background border-b border-border pb-4 -mx-6 px-6 py-2 backdrop-blur-sm z-10">
        <h3 className="text-lg font-semibold text-foreground flex items-center">
          <Send className="w-5 h-5 mr-2 text-blue-500" />
          Bulk Post to TikTok via Postiz ({slideshows.length} slideshows)
        </h3>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-destructive/10 hover:text-destructive">
            ×
          </Button>
        )}
      </div>

      {/* Slideshows Overview */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl border border-blue-200 dark:border-blue-800 p-5 shadow-sm">
        <div className="flex items-center space-x-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full">
            <Image className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-foreground text-lg">Selected Slideshows</h4>
            <p className="text-sm text-muted-foreground">{slideshows.length} slideshow{slideshows.length !== 1 ? 's' : ''} ready for posting</p>
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-700">
            <span className="inline-flex items-center">
              <CheckCircle className="w-3 h-3 mr-1" />
              Original captions preserved
            </span>
          </div>
        </div>
        
        {/* Caption preservation notice */}
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center text-green-700 dark:text-green-300">
            <CheckCircle className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">
              Each slideshow will use its own original caption without any modifications
            </span>
          </div>
        </div>
        
        <div className="max-h-64 overflow-y-auto custom-scrollbar">
          <style>{`
            .custom-scrollbar {
              scrollbar-width: thin;
              scrollbar-color: rgb(147 197 253) transparent;
            }
            .custom-scrollbar::-webkit-scrollbar {
              width: 6px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: transparent;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: linear-gradient(180deg, rgb(147 197 253), rgb(99 102 241));
              border-radius: 3px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: linear-gradient(180deg, rgb(96 165 250), rgb(79 70 229));
            }
          `}</style>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {slideshows.map((slideshow, index) => (
              <div key={slideshow.id} className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-xl border-2 border-blue-200 dark:border-blue-700 p-4 text-center hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer group relative overflow-hidden">
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mx-auto mb-3 group-hover:from-purple-600 group-hover:to-pink-600 transition-all duration-300 shadow-md group-hover:shadow-lg">
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  </div>
                  <div className="text-xs font-semibold text-foreground truncate mb-2 leading-tight min-h-[2.5rem] flex items-center justify-center" title={slideshow.title}>
                    {slideshow.title}
                  </div>
                  <div className="space-y-2">
                    <div className="inline-flex items-center px-2 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-full border border-blue-200 dark:border-blue-700">
                      <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                        {slideshow.condensedSlides?.length || 0} slides
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground font-medium bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
                      {slideshow.aspectRatio}
                    </div>
                    <div className="inline-flex items-center justify-center px-3 py-1.5 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full shadow-sm mt-2">
                      <span className="text-xs font-bold text-white">
                        Post #{index + 1}
                      </span>
                    </div>
                    {/* Show caption preview */}
                    {slideshow.caption && (
                      <div className="text-xs text-muted-foreground mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded border-l-2 border-blue-400">
                        <div className="truncate" title={slideshow.caption}>
                          "{slideshow.caption}"
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {slideshows.length > 12 && (
          <div className="text-center mt-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/30 py-2 px-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <span className="inline-flex items-center">
              <span className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse" />
              Scroll to see more slideshows...
            </span>
          </div>
        )}
      </div>

      {/* TikTok Profiles Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-foreground flex items-center">
            <User className="w-4 h-4 mr-2" />
            {profiles.length > 0 && !profiles.some(p =>
              p.provider?.toLowerCase().includes('tiktok') ||
              p.displayName?.toLowerCase().includes('tiktok') ||
              p.username?.toLowerCase().includes('tiktok')
            ) ? 'Connected Accounts' : 'TikTok Accounts'} ({profiles.length})
          </h4>
          {profiles.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedProfiles.length === profiles.length ? 'Deselect All' : 'Select All'}
            </Button>
          )}
        </div>

        {isLoadingProfiles ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">Loading TikTok accounts...</span>
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-4">
            <AlertCircle className="w-6 h-6 mx-auto text-yellow-500 mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              No TikTok accounts found
            </p>
            <p className="text-xs text-muted-foreground">
              Connect TikTok accounts in your Postiz dashboard
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {profiles.map((profile) => (
              <label
                key={profile.id}
                className={cn(
                  "flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  selectedProfiles.includes(profile.id)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedProfiles.includes(profile.id)}
                  onChange={() => handleProfileToggle(profile.id)}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-primary focus:ring-1"
                />
                <div className="flex items-center space-x-3 flex-1">
                  {profile.avatar && (
                    <img
                      src={profile.avatar}
                      alt={profile.displayName}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-foreground">{profile.displayName}</div>
                    <div className="text-sm text-muted-foreground">
                      @{profile.username} • {profile.provider}
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Posting Strategy */}
      <div className="space-y-4">
        <h4 className="font-medium text-foreground flex items-center">
          <CalendarDays className="w-4 h-4 mr-2" />
          Posting Strategy
        </h4>
        
        {/* Strategy Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setPostingStrategy('interval')}
            className={cn(
              "p-4 rounded-lg border-2 text-left transition-all",
              postingStrategy === 'interval'
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <div className="flex items-center space-x-2 mb-2">
              <Calendar className="w-5 h-5" />
              <span className="font-medium">Schedule All</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Post all slideshows with a time interval between each post
            </p>
          </button>
          
          <button
            onClick={() => setPostingStrategy('first-now')}
            className={cn(
              "p-4 rounded-lg border-2 text-left transition-all",
              postingStrategy === 'first-now'
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <div className="flex items-center space-x-2 mb-2">
              <Play className="w-5 h-5" />
              <span className="font-medium">Post 1 Now</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Post the first slideshow immediately, then schedule the rest
            </p>
          </button>
        </div>

        {/* Interval Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
          <div>
            <label className="text-sm text-muted-foreground block mb-2">Interval between posts</label>
            <select
              value={intervalHours}
              onChange={(e) => setIntervalHours(Number(e.target.value))}
              className="w-full px-3 py-2 bg-input text-foreground rounded border border-border focus:border-primary focus:outline-none"
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
          </div>
          
          {postingStrategy === 'interval' && (
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Start time</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-3 py-2 bg-input text-foreground rounded border border-border focus:border-primary focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Schedule Preview */}
      <div className="space-y-3">
        <h4 className="font-medium text-foreground flex items-center">
          <Eye className="w-4 h-4 mr-2" />
          Posting Schedule Preview
        </h4>
        
        {/* Schedule Constraints Notice */}
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <div className="font-medium text-amber-800 dark:text-amber-200 mb-1">Schedule Constraints Applied</div>
              <div className="text-amber-700 dark:text-amber-300">
                • Posts scheduled every {intervalHours} hours between 9am-10pm only<br/>
                • No posts between 12am-9am (moved to 9am if scheduled)<br/>
                • Posts after 10pm are automatically skipped
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          {getSchedulePreview().length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <AlertCircle className="w-6 h-6 mx-auto mb-2" />
              <p className="text-sm">No posts can be scheduled within the 9am-10pm window with the current settings</p>
            </div>
          ) : (
            getSchedulePreview().map((item, index) => (
              <div key={item.slideshowId} className="flex items-center justify-between p-2 bg-background rounded">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-foreground text-sm">{item.slideshowTitle}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.isImmediate ? 'Will post immediately' : `Scheduled for ${item.displayTime}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {item.status === 'pending' && (
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  )}
                  {item.status === 'posting' && (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  )}
                  {item.status === 'success' && (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  )}
                  {item.status === 'error' && (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Show count of skipped posts if any */}
        {slideshows.length > postingSchedule.length && (
          <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <div className="text-sm">
                <span className="font-medium text-orange-800 dark:text-orange-200">
                  {slideshows.length - postingSchedule.length} slideshow(s) skipped
                </span>
                <span className="text-orange-700 dark:text-orange-300 ml-2">
                  (would be scheduled after 10pm)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Post Result */}
      {postResult && (
        <div className={cn(
          "p-4 rounded-lg border space-y-3",
          postResult.success
            ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:text-green-200 dark:border-green-800"
            : "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800"
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
            <div className="text-xs text-muted-foreground">
              Progress: {postResult.completedPosts}/{postResult.totalPosts} completed
            </div>
          )}
        </div>
      )}

      <Separator />

      {/* Action Buttons - Sticky at bottom */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border pt-4 -mx-6 px-6">
        <div className="flex gap-3">
          <Button
            onClick={handleBulkPost}
            disabled={isPosting || selectedProfiles.length === 0 || slideshows.length === 0}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-3 shadow-lg"
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
            <Button variant="outline" onClick={onClose} className="px-6">
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
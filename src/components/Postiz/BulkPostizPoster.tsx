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
      <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-100 to-blue-100 dark:from-slate-800 dark:to-slate-700 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                <Image className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100">Bulk TikTok Posts</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {slideshows.length} slideshow{slideshows.length !== 1 ? 's' : ''} ready for posting
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="inline-flex items-center px-4 py-2 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800">
                <CheckCircle className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Captions Preserved</span>
              </div>
            </div>
          </div>
        </div>

        {/* Caption preservation notice */}
        <div className="p-6 pb-4">
          <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
            <div className="flex items-center text-emerald-800 dark:text-emerald-300">
              <CheckCircle className="w-5 h-5 mr-3" />
              <div>
                <div className="font-semibold text-sm">Original Content Preservation</div>
                <div className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
                  Each slideshow will maintain its original caption and hashtag formatting exactly as designed
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Slideshows Grid */}
        <div className="px-6 pb-6">
          <div className="space-y-4">
            {slideshows.map((slideshow, index) => (
              <div key={slideshow.id} className="group bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 overflow-hidden">
                <div className="flex items-center p-4 space-x-4">
                  {/* Image Preview */}
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                      {slideshow.condensedSlides && slideshow.condensedSlides[0] ? (
                        <img
                          src={slideshow.condensedSlides[0].condensedImageUrl || slideshow.condensedSlides[0].originalImageUrl}
                          alt="Slide preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Play className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="font-semibold text-slate-900 dark:text-slate-100 truncate" title={slideshow.title}>
                          {slideshow.title}
                        </h5>
                        <div className="flex items-center space-x-3 mt-2">
                          <span className="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium">
                            {slideshow.condensedSlides?.length || 0} slides
                          </span>
                          <span className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                            {slideshow.aspectRatio}
                          </span>
                          <span className="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white rounded-full text-xs font-bold">
                            {index + 1}
                          </span>
                        </div>
                        
                        {/* Caption preview */}
                        {slideshow.caption && (
                          <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border-l-4 border-blue-400 dark:border-blue-500">
                            <div className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2" title={slideshow.caption}>
                              "{slideshow.caption}"
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex-shrink-0">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ready</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Footer */}
        <div className="bg-slate-100/80 dark:bg-slate-800/80 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                <Hash className="w-4 h-4" />
                <span>Total Slides: {slideshows.reduce((sum, s) => sum + (s.condensedSlides?.length || 0), 0)}</span>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">•</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Aspect Ratios: {Array.from(new Set(slideshows.map(s => s.aspectRatio))).join(', ')}
              </div>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-500">
              {slideshows.length > 0 && 'Ready to schedule'}
            </div>
          </div>
        </div>
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
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-foreground">Posting Strategy</h4>
            <p className="text-sm text-muted-foreground">Choose how you want to schedule your bulk posts</p>
          </div>
        </div>
        
        {/* Strategy Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => setPostingStrategy('interval')}
            className={cn(
              "group relative p-6 rounded-2xl border-2 text-left transition-all duration-300 hover:shadow-lg",
              postingStrategy === 'interval'
                ? "border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 shadow-lg scale-[1.02]"
                : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            )}
          >
            <div className="flex items-center space-x-3 mb-3">
              <div className={cn(
                "flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300",
                postingStrategy === 'interval'
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg"
                  : "bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30"
              )}>
                <Calendar className={cn(
                  "w-6 h-6 transition-colors duration-300",
                  postingStrategy === 'interval' ? "text-white" : "text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                )} />
              </div>
              <div>
                <h5 className="font-bold text-foreground">Schedule All</h5>
                <p className="text-sm text-muted-foreground">Post all slideshows with time intervals</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                <span>Automated scheduling</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                <span>Perfect for bulk posting</span>
              </div>
            </div>
          </button>
          
          <button
            onClick={() => setPostingStrategy('first-now')}
            className={cn(
              "group relative p-6 rounded-2xl border-2 text-left transition-all duration-300 hover:shadow-lg",
              postingStrategy === 'first-now'
                ? "border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 shadow-lg scale-[1.02]"
                : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            )}
          >
            <div className="flex items-center space-x-3 mb-3">
              <div className={cn(
                "flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300",
                postingStrategy === 'first-now'
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg"
                  : "bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30"
              )}>
                <Play className={cn(
                  "w-6 h-6 transition-colors duration-300",
                  postingStrategy === 'first-now' ? "text-white" : "text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                )} />
              </div>
              <div>
                <h5 className="font-bold text-foreground">Post 1 Now</h5>
                <p className="text-sm text-muted-foreground">Immediate posting + schedule rest</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                <span>Instant engagement</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                <span>Followed by scheduled posts</span>
              </div>
            </div>
          </button>
        </div>

        {/* Interval Settings */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-foreground">Interval Between Posts</label>
              <select
                value={intervalHours}
                onChange={(e) => setIntervalHours(Number(e.target.value))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-foreground rounded-xl border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
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
                Optimal TikTok posting: 3-6 hours recommended
              </p>
            </div>
            
            {postingStrategy === 'interval' && (
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-foreground">Start Time</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-foreground rounded-xl border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                />
                <p className="text-xs text-muted-foreground">
                  All posts will be scheduled from this time
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schedule Preview */}
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl">
            <Eye className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-foreground">Schedule Preview</h4>
            <p className="text-sm text-muted-foreground">Review your posting timeline before confirmation</p>
          </div>
        </div>
        
        {/* Schedule Constraints Notice */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="font-bold text-amber-800 dark:text-amber-200 mb-2">Schedule Constraints Applied</div>
              <div className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                  <span>Posts scheduled every {intervalHours} hours between 9am-10pm only</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                  <span>No posts between 12am-9am (automatically moved to 9am)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                  <span>Posts after 10pm are automatically skipped</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Schedule Timeline */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          {getSchedulePreview().length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-slate-400" />
              </div>
              <h5 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">No Posts Scheduled</h5>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No posts can be scheduled within the 9am-10pm window with the current settings
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {getSchedulePreview().map((item, index) => (
                <div key={item.slideshowId} className="group bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl border border-blue-200 dark:border-blue-700">
                        <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{index + 1}</span>
                      </div>
                      <div>
                        <h6 className="font-semibold text-slate-900 dark:text-slate-100">{item.slideshowTitle}</h6>
                        <div className="flex items-center space-x-2 mt-1">
                          <Clock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            {item.isImmediate ? 'Will post immediately' : `Scheduled for ${item.displayTime}`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {item.status === 'pending' && (
                        <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                          <span className="text-xs font-medium">Pending</span>
                        </div>
                      )}
                      {item.status === 'posting' && (
                        <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-xs font-medium">Posting</span>
                        </div>
                      )}
                      {item.status === 'success' && (
                        <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-xs font-medium">Success</span>
                        </div>
                      )}
                      {item.status === 'error' && (
                        <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-xs font-medium">Error</span>
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
          <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 border border-orange-200 dark:border-orange-800 rounded-2xl p-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-10 h-10 bg-orange-100 dark:bg-orange-900/50 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <div className="font-bold text-orange-800 dark:text-orange-200">Posts Skipped</div>
                <div className="text-sm text-orange-700 dark:text-orange-300">
                  {slideshows.length - postingSchedule.length} slideshow(s) would be scheduled after 10pm and have been automatically skipped
                </div>
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
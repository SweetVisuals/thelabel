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
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  PostizProfile, 
  PostizSlideshowData, 
  SlideshowMetadata 
} from '../../types';
import { postizAPI } from '../../lib/postiz';
import { slideshowService } from '../../lib/slideshowService';

interface PostizPosterProps {
  slideshow: SlideshowMetadata | null;
  onPostSuccess?: (postId: string) => void;
  onClose?: () => void;
}

export const PostizPoster: React.FC<PostizPosterProps> = ({
  slideshow,
  onPostSuccess,
  onClose
}) => {
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [profiles, setProfiles] = useState<PostizProfile[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [postResult, setPostResult] = useState<{
    success: boolean;
    message: string;
    postId?: string;
  } | null>(null);
  
  // Scheduling state
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  // Auto-hide notifications
  useEffect(() => {
    if (postResult) {
      const timer = setTimeout(() => {
        setPostResult(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [postResult]);

  // Load TikTok profiles on component mount
  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    setIsLoadingProfiles(true);
    try {
      const loadedProfiles = await postizAPI.getProfiles();
      
      
      
      // More flexible TikTok detection - check for TikTok variants
      const tiktokProfiles = loadedProfiles.filter(profile => {
        const provider = profile.provider?.toLowerCase() || '';
        const displayName = profile.displayName?.toLowerCase() || '';
        const username = profile.username?.toLowerCase() || '';
        
        // Check multiple criteria for TikTok detection
        const isTikTok = provider.includes('tiktok') ||
                        displayName.includes('tiktok') ||
                        username.includes('tiktok') ||
                        provider === 'tt' ||
                        displayName.includes('tt') ||
                        provider === 'social';
        
        return isTikTok;
      });
      
      
      
      // If no TikTok profiles found, use all profiles as fallback
      const finalProfiles = tiktokProfiles.length > 0 ? tiktokProfiles : loadedProfiles;
      if (finalProfiles.length === 0) {
        setPostResult({
          success: false,
          message: 'No accounts found. Please check your Postiz API key and ensure accounts are connected.'
        });
      }
      
      setProfiles(finalProfiles);
      
      // Auto-select first TikTok profile if only one exists, otherwise first profile
      const profilesToSelect = tiktokProfiles.length > 0 ? tiktokProfiles : finalProfiles;
      if (profilesToSelect.length === 1) {
        setSelectedProfiles([profilesToSelect[0].id]);
      }
    } catch (error) {
      setPostResult({
        success: false,
        message: (error instanceof Error && error.message.includes('CORS'))
          ? 'CORS issue detected. The browser was blocking requests to Postiz API. This has been fixed with a proxy solution.'
          : 'Failed to load TikTok profiles. Please check your API key.'
      });
    } finally {
      setIsLoadingProfiles(false);
    }
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

  const handleScheduleToggle = () => {
    setIsScheduled(!isScheduled);
    
    // Set default schedule time to 1 hour from now
    if (!isScheduled) {
      const now = new Date();
      now.setHours(now.getHours() + 1);
      setScheduledDate(now.toISOString().split('T')[0]);
      setScheduledTime(now.toTimeString().slice(0, 5));
    } else {
      setScheduledDate('');
      setScheduledTime('');
    }
  };

  const getScheduledDateTime = (): Date | undefined => {
    if (!isScheduled || !scheduledDate || !scheduledTime) return undefined;
    
    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`);
    if (scheduledDateTime <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }
    
    return scheduledDateTime;
  };

  const validateForm = (): string | null => {
    if (!slideshow) return 'No slideshow selected';
    
    if (selectedProfiles.length === 0) {
      return 'Please select at least one TikTok account';
    }

    // Check if slideshow has condensed slides
    if (!slideshow.condensedSlides || slideshow.condensedSlides.length === 0) {
      return 'Slideshow has no images to post';
    }

    // Validate scheduled time if enabled
    if (isScheduled) {
      if (!scheduledDate || !scheduledTime) {
        return 'Please select date and time for scheduling';
      }
      
      const scheduledDateTime = getScheduledDateTime();
      if (!scheduledDateTime) {
        return 'Scheduled time must be in the future';
      }
    }

    return null;
  };

  const handlePost = async () => {
    if (!slideshow) return;

    const validationError = validateForm();
    if (validationError) {
      setPostResult({ success: false, message: validationError });
      return;
    }

    // Check if images need to be uploaded to Postiz domain
    if (slideshow.condensedSlides) {
      const imageUrls = slideshow.condensedSlides
        .map(slide => slide.originalImageUrl || slide.condensedImageUrl)
        .filter(Boolean);
      
      const imageValidation = postizAPI.validateImageUrls(imageUrls);
      
      if (imageValidation.needsUpload) {
        setPostResult({
          success: false,
          message: `⚠️ Postiz requires images to be uploaded to uploads.postiz.com domain first. 

Please:
1. Go to Postiz app (https://app.postiz.com/)
2. Upload your images to your media library
3. Copy the uploads.postiz.com URLs
4. Replace image URLs in your slideshow

Current external images: ${imageValidation.externalUrls.length}`
        });
        return;
      }
    }

    setIsPosting(true);
    setPostResult(null);

    try {
      const scheduledDateTime = getScheduledDateTime();
      
      const result = await slideshowService.scheduleSlideshowPost(
        slideshow,
        selectedProfiles,
        scheduledDateTime,
        !isScheduled // If not scheduled, post now
      );

      setPostResult({
        success: true,
        message: isScheduled 
          ? `Slideshow scheduled successfully for ${scheduledDate} at ${scheduledTime}!`
          : 'Slideshow posted successfully!',
        postId: result.id
      });

      if (onPostSuccess && result.id) {
        onPostSuccess(result.id);
      }

      // Reset form on success
      setTimeout(() => {
        setSelectedProfiles([]);
        setIsScheduled(false);
        setScheduledDate('');
        setScheduledTime('');
      }, 2000);

    } catch (error: any) {
      setPostResult({
        success: false,
        message: error.message || 'Failed to post slideshow. Please try again.'
      });
    } finally {
      setIsPosting(false);
    }
  };

  // Calculate formatted post data for preview
  const getPostData = (): PostizSlideshowData | null => {
    if (!slideshow) return null;

    try {
      const scheduledDateTime = getScheduledDateTime();
      return slideshowService.createPostizPostData(
        slideshow,
        selectedProfiles,
        scheduledDateTime,
        !isScheduled
      );
    } catch {
      return null;
    }
  };

  const postData = getPostData();

  if (!slideshow) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-8 h-8 mx-auto text-yellow-500 mb-2" />
        <p className="text-muted-foreground">No slideshow selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center">
          <Send className="w-5 h-5 mr-2" />
          Post to TikTok via Postiz
        </h3>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        )}
      </div>

      {/* Slideshow Info */}
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-center space-x-3 mb-2">
          <Image className="w-5 h-5 text-muted-foreground" />
          <h4 className="font-medium text-foreground">{slideshow.title}</h4>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div>
            <span className="font-medium">Images:</span> {slideshow.condensedSlides?.length || 0}
          </div>
          <div>
            <span className="font-medium">Aspect Ratio:</span> {slideshow.aspectRatio}
          </div>
          {slideshow.postTitle && (
            <div className="col-span-2">
              <span className="font-medium">Post Title:</span> {slideshow.postTitle}
            </div>
          )}
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

      {/* Scheduling Options */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-foreground flex items-center">
            <CalendarDays className="w-4 h-4 mr-2" />
            Posting Schedule
          </h4>
          <Button
            variant={isScheduled ? "default" : "outline"}
            size="sm"
            onClick={handleScheduleToggle}
          >
            {isScheduled ? 'Scheduled' : 'Post Now'}
          </Button>
        </div>

        {isScheduled && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Date</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 bg-input text-foreground rounded border border-border focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Time</label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-2 bg-input text-foreground rounded border border-border focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Post Preview */}
      {postData && (
        <div className="space-y-3">
          <h4 className="font-medium text-foreground flex items-center">
            <Eye className="w-4 h-4 mr-2" />
            Post Preview
          </h4>
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Caption:</span>
              </div>
              <p className="text-sm text-foreground bg-background p-2 rounded border whitespace-pre-line">
                {postData.text}
              </p>
            </div>
            
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Hash className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Images:</span>
              </div>
              <div className="flex space-x-2">
                {postData.mediaUrls?.slice(0, 3).map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`Slide ${index + 1}`}
                    className="w-12 h-12 rounded object-cover border"
                  />
                ))}
                {postData.mediaUrls && postData.mediaUrls.length > 3 && (
                  <div className="w-12 h-12 rounded bg-background border flex items-center justify-center text-xs text-muted-foreground">
                    +{postData.mediaUrls.length - 3}
                  </div>
                )}
              </div>
            </div>

            {isScheduled && scheduledDate && scheduledTime && (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Scheduled for {scheduledDate} at {scheduledTime}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post Result */}
      {postResult && (
        <div className={cn(
          "p-3 rounded-lg border flex items-center space-x-2",
          postResult.success
            ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:text-green-200 dark:border-green-800"
            : "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800"
        )}>
          {postResult.success ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span className="text-sm">{postResult.message}</span>
        </div>
      )}

      <Separator />

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handlePost}
          disabled={isPosting || selectedProfiles.length === 0}
          className="flex-1 bg-primary hover:bg-primary/90"
        >
          {isPosting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {isScheduled ? 'Scheduling...' : 'Posting...'}
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              {isScheduled ? 'Schedule Post' : 'Post Now'}
            </>
          )}
        </Button>
        
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};
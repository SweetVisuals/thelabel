import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { ChevronDown, ChevronRight, Save, Loader2, Send } from 'lucide-react';
import { UploadedImage, SlideshowMetadata, TikTokTextOverlay, TemplateApplicationResult } from '../../types';
import { slideshowService } from '../../lib/slideshowService';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '@/lib/utils';
import { PostizPoster } from '../Postiz/PostizPoster';
import { TemplateManager } from './TemplateManager';

interface SlideshowManagerProps {
   images: UploadedImage[];
   selectedImages: string[];
   textOverlays: TikTokTextOverlay[];
   title: string;
   postTitle?: string;
   caption: string;
   hashtags: string[];
   aspectRatio: string;
   transitionEffect: 'fade' | 'slide' | 'zoom';
   musicEnabled: boolean;
   onTitleChange: (title: string) => void;
   onPostTitleChange: (postTitle: string) => void;
   onCaptionChange: (caption: string) => void;
   onHashtagsChange: (hashtags: string[]) => void;
   onTextOverlaysChange: (overlays: TikTokTextOverlay[]) => void;
   onAspectRatioChange: (ratio: string) => void;
   onTransitionEffectChange: (effect: 'fade' | 'slide' | 'zoom') => void;
   onMusicEnabledChange: (enabled: boolean) => void;
   onImagesSelectForBulk: (images: UploadedImage[]) => void;
   onTemplateApplied?: (result: TemplateApplicationResult) => void;
   currentSlideshow?: SlideshowMetadata | null;
 }

export const SlideshowManager: React.FC<SlideshowManagerProps> = ({
   images,
   selectedImages,
   textOverlays,
   title,
   postTitle,
   caption,
   hashtags,
   aspectRatio,
   transitionEffect,
   musicEnabled,
   onTitleChange,
   onPostTitleChange,
   onCaptionChange,
   onHashtagsChange,
   onTextOverlaysChange,
   onAspectRatioChange,
   onTransitionEffectChange,
   onMusicEnabledChange,
   onImagesSelectForBulk,
   onTemplateApplied,
   currentSlideshow,
 }) => {
  const { user } = useAuth();
  const [savedSlideshows, setSavedSlideshows] = useState<SlideshowMetadata[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPostizPoster, setShowPostizPoster] = useState(false);
  const [tempSlideshow, setTempSlideshow] = useState<SlideshowMetadata | null>(null);
  const [isCreatingTempSlideshow, setIsCreatingTempSlideshow] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | null }>({ message: '', type: null });

  // Load saved slideshows on mount and when user changes
  useEffect(() => {
    if (user) {
      loadSavedSlideshows();
      // Load slideshows from database when user changes
      slideshowService.loadUserSlideshows(user.id).then(() => {
        loadSavedSlideshows(); // Refresh the list after loading from database
      });
    }
  }, [user]);

  // Auto-hide notifications
  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => {
        setNotification({ message: '', type: null });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const loadSavedSlideshows = () => {
    if (!user) return;
    const slideshows = slideshowService.getSavedSlideshows(user.id);
    setSavedSlideshows(slideshows);
  };

  const handleSaveSlideshow = async () => {
    if (!user) {
      setNotification({ message: 'Please log in to save slideshows', type: 'error' });
      return;
    }

    if (selectedImages.length === 0) {
      setNotification({ message: 'Please select at least one image', type: 'error' });
      return;
    }

    if (!title.trim()) {
      setNotification({ message: 'Please enter a title for your slideshow', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const slideshowImages = images.filter(img => selectedImages.includes(img.id));

      const savedSlideshow = await slideshowService.saveSlideshow(
        title,
        postTitle || '',
        caption,
        hashtags,
        slideshowImages,
        textOverlays,
        aspectRatio,
        transitionEffect,
        musicEnabled,
        user.id
      );

      // Slideshow will automatically appear in file browser

      loadSavedSlideshows();
      setNotification({ message: 'Slideshow saved successfully! You can now find it in the file browser as a .slideshow file.', type: 'success' });
      
      // Force file browser to refresh by dispatching slideshowUpdated event
      window.dispatchEvent(new CustomEvent('slideshowUpdated'));
    } catch (error) {
      console.error('Failed to save slideshow:', error);
      setNotification({ message: 'Failed to save slideshow. Please try again.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePostToTikTok = async () => {
    if (!user) {
      setNotification({ message: 'Please log in to post to TikTok', type: 'error' });
      return;
    }

    // If we have a loaded slideshow, post it directly
    if (currentSlideshow && !tempSlideshow) {
      setTempSlideshow(currentSlideshow);
      setShowPostizPoster(true);
      return;
    }

    if (selectedImages.length === 0 && !tempSlideshow) {
      setNotification({ message: 'Please select at least one image to create a slideshow', type: 'error' });
      return;
    }

    setIsCreatingTempSlideshow(true);
    try {
      const slideshowImages = images.filter(img => selectedImages.includes(img.id));
      
      // Create condensed slides but don't save to storage
      const condensedSlides = await slideshowService.createCondensedSlides(
        slideshowImages,
        textOverlays,
        aspectRatio
      );

      const tempSlideshowData: SlideshowMetadata = {
        id: `temp_${Date.now()}`,
        title,
        postTitle: postTitle || title,
        caption,
        hashtags,
        condensedSlides,
        textOverlays,
        aspectRatio,
        transitionEffect,
        musicEnabled,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: user.id,
        folder_id: null
      };

      setTempSlideshow(tempSlideshowData);
      setShowPostizPoster(true);
    } catch (error) {
      console.error('Failed to create temporary slideshow:', error);
      setNotification({ message: 'Failed to create slideshow for posting. Please try again.', type: 'error' });
    } finally {
      setIsCreatingTempSlideshow(false);
    }
  };

  const handleClosePostizPoster = () => {
    setShowPostizPoster(false);
    setTempSlideshow(null);
  };


  return (
    <div className="space-y-4">
      {/* Notification */}
      {notification.message && (
        <div className={cn(
          "px-3 py-2 rounded-lg text-sm",
          notification.type === 'success'
            ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-200 dark:border-green-800"
            : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800"
        )}>
          {notification.message}
        </div>
      )}

      {/* Save Slideshow Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-muted-foreground flex items-center">
            <Save className="w-4 h-4 mr-2" />
            Save Slideshow
          </h4>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="slideshow-title" className="text-sm text-muted-foreground block">Slideshow Title</label>
            <div className="flex gap-2">
              <input
                id="slideshow-title"
                type="text"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Enter slideshow title (file name)..."
                className="flex-1 mt-1 px-3 py-2 bg-input text-foreground rounded border border-border focus:border-primary focus:outline-none"
              />
              <Button
                type="button"
                onClick={() => {
                  // Auto-generate a slideshow title from the current title
                  const baseTitle = title.trim() || 'Amazing Slideshow';
                  const timestamp = new Date().toLocaleDateString();
                  const generatedTitle = `${baseTitle} - ${timestamp}`;
                  onTitleChange(generatedTitle);
                }}
                variant="outline"
                size="sm"
                className="mt-1 px-3 py-2 h-10"
                title="Auto-generate slideshow title"
              >
                Auto-generate
              </Button>
            </div>
          </div>

          <div>
            <label htmlFor="post-title" className="text-sm text-muted-foreground block">Post Title</label>
            <input
              id="post-title"
              type="text"
              value={postTitle || ''}
              onChange={(e) => onPostTitleChange(e.target.value)}
              placeholder="Enter post title for TikTok..."
              className="w-full mt-1 px-3 py-2 bg-input text-foreground rounded border border-border focus:border-primary focus:outline-none"
            />
          </div>

          <Button
            onClick={handleSaveSlideshow}
            disabled={isSaving || !user || selectedImages.length === 0}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Slideshow ({selectedImages.length} images)
              </>
            )}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Post to TikTok Section */}
      {(selectedImages.length > 0 || tempSlideshow || currentSlideshow) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-muted-foreground flex items-center">
              <Send className="w-4 h-4 mr-2" />
              Post to TikTok
              {tempSlideshow && <span className="ml-2 text-xs text-green-600">(Loaded Slideshow)</span>}
              {currentSlideshow && !tempSlideshow && <span className="ml-2 text-xs text-blue-600">(Saved Slideshow)</span>}
            </h4>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handlePostToTikTok}
              disabled={(!user || (selectedImages.length === 0 && !tempSlideshow && !currentSlideshow)) || isCreatingTempSlideshow}
              className="w-full bg-pink-600 hover:bg-pink-700 text-white"
            >
              {isCreatingTempSlideshow ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Slideshow...
                </>
              ) : tempSlideshow ? (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Post Loaded Slideshow to TikTok
                </>
              ) : currentSlideshow ? (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Post Saved Slideshow to TikTok
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Post Slideshow to TikTok ({selectedImages.length} images)
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Postiz Poster Modal */}
      {showPostizPoster && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6">
              {tempSlideshow ? (
                <PostizPoster
                  slideshow={tempSlideshow}
                  onPostSuccess={(postId) => {
                    setNotification({
                      message: 'Slideshow posted to TikTok successfully!',
                      type: 'success'
                    });
                    setShowPostizPoster(false);
                  }}
                  onClose={handleClosePostizPoster}
                />
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-4">Failed to create slideshow for posting</p>
                  <Button onClick={handleClosePostizPoster} variant="outline">
                    Close
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Template Manager */}
      <Separator />
      
      <TemplateManager
        currentSlideshow={currentSlideshow}
        uploadedImages={images}
        selectedImages={selectedImages}
        onTemplateApplied={(result) => {
          if (onTemplateApplied) {
            onTemplateApplied(result);
          }
          if (result.success && result.slideshow) {
            // Refresh saved slideshows to show the new one
            loadSavedSlideshows();
            setNotification({
              message: `Template applied successfully! Created ${result.processedImages} slides.`,
              type: 'success'
            });
          }
        }}
        onImagesSelectForBulk={onImagesSelectForBulk}
      />

    </div>
  );
};
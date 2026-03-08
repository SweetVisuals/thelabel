import React, { useState, useMemo, useEffect } from 'react';
import { Play, Plus, ChevronLeft, ChevronRight, Heart, MessageCircle, Share2, Repeat2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UploadedImage, TikTokTextOverlay, SlideshowMetadata } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { parseAspectRatio } from '@/lib/aspectRatio';

interface TikTokPreviewProps {
  images: UploadedImage[];
  selectedImages: string[];
  textOverlays: TikTokTextOverlay[];
  title: string;
  postTitle?: string;
  caption?: string;
  hashtags?: string[];
  transitionEffect?: 'fade' | 'slide' | 'zoom';
  musicEnabled?: boolean;
  aspectRatio?: string;
  previewMode?: boolean;
  onTextOverlaysChange?: (overlays: TikTokTextOverlay[]) => void;
  onTitleChange?: (title: string) => void;
  onPostTitleChange?: (title: string) => void;
  onCaptionChange?: (caption: string) => void;
  onHashtagsChange?: (hashtags: string[]) => void;
  onTransitionEffectChange?: (effect: 'fade' | 'slide' | 'zoom') => void;
  onMusicEnabledChange?: (enabled: boolean) => void;
  onAspectRatioChange?: (ratio: string) => void;
  onImagesUpdate?: (images: UploadedImage[]) => void;
  onCurrentSlideChange?: (index: number) => void;
  onSelectionOrderChange?: (order: string[]) => void;
  currentSlideshow: SlideshowMetadata | null;
}

export const TikTokPreview: React.FC<TikTokPreviewProps> = ({
  images,
  selectedImages,
  textOverlays = [],
  title,
  hashtags = [],
  aspectRatio = '9:16',
  previewMode = false,
  onTextOverlaysChange,
  onCurrentSlideChange,
  onAspectRatioChange,
  currentSlideshow
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentAspectRatio, setCurrentAspectRatio] = useState(aspectRatio);

  // Sync aspect ratio prop with local state
  useEffect(() => {
    setCurrentAspectRatio(aspectRatio);
  }, [aspectRatio]);

  // Handle outside messages for aspect ratio (from FileBrowser toolbar)
  useEffect(() => {
    const handleAspectRatioChange = (event: CustomEvent<string>) => {
      onAspectRatioChange?.(event.detail);
    };

    window.addEventListener('tiktokAspectRatioChange', handleAspectRatioChange as EventListener);
    return () => {
      window.removeEventListener('tiktokAspectRatioChange', handleAspectRatioChange as EventListener);
    };
  }, [onAspectRatioChange]);

  // Determine which images to show
  const { slideshowImages, originalSlidesCount } = useMemo(() => {
    let imagesToProcess: any[] = [];
    let count = 0;

    if (currentSlideshow && currentSlideshow.condensedSlides && currentSlideshow.condensedSlides.length > 0) {
      imagesToProcess = currentSlideshow.condensedSlides.map((slide: any) => ({
        id: slide.id,
        url: slide.condensedImageUrl,
        originalImageId: slide.originalImageId
      }));
      count = currentSlideshow.condensedSlides.length;
    } else {
      const imagesMap = new Map(images.map(img => [img.id, img]));
      imagesToProcess = selectedImages
        .map(id => imagesMap.get(id))
        .filter(img => img !== undefined) as UploadedImage[];
      count = imagesToProcess.length;
    }

    return { slideshowImages: imagesToProcess, originalSlidesCount: count };
  }, [currentSlideshow, images, selectedImages]);

  // Sync current slide and ensure it stays within bounds
  useEffect(() => {
    if (slideshowImages.length > 0 && currentSlide >= slideshowImages.length) {
      setCurrentSlide(0);
      onCurrentSlideChange?.(0);
    }
  }, [slideshowImages.length, currentSlide, onCurrentSlideChange]);

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying && slideshowImages.length > 1) {
      const interval = setInterval(() => {
        setCurrentSlide(prev => (prev >= slideshowImages.length - 1 ? 0 : prev + 1));
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isPlaying, slideshowImages.length]);

  const renderTikTokPreview = () => {
    const hasContent = slideshowImages.length > 0;

    if (!hasContent) {
      return (
        <div className="relative w-full max-w-[420px] mx-auto aspect-[9/19.5]">
          {/* iPhone Bezel (Hardware) - Empty State */}
          <div className="absolute inset-0 pointer-events-none z-50 opacity-50">
            <div className="w-full h-full border-[12px] border-[#111] rounded-[40px] relative shadow-2xl">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#111] rounded-b-[16px]"></div>
            </div>
          </div>

          <div className="absolute inset-[3px] bg-black rounded-[34px] flex flex-col items-center justify-center p-6 border border-white/5">
            <div className="text-center p-8 z-10 w-full">
              <div className="w-20 h-20 bg-white/5 rounded-none flex items-center justify-center mb-6 mx-auto border border-white/10">
                <Play className="w-8 h-8 text-white/40" strokeWidth={1} />
              </div>
              <h3 className="text-sm font-sans text-white/80 mb-2 uppercase tracking-wider">Preview Unavailable</h3>
              <p className="text-white/40 text-[10px] font-sans mb-4 uppercase tracking-wider">
                {currentSlideshow ? 'LOADING SLIDESHOW...' : 'SELECT IMAGES TO PREVIEW'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Styles for image display
    const getAspectRatioStyle = () => {
      return { objectFit: 'contain' as const, objectPosition: 'center' as const };
    };

    const getImageContainerStyle = () => {
      // Always fill height/width when inside the iPhone frame to avoid black bars
      return { position: 'relative' as const, width: '100%', height: '100%', overflow: 'hidden' };
    };

    return (
      <div className="relative w-full max-w-[420px] mx-auto aspect-[9/19.5]">
        {/* iPhone Bezel (Hardware) */}
        <div className="absolute inset-0 pointer-events-none z-50">
          <div className="w-full h-full border-[12px] border-[#111] rounded-[40px] shadow-2xl relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#111] rounded-b-[16px] flex items-center justify-center">
              <div className="w-12 h-1.5 bg-[#222] rounded-full mr-2"></div>
              <div className="w-2 h-2 bg-[#1a1a1a] rounded-full border border-[#333]"></div>
            </div>
            {/* Side buttons */}
            <div className="absolute top-24 -left-[14px] w-1 h-8 bg-[#222] rounded-l-sm"></div>
            <div className="absolute top-36 -left-[14px] w-1 h-12 bg-[#222] rounded-l-sm"></div>
            <div className="absolute top-52 -left-[14px] w-1 h-12 bg-[#222] rounded-l-sm"></div>
            <div className="absolute top-36 -right-[14px] w-1 h-16 bg-[#222] rounded-r-sm"></div>
          </div>
        </div>

        {/* Screen Content (The App) */}
        <div className="absolute inset-[3px] bg-black rounded-[34px] overflow-hidden">
          {/* Header Overlay */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 pt-8 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-white/10 border border-white/20 rounded-none flex items-center justify-center">
                <span className="text-white text-xs font-sans font-bold">T</span>
              </div>
              <div>
                <p className="text-white text-[10px] font-sans tracking-wider uppercase">@{title?.toLowerCase().replace(/\s+/g, '_').substring(0, 12) || 'label_user'}</p>
                <p className="text-white/60 text-[9px] font-sans tracking-wider uppercase">Following</p>
              </div>
            </div>
            <Button size="sm" variant="ghost" className="text-white h-6 px-2 rounded-none border border-white/20">
              <Plus className="w-3 h-3" strokeWidth={1} />
            </Button>
          </div>

          {/* Main Area */}
          <div className="absolute inset-0 flex flex-col bg-black overflow-hidden" onClick={() => setIsPlaying(!isPlaying)}>
            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
              {/* Image Display */}
              <div className="relative flex items-center justify-center z-10" style={getImageContainerStyle()}>
                <motion.img
                  key={`${currentSlide}-${slideshowImages[currentSlide]?.id}`}
                  src={slideshowImages[currentSlide]?.url}
                  className="w-full h-full"
                  style={getAspectRatioStyle()}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              {/* Text Overlays */}
              {(!currentSlideshow?.condensedSlides || currentSlideshow.condensedSlides.length === 0) && textOverlays
                .filter(overlay => overlay.slideIndex === currentSlide)
                .map(overlay => (
                  <div
                    key={overlay.id}
                    className="absolute z-20 pointer-events-none"
                    style={{
                      left: `${overlay.x}%`,
                      top: `${overlay.y}%`,
                      transform: 'translate(-50%, -50%)',
                      color: overlay.color || '#fff',
                      fontSize: `${(overlay.fontSize || 20) * 0.4}px`,
                      textAlign: overlay.alignment as any || 'center',
                      textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.2',
                      width: overlay.width ? `${overlay.width}%` : '90%',
                      fontFamily: overlay.fontFamily === 'TikTok Sans' ? 'sans-serif' : overlay.fontFamily,
                      fontWeight: overlay.fontWeight
                    }}
                  >
                    {overlay.text}
                  </div>
                ))}
            </div>

            {/* Side Panel */}
            <div className="absolute right-4 bottom-28 flex flex-col space-y-6 z-20">
              <div className="w-10 h-10 bg-white/10 border border-white/20 flex items-center justify-center rounded-none shadow-lg">
                <span className="text-white text-sm font-sans tracking-tighter">TB</span>
              </div>
              <div className="flex flex-col items-center space-y-1 text-white">
                <Heart className="w-6 h-6" strokeWidth={1} />
                <span className="text-[10px] font-sans uppercase">24k</span>
              </div>
              <div className="flex flex-col items-center space-y-1 text-white">
                <MessageCircle className="w-6 h-6" strokeWidth={1} />
                <span className="text-[10px] font-sans uppercase">128</span>
              </div>
              <div className="flex flex-col items-center space-y-1 text-white">
                <Share2 className="w-6 h-6" strokeWidth={1} />
                <span className="text-[10px] font-sans uppercase">Share</span>
              </div>
            </div>

            {/* Bottom Info */}
            <div className="absolute bottom-10 left-4 right-16 z-20 flex flex-col">
              <p className="text-white text-xs font-sans font-bold mb-1 tracking-wider">@label_user</p>
              <p className="text-white/90 text-[10px] font-sans line-clamp-2 uppercase leading-tight">
                <span className="font-bold mr-1">{title || 'the_label'}</span>
                {hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ') || '#thelabel #viral #slideshow'}
              </p>
            </div>

            {/* Slide Indicators */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-1 z-20">
              {slideshowImages.map((_, i) => (
                <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-all", i === currentSlide ? "bg-white scale-125" : "bg-white/40")} />
              ))}
            </div>

            {/* Nav Arrows */}
            {slideshowImages.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setCurrentSlide(prev => Math.max(0, prev - 1)); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 border border-white/20 rounded-full text-white flex items-center justify-center z-40 hover:bg-black/80 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setCurrentSlide(prev => Math.min(slideshowImages.length - 1, prev + 1)); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 border border-white/20 rounded-full text-white flex items-center justify-center z-40 hover:bg-black/80 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex items-center justify-center h-full w-full p-6 overflow-hidden relative">
      <div className="w-full max-h-full flex items-center justify-center">
        {renderTikTokPreview()}
      </div>
    </div>
  );
};

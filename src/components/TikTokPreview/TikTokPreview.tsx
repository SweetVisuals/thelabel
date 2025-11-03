
import React, { useState, useMemo, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, Edit3, Filter, Type, Crop, Music, Sparkles, Settings, Share2, Heart, MessageCircle, Repeat2, X, ChevronLeft, ChevronRight, Shuffle, Layers, Zap, Palette, Wand2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AspectRatioSelector } from '@/components/ui/aspectRatioSelector';
import { cn } from '@/lib/utils';
import { UploadedImage } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { parseAspectRatio } from '@/lib/aspectRatio';
import { useAspectRatio } from '@/hooks/useAspectRatio';

interface TextOverlay {
  id: string;
  slideIndex: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  alignment: 'left' | 'center' | 'right';
  outlineColor: string;
  outlineWidth: number;
  outlinePosition: 'outer' | 'middle' | 'inner';
  bold: boolean;
  italic: boolean;
  outline: boolean;
  glow: boolean;
  glowColor: string;
  glowIntensity: number;
  isEditing?: boolean;
  isSelected?: boolean;
}

interface TikTokPreviewProps {
  images: UploadedImage[];
  selectedImages: string[];
  textOverlays?: TextOverlay[];
  title?: string;
  postTitle?: string;
  caption?: string;
  hashtags?: string[];
  transitionEffect?: 'fade' | 'slide' | 'zoom';
  musicEnabled?: boolean;
  aspectRatio?: string;
  cutLength?: number;
  previewMode?: boolean;
  onTextOverlaysChange?: (overlays: TextOverlay[]) => void;
  onTitleChange?: (title: string) => void;
  onPostTitleChange?: (postTitle: string) => void;
  onCaptionChange?: (caption: string) => void;
  onHashtagsChange?: (hashtags: string[]) => void;
  onTransitionEffectChange?: (effect: 'fade' | 'slide' | 'zoom') => void;
  onMusicEnabledChange?: (enabled: boolean) => void;
  onAspectRatioChange?: (aspectRatio: string) => void;
  onImagesUpdate?: (images: UploadedImage[]) => void;
  onCurrentSlideChange?: (slideIndex: number) => void;
  onSelectionOrderChange?: (orderedIds: string[]) => void;
  currentSlideshow?: any;
}

export const TikTokPreview: React.FC<TikTokPreviewProps> = ({
  images,
  selectedImages,
  textOverlays = [],
  title = 'Amazing TikTok Slideshow',
  postTitle,
  caption = 'Your amazing TikTok slideshow! 🎉',
  hashtags = ['tiktok', 'slideshow', 'viral'],
  transitionEffect = 'fade',
  musicEnabled = false,
  aspectRatio = '9:16',
  cutLength = 5,
  previewMode = false,
  onTextOverlaysChange,
  onTitleChange,
  onPostTitleChange,
  onCaptionChange,
  onHashtagsChange,
  onTransitionEffectChange,
  onMusicEnabledChange,
  onAspectRatioChange,
  onImagesUpdate,
  onCurrentSlideChange,
  onSelectionOrderChange,
  currentSlideshow,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [selectedSlideForEdit, setSelectedSlideForEdit] = useState<number | null>(null);
  const dragContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [remixedSlideshowImages, setRemixedSlideshowImages] = useState<any[]>([]);
  const [isRemixed, setIsRemixed] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [activeEditTab, setActiveEditTab] = useState<'text' | 'effects' | 'settings'>('text');
  const [localTextOverlays, setLocalTextOverlays] = useState<TextOverlay[]>(textOverlays);
  const [currentAspectRatio, setCurrentAspectRatio] = useState(aspectRatio);

  useEffect(() => {
    setLocalTextOverlays(textOverlays);
  }, [textOverlays]);

  useEffect(() => {
    setCurrentAspectRatio(aspectRatio);
  }, [aspectRatio]);

  useEffect(() => {
    console.log('📱 TikTokPreview Props Debug:', {
      currentFolderContext: 'TikTokPreview',
      imagesCount: images.length,
      selectedImagesCount: selectedImages.length,
      selectedImageIds: selectedImages,
      currentSlideshow: !!currentSlideshow,
      previewMode,
      cutLength,
      firstFewImages: images.slice(0, 3).map(img => ({ id: img.id, url: img.url?.substring(0, 50) + '...' }))
    });
  }, [images, selectedImages, currentSlideshow, previewMode, cutLength]);

  const handleRemixSlides = () => {
    if (!currentSlideshow || !currentSlideshow.condensedSlides || currentSlideshow.condensedSlides.length < 2) return;
    
    console.log('🎲 Starting remix with slideshow slides:', currentSlideshow.condensedSlides.length, 'cutLength:', cutLength);
    
    // Always limit to cutLength when remixing
    const slidesToRemix = Math.min(cutLength, currentSlideshow.condensedSlides.length);
    const baseSlides = currentSlideshow.condensedSlides.slice(0, slidesToRemix).map((slide: any) => ({
      id: slide.originalImageId || slide.id,
      condensedSlideId: slide.id,
      url: slide.condensedImageUrl,
      originalImageUrl: slide.originalImageUrl,
      width: slide.width,
      height: slide.height,
      aspectRatio: slide.aspectRatio,
      file: new File([], `slide-${slide.id}.jpg`),
    }));
    
    if (baseSlides.length < 2) return;
    
    const shuffledImages = [...baseSlides];
    for (let i = shuffledImages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledImages[i], shuffledImages[j]] = [shuffledImages[j], shuffledImages[i]];
    }
    
    console.log('🔀 Shuffled slideshow slides:', shuffledImages.map(img => img.id));
    
    setRemixedSlideshowImages(shuffledImages);
    setIsRemixed(true);
    setCurrentSlide(0);
    
    console.log('🎉 Slideshow remix completed! New order:', shuffledImages.map(img => img.id));
  };

  const { slideshowImages, originalSlidesCount } = useMemo(() => {
    console.log('🔄 TikTokPreview useMemo recalculating...', {
      imagesCount: images.length,
      selectedImagesCount: selectedImages.length,
      selectedImageIds: selectedImages,
      currentSlideshow: !!currentSlideshow,
      previewMode,
      cutLength
    });
    
    // Always apply cut length limit - it should override the preview
    let imagesToProcess: any[] = [];
    let originalCount = 0;

    if (currentSlideshow && currentSlideshow.condensedSlides && currentSlideshow.condensedSlides.length > 0) {
      console.log('📱 Using loaded slideshow (preview mode)');
      originalCount = currentSlideshow.condensedSlides.length;
      
      // Get all available slides but limit by cutLength
      const availableSlides = currentSlideshow.condensedSlides.map((slide: any) => ({
        id: slide.originalImageId || slide.id,
        condensedSlideId: slide.id,
        url: slide.condensedImageUrl,
        originalImageUrl: slide.originalImageUrl,
        width: slide.width,
        height: slide.height,
        aspectRatio: slide.aspectRatio,
        file: new File([], `slide-${slide.id}.jpg`),
      }));
      
      // Apply remix if active, but still respect cutLength
      if (isRemixed && remixedSlideshowImages.length > 0) {
        const remixedLimited = remixedSlideshowImages.slice(0, cutLength);
        imagesToProcess = remixedLimited;
      } else {
        // Limit by cutLength regardless of remix state
        imagesToProcess = availableSlides.slice(0, cutLength);
      }
    }
    else if (selectedImages.length > 0) {
      console.log('🖼️ Creating slideshow from selected images');
      
      const imagesMap = new Map(images.map(img => [img.id, img]));
      
      console.log('🔍 Images map debug:', {
        totalImagesInMap: imagesMap.size,
        sampleImageIds: Array.from(imagesMap.keys()).slice(0, 5),
        selectedIds: selectedImages,
        mapHasSelectedIds: selectedImages.map(id => imagesMap.has(id))
      });
      
      const orderedImages = selectedImages
        .map(id => imagesMap.get(id))
        .filter(img => img !== undefined) as UploadedImage[];
      
      console.log('🎬 TikTokPreview: Creating slideshow from selected images:', {
        selectedImageIds: selectedImages,
        availableImagesCount: images.length,
        foundImagesCount: orderedImages.length,
        missingImageIds: selectedImages.filter(id => !imagesMap.has(id)),
        foundImageDetails: orderedImages.map(img => ({ id: img.id, url: img.url?.substring(0, 50) + '...' }))
      });
      
      if (orderedImages.length === 0) {
        console.warn('⚠️ TikTokPreview: No matching images found for selected IDs in current folder');
        console.log('🔍 Debug - Available images:', images.map(img => ({ id: img.id, url: img.url?.substring(0, 50) + '...' })));
      }

      // Apply cut length limit to selected images
      imagesToProcess = orderedImages.slice(0, cutLength);
      originalCount = orderedImages.length;
    }

    console.log('🎬 Final slideshow images after cut length filtering:', {
      cutLength,
      imagesToProcessCount: imagesToProcess.length,
      originalCount
    });

    return { slideshowImages: imagesToProcess, originalSlidesCount: originalCount };
  }, [images, selectedImages, currentSlideshow, isRemixed, remixedSlideshowImages, cutLength]);

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying && slideshowImages.length > 1) {
      const interval = setInterval(() => {
        setCurrentSlide(prev =>
          prev >= slideshowImages.length - 1 ? 0 : prev + 1
        );
      }, 3000); // 3 seconds per slide

      return () => clearInterval(interval);
    }
  }, [isPlaying, slideshowImages.length]);

  // Auto-advance when slideshow data changes
  useEffect(() => {
    if (slideshowImages.length > 0) {
      setCurrentSlide(0);
    }
  }, [slideshowImages.length]);

  // Debug logging for data flow
  }, [slideshowImages, selectedImages, currentSlideshow, previewMode, currentSlide, originalSlidesCount]);

  // Render the TikTok preview interface
  const renderTikTokPreview = () => {
    const hasContent = slideshowImages.length > 0;
    
    if (!hasContent) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-500/20 via-pink-500/10 to-purple-500/5 border border-purple-500/20 rounded-2xl p-6">
          <div className="text-center p-8">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-500/30 to-pink-500/20 rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <Play className="w-12 h-12 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">TikTok Preview</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {currentSlideshow ? 'Loading slideshow...' : 'Select images to create a slideshow'}
            </p>
            {selectedImages.length > 0 && !currentSlideshow && (
              <p className="text-primary text-xs">
                {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected
              </p>
            )}
            {currentSlideshow && (
              <p className="text-primary text-xs">
                {currentSlideshow.condensedSlides?.length || 0} slides in slideshow
              </p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="aspect-[9/16] w-full max-w-md mx-auto bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-purple-500/10 border border-purple-500/20 rounded-2xl overflow-hidden relative">
        {/* TikTok-style header */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/60 via-black/30 to-transparent">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">T</span>
            </div>
            <div>
              <p className="text-white text-xs font-medium">@{title.toLowerCase().replace(/\s+/g, '_').substring(0, 12)}</p>
              <p className="text-gray-300 text-xs">Following</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 h-6 px-2">
            <Plus className="w-3 h-3" />
          </Button>
        </div>

        {/* Main video/slideshow area */}
        <div ref={dragContainerRef} className="relative w-full h-full bg-black overflow-hidden">
          {slideshowImages.length > 0 ? (
            <div className="relative w-full h-full">
              {/* Current slide display */}
              <motion.img
                key={`${currentSlide}-${slideshowImages[currentSlide]?.id || 'empty'}`}
                src={slideshowImages[currentSlide]?.url}
                alt={`Slide ${currentSlide + 1}`}
                className="w-full h-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              />
              
              {/* Text overlays on current slide - only show for unsaved slideshows */}
              {/* For saved slideshows, text is already embedded in the condensed images */}
              {!currentSlideshow && textOverlays
                .filter(overlay => overlay.slideIndex === currentSlide)
                .map((overlay) => (
                  <motion.div
                    key={overlay.id}
                    className="absolute cursor-grab"
                    style={{
                      x: `${overlay.x}%`,
                      y: `${overlay.y}%`,
                      width: `${overlay.width}%`,
                      height: `${overlay.height}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    drag={!previewMode}
                    dragConstraints={dragContainerRef}
                    dragElastic={0.2}
                    onDragEnd={(_, info) => {
                      if (previewMode) return;

                      const container = dragContainerRef.current;
                      if (!container) return;

                      const containerRect = container.getBoundingClientRect();
                      const newX = (info.point.x - containerRect.left) / containerRect.width * 100;
                      const newY = (info.point.y - containerRect.top) / containerRect.height * 100;

                      // Snapping logic (e.g., snap to a grid or center)
                      const snapGrid = 5; // Snap every 5%
                      const snappedX = Math.round(newX / snapGrid) * snapGrid;
                      const snappedY = Math.round(newY / snapGrid) * snapGrid;

                      const updatedOverlays = textOverlays.map(o =>
                        o.id === overlay.id
                          ? { ...o, x: Math.max(0, Math.min(100, snappedX)), y: Math.max(0, Math.min(100, snappedY)) }
                          : o
                      );
                      onTextOverlaysChange?.(updatedOverlays);
                    }}
                  >
                    <div
                      className={cn(
                        "w-full h-full flex items-center justify-center text-center p-1 overflow-hidden",
                        overlay.bold && "font-bold",
                        overlay.italic && "italic",
                      )}
                      style={{
                        color: overlay.color,
                        fontSize: `${Math.max(10, Math.min(overlay.fontSize, 24))}px`, // Keep text small and within bounds
                        fontFamily: 'TikTok Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', // Always use TikTok Sans
                        textAlign: overlay.alignment,
                        lineHeight: '1.2', // Ensure proper line spacing
                        whiteSpace: 'pre-wrap', // Respect line breaks from edit settings
                        wordWrap: 'break-word', // Prevent text overflow
                        textShadow: overlay.outline
                          ? `${Math.max(1, overlay.outlineWidth)}px ${Math.max(1, overlay.outlineWidth)}px 0 ${overlay.outlineColor}`
                          : overlay.glow
                          ? `0 0 ${Math.max(2, overlay.glowIntensity)}px ${overlay.glowColor}`
                          : 'none',
                      }}
                    >
                      {overlay.text}
                    </div>
                  </motion.div>
                ))
              }

              {/* TikTok-style side panel - positioned within video container */}
              <div className="absolute right-6 bottom-24 flex flex-col space-y-5 z-10">
                {/* Profile picture */}
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-base font-bold">T</span>
                  </div>
                  <button className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center border-2 border-black">
                    <Plus className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>

                {/* Action buttons */}
                <button className="flex flex-col items-center space-y-1 text-white hover:scale-110 transition-transform">
                  <Heart className="w-7 h-7" />
                  <span className="text-sm">24.5K</span>
                </button>
                <button className="flex flex-col items-center space-y-1 text-white hover:scale-110 transition-transform">
                  <MessageCircle className="w-7 h-7" />
                  <span className="text-sm">203</span>
                </button>
                <button className="flex flex-col items-center space-y-1 text-white hover:scale-110 transition-transform">
                  <Repeat2 className="w-7 h-7" />
                  <span className="text-sm">89</span>
                </button>
                <button className="flex flex-col items-center space-y-1 text-white hover:scale-110 transition-transform">
                  <Share2 className="w-7 h-7" />
                  <span className="text-sm">Share</span>
                </button>
              </div>

              {/* Slide indicators */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-1 z-20">
                {slideshowImages.map((_: any, index: number) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all duration-200",
                      index === currentSlide
                        ? "bg-white scale-125"
                        : "bg-white/50 hover:bg-white/75"
                    )}
                  />
                ))}
              </div>

              {/* Navigation arrows */}
              {slideshowImages.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                    disabled={currentSlide === 0}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed z-20"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentSlide(Math.min(slideshowImages.length - 1, currentSlide + 1))}
                    disabled={currentSlide === slideshowImages.length - 1}
                    className="absolute right-16 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed z-20"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white text-center">
              <p>No content to display</p>
            </div>
          )}
        </div>

        {/* Bottom content area - fixed positioning */}
        <div className="absolute bottom-0 left-0 right-0 z-10 p-3 pb-12 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <div className="text-white">
            <p className="font-medium mb-1 text-sm truncate">{title}</p>
            <p className="text-xs text-gray-200 mb-2 line-clamp-2">{caption}</p>
            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {hashtags.map((tag, index) => (
                  <span key={index} className="text-xs text-blue-400">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Playback controls - positioned above bottom content */}
        <div className="absolute bottom-4 left-4 flex items-center space-x-2 z-20">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsPlaying(!isPlaying)}
            className="text-white hover:bg-white/10 h-8 w-8 p-0"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsMuted(!isMuted)}
            className="text-white hover:bg-white/10 h-8 w-8 p-0"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <span className="text-white text-xs bg-black/50 px-2 py-1 rounded">
            {currentSlide + 1}/{slideshowImages.length}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full flex items-center justify-center bg-black/20 rounded-2xl p-6">
      {renderTikTokPreview()}
    </div>
  );
};

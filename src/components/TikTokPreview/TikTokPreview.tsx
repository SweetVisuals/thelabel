import React, { useState, useMemo, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, Edit3, Filter, Type, Crop, Music, Sparkles, Settings, Share2, Heart, MessageCircle, Repeat2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AspectRatioSelector } from '@/components/ui/aspectRatioSelector';
import { cn } from '@/lib/utils';
import { UploadedImage } from '@/types';
import { motion } from 'framer-motion';
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
   title?: string; // Slideshow title (file name)
   postTitle?: string; // Title for TikTok post
   caption?: string;
   hashtags?: string[];
   transitionEffect?: 'fade' | 'slide' | 'zoom';
   musicEnabled?: boolean;
   aspectRatio?: string;
   cutLength?: number;
   previewMode?: boolean; // When true, only show loaded slideshows, don't auto-create from selected images
   onTextOverlaysChange?: (overlays: TextOverlay[]) => void;
   onTitleChange?: (title: string) => void;
   onPostTitleChange?: (postTitle: string) => void; // New callback for post title
   onCaptionChange?: (caption: string) => void;
   onHashtagsChange?: (hashtags: string[]) => void;
   onTransitionEffectChange?: (effect: 'fade' | 'slide' | 'zoom') => void;
   onMusicEnabledChange?: (enabled: boolean) => void;
   onAspectRatioChange?: (aspectRatio: string) => void;
   onImagesUpdate?: (images: UploadedImage[]) => void;
   onCurrentSlideChange?: (slideIndex: number) => void; // Added onCurrentSlideChange
   currentSlideshow?: any; // Add currentSlideshow prop for loaded slideshows
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
   onCurrentSlideChange, // Destructure new prop
   currentSlideshow, // Destructure new prop
 }) => {
   
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
   const [showControls, setShowControls] = useState(true);
   const [selectedSlideForEdit, setSelectedSlideForEdit] = useState<number | null>(null);
   const [draggedText, setDraggedText] = useState<string | null>(null);
   const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
   const dragContainerRef = React.useRef<HTMLElement | null>(null); // Ref to store the drag container

   // Local state for text overlays to handle internal updates
   const [localTextOverlays, setLocalTextOverlays] = useState<TextOverlay[]>(textOverlays);
   const [currentAspectRatio, setCurrentAspectRatio] = useState(aspectRatio);

  // Sync local state with props
  useEffect(() => {
    setLocalTextOverlays(textOverlays);
  }, [textOverlays]);

  // Sync aspect ratio with props
  useEffect(() => {
    setCurrentAspectRatio(aspectRatio);
  }, [aspectRatio]);

  // Create a single slideshow with all selected images or use loaded slideshow (with cut length limit)
  const { slideshowImages, originalSlidesCount } = useMemo(() => {
    
    // If we have a properly loaded slideshow with condensed slides, use it (preview mode)
    if (currentSlideshow && currentSlideshow.condensedSlides && currentSlideshow.condensedSlides.length > 0) {
      
      const originalCount = currentSlideshow.condensedSlides.length;
      const limitedSlides = currentSlideshow.condensedSlides.slice(0, cutLength).map((slide: any) => ({
        id: slide.originalImageId || slide.id, // Use original image ID for database queries, fallback to condensed ID
        condensedSlideId: slide.id, // Keep condensed slide ID for reference
        url: slide.condensedImageUrl,
        originalImageUrl: slide.originalImageUrl, // Store original URL for fallback
        width: slide.width,
        height: slide.height,
        aspectRatio: slide.aspectRatio,
        file: new File([], `slide-${slide.id}.jpg`), // Dummy file for compatibility
      }));
      
      return { slideshowImages: limitedSlides, originalSlidesCount: originalCount };
    }

    // If we have selected images, create slideshow from them (regardless of previewMode when no slideshow loaded)
    // Apply cut length limit here as well
    if (selectedImages.length > 0) {
      const filteredImages = images.filter(img => selectedImages.includes(img.id));
      const originalCount = filteredImages.length;
      const slideshow = filteredImages.slice(0, cutLength);
      return { slideshowImages: slideshow, originalSlidesCount: originalCount };
    }

    // No slideshow or selected images, return empty
    return { slideshowImages: [], originalSlidesCount: 0 };
  }, [images, selectedImages, currentSlideshow, previewMode, cutLength]);

  // Auto-detect aspect ratio from loaded images (when they're all the same)
  useEffect(() => {
    if (slideshowImages.length === 0) return;

    // Get aspect ratios from all selected images
    const aspectRatios = slideshowImages
      .map((img: any) => img.aspectRatio)
      .filter((ar: any) => ar && ar !== 'free'); // Filter out undefined and 'free'

    if (aspectRatios.length === 0) return;

    // Check if all images have the same aspect ratio
    const uniqueAspectRatios = [...new Set(aspectRatios)];

    if (uniqueAspectRatios.length === 1 && uniqueAspectRatios[0]) {
      // All images have the same aspect ratio
      const detectedAspectRatio = uniqueAspectRatios[0] as string;
      if (detectedAspectRatio !== currentAspectRatio) {
        
        setCurrentAspectRatio(detectedAspectRatio);
        onAspectRatioChange?.(detectedAspectRatio);
      }
    } else {
      // Images have different aspect ratios, revert to free mode
      if (currentAspectRatio !== 'free') {
        
        setCurrentAspectRatio('free');
        onAspectRatioChange?.('free');
      }
    }
  }, [slideshowImages, currentAspectRatio, onAspectRatioChange]);

  // Aspect ratio cropping functionality - needs to be after slideshowImages
  const { changeAspectRatio, isCropping, croppingProgress, error } = useAspectRatio({
    selectedImages: slideshowImages,
    onImagesUpdate: onImagesUpdate || (() => {})
  });

  // Calculate CSS aspect ratio value
  const getAspectRatioStyle = () => {
    if (currentAspectRatio === 'free') return {};
    
    const ratio = parseAspectRatio(currentAspectRatio);
    if (ratio === 0) return {};
    
    return {
      aspectRatio: `${Math.round(ratio * 1000) / 1000}:1`
    };
  };

  // Handle aspect ratio change
  const handleAspectRatioChange = async (newAspectRatio: string) => {
    setCurrentAspectRatio(newAspectRatio);
    onAspectRatioChange?.(newAspectRatio);
    
    // Trigger actual image cropping if not in free mode
    if (newAspectRatio !== 'free' && slideshowImages.length > 0) {
      try {
        await changeAspectRatio(newAspectRatio);
      } catch (err) {
        console.error('Failed to crop images:', err);
      }
    }
  };

  const totalSlides = slideshowImages.length;

  // Auto-play functionality
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && totalSlides > 1) {
      interval = setInterval(() => {
        nextSlide();
      }, 3000); // Switch slides every 3 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, totalSlides, currentSlide]);

  const nextSlide = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(prev => {
        const newSlide = prev + 1;
        onCurrentSlideChange?.(newSlide); // Notify parent of slide change
        return newSlide;
      });
    } else {
      setCurrentSlide(0);
      onCurrentSlideChange?.(0); // Notify parent of slide change
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => {
        const newSlide = prev - 1;
        onCurrentSlideChange?.(newSlide); // Notify parent of slide change
        return newSlide;
      });
    } else {
      setCurrentSlide(totalSlides - 1);
      onCurrentSlideChange?.(totalSlides - 1); // Notify parent of slide change
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const downloadSlideshow = () => {
    slideshowImages.forEach((image: any, index: number) => {
      const link = document.createElement('a');
      link.href = image.url;
      link.download = `tiktok-slide-${index + 1}-${image.file?.name || 'slide.jpg'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  const addTextOverlay = () => {
    const newText: TextOverlay = {
      id: Math.random().toString(36).substr(2, 9),
      slideIndex: currentSlide,
      text: 'Your Text Here',
      x: 50,
      y: 50,
      width: 60,
      height: 15,
      fontSize: 24,
      color: '#ffffff',
      fontFamily: 'TikTok Sans',
      fontWeight: '400',
      alignment: 'center',
      outlineColor: '#000000',
      outlineWidth: 1.9,
      outlinePosition: 'outer',
      bold: false,
      italic: false,
      outline: false,
      glow: false,
      glowColor: '#ffffff',
      glowIntensity: 5,
    };

    const updatedOverlays = [...localTextOverlays, newText];
    setLocalTextOverlays(updatedOverlays);
    onTextOverlaysChange?.(updatedOverlays);
  };

  const updateTextOverlay = (id: string, updates: Partial<TextOverlay>) => {
    const updatedOverlays = localTextOverlays.map(overlay =>
      overlay.id === id ? { ...overlay, ...updates } : overlay
    );
    setLocalTextOverlays(updatedOverlays);
    onTextOverlaysChange?.(updatedOverlays);
  };

  const removeTextOverlay = (id: string) => {
    const updatedOverlays = localTextOverlays.filter(overlay => overlay.id !== id);
    setLocalTextOverlays(updatedOverlays);
    onTextOverlaysChange?.(updatedOverlays);
  };

  const handleTextMouseDown = (e: React.MouseEvent, overlayId: string) => {
    e.preventDefault();
    setDraggedText(overlayId);
    // Calculate offset from the mouse position relative to the text element
    const rect = e.currentTarget.getBoundingClientRect();
    const container = e.currentTarget.closest('.tiktok-slideshow-container') as HTMLElement;
    if (container) {
      dragContainerRef.current = container; // Store container reference
      const containerRect = container.getBoundingClientRect();

      // Calculate the initial offset from the mouse click to the center of the text element
      const textCenterXRelativeToContainer = (rect.left + rect.width / 2) - containerRect.left;
      const textCenterYRelativeToContainer = (rect.top + rect.height / 2) - containerRect.top;

      setDragOffset({
        x: e.clientX - containerRect.left - textCenterXRelativeToContainer,
        y: e.clientY - containerRect.top - textCenterYRelativeToContainer,
      });
    }
  };

  const handleTextMouseMove = (e: React.MouseEvent) => {
    if (draggedText && dragContainerRef.current) {
      const container = dragContainerRef.current; // Use the stored container reference
      const containerRect = container.getBoundingClientRect();

      // Calculate new position relative to the container, accounting for the initial offset
      let newX = ((e.clientX - containerRect.left - dragOffset.x) / containerRect.width) * 100;
      let newY = ((e.clientY - containerRect.top - dragOffset.y) / containerRect.height) * 100;

      // Snap to center if close
      const snapThreshold = 5; // 5% threshold
      if (Math.abs(newX - 50) < snapThreshold) newX = 50;
      if (Math.abs(newY - 50) < snapThreshold) newY = 50;

      updateTextOverlay(draggedText, {
        x: Math.max(0, Math.min(100, newX)),
        y: Math.max(0, Math.min(100, newY)),
      });
    }
  };

  const handleTextMouseUp = () => {
    setDraggedText(null);
    dragContainerRef.current = null; // Clear container reference
  };




  const handleTextClick = (overlayId: string) => {
    const updatedOverlays = localTextOverlays.map(overlay =>
      overlay.id === overlayId
        ? { ...overlay, isSelected: true, isEditing: true }
        : { ...overlay, isSelected: false, isEditing: false }
    );
    setLocalTextOverlays(updatedOverlays);
    onTextOverlaysChange?.(updatedOverlays);
  };



  const handleTextChange = (overlayId: string, newText: string) => {
    updateTextOverlay(overlayId, { text: newText });
  };

  const handleTextBlur = (overlayId: string) => {
    const updatedOverlays = localTextOverlays.map(overlay =>
      overlay.id === overlayId ? { ...overlay, isEditing: false } : overlay
    );
    setLocalTextOverlays(updatedOverlays);
    onTextOverlaysChange?.(updatedOverlays);
  };

  // Only show "no images" message if there's no slideshow loaded AND no selected images
  if (!currentSlideshow && selectedImages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-gray-200 rounded-full flex items-center justify-center">
            <Play className="w-8 h-8 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No images selected
            </h3>
            <p className="text-gray-600">
              Select images from the file browser to preview your TikTok slideshow
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Only show "no slideshow" message if there's no slideshow loaded AND no slideshowImages
  if (!currentSlideshow && slideshowImages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-gray-200 rounded-full flex items-center justify-center">
            <Play className="w-8 h-8 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No slideshow available
            </h3>
            <p className="text-gray-600">
              Select images from the file browser to create a TikTok slideshow
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If we have a slideshow loaded but no slideshowImages, that's an error state
  if (currentSlideshow && slideshowImages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-red-200 rounded-full flex items-center justify-center">
            <Play className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Slideshow loading error
            </h3>
            <p className="text-gray-600">
              Failed to load slideshow images. Please try reloading the slideshow.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-gray-900 via-black to-gray-900 overflow-hidden relative z-10">
      {/* Main Content Area */}
      <div className="h-full flex">
        {/* Preview Area */}
        <div className="flex-1 flex flex-col">
          {/* Preview */}
          <div className="flex-1 flex flex-col">
              {/* Enhanced Header */}
              <motion.div
                className="flex items-center justify-between p-4 bg-black/50 backdrop-blur-md text-white border-b border-white/10"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center space-x-4">
                  <motion.div
                    className="flex items-center space-x-3"
                    whileHover={{ scale: 1.05 }}
                  >
                    <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <h2 className="text-lg font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                      TikTok Preview
                    </h2>
                  </motion.div>
                  <motion.span
                    className={cn(
                      "text-sm bg-black/30 px-3 py-1 rounded-full",
                      originalSlidesCount > cutLength ? "text-yellow-400" : "text-gray-400"
                    )}
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2 }}
                    title={originalSlidesCount > cutLength ? `Showing first ${cutLength} of ${originalSlidesCount} slides` : undefined}
                  >
                    {originalSlidesCount > cutLength ? (
                      <>Showing {slideshowImages.length} of {originalSlidesCount} slides • Slide {currentSlide + 1} of {slideshowImages.length}</>
                    ) : (
                      <>{slideshowImages.length} slides • Slide {currentSlide + 1} of {totalSlides}</>
                    )}
                  </motion.span>
                </div>

                <div className="flex items-center space-x-3">
                  <AspectRatioSelector
                    selectedAspectRatio={currentAspectRatio}
                    onAspectRatioChange={handleAspectRatioChange}
                    disabled={isCropping}
                  />
                  
                  {/* Cropping progress indicator */}
                  {isCropping && (
                    <div className="flex items-center space-x-2 text-white">
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                      <span className="text-sm">Cropping... {croppingProgress}%</span>
                    </div>
                  )}
                  
                  {/* Error display */}
                  {error && (
                    <div className="text-red-400 text-sm">
                      {error}
                    </div>
                  )}
                   
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={downloadSlideshow}
                      className="text-white hover:bg-white/10 border border-white/20"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/10 border border-white/20"
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                  </motion.div>
                </div>
              </motion.div>

              {/* Main Preview Area */}
             <div className="flex-1 relative overflow-hidden flex flex-col">
               <div
                 className="flex-1 bg-black flex items-center justify-center px-[100px] py-4"
                 onMouseEnter={() => setShowControls(true)}
                 onMouseLeave={() => setShowControls(false)}
               >
                 {/* Enhanced TikTok-style slideshow container */}
                 <div className="flex flex-col items-center w-full">
<motion.div
 className={cn(
   "relative w-full mx-auto bg-gray-200 rounded-2xl overflow-hidden shadow-2xl border border-gray-300 tiktok-slideshow-container",
   "aspect-[9/16]" // Always maintain 9:16 phone screen ratio
 )}
 initial={{ scale: 0.9, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 transition={{ duration: 0.4, delay: 0.2 }}
 whileHover={{ scale: 1.02 }}
 onMouseMove={handleTextMouseMove}
 onMouseUp={handleTextMouseUp}
 onMouseLeave={handleTextMouseUp}
>
                      {/* Current slide with transition effects */}
                    <motion.div
                      className="absolute inset-0"
                      key={currentSlide}
                      initial={
                        transitionEffect === 'slide' ? { x: 300, opacity: 0 } :
                        transitionEffect === 'zoom' ? { scale: 0.8, opacity: 0 } :
                        { opacity: 0 }
                      }
                      animate={{ x: 0, scale: 1, opacity: 1 }}
                      exit={
                        transitionEffect === 'slide' ? { x: -300, opacity: 0 } :
                        transitionEffect === 'zoom' ? { scale: 1.2, opacity: 0 } :
                        { opacity: 0 }
                      }
                      transition={{ duration: 0.5 }}
                    >
                      <div className="relative w-full h-full flex items-center justify-center bg-black">
                        <img
                          src={slideshowImages[currentSlide]?.url}
                          alt={`Slide ${currentSlide + 1}`}
                          className={cn(
                            "pointer-events-none",
                            // Always use object-contain to preserve aspect ratio without stretching
                            "object-contain"
                          )}
                          style={{
                            pointerEvents: 'none',
                            // Fill width (left/right edges), add black bars only on top/bottom when needed
                            ...(() => {
                              const currentImage = slideshowImages[currentSlide];
                              if (!currentImage?.width || !currentImage?.height) return {};

                              const containerRatio = 9/16; // 9:16 container
                              const imageRatio = currentImage.width / currentImage.height;

                              // Always try to fill width first (like TikTok)
                              const imageWidth = 100; // Full width of container

                              // Calculate what the height would be at full width
                              const calculatedHeight = imageWidth / imageRatio;

                              // If calculated height is taller than container, crop to fit (no black bars)
                              if (calculatedHeight > 100) {
                                // Image is too tall for container - crop to fit exactly
                                return {
                                  width: `${imageWidth}%`,
                                  height: '100%',
                                  maxWidth: 'none',
                                  maxHeight: 'none',
                                };
                              } else {
                                // Image fits in height - show with black bars on top/bottom
                                return {
                                  width: `${imageWidth}%`,
                                  height: `${calculatedHeight}%`,
                                  maxWidth: 'none',
                                  maxHeight: 'none',
                                };
                              }
                            })()
                          }}
                          onLoad={() => {}}
                          onError={(e) => {}}
                        />
  
                        <>
                          {/* Snapping guide lines */}
                          {draggedText && (
                            <>
                              {/* Horizontal center line */}
                              <div className="absolute left-0 right-0 top-1/2 h-px bg-blue-500 opacity-50 pointer-events-none" />
                              {/* Vertical center line */}
                              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-blue-500 opacity-50 pointer-events-none" />
                            </>
                          )}



                          {localTextOverlays.filter(overlay => overlay.slideIndex === currentSlide).map(overlay => {
                            return (
                            <div key={overlay.id}>
                              <div
                                contentEditable={overlay.isEditing}
                                suppressContentEditableWarning={true}
                                onBlur={(e: React.FocusEvent) => {
                                  const newText = e.currentTarget.textContent || '';
                                  const updatedOverlays = localTextOverlays.map(o =>
                                    o.id === overlay.id ? { ...o, text: newText, isEditing: false } : o
                                  );
                                  setLocalTextOverlays(updatedOverlays);
                                  onTextOverlaysChange?.(updatedOverlays);
                                }}
                                onKeyDown={(e: React.KeyboardEvent) => {
                                  if (e.key === 'Enter' || e.key === 'Escape') {
                                    e.preventDefault();
                                    const updatedOverlays = localTextOverlays.map(o =>
                                      o.id === overlay.id ? { ...o, isEditing: false } : o
                                    );
                                    setLocalTextOverlays(updatedOverlays);
                                    onTextOverlaysChange?.(updatedOverlays);
                                  }
                                }}
                                className={cn(
                                  "absolute select-none z-50",
                                  overlay.isEditing ? "bg-transparent border-none outline-none" : "",
                                  draggedText === overlay.id ? "cursor-grabbing" : overlay.isEditing ? "cursor-text" : "cursor-move"
                                )}
                                style={{
                                  left: `${overlay.x}%`,
                                  top: `${overlay.y}%`,
                                  fontSize: `${overlay.fontSize}px`,
                                  color: overlay.color,
                                  fontFamily: `"${overlay.fontFamily}", Arial, sans-serif`,
                                  fontWeight: overlay.bold ? 'bold' : overlay.fontWeight,
                                  fontStyle: overlay.italic ? 'italic' : 'normal',
                                  textAlign: overlay.alignment,
                                  transform: 'translate(-50%, -50%)',
                                  // Preserve explicit line breaks but don't auto-wrap
                                  whiteSpace: 'pre',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: 'calc(100vw - 40px)', // 20px padding on each side
                                  textShadow: overlay.isEditing ? 'none' : (() => {
                                    const shadows = [];
                                    
                                    // Add glow if enabled
                                    if (overlay.glow) {
                                      shadows.push(`0 0 ${overlay.glowIntensity}px ${overlay.glowColor}`);
                                    }
                                    
                                    // Add outline using text-shadow for outer strokes
                                    if (overlay.outline && overlay.outlinePosition === 'outer') {
                                      const outlineWidth = overlay.outlineWidth;
                                      const color = overlay.outlineColor;
                                      
                                      // Create multiple shadows around the text to simulate outline
                                      const maxOffset = Math.max(1, Math.ceil(outlineWidth));
                                      for (let i = 1; i <= maxOffset; i++) {
                                        let offset = i;
                                        // For fractional values, adjust the last iteration
                                        if (i === maxOffset && outlineWidth < maxOffset) {
                                          offset = outlineWidth;
                                        }
                                        shadows.push(
                                          `${offset}px 0 0 ${color}`,
                                          `-${offset}px 0 0 ${color}`,
                                          `0 ${offset}px 0 ${color}`,
                                          `0 -${offset}px 0 ${color}`,
                                          `${offset}px ${offset}px 0 ${color}`,
                                          `${offset}px -${offset}px 0 ${color}`,
                                          `-${offset}px ${offset}px 0 ${color}`,
                                          `-${offset}px -${offset}px 0 ${color}`
                                        );
                                      }
                                    }
                                    
                                    return shadows.length > 0 ? shadows.join(', ') : undefined;
                                  })(),
                                  WebkitTextStroke: overlay.isEditing ? 'none' : overlay.outline && overlay.outlinePosition !== 'outer' ? `${Math.max(0.5, overlay.outlineWidth / 2)}px ${overlay.outlineColor}` : undefined,
                                  WebkitTextFillColor: overlay.isEditing ? undefined : overlay.outline && overlay.outlinePosition === 'inner' ? 'transparent' : undefined,
                                  filter: 'none',
                                }}
                                onMouseDown={(e: React.MouseEvent) => {
                                  if (!overlay.isEditing) {
                                    handleTextMouseDown(e, overlay.id);
                                  }
                                }}
                                onClick={() => handleTextClick(overlay.id)}
                              >
                                {overlay.isEditing ? overlay.text : (
                                  <span className="inline-block max-w-full">
                                    {overlay.text}
                                  </span>
                                )}
                              </div>
                            </div>
                          )})}

                        </>
                      </div>
                    </motion.div>

                      {/* Enhanced slide indicators */}
                      <div className="absolute top-4 left-4 right-4 flex space-x-1">
                        {slideshowImages.map((_: any, index: number) => (
                          <motion.div
                            key={index}
                            className={cn(
                              "h-1 flex-1 rounded-full transition-all duration-300",
                              index === currentSlide
                                ? "bg-gradient-to-r from-pink-500 to-purple-600"
                                : index < currentSlide
                                ? "bg-white/50"
                                : "bg-white/20"
                            )}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: index * 0.1, duration: 0.3 }}
                          />
                        ))}
                      </div>

                      {/* Enhanced TikTok UI overlay */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                        <motion.div
                          className="text-white"
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.3 }}
                        >
                          <p className="text-sm font-bold mb-2 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                            @yourusername
                          </p>
                          {(postTitle && postTitle.trim()) && (
                            <h3 className="text-base font-semibold mb-2 text-white">
                              {postTitle}
                            </h3>
                          )}
                          {(!postTitle || !postTitle.trim()) && title && (
                            <h3 className="text-base font-semibold mb-2 text-white">
                              {title}
                            </h3>
                          )}
                          <p className="text-sm mb-2 leading-relaxed">
                            {caption}
                          </p>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {hashtags.map((tag, index) => (
                              <span key={index} className="text-xs text-blue-400">
                                #{tag}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-gray-400 flex items-center">
                            <Music className="w-3 h-3 mr-1" />
                            Original Sound • Slide {currentSlide + 1}/{slideshowImages.length}
                          </p>
                        </motion.div>
                      </div>

                      {/* TikTok-style interaction buttons */}
                      <div className="absolute right-4 bottom-20 flex flex-col space-y-4">
                        {[
                          { icon: Heart, count: '2.1M', color: 'text-red-500' },
                          { icon: MessageCircle, count: '12.3K', color: 'text-white' },
                          { icon: Share2, count: '45.2K', color: 'text-white' },
                          { icon: Repeat2, count: '892', color: 'text-green-400' }
                        ].map((item, index) => (
                          <motion.div
                            key={index}
                            className="flex flex-col items-center space-y-1"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.4 + index * 0.1 }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <div className={cn(
                              "w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20",
                              item.color
                            )}>
                              <item.icon className="w-6 h-6" />
                            </div>
                            <span className="text-xs text-white font-medium">{item.count}</span>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>

                  </div>
                </div>

                {/* Footer with slideshow info and controls */}
                <div className="p-4 bg-gray-900 text-white">
                  <div className="flex items-center justify-between">
                    <div className={cn(
                      "text-sm",
                      originalSlidesCount > cutLength ? "text-yellow-400" : "text-gray-400"
                    )}>
                      {originalSlidesCount > cutLength ? (
                        <>Showing {slideshowImages.length} of {originalSlidesCount} slides for TikTok</>
                      ) : (
                        <>{slideshowImages.length} slide{slideshowImages.length !== 1 ? 's' : ''} ready for TikTok</>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={prevSlide}
                        disabled={totalSlides <= 1}
                        className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4 text-white" />
                      </button>

                      <button
                        onClick={togglePlay}
                        className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center hover:from-pink-600 hover:to-purple-700 transition-all"
                      >
                        {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
                      </button>

                      <button
                        onClick={nextSlide}
                        disabled={totalSlides <= 1}
                        className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4 text-white" />
                      </button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleMute}
                        className="text-white hover:bg-gray-700"
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

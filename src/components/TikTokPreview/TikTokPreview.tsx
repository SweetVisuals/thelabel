
import React, { useState, useMemo, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, Edit3, Filter, Type, Crop, Music, Sparkles, Settings, Share2, Heart, MessageCircle, Repeat2, X, ChevronLeft, ChevronRight, Shuffle, Layers, Zap, Palette, Wand2 } from 'lucide-react';
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
  const [draggedText, setDraggedText] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragContainerRef = React.useRef<HTMLElement | null>(null);
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
    
    console.log('🎲 Starting remix with slideshow slides:', currentSlideshow.condensedSlides.length);
    
    const baseSlides = currentSlideshow.condensedSlides.slice(0, cutLength).map((slide: any) => ({
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
    
    if (currentSlideshow && currentSlideshow.condensedSlides && currentSlideshow.condensedSlides.length > 0) {
      console.log('📱 Using loaded slideshow (preview mode)');
      const originalCount = currentSlideshow.condensedSlides.length;
      
      const baseSlides = currentSlideshow.condensedSlides.slice(0, cutLength).map((slide: any) => ({
        id: slide.originalImageId || slide.id,
        condensedSlideId: slide.id,
        url: slide.condensedImageUrl,
        originalImageUrl: slide.originalImageUrl,
        width: slide.width,
        height: slide.height,
        aspectRatio: slide.aspectRatio,
        file: new File([], `slide-${slide.id}.jpg`),
      }));
      
      const displaySlides = isRemixed && remixedSlideshowImages.length > 0
        ? remixedSlideshowImages.slice(0, cutLength)
        : baseSlides;
      
      return { slideshowImages: displaySlides, originalSlidesCount: originalCount };
    }

    if (selectedImages.length > 0) {
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

      return { slideshowImages: orderedImages, originalSlidesCount: orderedImages.length };
    }

    return { slideshowImages: [], originalSlidesCount: 0 };
  }, [images, selectedImages, currentSlideshow, isRemixed, remixedSlideshowImages, cutLength]);

  // TODO: Add the rest of the component implementation
  return null;
};

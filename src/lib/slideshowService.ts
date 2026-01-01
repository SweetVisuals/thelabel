import { SlideshowMetadata, CondensedSlide, TikTokTextOverlay, UploadedImage, PostizSlideshowData, SlideshowTemplate, TemplateApplicationResult, BulkUploadWithTemplate } from '@/types';
import { postizAPI } from './postiz';
import { imageService, ImageCroppingService } from './imageService';
import { postizUploadService } from './postizUploadService';
import { uploadWithFallback } from './imgbb';
import { calculateCropArea } from './aspectRatio';
import { ensureTikTokFontsLoaded, fontLoader } from './fontUtils';

import { supabaseStorage } from './supabaseStorage'; export class SlideshowService {
  private static instance: SlideshowService;
  private slideshows: Map<string, SlideshowMetadata> = new Map();
  private templates: Map<string, SlideshowTemplate> = new Map();

  static getInstance(): SlideshowService {
    if (!SlideshowService.instance) {
      SlideshowService.instance = new SlideshowService();
    }
    return SlideshowService.instance;
  }

  /**
   * Get all loaded slideshows
   */
  getAllSlideshows(): SlideshowMetadata[] {
    return Array.from(this.slideshows.values());
  }

  /**
   * Create condensed slides by overlaying text on images and compressing them
   */
  async createCondensedSlides(
    images: UploadedImage[],
    textOverlays: TikTokTextOverlay[],
    aspectRatio: string
  ): Promise<CondensedSlide[]> {
    const condensedSlides: CondensedSlide[] = [];

    console.log(`🎨 createCondensedSlides called with ${images.length} images and ${textOverlays.length} text overlays`);
    console.log(`🎨 Text overlays:`, textOverlays.map(o => ({ text: o.text?.substring(0, 20), slideIndex: o.slideIndex })));

    // CRITICAL FIX: Ensure TikTok fonts are loaded once for all slides in bulk operations
    await ensureTikTokFontsLoaded();

    // Creating condensed slides with text overlays

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const slideTextOverlays = textOverlays.filter(overlay => overlay.slideIndex === i);

      console.log(`🖼️ Slide ${i}: ${slideTextOverlays.length} text overlays`, slideTextOverlays.map(o => ({ text: o.text?.substring(0, 20) })));

      try {
        const condensedSlide = await this.createCondensedSlide(image, slideTextOverlays, aspectRatio);
        condensedSlides.push(condensedSlide);
      } catch (error) {
        console.error(`Failed to create condensed slide for image ${image.id}:`, error);
        throw error;
      }
    }

    return condensedSlides;
  }

  /**
   * Create a single condensed slide by overlaying text on the image
   */
  private createCondensedSlide(
    image: UploadedImage,
    textOverlays: TikTokTextOverlay[],
    aspectRatio: string
  ): Promise<CondensedSlide> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          // Set canvas size based on aspect ratio
          const ratio = this.parseAspectRatio(aspectRatio);
          if (ratio > 0) {
            canvas.width = 1080; // Standard TikTok width
            canvas.height = Math.round(1080 / ratio);
          } else {
            // For 'free' aspect ratio, use the image's natural dimensions
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
          }

          // Draw the base image, cropping to fit aspect ratio
          if (ratio > 0) {
            // Calculate crop area to fit the aspect ratio
            const cropArea = calculateCropArea(img.naturalWidth, img.naturalHeight, ratio, img);

            // Draw the cropped portion scaled to canvas
            ctx.drawImage(
              img,
              cropArea.x, cropArea.y, cropArea.width, cropArea.height,
              0, 0, canvas.width, canvas.height
            );
          } else {
            // For free aspect ratio, draw at natural size
            ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
          }

          // Overlay text elements
          textOverlays.forEach(overlay => {
            this.drawTextOverlay(ctx, overlay, canvas.width, canvas.height);
          });

          // Convert to compressed image
          canvas.toBlob(
            async (blob) => {
              if (blob) {
                // Convert blob to base64 for storage in database
                const reader = new FileReader();
                reader.onload = () => {
                  const base64Data = reader.result as string;
                  resolve({
                    id: `condensed_${image.id}_${Date.now()}`,
                    originalImageId: image.id,
                    condensedImageUrl: base64Data, // For display/preview only
                    originalImageUrl: image.url, // Store original URL for API posting
                    width: canvas.width,
                    height: canvas.height,
                    aspectRatio: aspectRatio,
                    fileSize: blob.size
                  });
                };
                reader.onerror = () => {
                  reject(new Error('Failed to convert blob to base64'));
                };
                reader.readAsDataURL(blob);
              } else {
                reject(new Error('Failed to create blob from canvas'));
              }
            },
            'image/jpeg',
            0.85 // 85% quality for good compression
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = image.url;
    });
  }

  /**
   * Draw text overlay on canvas
   */
  private async drawTextOverlay(
    ctx: CanvasRenderingContext2D,
    overlay: TikTokTextOverlay,
    canvasWidth: number,
    canvasHeight: number
  ): Promise<void> {
    const { text, x, y, fontSize, color, fontFamily, fontWeight, alignment, bold, italic, outline, outlineColor, outlineWidth, outlinePosition, glow, glowColor, glowIntensity } = overlay;

    // Fonts are already loaded at the start of createCondensedSlides for bulk operations

    // Calculate position as percentage of canvas
    const posX = (x / 100) * canvasWidth;
    const posY = (y / 100) * canvasHeight;

    // Calculate correct scaling factor for TikTok format
    // The preview in TikTokPreview is designed to look good at various sizes
    // but the final TikTok format is standardized at 1080px width
    // We need to scale text appropriately to maintain visual proportions

    // Use a scaling factor that makes text appropriately sized for 1080px final width
    // 3x scaling gives better results than 4x
    const tiktokScaleFactor = 3;
    const scaledFontSize = Math.max(16, fontSize * tiktokScaleFactor);
    // Scale outline width more aggressively for better visibility (5x vs 3x for text)
    const strokeScaleFactor = 5;
    const scaledOutlineWidth = outlineWidth * strokeScaleFactor;
    const scaledGlowIntensity = Math.max(2, glowIntensity * tiktokScaleFactor);

    // Get the proper canvas font family with loaded TikTok fonts
    // CRITICAL FIX: Use the 'bold' boolean to determine the weight we want, 
    // as overlay.fontWeight might be stale or default '400'
    const effectiveFontWeight = bold ? '700' : (fontWeight || '400');
    const canvasFontFamily = fontLoader.getCanvasFontFamily(fontFamily, effectiveFontWeight);

    // Set font properties with loaded TikTok fonts and fallbacks
    // Construct the font string carefully to ensure browser parses it correctly

    // We are now using distinct font families for each weight (e.g. "TikTokBold", "TikTokRegular")
    // All of these are registered with weight '400'/'normal' to avoid browser synthetic bolding.
    // So we ALWAYS use 'normal' weight in the font string when using these families.
    const weight = 'normal';

    const style = italic ? 'italic' : 'normal';
    const size = `${scaledFontSize}px`;

    // Construct the full font string
    // fontLoader.getCanvasFontFamily returns a string like: '"TikTok Sans", Arial, sans-serif'
    // So we just need to interpolate it directly.
    const fontStyle = `${style} ${weight} ${size} ${canvasFontFamily}`;

    // Apply font to context
    ctx.font = fontStyle;

    // Verify if the font is actually loaded and ready
    // document.fonts.check() returns true if the font is loaded or if it's a system font
    // If it returns false, we should still try to draw, maybe logging a warning.
    // The previous behavior of returning early caused "no font is displayed".
    const isFontLoaded = document.fonts.check(fontStyle);
    if (!isFontLoaded) {
      console.warn(`⚠️ Font might not be loaded: ${fontStyle}. Drawing anyway.`);
    } else {
      console.log(`✅ Font confirmed loaded: ${fontStyle}`);
    }

    ctx.fillStyle = color;
    ctx.textAlign = alignment as CanvasTextAlign;
    ctx.textBaseline = 'top'; // Change to 'top' for multi-line text

    // Apply glow effect
    if (glow) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = scaledGlowIntensity;
    } else {
      ctx.shadowBlur = 0;
    }

    // Split text into lines for multi-line support
    const lines = text.split('\n');
    const lineHeight = scaledFontSize * 1.2; // 20% extra space between lines

    // Calculate starting Y position for vertical alignment
    let startY = posY;
    if (alignment === 'center') {
      startY = posY - (lines.length * lineHeight) / 2;
    } else if (alignment === 'right') {
      startY = posY - (lines.length * lineHeight);
    }

    // Draw each line
    lines.forEach((line, lineIndex) => {
      const currentY = startY + (lineIndex * lineHeight);

      // Apply outline for each line
      if (outline) {
        ctx.lineWidth = scaledOutlineWidth;
        ctx.strokeStyle = outlineColor;

        if (outlinePosition === 'outer' || outlinePosition === 'middle') {
          // Stroke text first (outer or middle outline)
          ctx.strokeText(line, posX, currentY);
        }

        if (outlinePosition === 'inner') {
          // Use fill with stroke for inner outline
          ctx.save();
          ctx.globalCompositeOperation = 'destination-in';
          ctx.strokeText(line, posX, currentY);
          ctx.restore();
        }
      }

      // Fill text
      ctx.fillText(line, posX, currentY);
    });
  }

  /**
   * Parse aspect ratio string to number
   */
  private parseAspectRatio(aspectRatio: string): number {
    if (aspectRatio === 'free') return 0;

    const [width, height] = aspectRatio.split(':').map(Number);
    return width / height;
  }

  /**
   * Save slideshow metadata with enhanced cropping integration
   */
  async saveSlideshow(
    title: string,
    postTitle: string,
    caption: string,
    hashtags: string[],
    images: UploadedImage[],
    textOverlays: TikTokTextOverlay[],
    aspectRatio: string,
    transitionEffect: 'fade' | 'slide' | 'zoom',
    musicEnabled: boolean,
    userId: string
  ): Promise<SlideshowMetadata> {
    try {
      // Starting enhanced slideshow save with smart cropping

      // CRITICAL FIX: Validate and ensure aspect ratio is properly determined
      const finalAspectRatio = aspectRatio || images[0]?.aspectRatio || '9:16';

      // Validate the final aspect ratio
      const validatedAspectRatio = this.validateAspectRatio(finalAspectRatio) ? finalAspectRatio : '9:16';

      // Use the validated aspect ratio
      const finalAR = validatedAspectRatio;

      // CRITICAL FIX: Crop images to target aspect ratio BEFORE creating slideshow
      let processedImages = images;

      if (finalAR !== 'free' && images.length > 0) {
        try {
          console.log('✂️ Pre-cropping images to target aspect ratio before slideshow creation...');

          // Get image IDs for cropping
          const imageIds = images.map(img => img.id);

          // Use enhanced cropping service to crop images
          const croppedImages = await ImageCroppingService.changeAspectRatio(
            imageIds,
            finalAR,
            userId
          );

          // Update images array with cropped versions
          const imageMap = new Map(croppedImages.map(img => [img.id, img]));
          processedImages = images.map(img => imageMap.get(img.id) || img);

          console.log(`✅ Pre-cropped ${croppedImages.length} images for slideshow creation`);

        } catch (cropError) {
          console.warn('⚠️ Failed to pre-crop images, proceeding with original images:', cropError);
          // Continue with original images if cropping fails
        }
      }


      // Create condensed slides (text consolidated into images) for slideshow display
      const condensedSlides = await this.createCondensedSlides(processedImages, textOverlays, finalAR);

      // Generate slideshow ID with prefix for consistency
      const slideshowId = `slideshow_${crypto.randomUUID()}`;


      // Upload condensed images to imgbb for slideshow creation and display
      const optimizedCondensedSlides = await this.uploadCondensedSlidesToSupabaseStorage(condensedSlides, userId);

      const slideshow: SlideshowMetadata = {
        id: slideshowId, // Use prefixed ID consistently throughout
        title,
        postTitle: postTitle || title, // Use postTitle if provided, fallback to title
        caption,
        hashtags,
        condensedSlides: optimizedCondensedSlides, // These now have imgbb URLs instead of base64!
        textOverlays, // Keep original text overlays for editing
        aspectRatio: finalAR, // Use the validated aspect ratio
        transitionEffect: transitionEffect, // Keep original transition effect
        musicEnabled: musicEnabled, // Keep original music setting
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: userId,
        folder_id: null // Initialize with no folder
      };

      console.log('✅ Enhanced slideshow object created with smart cropping:', {
        id: slideshow.id,
        title: slideshow.title,
        condensedSlidesCount: slideshow.condensedSlides.length,
        aspectRatio: slideshow.aspectRatio,
        hasImgbbUrls: slideshow.condensedSlides.every(slide => slide.condensedImageUrl?.includes('i.ibb.co'))
      });

      // Store in memory
      this.slideshows.set(slideshow.id, slideshow);

      // Save to localStorage for persistence (this makes it appear in the file browser)
      this.saveToLocalStorage();

      // Save to Supabase database for persistence
      await this.saveToDatabase(slideshow);

      // Dispatch custom event to update file browser immediately
      window.dispatchEvent(new CustomEvent('slideshowUpdated'));

      // Automatically export slideshow as a clickable file for the file browser
      console.log('💾📁 Auto-exporting slideshow as file...');
      try {
        await this.saveSlideshowFile(slideshow);
        console.log('✅ Slideshow file auto-created successfully');

        // Trigger storage events to update file browser
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'savedSlideshows',
          newValue: localStorage.getItem('savedSlideshows')
        }));
      } catch (exportError) {
        console.warn('⚠️ Failed to auto-export slideshow file:', exportError);
        // Don't fail the entire save operation if file export fails
      }

      console.log('✅💾 Enhanced slideshow saved successfully:', slideshow.title, 'with', optimizedCondensedSlides.length, 'slides (smart cropped, uploaded URLs)');
      console.log('🎯 Slideshow ready for posting with aspect ratio:', slideshow.aspectRatio);

      return slideshow;
    } catch (error) {
      console.error('❌ Failed to save slideshow:', error);
      throw error;
    }
  }

  /**
   * Load slideshow by ID
   */
  async loadSlideshow(slideshowId: string): Promise<SlideshowMetadata | null> {
    console.log('🔍📋 SLIDESHOW SERVICE: loadSlideshow called with ID:', slideshowId);
    console.log('📊 Current memory slideshows count:', this.slideshows.size);

    // Check memory first
    console.log('🔍 Checking memory for slideshow:', slideshowId);
    let slideshow = this.slideshows.get(slideshowId);
    console.log('🧠 Memory result:', { found: !!slideshow, title: slideshow?.title, postTitle: slideshow?.postTitle });

    if (!slideshow) {
      console.log('📁 Not in memory, trying localStorage...');
      // Try to load from localStorage
      this.loadFromLocalStorage();
      slideshow = this.slideshows.get(slideshowId);
      console.log('💾 localStorage result:', { found: !!slideshow, title: slideshow?.title, postTitle: slideshow?.postTitle });
    }

    if (!slideshow) {
      console.log('🗄️ Not in localStorage, trying database...');
      // Try to load from database - we need to get userId from existing slideshows or from auth
      try {
        const { supabase } = await import('./supabase');
        const { data: { session } } = await supabase.auth.getSession();
        console.log('🔐 Auth session check:', { hasSession: !!session, hasUser: !!session?.user?.id });

        if (session?.user?.id) {
          await this.loadFromDatabase(session.user.id);
          slideshow = this.slideshows.get(slideshowId);
          console.log('🗄️ Database result:', { found: !!slideshow, title: slideshow?.title, postTitle: slideshow?.postTitle });
        }
      } catch (error) {
        console.error('❌ Failed to get user session for database load:', error);
      }
    }

    if (!slideshow) {
      console.log('💻 Not found anywhere else, trying file system...');
      // Try to load from file system - this is now the primary load method
      const loadedSlideshow = await this.loadFromFileSystem(slideshowId);
      slideshow = loadedSlideshow || undefined;
      console.log('💻 File system result:', { found: !!loadedSlideshow, title: loadedSlideshow?.title, postTitle: loadedSlideshow?.postTitle });
    }

    const finalResult = slideshow || null;
    console.log('🎯📋 SLIDESHOW SERVICE: Final result:', {
      slideshowId,
      found: !!finalResult,
      title: finalResult?.title,
      postTitle: finalResult?.postTitle,
      condensedSlidesCount: finalResult?.condensedSlides?.length || 0
    });

    return finalResult;
  }

  /**
   * Load slideshow with clear settings - returns slideshow data but clears text fields for editing
   * This ensures slideshows always load with clear settings unless the user wants to add something
   */
  async loadSlideshowWithClearSettings(slideshowId: string): Promise<SlideshowMetadata | null> {
    console.log('🧹📋 SLIDESHOW SERVICE: loadSlideshowWithClearSettings called with ID:', slideshowId);

    // Load the original slideshow first
    const originalSlideshow = await this.loadSlideshow(slideshowId);

    if (!originalSlideshow) {
      console.log('❌ No slideshow found with ID:', slideshowId);
      return null;
    }

    // Create a clean version with cleared text fields
    const cleanSlideshow: SlideshowMetadata = {
      ...originalSlideshow,
      // Clear all text content but preserve images and formatting settings
      title: '',
      postTitle: '',
      caption: '',
      hashtags: [],
      textOverlays: [], // Clear all text overlays
      // Keep structural and formatting settings
      aspectRatio: originalSlideshow.aspectRatio,
      transitionEffect: originalSlideshow.transitionEffect,
      musicEnabled: originalSlideshow.musicEnabled,
      condensedSlides: originalSlideshow.condensedSlides, // Keep the slides/images
      updated_at: new Date().toISOString() // Update timestamp to indicate this is a fresh load
    };

    console.log('🧹📋 Created clean slideshow with cleared text fields:', {
      slideshowId,
      originalTitle: originalSlideshow.title,
      newTitle: cleanSlideshow.title,
      slideCount: cleanSlideshow.condensedSlides.length,
      hasClearedText: !cleanSlideshow.title && !cleanSlideshow.caption && cleanSlideshow.hashtags.length === 0
    });

    return cleanSlideshow;
  }

  /**
   * Load slideshow from file
   */
  async loadSlideshowFromFile(file: File): Promise<SlideshowMetadata> {
    try {
      console.log('Loading slideshow from file:', file.name);
      const content = await file.text();
      const slideshow = JSON.parse(content) as SlideshowMetadata;

      // Validate the slideshow structure
      if (!slideshow.id || !slideshow.title || !slideshow.condensedSlides) {
        throw new Error('Invalid slideshow file format');
      }

      // Ensure backward compatibility fields exist
      if (!('folder_id' in slideshow)) {
        (slideshow as any).folder_id = null;
      }

      // Ensure postTitle exists for backward compatibility (fix for missing postTitle)
      if (!('postTitle' in slideshow)) {
        (slideshow as any).postTitle = slideshow.title; // Fallback to title
      }

      console.log('Parsed slideshow:', slideshow.title, 'with', slideshow.condensedSlides.length, 'slides');
      console.log('📝 Post title loaded:', slideshow.postTitle);

      // Store in memory for future reference
      this.slideshows.set(slideshow.id, slideshow);
      this.saveToLocalStorage();

      // Dispatch custom event to update file browser
      window.dispatchEvent(new CustomEvent('slideshowUpdated'));

      return slideshow;
    } catch (error) {
      console.error('Failed to load slideshow from file:', error);
      throw new Error('Invalid slideshow file');
    }
  }

  /**
   * Get all saved slideshows for a user
   */
  getSavedSlideshows(userId: string): SlideshowMetadata[] {
    return Array.from(this.slideshows.values())
      .filter(slideshow => slideshow.user_id === userId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  /**
   * Delete slideshow
   */
  async deleteSlideshow(slideshowId: string): Promise<void> {
    let databaseDeletionFailed = false;

    // Delete from memory first
    this.slideshows.delete(slideshowId);

    // Save to localStorage immediately
    this.saveToLocalStorage();

    // Delete from database
    try {
      await this.deleteFromDatabase(slideshowId);
      console.log('Successfully deleted slideshow from database');
    } catch (error) {
      console.error('Failed to delete slideshow from database:', error);
      databaseDeletionFailed = true;
      // Continue with local deletion even if database deletion fails
    }

    // Delete from file system (placeholder)
    await this.deleteFromFileSystem(slideshowId);

    // Clean up file data for file browser integration
    const fileKey = `slideshow_file_${slideshowId}`;
    localStorage.removeItem(fileKey);

    // Dispatch custom event to update file browser immediately
    window.dispatchEvent(new CustomEvent('slideshowUpdated'));

    if (databaseDeletionFailed) {
      console.warn('Slideshow deleted locally but database deletion failed. Slideshow may reappear on reload.');
      throw new Error('Slideshow deleted locally but database deletion failed. Please check your connection and try again.');
    }

    console.log('Slideshow deleted successfully:', slideshowId);
  }

  /**
   * Format caption with hashtags for Buffer
   */
  formatCaptionForBuffer(caption: string, hashtags: string[]): string {
    // Use the caption exactly as provided - no automatic modifications
    const hashtagText = hashtags.map(tag => `#${tag}`).join(' ');
    // Ensure proper line breaks for TikTok display
    return `${caption}\n\n${hashtagText}`;
  }

  /**
   * Create Postiz post data from slideshow with payload size optimization
   */
  createPostizPostData(
    slideshow: SlideshowMetadata,
    profileIds: string[],
    scheduledAt?: Date,
    postNow: boolean = false
  ): PostizSlideshowData {
    // Get optimized media URLs with size checking
    const { optimizedUrls, hasLargePayload } = this.optimizeSlideshowPayload(slideshow);

    if (hasLargePayload) {
      console.warn('⚠️ Large slideshow payload detected. Consider reducing image count or using compressed images.');
    }

    return {
      text: this.formatCaptionForBuffer(slideshow.caption, slideshow.hashtags),
      profileIds: profileIds,
      mediaUrls: optimizedUrls,
      scheduledAt: scheduledAt?.toISOString(),
      publishedAt: postNow ? new Date().toISOString() : undefined
    };
  }

  /**
   * Optimize slideshow payload to avoid 413 errors
   */
  optimizeSlideshowPayload(slideshow: SlideshowMetadata): { optimizedUrls: string[], hasLargePayload: boolean } {
    const urls: string[] = [];
    let totalSize = 0;
    let hasLargeDataUrl = false;

    for (const slide of slideshow.condensedSlides) {
      let url = '';

      // CRITICAL FIX: Priority 1 - Use imgbb URL if available (best for Postiz)
      if (slide.condensedImageUrl?.includes('i.ibb.co')) {
        console.log(`🔗 Using imgbb URL (optimized) for slide ${slide.id}`);
        url = slide.condensedImageUrl;
      }
      // Priority 2 - Use condensed image URL if it's NOT base64
      else if (slide.condensedImageUrl && !slide.condensedImageUrl.startsWith('data:')) {
        console.log(`🖼️ Using condensed image URL (with text) for slide ${slide.id}`);
        url = slide.condensedImageUrl;
      }
      // Priority 3 - Fallback to original image URL ONLY if no better option
      else if (slide.originalImageUrl) {
        console.warn(`⚠️ Fallback to original image (NO TEXT) for slide ${slide.id}`);
        url = slide.originalImageUrl;
      }
      // Priority 4 - Last resort: keep base64 if nothing else works
      else if (slide.condensedImageUrl?.startsWith('data:')) {
        console.warn(`⚠️ Using base64 data (large payload) for slide ${slide.id}`);
        url = slide.condensedImageUrl;
        hasLargeDataUrl = true;
      }

      urls.push(url);

      // Estimate size for payload optimization
      if (url.startsWith('data:')) {
        // Base64 data URLs are roughly 33% larger than the original binary data
        totalSize += (url.length * 3) / 4;
        hasLargeDataUrl = true;
      } else if (url.startsWith('http')) {
        // For actual URLs (imgbb or others), we need to estimate the image size
        // imgbb URLs are generally much smaller than base64 data
        if (url.includes('i.ibb.co')) {
          totalSize += 50000; // ~50KB per imgbb image (much smaller than base64)
        } else {
          totalSize += 200000; // Assume ~200KB per image on average
        }
      }
    }

    // Check if payload might be too large (rough threshold)
    const hasLargePayload = hasLargeDataUrl || totalSize > 1000000; // 1MB threshold

    console.log('📊 Payload optimization result:', {
      urlsCount: urls.length,
      hasLargePayload,
      usingImgbbUrls: urls.some(url => url.includes('i.ibb.co')),
      usingBase64: urls.some(url => url.startsWith('data:')),
      totalEstimatedSize: Math.round(totalSize / 1024) + 'KB'
    });
    return { optimizedUrls: urls, hasLargePayload };
  }

  /**
   * Upgrade slideshow by adding originalImageUrl to condensed slides
   * This is used to fix existing slideshows that have large base64 data
   */
  async upgradeSlideshowPayload(slideshow: SlideshowMetadata): Promise<SlideshowMetadata> {
    try {
      console.log('🔄 Upgrading slideshow payload to reduce size...');

      // Load the original images to get their URLs
      const allImages = await imageService.loadImages();
      const imageUrlMap = new Map(allImages.map(img => [img.id, img.url]));

      // Update each condensed slide to include original URL if missing
      const upgradedSlides = slideshow.condensedSlides.map(slide => {
        if (!slide.originalImageUrl && slide.originalImageId) {
          const originalUrl = imageUrlMap.get(slide.originalImageId);
          if (originalUrl) {
            console.log(`✅ Added original URL for slide ${slide.id}`);
            return {
              ...slide,
              originalImageUrl: originalUrl
            };
          }
        }
        return slide;
      });

      // Create upgraded slideshow
      const upgradedSlideshow: SlideshowMetadata = {
        ...slideshow,
        condensedSlides: upgradedSlides
      };

      // Update in memory
      this.slideshows.set(slideshow.id, upgradedSlideshow);

      // Save to localStorage
      this.saveToLocalStorage();

      // Save to database
      await this.saveToDatabase(upgradedSlideshow);

      console.log(`✅ Upgraded slideshow: ${slideshow.title} (${upgradedSlides.length} slides)`);
      return upgradedSlideshow;

    } catch (error) {
      console.error('❌ Failed to upgrade slideshow payload:', error);
      return slideshow; // Return original if upgrade fails
    }
  }

  /**
   * Check if slideshow needs upgrading (has large base64 payloads)
   */
  needsUpgrade(slideshow: SlideshowMetadata): boolean {
    return slideshow.condensedSlides.some(slide =>
      slide.condensedImageUrl?.startsWith('data:') && !slide.originalImageUrl
    );
  }

  /**
   * Upload condensed slides to imgbb and return optimized slides with imgbb URLs
   */
  /**
   * Upload condensed slides to Supabase storage and return optimized slides with Supabase URLs
   */
  private async uploadCondensedSlidesToSupabaseStorage(condensedSlides: CondensedSlide[], userId: string): Promise<CondensedSlide[]> {
    const optimizedSlides: CondensedSlide[] = [];

    for (let i = 0; i < condensedSlides.length; i++) {
      const slide = condensedSlides[i];

      try {
        console.log(`📤 Uploading slide ${i + 1}/${condensedSlides.length} to Supabase storage: ${slide.id}`);

        // Convert base64 data URL to File object
        const imageFile = await this.dataUrlToFile(slide.condensedImageUrl, `slideshow_slide_${i + 1}.jpg`);

        // Upload to Supabase storage
        const uploadResult = await supabaseStorage.uploadFile(imageFile, userId, 'consolidated');

        // Create optimized slide with Supabase storage URL
        const optimizedSlide: CondensedSlide = {
          ...slide,
          condensedImageUrl: uploadResult.url, // Replace base64 with Supabase storage URL
          originalImageUrl: slide.originalImageUrl // Keep original as backup
        };

        console.log(`✅ Successfully uploaded slide ${i + 1} to Supabase storage:`, uploadResult.url);
        optimizedSlides.push(optimizedSlide);

      } catch (error) {
        console.error(`❌ Failed to upload slide ${i + 1} to Supabase storage:`, error);

        // CRITICAL FIX: For bulk slideshow creation, we MUST use Supabase storage
        // Throw error instead of falling back to base64 to ensure proper storage usage
        throw new Error(`Failed to upload condensed slide to Supabase storage. Please check your Supabase configuration and ensure storage policies are set up correctly. Original error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const successCount = optimizedSlides.filter(slide => slide.condensedImageUrl && !slide.condensedImageUrl.startsWith('data:')).length;
    console.log(`🎉 Completed upload: ${successCount}/${condensedSlides.length} slides optimized (Supabase storage)`);

    return optimizedSlides;
  }
  /**
   * Convert data URL to File object
   */
  private async dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], filename, { type: 'image/jpeg' }));
            } else {
              reject(new Error('Failed to convert canvas to blob'));
            }
          },
          'image/jpeg',
          0.9
        );
      };

      img.onerror = () => reject(new Error('Failed to load image from data URL'));
      img.src = dataUrl;
    });
  }

  /**
   * Auto-upgrade slideshow if it needs it and return optimized data
   */
  async getOptimizedPostData(
    slideshow: SlideshowMetadata,
    profileIds: string[],
    scheduledAt?: Date,
    postNow: boolean = false
  ): Promise<PostizSlideshowData> {
    let slideshowToUse = slideshow;

    // Auto-upgrade if needed
    if (this.needsUpgrade(slideshow)) {
      console.log('🔄 Auto-upgrading slideshow to reduce payload size...');
      slideshowToUse = await this.upgradeSlideshowPayload(slideshow);
    }

    // Get optimized data
    return this.createPostizPostData(slideshowToUse, profileIds, scheduledAt, postNow);
  }

  /**
   * Schedule slideshow post via Postiz using the 2-step process:
   * Step 1: Upload images to Postiz storage
   * Step 2: Create post using Postiz image gallery URLs
   */
  async scheduleSlideshowPost(
    slideshow: SlideshowMetadata,
    profileIds: string[],
    scheduledAt?: Date,
    postNow: boolean = false
  ): Promise<any> {
    try {
      console.log('🚀 Starting 2-step slideshow post to Postiz...');
      console.log('📋 Slideshow details:', {
        title: slideshow.title,
        slideCount: slideshow.condensedSlides.length,
        profileCount: profileIds.length,
        hasScheduledDate: !!scheduledAt,
        postNow
      });

      // ========================================
      // STEP 1: Upload imgbb images to Postiz storage
      // ========================================
      console.log('📤 STEP 1: Uploading images to Postiz storage...');
      const postizMedia = await postizUploadService.uploadImgbbImagesToPostiz(slideshow);

      if (postizMedia.length === 0) {
        throw new Error('No images were successfully uploaded to Postiz storage. Cannot create post without images.');
      }

      console.log(`✅ STEP 1 COMPLETE: ${postizMedia.length} images uploaded to Postiz storage`);
      console.log('📊 Postiz media details:', postizMedia);

      // ========================================
      // STEP 2: Create post using Postiz image gallery URLs
      // ========================================
      console.log('📤 STEP 2: Creating TikTok post with Postiz image gallery URLs...');

      const captionText = this.formatCaptionForBuffer(slideshow.caption, slideshow.hashtags);

      const result = await postizAPI.createPostWithPostizImages(
        captionText,                           // Post content
        profileIds[0],                         // Integration ID (TikTok profile)
        postizMedia,                           // Postiz uploaded images {id, path}[]
        scheduledAt,                           // Scheduled date (if any)
        postNow                                // Post immediately or schedule
      );

      console.log('✅ STEP 2 COMPLETE: TikTok post created successfully');
      console.log('🎉 Final result:', result);

      return {
        id: result.postId,
        integration: result.integration,
        status: 'scheduled',
        scheduledAt: scheduledAt?.toISOString(),
        mediaCount: postizMedia.length,
        slideshowTitle: slideshow.title
      };

    } catch (error) {
      console.error('❌ Failed to post slideshow to Postiz:', error);
      throw error;
    }
  }

  /**
   * Save to localStorage with quota management
   */
  private saveToLocalStorage(): void {
    try {
      const data = Array.from(this.slideshows.entries());
      const jsonData = JSON.stringify(data);

      // Check if data is too large (rough estimate: 4MB limit)
      if (jsonData.length > 4 * 1024 * 1024) {
        console.warn('⚠️ Slideshow data too large for localStorage, cleaning up old slideshows...');

        // Keep only the 10 most recent slideshows
        const sortedSlideshows = Array.from(this.slideshows.values())
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 10);

        this.slideshows.clear();
        sortedSlideshows.forEach(slideshow => {
          this.slideshows.set(slideshow.id, slideshow);
        });

        // Retry with reduced data
        const reducedData = Array.from(this.slideshows.entries());
        localStorage.setItem('savedSlideshows', JSON.stringify(reducedData));
        console.log('💾 Saved reduced slideshows to localStorage:', reducedData.length);
        return;
      }

      localStorage.setItem('savedSlideshows', jsonData);
      console.log('💾 Saved slideshows to localStorage:', data.length);
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('⚠️ localStorage quota exceeded, clearing old data...');

        try {
          // Clear all slideshow data and keep only essential info
          const essentialData = Array.from(this.slideshows.values()).map(slideshow => ({
            id: slideshow.id,
            title: slideshow.title,
            created_at: slideshow.created_at,
            updated_at: slideshow.updated_at,
            user_id: slideshow.user_id,
            folder_id: slideshow.folder_id
          }));

          localStorage.setItem('savedSlideshows', JSON.stringify(essentialData));
          console.log('💾 Saved essential slideshow data to localStorage');
        } catch (fallbackError) {
          console.error('❌ Failed to save even essential data to localStorage:', fallbackError);
          // Clear localStorage completely as last resort
          try {
            localStorage.removeItem('savedSlideshows');
            console.log('🗑️ Cleared localStorage to prevent quota errors');
          } catch (clearError) {
            console.error('❌ Failed to clear localStorage:', clearError);
          }
        }
      } else {
        console.error('Failed to save to localStorage:', error);
      }
    }
  }

  /**
   * Load from localStorage
   */
  public loadFromLocalStorage(): void {
    try {
      const data = localStorage.getItem('savedSlideshows');
      if (data) {
        const entries = JSON.parse(data);
        this.slideshows = new Map(entries);
        console.log('💾 Loaded slideshows from localStorage:', entries.length);
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    }
  }

  /**
   * Load slideshows for user (combines localStorage and database)
   */
  async loadUserSlideshows(userId: string): Promise<void> {
    // First try to load from localStorage for immediate display
    this.loadFromLocalStorage();

    // Then load from database in background (will update localStorage)
    await this.loadFromDatabase(userId);

    // Force a re-render by dispatching a storage event
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'savedSlideshows',
      newValue: localStorage.getItem('savedSlideshows')
    }));

    // Also save to localStorage after loading from database to ensure persistence
    this.saveToLocalStorage();


  }

  /**
   * Save to file system (using File System Access API)
   */
  private async saveToFileSystem(slideshow: SlideshowMetadata): Promise<void> {
    try {
      if ('showSaveFilePicker' in window) {
        const fileName = `${slideshow.title.replace(/[^a-zA-Z0-9]/g, '_')}.slideshow`;
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'Slideshow File',
            accept: { 'application/json': ['.slideshow'] }
          }]
        });

        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(slideshow, null, 2));
        await writable.close();
      }
    } catch (error) {
      console.warn('File System Access not available or user cancelled:', error);
    }
  }

  /**
   * Load from file system
   */
  private async loadFromFileSystem(slideshowId: string): Promise<SlideshowMetadata | null> {
    try {
      if ('showOpenFilePicker' in window) {
        const [fileHandle] = await (window as any).showOpenFilePicker({
          types: [{
            description: 'Slideshow File',
            accept: { 'application/json': ['.slideshow'] }
          }],
          excludeAcceptAllOption: true,
          multiple: false
        });

        const file = await fileHandle.getFile();
        const content = await file.text();
        const slideshow = JSON.parse(content) as SlideshowMetadata;

        if (slideshow.id === slideshowId) {
          this.slideshows.set(slideshow.id, slideshow);
          return slideshow;
        }
      }
    } catch (error) {
      console.warn('Failed to load from file system:', error);
    }
    return null;
  }

  /**
   * Save slideshow as a downloadable file (simulated file browser integration)
   */
  private async saveSlideshowFile(slideshow: SlideshowMetadata): Promise<void> {
    try {
      console.log('💾 saveSlideshowFile called for:', slideshow.title, 'ID:', slideshow.id);

      // Create a blob and download link for the slideshow file
      const content = JSON.stringify(slideshow, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Create a simulated file entry in localStorage that the file browser can detect
      const fileKey = `slideshow_file_${slideshow.id}`;
      const fileData = {
        id: slideshow.id,
        name: `${slideshow.title.replace(/[^a-zA-Z0-9]/g, '_')}.slideshow`,
        type: 'slideshow',
        blob: content,
        created: new Date().toISOString(),
        folderId: slideshow.folder_id || null
      };

      console.log('💾 About to save slideshow file to localStorage:', fileKey);
      console.log('📁 File data structure:', fileData);

      localStorage.setItem(fileKey, JSON.stringify(fileData));

      // Verify it was saved
      const saved = localStorage.getItem(fileKey);
      console.log('✅ Slideshow file saved successfully:', !!saved);

      console.log('🎯 Slideshow file created and ready for download:', slideshow.title);

      // Don't revoke the URL immediately so the user can still download it if needed
      setTimeout(() => URL.revokeObjectURL(url), 30000); // Revoke after 30 seconds
    } catch (error) {
      console.warn('❌ Failed to create slideshow file:', error);
      // Don't throw - this is a nice-to-have feature
    }
  }

  /**
   * Get slideshow files from localStorage for file browser integration
   */
  getSlideshowFiles(): { id: string; name: string; type: string; blob: string; created: string; folderId?: string | null }[] {
    const files: { id: string; name: string; type: string; blob: string; created: string; folderId?: string | null }[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('slideshow_file_')) {
        try {
          const fileData = localStorage.getItem(key);
          if (fileData) {
            files.push(JSON.parse(fileData));
          }
        } catch (error) {
          console.warn('Failed to parse slideshow file data:', error);
        }
      }
    }

    return files.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  }

  /**
   * Export slideshow as a clickable file in the file browser
   */
  async exportSlideshowAsFile(slideshowId: string): Promise<void> {
    console.log('🎯 exportSlideshowAsFile called with slideshowId:', slideshowId);
    const slideshow = this.slideshows.get(slideshowId);
    if (!slideshow) {
      console.error('❌ Slideshow not found in memory for ID:', slideshowId);
      throw new Error('Slideshow not found');
    }

    try {
      console.log('📝 About to save slideshow file for:', slideshow.title);
      await this.saveSlideshowFile(slideshow);

      // Trigger a storage event to update the file browser
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'savedSlideshows',
        newValue: localStorage.getItem('savedSlideshows')
      }));

      // Also dispatch custom slideshow updated event
      window.dispatchEvent(new CustomEvent('slideshowUpdated'));

      console.log('✅ Slideshow exported as file:', slideshow.title);

      // Verify the file was created
      const fileKey = `slideshow_file_${slideshow.id}`;
      const savedFile = localStorage.getItem(fileKey);
      console.log('🔍 Verifying saved file exists:', !!savedFile, 'Key:', fileKey);

    } catch (error) {
      console.error('❌ Failed to export slideshow:', error);
      throw error;
    }
  }

  /**
   * Save to Supabase database
   */
  private async saveToDatabase(slideshow: SlideshowMetadata): Promise<void> {
    try {
      const { supabase } = await import('./supabase');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        throw new Error('User not authenticated');
      }

      // Extract the actual UUID from slideshow ID (remove "slideshow_" prefix if present)
      const actualDatabaseId = slideshow.id.startsWith('slideshow_')
        ? slideshow.id.replace('slideshow_', '')
        : slideshow.id;

      // Save slideshow metadata to database with proper UUID
      const { error } = await supabase
        .from('slideshows')
        .upsert({
          id: actualDatabaseId, // Use clean UUID for database
          user_id: slideshow.user_id,
          title: slideshow.title,
          description: slideshow.caption,
          aspect_ratio: slideshow.aspectRatio,
          created_at: slideshow.created_at,
          updated_at: slideshow.updated_at,
          metadata: {
            hashtags: slideshow.hashtags,
            condensedSlides: slideshow.condensedSlides,
            textOverlays: slideshow.textOverlays,
            postTitle: slideshow.postTitle,
            transitionEffect: slideshow.transitionEffect,
            musicEnabled: slideshow.musicEnabled,
            folder_id: slideshow.folder_id || null,
            uploadCount: slideshow.uploadCount || 0
          }
        });

      if (error) {
        console.error('Failed to save slideshow to database:', error);
        // Don't throw error - localStorage is still the primary storage
      }
    } catch (error) {
      console.error('Failed to save slideshow to database:', error);
      // Don't throw error - localStorage is still the primary storage
    }
  }

  /**
   * Load from Supabase database
   */
  private async loadFromDatabase(userId: string): Promise<void> {
    try {
      const { supabase } = await import('./supabase');
      const { data: slideshows, error } = await supabase
        .from('slideshows')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Failed to load slideshows from database:', error);
        return;
      }

      // Only log if slideshow count changed
      const currentCount = this.slideshows.size;
      const newCount = slideshows?.length || 0;

      if (currentCount !== newCount || currentCount === 0) {
        console.log('📊 Slideshows loaded:', newCount);
      }

      // AUTHORITATIVE SYNC: Create a set of IDs from the database
      const dbSlideshowIds = new Set<string>();

      // Convert database format to SlideshowMetadata
      slideshows?.forEach(dbSlideshow => {
        try {
          const metadata = dbSlideshow.metadata || {};
          // Add slideshow prefix for internal compatibility
          const slideshowId = `slideshow_${dbSlideshow.id}`;
          dbSlideshowIds.add(slideshowId); // Track valid DB ID

          const slideshow: SlideshowMetadata = {
            id: slideshowId, // Add prefix for internal compatibility
            title: dbSlideshow.title,
            caption: dbSlideshow.description || '',
            hashtags: metadata.hashtags || [],
            condensedSlides: metadata.condensedSlides || [],
            textOverlays: metadata.textOverlays || [],
            aspectRatio: dbSlideshow.aspect_ratio || '9:16',
            transitionEffect: metadata.transitionEffect || 'fade',
            musicEnabled: metadata.musicEnabled || false,
            created_at: dbSlideshow.created_at,
            updated_at: dbSlideshow.updated_at,
            user_id: dbSlideshow.user_id,
            folder_id: metadata.folder_id || null,
            // Ensure postTitle exists - fallback to title if not in metadata
            postTitle: metadata.postTitle || dbSlideshow.title,
            uploadCount: metadata.uploadCount || 0,
            lastUploadStatus: metadata.lastUploadStatus // Restore upload status
          };

          // Store in memory
          this.slideshows.set(slideshow.id, slideshow);
        } catch (parseError) {
          console.error('Failed to parse slideshow metadata:', parseError);
        }
      });

      // AUTHORITATIVE SYNC: Remove any local slideshows for this user that are NOT in the database
      // This handles the case where a slideshow was deleted on another device
      for (const [id, slideshow] of this.slideshows.entries()) {
        if (slideshow.user_id === userId && !dbSlideshowIds.has(id)) {
          console.log(`🗑️ Sync: Removing local slideshow ${id} as it was deleted on server`);
          this.slideshows.delete(id);

          // Also cleanup file entry if it exists
          const fileKey = `slideshow_file_${id}`;
          localStorage.removeItem(fileKey);
        }
      }

      // Save to localStorage for faster access and persistence of the correct state
      this.saveToLocalStorage();

      // Only log total count if changed
      if (currentCount !== this.slideshows.size) {
        console.log('📊 Total slideshows after database load (authoritative sync):', this.slideshows.size);
      }
    } catch (error) {
      console.error('Failed to load slideshows from database:', error);
    }
  }

  /**
   * Delete from Supabase database
   */
  private async deleteFromDatabase(slideshowId: string): Promise<void> {
    try {
      const { supabase } = await import('./supabase');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        throw new Error('User not authenticated for database deletion');
      }

      // Extract the actual UUID from slideshow ID (remove "slideshow_" prefix if present)
      const actualDatabaseId = slideshowId.startsWith('slideshow_')
        ? slideshowId.replace('slideshow_', '')
        : slideshowId;

      const { error } = await supabase
        .from('slideshows')
        .delete()
        .eq('id', actualDatabaseId)
        .eq('user_id', session.user.id); // Ensure we only delete user's own slideshows

      if (error) {
        console.error('Failed to delete slideshow from database:', error);
        throw new Error(`Database deletion failed: ${error.message}`);
      }

      console.log('Successfully deleted slideshow from database:', actualDatabaseId);
    } catch (error) {
      console.error('Failed to delete slideshow from database:', error);
      throw error; // Re-throw to make deletion fail if database deletion fails
    }
  }

  /**
   * Delete from file system
   */
  private async deleteFromFileSystem(slideshowId: string): Promise<void> {
    // Note: File System Access API doesn't provide delete functionality
    // This is a placeholder for future implementation
    console.log(`Deleted slideshow ${slideshowId} from memory and localStorage`);
  }

  /**
   * Load slideshow from file data blob (for FileBrowser loading from localStorage)
   */
  async loadSlideshowFromFileData(fileData: string): Promise<SlideshowMetadata> {
    try {
      console.log('🔄 Loading slideshow from file data...');
      const slideshow = JSON.parse(fileData) as SlideshowMetadata;

      // Ensure backward compatibility fields exist
      if (!('folder_id' in slideshow)) {
        (slideshow as any).folder_id = null;
      }

      // Ensure postTitle exists for backward compatibility (fix for missing postTitle)
      if (!('postTitle' in slideshow)) {
        (slideshow as any).postTitle = slideshow.title; // Fallback to title
      }

      // Validate the slideshow structure
      if (!slideshow.id || !slideshow.title || !slideshow.condensedSlides) {
        throw new Error('Invalid slideshow file format');
      }

      console.log('✅ Parsed slideshow from file data:', slideshow.title, 'with', slideshow.condensedSlides.length, 'slides');
      console.log('📝 Post title loaded:', slideshow.postTitle);

      // Store in memory for future reference
      this.slideshows.set(slideshow.id, slideshow);
      this.saveToLocalStorage();

      // Dispatch custom event to update file browser
      window.dispatchEvent(new CustomEvent('slideshowUpdated'));

      return slideshow;
    } catch (error) {
      console.error('❌ Failed to load slideshow from file data:', error);
      throw new Error('Invalid slideshow file data');
    }
  }

  /**
   * Move slideshow to folder
   */
  async moveSlideshowToFolder(slideshowId: string, folderId: string | null): Promise<void> {
    try {
      console.log(`📁 Moving slideshow ${slideshowId} to folder ${folderId || 'root'}`);

      const slideshow = this.slideshows.get(slideshowId);
      if (!slideshow) {
        throw new Error('Slideshow not found');
      }

      // Update the slideshow's folder association
      slideshow.folder_id = folderId;
      slideshow.updated_at = new Date().toISOString();

      // Store in memory
      this.slideshows.set(slideshowId, slideshow);

      // Save to localStorage
      this.saveToLocalStorage();

      // CRITICAL FIX: Update ALL slideshow file entries in localStorage
      // Find all file entries for this slideshow by searching all slideshow_file_ keys
      const slideshowFileKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('slideshow_file_')) {
          const fileData = localStorage.getItem(key);
          if (fileData) {
            try {
              const parsed = JSON.parse(fileData);
              // Match by slideshow ID (remove the "slideshow_" prefix if present)
              const fileSlideshowId = parsed.id.startsWith('slideshow_') ? parsed.id : `slideshow_${parsed.id}`;
              if (fileSlideshowId === slideshowId) {
                slideshowFileKeys.push(key);
              }
            } catch (error) {
              console.warn('Failed to parse slideshow file data:', key, error);
            }
          }
        }
      }

      console.log(`🔍 Found ${slideshowFileKeys.length} file entries for slideshow ${slideshowId}`);

      // Update all found file entries to the new folder
      slideshowFileKeys.forEach(fileKey => {
        try {
          const fileData = localStorage.getItem(fileKey);
          if (fileData) {
            const parsedFileData = JSON.parse(fileData);
            parsedFileData.folderId = folderId;
            parsedFileData.updated = new Date().toISOString();
            localStorage.setItem(fileKey, JSON.stringify(parsedFileData));
            console.log(`✅ Updated file entry ${fileKey} to folder ${folderId || 'root'}`);
          }
        } catch (error) {
          console.error(`Failed to update file entry ${fileKey}:`, error);
        }
      });

      // Also save to database for persistence
      await this.saveToDatabase(slideshow);

      // Dispatch storage event to trigger re-render
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'savedSlideshows',
        newValue: localStorage.getItem('savedSlideshows')
      }));

      // Dispatch custom event to update file browser
      window.dispatchEvent(new CustomEvent('slideshowUpdated'));

      console.log(`✅ Slideshow ${slideshow.title} moved to ${folderId || 'root'}`);
    } catch (error) {
      console.error('❌ Failed to move slideshow to folder:', error);
      throw error;
    }
  }

  /**
   * Increment upload count for a slideshow
   */
  async incrementUploadCount(slideshowId: string): Promise<void> {
    try {
      const slideshow = this.slideshows.get(slideshowId);
      if (!slideshow) {
        throw new Error('Slideshow not found');
      }

      // Initialize or increment count
      slideshow.uploadCount = (slideshow.uploadCount || 0) + 1;
      slideshow.updated_at = new Date().toISOString();

      // Store in memory
      this.slideshows.set(slideshowId, slideshow);

      // Save to localStorage
      this.saveToLocalStorage();

      // Save to database
      await this.saveToDatabase(slideshow);

      // Dispatch events
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'savedSlideshows',
        newValue: localStorage.getItem('savedSlideshows')
      }));
      window.dispatchEvent(new CustomEvent('slideshowUpdated'));

      console.log(`✅ Incremented upload count for slideshow ${slideshow.title} to ${slideshow.uploadCount}`);
    } catch (error) {
      console.error('❌ Failed to increment upload count:', error);
      throw error;
    }
  }

  /**
   * Get slideshows in a specific folder
   */
  getSlideshowsInFolder(folderId: string | null): SlideshowMetadata[] {
    return Array.from(this.slideshows.values())
      .filter(slideshow => slideshow.folder_id === folderId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  /**
   * Update slideshow metadata interface to include folder association
   */
  private updateSlideshowMetadataForFolderSupport(): void {
    // This method ensures backward compatibility by adding folder_id if it doesn't exist
    for (const [id, slideshow] of this.slideshows.entries()) {
      if (!('folder_id' in slideshow)) {
        (slideshow as any).folder_id = null;
        this.slideshows.set(id, slideshow);
      }
    }
    this.saveToLocalStorage();
  }

  /**
   * Load slideshow file data with folder support
   */
  async loadSlideshowFromFileDataWithFolder(fileData: string): Promise<SlideshowMetadata> {
    try {
      const slideshow = JSON.parse(fileData) as SlideshowMetadata;

      // Ensure backward compatibility fields exist
      if (!('folder_id' in slideshow)) {
        (slideshow as any).folder_id = null;
      }

      // Ensure postTitle exists for backward compatibility (fix for missing postTitle)
      if (!('postTitle' in slideshow)) {
        (slideshow as any).postTitle = slideshow.title; // Fallback to title
      }

      // Validate the slideshow structure
      if (!slideshow.id || !slideshow.title || !slideshow.condensedSlides) {
        throw new Error('Invalid slideshow file format');
      }

      console.log('✅ Parsed slideshow from file data with folder support:', slideshow.title, 'with', slideshow.condensedSlides.length, 'slides');
      console.log('📝 Post title loaded:', slideshow.postTitle);

      // Store in memory for future reference
      this.slideshows.set(slideshow.id, slideshow);
      this.saveToLocalStorage();

      // Dispatch custom event to update file browser
      window.dispatchEvent(new CustomEvent('slideshowUpdated'));

      return slideshow;
    } catch (error) {
      console.error('❌ Failed to load slideshow from file data:', error);
      throw new Error('Invalid slideshow file data');
    }
  }

  // ========================================
  // TEMPLATE MANAGEMENT METHODS
  // ========================================

  /**
   * Create slideshow with optimized payload for posting
   * This method ensures slideshows can be posted without 413 errors
   */
  async createOptimizedSlideshow(
    title: string,
    postTitle: string,
    caption: string,
    hashtags: string[],
    images: UploadedImage[],
    textOverlays: TikTokTextOverlay[],
    aspectRatio: string,
    transitionEffect: 'fade' | 'slide' | 'zoom',
    musicEnabled: boolean,
    userId: string
  ): Promise<SlideshowMetadata> {
    try {
      console.log('🚀 Starting optimized slideshow creation with smart cropping...');

      // CRITICAL FIX: Ensure TikTok fonts are loaded once for the entire slideshow creation
      await ensureTikTokFontsLoaded();

      // CRITICAL FIX: Crop images to target aspect ratio BEFORE creating slideshow
      let processedImages = images;

      if (aspectRatio !== 'free' && images.length > 0) {
        try {

          // Get image IDs for cropping
          const imageIds = images.map(img => img.id);

          // Use enhanced cropping service to crop images
          const croppedImages = await ImageCroppingService.changeAspectRatio(
            imageIds,
            aspectRatio,
            userId
          );

          // Update images array with cropped versions
          const imageMap = new Map(croppedImages.map(img => [img.id, img]));
          processedImages = images.map(img => imageMap.get(img.id) || img);


        } catch (cropError) {
          console.warn('⚠️ Failed to pre-crop images, proceeding with original images:', cropError);
          // Continue with original images if cropping fails
        }
      }

      // Create condensed slides first with pre-cropped images
      const condensedSlides = await this.createCondensedSlides(processedImages, textOverlays, aspectRatio);

      // Generate slideshow ID with prefix for consistency
      const slideshowId = `slideshow_${crypto.randomUUID()}`;

      console.log('🖼️ Uploading condensed images to imgbb immediately...');

      // IMMEDIATE OPTIMIZATION: Upload condensed images to ImgBB/FreeImage and get URLs
      const optimizedCondensedSlides = await this.uploadCondensedSlidesToSupabaseStorage(condensedSlides, userId);

      const slideshow: SlideshowMetadata = {
        id: slideshowId,
        title,
        postTitle: postTitle || title,
        caption,
        hashtags,
        condensedSlides: optimizedCondensedSlides, // These now have imgbb URLs instead of base64!
        textOverlays,
        aspectRatio: aspectRatio,
        transitionEffect,
        musicEnabled,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: userId,
        folder_id: null
      };

      console.log('✅ Optimized slideshow object created:', {
        id: slideshow.id,
        title: slideshow.title,
        condensedSlidesCount: slideshow.condensedSlides.length,
        hasImgbbUrls: slideshow.condensedSlides.every(slide => slide.condensedImageUrl && !slide.condensedImageUrl.startsWith('data:'))
      });

      // Store in memory
      this.slideshows.set(slideshow.id, slideshow);
      this.saveToLocalStorage();

      // Save to Supabase database
      await this.saveToDatabase(slideshow);

      // Dispatch custom event to update file browser
      window.dispatchEvent(new CustomEvent('slideshowUpdated'));

      // Auto-export slideshow file
      try {
        await this.saveSlideshowFile(slideshow);
      } catch (exportError) {
        console.warn('Failed to auto-export slideshow file:', exportError);
      }

      console.log(`✅ Created optimized slideshow: ${title} (${optimizedCondensedSlides.length} slides with uploaded URLs)`);
      return slideshow;
    } catch (error) {
      console.error('❌ Failed to create optimized slideshow:', error);
      throw error;
    }
  }

  /**
   * Create condensed slides with optimized payload (original URLs for API)
   */
  private async createOptimizedCondensedSlides(
    images: UploadedImage[],
    textOverlays: TikTokTextOverlay[],
    aspectRatio: string
  ): Promise<CondensedSlide[]> {
    const condensedSlides: CondensedSlide[] = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const slideTextOverlays = textOverlays.filter(overlay => overlay.slideIndex === i);

      try {
        // Create optimized slide with both base64 (for display) and original URL (for API)
        const optimizedSlide = await this.createOptimizedCondensedSlide(image, slideTextOverlays, aspectRatio);
        condensedSlides.push(optimizedSlide);
      } catch (error) {
        console.error(`Failed to create optimized condensed slide for image ${image.id}:`, error);
        throw error;
      }
    }

    return condensedSlides;
  }

  /**
   * Create a single optimized condensed slide
   */
  private async createOptimizedCondensedSlide(
    image: UploadedImage,
    textOverlays: TikTokTextOverlay[],
    aspectRatio: string
  ): Promise<CondensedSlide> {
    return new Promise(async (resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = async () => {
        try {
          // Set canvas size based on aspect ratio
          const ratio = this.parseAspectRatio(aspectRatio);
          if (ratio > 0) {
            canvas.width = 1080;
            canvas.height = Math.round(1080 / ratio);
          } else {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
          }

          // Draw the base image
          if (ratio > 0) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          } else {
            ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
          }

          // Overlay text elements
          for (const overlay of textOverlays) {
            await this.drawTextOverlay(ctx, overlay, canvas.width, canvas.height);
          }

          // Convert to compressed image
          canvas.toBlob(
            async (blob) => {
              if (blob) {
                const reader = new FileReader();
                reader.onload = () => {
                  const base64Data = reader.result as string;
                  resolve({
                    id: `optimized_${image.id}_${Date.now()}`,
                    originalImageId: image.id,
                    condensedImageUrl: base64Data, // For display/preview
                    originalImageUrl: image.url,   // For API posting (optimizes payload!)
                    width: canvas.width,
                    height: canvas.height,
                    aspectRatio: aspectRatio,
                    fileSize: blob.size
                  });
                };
                reader.onerror = () => {
                  reject(new Error('Failed to convert blob to base64'));
                };
                reader.readAsDataURL(blob);
              } else {
                reject(new Error('Failed to create blob from canvas'));
              }
            },
            'image/jpeg',
            0.85 // 85% quality for good compression
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = image.url;
    });
  }

  /**
   * Create a template from a slideshow with enhanced aspect ratio persistence
   */
  async createTemplateFromSlideshow(
    name: string,
    description: string,
    slideshow: SlideshowMetadata,
    userId: string
  ): Promise<SlideshowTemplate> {
    // CRITICAL FIX: Ensure aspect ratio is properly saved
    const finalAspectRatio = slideshow.aspectRatio || '9:16';

    const template: SlideshowTemplate = {
      id: `template_${crypto.randomUUID()}`, // Full ID for memory/localStorage
      name,
      description,
      user_id: userId,
      title: slideshow.title,
      postTitle: slideshow.postTitle,
      caption: slideshow.caption,
      hashtags: slideshow.hashtags,
      textOverlays: slideshow.textOverlays,
      aspectRatio: finalAspectRatio, // Ensure aspect ratio is always set
      transitionEffect: slideshow.transitionEffect || 'fade',
      musicEnabled: slideshow.musicEnabled || false,
      slideCount: Math.max(1, slideshow.condensedSlides.length),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('🎯 Creating template with enhanced aspect ratio persistence:', {
      name: template.name,
      aspectRatio: template.aspectRatio,
      slideCount: template.slideCount,
      sourceTextOverlays: slideshow.textOverlays.length,
      templateTextOverlays: template.textOverlays.length,
      textOverlayDetails: template.textOverlays.map(overlay => ({
        text: overlay.text?.substring(0, 20) + '...',
        slideIndex: overlay.slideIndex
      }))
    });

    // Store in memory
    this.templates.set(template.id, template);

    // Save to localStorage
    this.saveTemplatesToLocalStorage();

    // Save to database (use clean UUID without prefix)
    await this.saveTemplateToDatabase(template);

    // Dispatch event to update UI
    window.dispatchEvent(new CustomEvent('templatesUpdated'));

    console.log('✅ Template created successfully:', template.name, 'with aspect ratio:', template.aspectRatio);
    console.log('📝 Template text overlays preserved:', template.textOverlays.length);
    return template;
  }

  /**
   * Save template
   */
  async saveTemplate(template: SlideshowTemplate): Promise<void> {
    this.templates.set(template.id, template);
    this.saveTemplatesToLocalStorage();
    await this.saveTemplateToDatabase(template);
  }

  /**
   * Load template by ID
   */
  async loadTemplate(templateId: string): Promise<SlideshowTemplate | null> {
    // Check memory first (with prefix)
    let template = this.templates.get(templateId);
    if (!template) {
      // Try to load from localStorage
      this.loadTemplatesFromLocalStorage();
      template = this.templates.get(templateId);

      // If not found and templateId doesn't have prefix, try with prefix
      if (!template && !templateId.startsWith('template_')) {
        template = this.templates.get(`template_${templateId}`);
      }
    }

    // Auto-fix legacy width: Ensure text overlays have width=90 if missing or old default (60)
    if (template && template.textOverlays) {
      template.textOverlays = template.textOverlays.map(overlay => ({
        ...overlay,
        width: (!overlay.width || overlay.width === 60) ? 90 : overlay.width
      }));
    }

    return template || null;
  }

  /**
   * Get all templates for a user
   */
  getSavedTemplates(userId: string): SlideshowTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.user_id === userId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    this.templates.delete(templateId);
    this.saveTemplatesToLocalStorage();
    await this.deleteTemplateFromDatabase(templateId);

    // Dispatch event to update UI
    window.dispatchEvent(new CustomEvent('templatesUpdated'));

    console.log('Template deleted:', templateId);
  }

  /**
   * Apply template settings to current editor without creating a saved slideshow
   * This populates the edit settings columns with template data using new images
   */
  async applyTemplateToSettings(
    template: SlideshowTemplate,
    images: UploadedImage[],
    selectedImageIds: string[],
    customizations?: {
      title?: string;
      caption?: string;
      hashtags?: string[];
    }
  ): Promise<TemplateApplicationResult> {
    try {
      // Use template settings with optional overrides
      const finalTitle = customizations?.title || template.title;
      const finalCaption = customizations?.caption || template.caption;
      const finalHashtags = customizations?.hashtags || template.hashtags;

      // Filter images based on selected IDs or use all images
      const targetImages = selectedImageIds.length > 0
        ? images.filter(img => selectedImageIds.includes(img.id))
        : images;

      // Apply template text overlays with new image IDs adapted for the new images
      let adaptedTextOverlays = template.textOverlays.map(overlay => ({
        ...overlay,
        id: `${overlay.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }));

      // Remap text overlay indices to fit within the selected images
      const selectedImagesCount = selectedImageIds.length;
      adaptedTextOverlays = adaptedTextOverlays.map(overlay => {
        // If overlay slide index exceeds available slides, map it using modulo
        if (overlay.slideIndex >= selectedImagesCount) {
          const mappedIndex = overlay.slideIndex % selectedImagesCount;
          console.log(`🔄 Mapping template overlay slide ${overlay.slideIndex} to slide ${mappedIndex} for settings`);
          return { ...overlay, slideIndex: mappedIndex };
        }
        return overlay;
      });

      // Create a temporary slideshow for validation (not saved)
      const tempSlideshow: SlideshowMetadata = {
        id: `temp_${Date.now()}`,
        title: finalTitle,
        postTitle: template.postTitle || finalTitle,
        caption: finalCaption,
        hashtags: finalHashtags,
        condensedSlides: [], // Empty for settings-only application
        textOverlays: adaptedTextOverlays,
        aspectRatio: template.aspectRatio,
        transitionEffect: template.transitionEffect,
        musicEnabled: template.musicEnabled,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: '', // Will be set by caller if needed
        folder_id: null
      };

      return {
        success: true,
        slideshow: tempSlideshow,
        processedImages: targetImages.length,
        totalImages: images.length
      };
    } catch (error) {
      console.error('Failed to apply template to settings:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processedImages: 0,
        totalImages: images.length
      };
    }
  }

  /**
   * Apply template to images and create slideshow (legacy method for backward compatibility)
   */
  async applyTemplateToImages(
    template: SlideshowTemplate,
    images: UploadedImage[],
    userId: string,
    customizations?: {
      title?: string;
      caption?: string;
      hashtags?: string[];
      aspectRatio?: string; // Add aspect ratio override for template application
    }
  ): Promise<TemplateApplicationResult> {
    try {
      // Use template settings with optional overrides
      const finalTitle = customizations?.title || `${template.name} - ${new Date().toLocaleDateString()}`;
      const finalCaption = customizations?.caption || template.caption;
      const finalHashtags = customizations?.hashtags || template.hashtags;
      // CRITICAL FIX: Use provided aspect ratio or fall back to template aspect ratio
      const finalAspectRatio = customizations?.aspectRatio || template.aspectRatio || '9:16';

      // Determine how many images to use based on template
      const selectedImages = images.slice(0, template.slideCount);

      if (selectedImages.length === 0) {
        return {
          success: false,
          error: 'No images to process',
          processedImages: 0,
          totalImages: images.length
        };
      }

      // Apply template text overlays with new image IDs and remap slide indices
      let adaptedTextOverlays = template.textOverlays.map(overlay => ({
        ...overlay,
        id: `${overlay.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }));

      // Remap text overlay indices to fit within the selected images
      adaptedTextOverlays = adaptedTextOverlays.map(overlay => {
        // If overlay slide index exceeds available slides, map it using modulo
        if (overlay.slideIndex >= selectedImages.length) {
          const mappedIndex = overlay.slideIndex % selectedImages.length;
          console.log(`🔄 Mapping template overlay slide ${overlay.slideIndex} to slide ${mappedIndex}`);
          return { ...overlay, slideIndex: mappedIndex };
        }
        return overlay;
      });

      console.log('🎯 Applying template with aspect ratio:', finalAspectRatio);

      // Create the slideshow with the correct aspect ratio
      const slideshow = await this.saveSlideshow(
        finalTitle,
        template.postTitle || finalTitle,
        finalCaption,
        finalHashtags,
        selectedImages,
        adaptedTextOverlays,
        finalAspectRatio, // Use the final aspect ratio
        template.transitionEffect,
        template.musicEnabled,
        userId
      );

      return {
        success: true,
        slideshow,
        processedImages: selectedImages.length,
        totalImages: images.length
      };
    } catch (error) {
      console.error('Failed to apply template:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processedImages: 0,
        totalImages: images.length
      };
    }
  }

  /**
   * Bulk upload with template application - creates multiple slideshows from one template
   */
  async bulkUploadWithTemplate(bulkData: BulkUploadWithTemplate, userId: string): Promise<TemplateApplicationResult> {
    try {
      const template = await this.loadTemplate(bulkData.templateId);
      if (!template) {
        return {
          success: false,
          error: 'Template not found',
          processedImages: 0,
          totalImages: bulkData.images.length
        };
      }

      // Apply template to images (legacy single slideshow method)
      return await this.applyTemplateToImages(
        template,
        bulkData.images,
        userId,
        bulkData.customizations
      );
    } catch (error) {
      console.error('Bulk upload with template failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processedImages: 0,
        totalImages: bulkData.images.length
      };
    }
  }

  /**
   * Create multiple slideshows from template with bulk image processing
   * This is the main method for bulk template creation
   */
  async createBulkSlideshowsFromTemplate(
    template: SlideshowTemplate,
    images: UploadedImage[],
    userId: string,
    options: {
      randomizeImages?: boolean;
      slidesPerSlideshow?: number; // Number of slides per slideshow (cut length)
      customizations?: {
        title?: string;
        caption?: string;
        hashtags?: string[];
        randomizeHashtags?: boolean;
      };
      slideshowTitles?: string[]; // Optional custom titles for each slideshow
    } = {},
    onProgress?: (progress: number, current: number, total: number) => void
  ): Promise<{
    success: boolean;
    slideshows: SlideshowMetadata[];
    error?: string;
    totalImages: number;
    slideshowCount: number;
  }> {
    try {
      const { randomizeImages = false, slidesPerSlideshow, customizations = {}, slideshowTitles = [] } = options;

      console.log('🎯 BULK TEMPLATE CREATION DEBUG:', {
        templateName: template.name,
        templateTextOverlaysCount: template.textOverlays?.length || 0,
        templateTextOverlays: template.textOverlays?.map(o => ({ text: o.text?.substring(0, 20), slideIndex: o.slideIndex })) || [],
        imagesCount: images.length
      });

      if (images.length === 0) {
        return {
          success: false,
          slideshows: [],
          error: 'No images provided',
          totalImages: 0,
          slideshowCount: 0
        };
      }

      // Use provided slidesPerSlideshow or default to template's slideCount
      const slidesPerSlideshowFinal = slidesPerSlideshow || template.slideCount;

      // Determine number of slideshows to create
      const slideshowCount = Math.ceil(images.length / slidesPerSlideshowFinal);

      if (slideshowCount === 0) {
        return {
          success: false,
          slideshows: [],
          error: `Need at least ${slidesPerSlideshowFinal} images but none provided`,
          totalImages: images.length,
          slideshowCount: 0
        };
      }

      console.log(`🎬 Creating ${slideshowCount} slideshows from ${images.length} images with template: ${template.name} (${slidesPerSlideshowFinal} slides each)`);

      // Group images into sets for each slideshow
      const imageGroups = this.groupImagesForSlideshows(images, slidesPerSlideshowFinal, randomizeImages);

      const createdSlideshows: SlideshowMetadata[] = [];
      const finalTitle = customizations.title || template.title;
      const finalCaption = customizations.caption || template.caption;
      const finalHashtags = customizations.hashtags || template.hashtags;

      // Create each slideshow
      for (let i = 0; i < imageGroups.length; i++) {
        const imageGroup = imageGroups[i];
        const slideshowTitle = slideshowTitles[i] || finalTitle;

        try {
          console.log(`🎬 Starting slideshow ${i + 1}/${imageGroups.length}: ${slideshowTitle}`);

          // Report progress
          if (onProgress) {
            const progress = Math.round((i / imageGroups.length) * 100);
            onProgress(progress, i + 1, imageGroups.length);
          }

          console.log(`📋 Image group details:`, {
            images: imageGroup.map(img => img.id),
            imageCount: imageGroup.length
          });

          // Apply template text overlays with new image IDs adapted for this group
          // CRITICAL FIX: Always map text overlays to fit within available slides
          let adaptedTextOverlays = template.textOverlays.map(overlay => ({
            ...overlay,
            id: `${overlay.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          }));

          console.log(`📝 Slideshow ${i + 1} text overlays before adaptation:`, template.textOverlays.map(o => ({ text: o.text?.substring(0, 20), slideIndex: o.slideIndex })));
          console.log(`📝 Slideshow ${i + 1} adapted text overlays:`, adaptedTextOverlays.map(o => ({ text: o.text?.substring(0, 20), slideIndex: o.slideIndex })));

          // Always remap text overlay indices to fit within the available slides
          // This ensures text overlays work even when template has more slides than current group
          adaptedTextOverlays = adaptedTextOverlays.map(overlay => {
            // If overlay slide index exceeds available slides, map it to a valid slide
            if (overlay.slideIndex >= imageGroup.length) {
              const mappedIndex = overlay.slideIndex % imageGroup.length;
              console.log(`🔄 Mapping overlay slide ${overlay.slideIndex} to slide ${mappedIndex} (modulo mapping)`);
              return { ...overlay, slideIndex: mappedIndex };
            }
            return overlay;
          });

          console.log(`📝 Slideshow ${i + 1} final text overlays after remapping:`, adaptedTextOverlays.map(o => ({ text: o.text?.substring(0, 20), slideIndex: o.slideIndex })));

          console.log(`📝 Text overlays for slideshow ${i + 1}:`, {
            templateOverlays: template.textOverlays.length,
            adaptedOverlays: adaptedTextOverlays.length,
            imageGroupSize: imageGroup.length,
            isPartialGroup: imageGroup.length < template.slideCount,
            templateOverlayDetails: template.textOverlays.map(overlay => ({
              text: overlay.text?.substring(0, 20) + '...',
              slideIndex: overlay.slideIndex
            })),
            adaptedOverlayDetails: adaptedTextOverlays.map(overlay => ({
              text: overlay.text?.substring(0, 20) + '...',
              slideIndex: overlay.slideIndex
            }))
          });

          // Handle hashtag randomization
          let slideshowHashtags = finalHashtags;
          if (customizations.randomizeHashtags && finalHashtags.length > 0) {
            // Pick 4 random hashtags
            const shuffled = [...finalHashtags].sort(() => 0.5 - Math.random());
            slideshowHashtags = shuffled.slice(0, 4);
          }

          // Create the slideshow with adapted text overlays
          const slideshow = await this.saveSlideshow(
            slideshowTitle,
            template.postTitle || slideshowTitle,
            finalCaption,
            slideshowHashtags,
            imageGroup,
            adaptedTextOverlays,
            template.aspectRatio,
            template.transitionEffect,
            template.musicEnabled,
            userId
          );

          console.log(`🎯 FINAL VERIFICATION - Slideshow ${i + 1}:`, {
            title: slideshow.title,
            finalTextOverlaysCount: slideshow.textOverlays.length,
            finalTextOverlays: slideshow.textOverlays.map(overlay => ({
              text: overlay.text?.substring(0, 20) + '...',
              slideIndex: overlay.slideIndex
            }))
          });

          createdSlideshows.push(slideshow);
          console.log(`✅ Created slideshow ${i + 1}/${imageGroups.length}: ${slideshowTitle} (${imageGroup.length} images)`);
          console.log(`✅ Slideshow textOverlays count:`, slideshow.textOverlays.length);

          // Report progress after completion of this item
          if (onProgress) {
            const progress = Math.round(((i + 1) / imageGroups.length) * 100);
            onProgress(progress, i + 1, imageGroups.length);
          }

        } catch (error) {
          console.error(`❌ Failed to create slideshow ${i + 1}:`, error);
          // Continue with other slideshows even if one fails
        }
      }

      console.log(`🎉 Bulk template creation completed: ${createdSlideshows.length}/${imageGroups.length} slideshows created`);

      return {
        success: createdSlideshows.length > 0,
        slideshows: createdSlideshows,
        error: createdSlideshows.length === 0 ? 'Failed to create any slideshows' : undefined,
        totalImages: images.length,
        slideshowCount: createdSlideshows.length
      };

    } catch (error) {
      console.error('Bulk template creation failed:', error);
      return {
        success: false,
        slideshows: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        totalImages: images.length,
        slideshowCount: 0
      };
    }
  }

  /**
   * Group images into sets for multiple slideshows
   * Ensures no duplicate images within the same slideshow
   */
  private groupImagesForSlideshows(
    images: UploadedImage[],
    slidesPerSlideshow: number,
    randomize: boolean = false
  ): UploadedImage[][] {
    const workingImages = [...images]; // Create a copy to avoid modifying original

    if (randomize) {
      // Fisher-Yates shuffle for true randomization
      for (let i = workingImages.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [workingImages[i], workingImages[j]] = [workingImages[j], workingImages[i]];
      }
    }

    const groups: UploadedImage[][] = [];

    // Split images into groups of slidesPerSlideshow
    for (let i = 0; i < workingImages.length; i += slidesPerSlideshow) {
      const group = workingImages.slice(i, i + slidesPerSlideshow);
      if (group.length > 0) {
        groups.push(group);
      }
    }

    return groups;
  }

  /**
   * Get preview of bulk template creation - shows how images will be grouped
   */
  previewBulkTemplateCreation(
    images: UploadedImage[],
    template: SlideshowTemplate,
    randomizeImages: boolean = false,
    slidesPerSlideshow?: number
  ): {
    totalImages: number;
    slideshowCount: number;
    slidesPerSlideshow: number;
    groups: UploadedImage[][];
    willCreatePartialSlideshow: boolean;
  } {
    const slidesPerSlideshowFinal = slidesPerSlideshow || template.slideCount;
    const groups = this.groupImagesForSlideshows(images, slidesPerSlideshowFinal, randomizeImages);
    const lastGroupSize = groups[groups.length - 1]?.length || 0;

    return {
      totalImages: images.length,
      slideshowCount: groups.length,
      slidesPerSlideshow: slidesPerSlideshowFinal,
      groups,
      willCreatePartialSlideshow: lastGroupSize > 0 && lastGroupSize < slidesPerSlideshowFinal
    };
  }

  /**
   * Save templates to localStorage
   */
  private saveTemplatesToLocalStorage(): void {
    try {
      const data = Array.from(this.templates.entries());
      localStorage.setItem('savedTemplates', JSON.stringify(data));
      console.log('💾 Saved templates to localStorage:', data.length);
    } catch (error) {
      console.error('Failed to save templates to localStorage:', error);
    }
  }

  /**
   * Load templates from localStorage
   */
  public loadTemplatesFromLocalStorage(): void {
    try {
      const data = localStorage.getItem('savedTemplates');
      if (data) {
        const entries = JSON.parse(data);
        this.templates = new Map(entries);
        console.log('💾 Loaded templates from localStorage:', this.templates.size);
      }
    } catch (error) {
      console.error('Failed to load templates from localStorage:', error);
    }
  }

  /**
   * Save template to database
   */
  private async saveTemplateToDatabase(template: SlideshowTemplate): Promise<void> {
    try {
      const { supabase } = await import('./supabase');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        throw new Error('User not authenticated');
      }

      // Extract clean UUID (remove "template_" prefix) for database compatibility
      const cleanTemplateId = template.id.startsWith('template_')
        ? template.id.replace('template_', '')
        : template.id;

      const { error } = await supabase
        .from('slideshow_templates')
        .upsert({
          id: cleanTemplateId, // Use clean UUID for database
          user_id: template.user_id,
          name: template.name,
          description: template.description,
          title: template.title,
          post_title: template.postTitle,
          caption: template.caption,
          hashtags: template.hashtags,
          text_overlays: template.textOverlays,
          aspect_ratio: template.aspectRatio,
          transition_effect: template.transitionEffect,
          music_enabled: template.musicEnabled,
          preview_image: template.previewImage,
          slide_count: template.slideCount,
          created_at: template.created_at,
          updated_at: template.updated_at,
        });

      if (error) {
        console.error('Failed to save template to database:', error);
        throw error; // Propagate error for better error handling
      }
    } catch (error) {
      console.error('Failed to save template to database:', error);
      throw error; // Propagate error for better error handling
    }
  }

  /**
   * Delete template from database
   */
  private async deleteTemplateFromDatabase(templateId: string): Promise<void> {
    try {
      const { supabase } = await import('./supabase');

      // Extract clean UUID (remove "template_" prefix) for database compatibility
      const cleanTemplateId = templateId.startsWith('template_')
        ? templateId.replace('template_', '')
        : templateId;

      const { error } = await supabase
        .from('slideshow_templates')
        .delete()
        .eq('id', cleanTemplateId); // Use clean UUID for database

      if (error) {
        console.error('Failed to delete template from database:', error);
      }
    } catch (error) {
      console.error('Failed to delete template from database:', error);
    }
  }

  /**
   * Load templates from database for user with enhanced aspect ratio persistence
   */
  async loadUserTemplates(userId: string): Promise<void> {
    try {
      const { supabase } = await import('./supabase');
      const { data: templates, error } = await supabase
        .from('slideshow_templates')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Failed to load templates from database:', error);
        return;
      }

      // Only log if templates count changed or on first load
      const currentCount = Array.from(this.templates.values()).filter(t => t.user_id === userId).length;
      const newCount = templates?.length || 0;

      if (currentCount !== newCount || currentCount === 0) {
        console.log('📊 Templates loaded:', newCount);
      }

      // Clear existing templates for this user first
      const userTemplates = Array.from(this.templates.values()).filter(t => t.user_id !== userId);
      this.templates.clear();
      userTemplates.forEach(template => this.templates.set(template.id, template));

      // Convert database format to SlideshowTemplate with enhanced aspect ratio handling
      templates?.forEach(dbTemplate => {
        // Add "template_" prefix to match internal ID format
        const templateId = `template_${dbTemplate.id}`;

        // CRITICAL FIX: Ensure aspect ratio is properly loaded and validated
        const loadedAspectRatio = dbTemplate.aspect_ratio || '9:16';
        const validAspectRatio = this.validateAspectRatio(loadedAspectRatio) ? loadedAspectRatio : '9:16';

        const template: SlideshowTemplate = {
          id: templateId, // Use prefixed ID for memory/localStorage consistency
          name: dbTemplate.name,
          description: dbTemplate.description,
          user_id: dbTemplate.user_id,
          title: dbTemplate.title,
          postTitle: dbTemplate.post_title,
          caption: dbTemplate.caption,
          hashtags: dbTemplate.hashtags || [],
          textOverlays: dbTemplate.text_overlays || [],
          aspectRatio: validAspectRatio, // Ensure aspect ratio is valid and properly loaded
          transitionEffect: dbTemplate.transition_effect || 'fade',
          musicEnabled: dbTemplate.music_enabled || false,
          previewImage: dbTemplate.preview_image,
          slideCount: dbTemplate.slide_count || 1,
          created_at: dbTemplate.created_at,
          updated_at: dbTemplate.updated_at,
        };

        console.log('🔄 Loaded template with validated aspect ratio:', {
          name: template.name,
          loadedAspectRatio: loadedAspectRatio,
          finalAspectRatio: template.aspectRatio,
          isValid: this.validateAspectRatio(template.aspectRatio)
        });

        this.templates.set(template.id, template);
      });

      // Save to localStorage for faster access
      this.saveTemplatesToLocalStorage();

      // Only dispatch event if count changed
      if (currentCount !== newCount) {
        window.dispatchEvent(new CustomEvent('templatesUpdated'));
      }
    } catch (error) {
      console.error('Failed to load templates from database:', error);
    }
  }



  /**
   * Validate aspect ratio format
   */
  private validateAspectRatio(aspectRatio: string): boolean {
    if (!aspectRatio) return false;

    // Check for valid formats: "9:16", "16:9", "1:1", "free", etc.
    const validFormats = [
      /^(\d+):(\d+)$/, // Ratios like "9:16", "16:9", "1:1"
      /^free$/,        // Free form
      /^auto$/         // Auto detection
    ];

    return validFormats.some(format => format.test(aspectRatio.toLowerCase()));
  }

  /**
   * Update slideshow status (success/failed)
   */
  async updateSlideshowStatus(slideshowId: string, status: 'success' | 'failed' | 'pending'): Promise<void> {
    const slideshow = this.slideshows.get(slideshowId);
    if (!slideshow) return;

    const updatedSlideshow = {
      ...slideshow,
      lastUploadStatus: status,
      updated_at: new Date().toISOString()
    };

    this.slideshows.set(slideshowId, updatedSlideshow);
    this.saveToLocalStorage();

    // Update in database if possible
    try {
      const { supabase } = await import('./supabase');
      const { data, error: fetchError } = await supabase
        .from('slideshows')
        .select('metadata')
        .eq('id', slideshowId.replace('slideshow_', ''))
        .single();

      if (!fetchError && data) {
        const newMetadata = {
          ...data.metadata,
          lastUploadStatus: status
        };

        await supabase
          .from('slideshows')
          .update({ metadata: newMetadata })
          .eq('id', slideshowId.replace('slideshow_', ''));
      }
    } catch (error) {
      console.error('Failed to update slideshow status in DB:', error);
    }

    window.dispatchEvent(new CustomEvent('slideshowUpdated'));
  }


}

export const slideshowService = SlideshowService.getInstance();

import { SlideshowMetadata, CondensedSlide, TikTokTextOverlay, UploadedImage, PostizSlideshowData, SlideshowTemplate, TemplateApplicationResult, BulkUploadWithTemplate } from '@/types';
import { postizAPI } from './postiz';
import { imageService } from './imageService';

export class SlideshowService {
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
   * Create condensed slides by overlaying text on images and compressing them
   */
  async createCondensedSlides(
    images: UploadedImage[],
    textOverlays: TikTokTextOverlay[],
    aspectRatio: string
  ): Promise<CondensedSlide[]> {
    const condensedSlides: CondensedSlide[] = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const slideTextOverlays = textOverlays.filter(overlay => overlay.slideIndex === i);

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
  private async createCondensedSlide(
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

          // Draw the base image, maintaining aspect ratio
          if (ratio > 0) {
            // For fixed aspect ratios, scale the image to fit the canvas
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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
  private drawTextOverlay(
    ctx: CanvasRenderingContext2D,
    overlay: TikTokTextOverlay,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const { text, x, y, fontSize, color, fontFamily, fontWeight, alignment, bold, italic, outline, outlineColor, outlineWidth, outlinePosition, glow, glowColor, glowIntensity } = overlay;

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

    // Set font properties
    let fontStyle = '';
    if (italic) fontStyle += 'italic ';
    if (bold) fontStyle += 'bold ';
    fontStyle += `${scaledFontSize}px "${fontFamily}"`;

    ctx.font = fontStyle;
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
   * Save slideshow metadata
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

      // Use the aspect ratio from the first image if available, otherwise use the provided aspect ratio
      const finalAspectRatio = images[0]?.aspectRatio || aspectRatio;

      

      // Create condensed slides (text consolidated into images) - but don't save them as separate files
      const condensedSlides = await this.createCondensedSlides(images, textOverlays, finalAspectRatio);

      // Generate slideshow ID with prefix for consistency
      const slideshowId = `slideshow_${crypto.randomUUID()}`;

      const slideshow: SlideshowMetadata = {
        id: slideshowId, // Use prefixed ID consistently throughout
        title,
        postTitle: postTitle || title, // Use postTitle if provided, fallback to title
        caption,
        hashtags,
        condensedSlides, // These are the individual images with text consolidated
        textOverlays, // Keep original text overlays for editing
        aspectRatio: finalAspectRatio,
        transitionEffect: transitionEffect, // Keep original transition effect
        musicEnabled: musicEnabled, // Keep original music setting
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: userId,
        folder_id: null // Initialize with no folder
      };

      console.log('✅ Slideshow object created:', {
        id: slideshow.id,
        title: slideshow.title,
        condensedSlidesCount: slideshow.condensedSlides.length,
        hasCondensedSlides: !!slideshow.condensedSlides
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

      console.log('✅💾 Slideshow saved successfully:', slideshow.title, 'with', condensedSlides.length, 'slides');
      console.log('🎯 Slideshow ID for file browser:', slideshow.id);

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
    console.log('🧠 Memory result:', { found: !!slideshow, title: slideshow?.title });

    if (!slideshow) {
      console.log('📁 Not in memory, trying localStorage...');
      // Try to load from localStorage
      this.loadFromLocalStorage();
      slideshow = this.slideshows.get(slideshowId);
      console.log('💾 localStorage result:', { found: !!slideshow, title: slideshow?.title });
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
          console.log('🗄️ Database result:', { found: !!slideshow, title: slideshow?.title });
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
      console.log('💻 File system result:', { found: !!loadedSlideshow, title: loadedSlideshow?.title });
    }

    const finalResult = slideshow || null;
    console.log('🎯📋 SLIDESHOW SERVICE: Final result:', {
      slideshowId,
      found: !!finalResult,
      title: finalResult?.title,
      condensedSlidesCount: finalResult?.condensedSlides?.length || 0
    });
    
    return finalResult;
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

      // Ensure folder_id exists for backward compatibility
      if (!('folder_id' in slideshow)) {
        (slideshow as any).folder_id = null;
      }

      console.log('Parsed slideshow:', slideshow.title, 'with', slideshow.condensedSlides.length, 'slides');

      // IMPORTANT: Don't save condensed images as separate files when loading from file
      // They should only exist in the slideshow metadata

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
    this.slideshows.delete(slideshowId);
    this.saveToLocalStorage();
    await this.deleteFromDatabase(slideshowId);
    await this.deleteFromFileSystem(slideshowId);
    
    // Clean up file data for file browser integration
    const fileKey = `slideshow_file_${slideshowId}`;
    localStorage.removeItem(fileKey);

    // Dispatch custom event to update file browser immediately
    window.dispatchEvent(new CustomEvent('slideshowUpdated'));

    console.log('Slideshow deleted successfully:', slideshowId);
  }

  /**
   * Format caption with hashtags for Buffer
   */
  formatCaptionForBuffer(caption: string, hashtags: string[]): string {
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
      
      // CRITICAL FIX: Priority 1 - Use CONsolidated image URL (with text overlays)
      if (slide.condensedImageUrl) {
        if (slide.condensedImageUrl.startsWith('data:')) {
          // For base64 data, we need to upload this as a blob to Postiz
          console.log(`📝 Using base64 condensed image (with text) for slide ${slide.id}`);
          url = slide.condensedImageUrl;
          hasLargeDataUrl = true;
        } else {
          // For regular URLs (should not happen normally)
          console.log(`🖼️ Using condensed image URL (with text) for slide ${slide.id}`);
          url = slide.condensedImageUrl;
        }
      }
      // Priority 2 - Fallback to original image URL ONLY if no condensed image
      else if (slide.originalImageUrl) {
        console.warn(`⚠️ Fallback to original image (NO TEXT) for slide ${slide.id} - condensed image missing!`);
        url = slide.originalImageUrl;
      }

      urls.push(url);
      
      // Estimate size (rough calculation for base64 data URLs)
      if (url.startsWith('data:')) {
        // Base64 data URLs are roughly 33% larger than the original binary data
        totalSize += (url.length * 3) / 4;
      } else if (url.startsWith('http')) {
        // For actual URLs, we need to estimate the image size
        // This is a rough estimate - actual sizes vary
        totalSize += 200000; // Assume ~200KB per image on average
      }
    }

    // Check if payload might be too large (rough threshold)
    const hasLargePayload = hasLargeDataUrl || totalSize > 1000000; // 1MB threshold

    console.log('📊 Payload optimization result:', {
      urlsCount: urls.length,
      hasLargePayload,
      usingConsolidatedImages: urls.some(url => !url.includes('i.ibb.co')) // Check if we're NOT using original imgbb URLs
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
   * Schedule slideshow post via Postiz with automatic payload optimization
   */
  async scheduleSlideshowPost(
    slideshow: SlideshowMetadata,
    profileIds: string[],
    scheduledAt?: Date,
    postNow: boolean = false
  ): Promise<any> {
    try {
      // Use optimized posting data with automatic upgrade if needed
      const postData = await this.getOptimizedPostData(slideshow, profileIds, scheduledAt, postNow);
      
      // Use the enhanced Postiz API with proper image processing
      const result = await postizAPI.createPostWithImages(postData);
      
      console.log('✅ Successfully posted slideshow to Postiz:', result.id);
      return result;
    } catch (error) {
      console.error('❌ Failed to post slideshow to Postiz:', error);
      throw error;
    }
  }

  /**
   * Save to localStorage
   */
  private saveToLocalStorage(): void {
    try {
      const data = Array.from(this.slideshows.entries());
      localStorage.setItem('savedSlideshows', JSON.stringify(data));
      console.log('Saved slideshows to localStorage:', data.length);
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
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
            folder_id: slideshow.folder_id || null
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

      console.log('Loaded slideshows from database:', slideshows?.length || 0);

      // Convert database format to SlideshowMetadata
      slideshows?.forEach(dbSlideshow => {
        try {
          const metadata = dbSlideshow.metadata || {};
          // Add slideshow prefix for internal compatibility
          const slideshowId = `slideshow_${dbSlideshow.id}`;
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
            folder_id: metadata.folder_id || null
          };

          // Store in memory - IMPORTANT: Don't create separate image files for condensed slides
          this.slideshows.set(slideshow.id, slideshow);
          console.log('Loaded slideshow from database:', slideshow.title, 'with', slideshow.condensedSlides.length, 'slides');
        } catch (parseError) {
          console.error('Failed to parse slideshow metadata:', parseError);
        }
      });

      // Save to localStorage for faster access
      this.saveToLocalStorage();

      console.log('Total slideshows after database load:', this.slideshows.size);
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
      // Extract the actual UUID from slideshow ID (remove "slideshow_" prefix if present)
      const actualDatabaseId = slideshowId.startsWith('slideshow_')
        ? slideshowId.replace('slideshow_', '')
        : slideshowId;

      const { error } = await supabase
        .from('slideshows')
        .delete()
        .eq('id', actualDatabaseId); // Use clean UUID for database

      if (error) {
        console.error('Failed to delete slideshow from database:', error);
      }
    } catch (error) {
      console.error('Failed to delete slideshow from database:', error);
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

      // Ensure folder_id exists for backward compatibility
      if (!('folder_id' in slideshow)) {
        (slideshow as any).folder_id = null;
      }

      // Validate the slideshow structure
      if (!slideshow.id || !slideshow.title || !slideshow.condensedSlides) {
        throw new Error('Invalid slideshow file format');
      }

      console.log('✅ Parsed slideshow from file data:', slideshow.title, 'with', slideshow.condensedSlides.length, 'slides');

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

      // Update the slideshow file data in localStorage
      const fileKey = `slideshow_file_${slideshowId}`;
      const fileData = localStorage.getItem(fileKey);
      if (fileData) {
        const parsedFileData = JSON.parse(fileData);
        parsedFileData.folderId = folderId;
        parsedFileData.updated = new Date().toISOString();
        localStorage.setItem(fileKey, JSON.stringify(parsedFileData));
      }

      // Dispatch custom event to update file browser
      window.dispatchEvent(new CustomEvent('slideshowUpdated'));

      console.log(`✅ Slideshow ${slideshow.title} moved to ${folderId || 'root'}`);
    } catch (error) {
      console.error('❌ Failed to move slideshow to folder:', error);
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
      
      // Ensure folder_id exists for backward compatibility
      if (!('folder_id' in slideshow)) {
        (slideshow as any).folder_id = null;
      }

      // Validate the slideshow structure
      if (!slideshow.id || !slideshow.title || !slideshow.condensedSlides) {
        throw new Error('Invalid slideshow file format');
      }

      console.log('✅ Parsed slideshow from file data with folder support:', slideshow.title, 'with', slideshow.condensedSlides.length, 'slides');

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
      // Use the aspect ratio from the first image if available
      const finalAspectRatio = images[0]?.aspectRatio || aspectRatio;

      // Create optimized condensed slides with original URLs for API posting
      const condensedSlides = await this.createOptimizedCondensedSlides(images, textOverlays, finalAspectRatio);

      // Generate slideshow ID with prefix for consistency
      const slideshowId = `slideshow_${crypto.randomUUID()}`;

      const slideshow: SlideshowMetadata = {
        id: slideshowId,
        title,
        postTitle: postTitle || title,
        caption,
        hashtags,
        condensedSlides, // These include original URLs for optimized posting
        textOverlays,
        aspectRatio: finalAspectRatio,
        transitionEffect,
        musicEnabled,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: userId,
        folder_id: null
      };

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

      console.log(`✅ Created optimized slideshow: ${title} (${condensedSlides.length} slides)`);
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
          textOverlays.forEach(overlay => {
            this.drawTextOverlay(ctx, overlay, canvas.width, canvas.height);
          });

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
   * Create a template from a slideshow
   */
  async createTemplateFromSlideshow(
    name: string,
    description: string,
    slideshow: SlideshowMetadata,
    userId: string
  ): Promise<SlideshowTemplate> {
    const template: SlideshowTemplate = {
      id: `template_${crypto.randomUUID()}`,
      name,
      description,
      user_id: userId,
      title: slideshow.title,
      postTitle: slideshow.postTitle,
      caption: slideshow.caption,
      hashtags: slideshow.hashtags,
      textOverlays: slideshow.textOverlays,
      aspectRatio: slideshow.aspectRatio,
      transitionEffect: slideshow.transitionEffect,
      musicEnabled: slideshow.musicEnabled,
      slideCount: slideshow.condensedSlides.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Store in memory
    this.templates.set(template.id, template);
    
    // Save to localStorage
    this.saveTemplatesToLocalStorage();

    // Save to database
    await this.saveTemplateToDatabase(template);

    console.log('Template created:', template.name);
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
    // Check memory first
    let template = this.templates.get(templateId);
    if (!template) {
      // Try to load from localStorage
      this.loadTemplatesFromLocalStorage();
      template = this.templates.get(templateId);
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
    console.log('Template deleted:', templateId);
  }

  /**
   * Apply template to images and create slideshow
   */
  async applyTemplateToImages(
    template: SlideshowTemplate,
    images: UploadedImage[],
    userId: string,
    customizations?: {
      title?: string;
      caption?: string;
      hashtags?: string[];
    }
  ): Promise<TemplateApplicationResult> {
    try {
      // Use template settings with optional overrides
      const finalTitle = customizations?.title || `${template.name} - ${new Date().toLocaleDateString()}`;
      const finalCaption = customizations?.caption || template.caption;
      const finalHashtags = customizations?.hashtags || template.hashtags;

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

      // Apply template text overlays with new image IDs
      const adaptedTextOverlays = template.textOverlays.map(overlay => ({
        ...overlay,
        id: `${overlay.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }));

      // Create the slideshow
      const slideshow = await this.saveSlideshow(
        finalTitle,
        template.postTitle || finalTitle,
        finalCaption,
        finalHashtags,
        selectedImages,
        adaptedTextOverlays,
        template.aspectRatio,
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
   * Bulk upload with template application
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
   * Save templates to localStorage
   */
  private saveTemplatesToLocalStorage(): void {
    try {
      const data = Array.from(this.templates.entries());
      localStorage.setItem('savedTemplates', JSON.stringify(data));
      console.log('Saved templates to localStorage:', data.length);
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
        console.log('Loaded templates from localStorage:', this.templates.size);
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

      const { error } = await supabase
        .from('slideshow_templates')
        .upsert({
          id: template.id,
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
      }
    } catch (error) {
      console.error('Failed to save template to database:', error);
    }
  }

  /**
   * Delete template from database
   */
  private async deleteTemplateFromDatabase(templateId: string): Promise<void> {
    try {
      const { supabase } = await import('./supabase');
      const { error } = await supabase
        .from('slideshow_templates')
        .delete()
        .eq('id', templateId);

      if (error) {
        console.error('Failed to delete template from database:', error);
      }
    } catch (error) {
      console.error('Failed to delete template from database:', error);
    }
  }

  /**
   * Load templates from database for user
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

      console.log('Loaded templates from database:', templates?.length || 0);

      // Convert database format to SlideshowTemplate
      templates?.forEach(dbTemplate => {
        const template: SlideshowTemplate = {
          id: dbTemplate.id,
          name: dbTemplate.name,
          description: dbTemplate.description,
          user_id: dbTemplate.user_id,
          title: dbTemplate.title,
          postTitle: dbTemplate.post_title,
          caption: dbTemplate.caption,
          hashtags: dbTemplate.hashtags || [],
          textOverlays: dbTemplate.text_overlays || [],
          aspectRatio: dbTemplate.aspect_ratio || '9:16',
          transitionEffect: dbTemplate.transition_effect || 'fade',
          musicEnabled: dbTemplate.music_enabled || false,
          previewImage: dbTemplate.preview_image,
          slideCount: dbTemplate.slide_count || 1,
          created_at: dbTemplate.created_at,
          updated_at: dbTemplate.updated_at,
        };

        this.templates.set(template.id, template);
      });

      // Save to localStorage for faster access
      this.saveTemplatesToLocalStorage();
      console.log('Total templates after database load:', this.templates.size);
    } catch (error) {
      console.error('Failed to load templates from database:', error);
    }
  }
}

export const slideshowService = SlideshowService.getInstance();
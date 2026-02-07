import { postizAPI } from './postiz';
import { CondensedSlide, SlideshowMetadata } from '@/types';

export class PostizUploadService {
  /**
   * Upload slideshow images to Postiz storage for posting
   */
  async uploadImagesToPostizStorage(slideshow: SlideshowMetadata): Promise<{ id: string, path: string }[]> {
    console.log('🔄 Starting upload of images to Postiz storage...');

    const validUrls: string[] = [];

    // Extract URLs from the slideshow
    for (const slide of slideshow.condensedSlides) {
      // Priority 1: Condensed URL (Has text burned in) - MUST be http/https and NOT data:
      if (slide.condensedImageUrl && slide.condensedImageUrl.startsWith('http') && !slide.condensedImageUrl.startsWith('data:')) {
        validUrls.push(slide.condensedImageUrl);
      }
      // Priority 2: Original URL (No text, but better than nothing or base64)
      else if (slide.originalImageUrl && slide.originalImageUrl.startsWith('http')) {
        console.warn(`⚠️ Using original image for slide ${slide.id} (Text overlay will be missing)`);
        validUrls.push(slide.originalImageUrl);
      }
      // Priority 3: Fallback - skip if only base64 is available (Postiz requires URL)
      else {
        console.error(`❌ No valid URL found for slide ${slide.id}. Condensed is base64 and original is missing/invalid.`);
      }
    }

    console.log('📋 Found valid URLs to upload:', validUrls);

    const postizMedia: { id: string, path: string }[] = [];
    let successCount = 0;

    for (let i = 0; i < validUrls.length; i++) {
      const imageUrl = validUrls[i];

      try {
        console.log(`📤 Uploading image ${i + 1}/${validUrls.length}: ${imageUrl}`);

        // Upload from URL to Postiz storage
        const postizResponse = await this.uploadUrlToPostiz(imageUrl);

        postizMedia.push({
          id: postizResponse.id,
          path: postizResponse.path
        });

        successCount++;
        console.log(`✅ Successfully uploaded image ${i + 1} to Postiz:`, postizResponse.path);

      } catch (error) {
        console.error(`❌ Failed to upload image ${i + 1}:`, error);
        // Don't add failed uploads
      }
    }

    console.log(`🎉 Upload completed: ${successCount}/${validUrls.length} images successfully uploaded to Postiz`);

    if (successCount === 0) {
      throw new Error('All image uploads to Postiz storage failed. Please try again or check your Postiz API configuration.');
    }

    return postizMedia;
  }

  /**
   * Upload image from URL to Postiz storage using upload-from-url endpoint
   */
  private async uploadUrlToPostiz(imageUrl: string): Promise<{ id: string, path: string }> {
    console.log(`🌐 Uploading to Postiz from URL: ${imageUrl}`);

    try {
      // Use proxy for CORS handling (required for browser-based uploads)
      const response = await fetch('/api/postiz-proxy?path=upload-from-url', {
        method: 'POST',
        headers: {
          'Authorization': postizAPI.getApiKey() || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: imageUrl })
      });

      console.log(`📊 Upload response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Postiz upload error:', errorText);

        // Provide specific error messages for different failure types
        if (response.status === 404) {
          throw new Error('Upload endpoint not found. The Postiz API proxy may not be configured correctly.');
        } else if (response.status === 401) {
          throw new Error('Authentication failed. Please check your Postiz API key.');
        } else {
          throw new Error(`Upload failed (${response.status}): ${errorText}`);
        }
      }

      const result = await response.json();
      console.log('✅ Postiz upload successful:', result);

      // Validate that the result contains proper Postiz domain paths
      const uploadPath = result.path || result.url;
      if (!uploadPath.includes('uploads.postiz.com')) {
        throw new Error('Upload succeeded but returned invalid domain. Expected uploads.postiz.com domain.');
      }

      return {
        id: result.id || `upload_${Date.now()}`,
        path: uploadPath
      };

    } catch (error) {
      console.error('❌ Upload request failed:', error);
      throw error;
    }
  }

  /**
   * Create Postiz post data with valid images images uploaded to Postiz storage
   * This follows the correct flow: ImgBB/Supabase -> Postiz storage for posting
   */
  async createOptimizedPostizData(
    slideshow: SlideshowMetadata,
    profileIds: string[],
    scheduledAt?: Date,
    postNow: boolean = false
  ) {
    console.log('🔄 Creating Postiz post data with ImgBB/Supabase -> Postiz storage flow...');

    // Step 1: Upload images to Postiz storage (required for posting)
    // Uses the new method name
    const postizMedia = await this.uploadImagesToPostizStorage(slideshow);

    if (postizMedia.length === 0) {
      throw new Error('No images were successfully uploaded to Postiz storage. Cannot create post without images.');
    }

    const postData = {
      text: this.formatCaptionForBuffer(slideshow.caption, slideshow.hashtags),
      profileIds: profileIds,
      mediaUrls: postizMedia.map(media => media.path), // Use Postiz storage paths
      scheduledAt: scheduledAt?.toISOString(),
      publishedAt: postNow ? new Date().toISOString() : undefined,
      _postizMedia: postizMedia, // Keep for API call with Postiz image IDs
      // Add enhanced metadata for better tracking
      _uploadMetadata: {
        originalCount: slideshow.condensedSlides.length,
        postizUploadedCount: postizMedia.length,
        uploadTimestamp: new Date().toISOString(),
        uploadSuccess: postizMedia.length === slideshow.condensedSlides.length
      }
    };

    console.log('✅ Created Postiz post data with Postiz storage paths');
    console.log('📊 Final media to reference in post:', postizMedia);
    return postData;
  }

  /**
   * STEP 2 ONLY: Create post using already uploaded Postiz images
   * Requires images to already be uploaded to Postiz storage (Step 1 completed)
   */
  async createPostWithUploadedImages(
    text: string,
    integrationId: string,
    postizMedia: { id: string, path: string }[],
    scheduledAt?: Date,
    postNow: boolean = false
  ): Promise<{ postId: string, integration: string }> {
    console.log('📤 STEP 2: Creating post with already uploaded Postiz images...');

    // Use the postizAPI method directly
    return await postizAPI.createPostWithPostizImages(
      text,
      integrationId,
      postizMedia,
      scheduledAt,
      postNow
    );
  }

  /**
   * Format caption with hashtags for Postiz
   */
  private formatCaptionForBuffer(caption: string, hashtags: string[]): string {
    // Use the caption exactly as provided - preserve original text without modifications
    const hashtagText = hashtags.map(tag => `#${tag}`).join(' ');
    return `${caption}\n\n${hashtagText}`;
  }
}

export const postizUploadService = new PostizUploadService();
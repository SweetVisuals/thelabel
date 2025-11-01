import { postizAPI } from './postiz';
import { CondensedSlide, SlideshowMetadata } from '@/types';

export class PostizUploadService {
  /**
   * Upload imgbb-hosted slideshow images to Postiz storage for posting
   * This takes the imgbb URLs from the slideshow and uploads them to Postiz's storage
   */
  async uploadImgbbImagesToPostiz(slideshow: SlideshowMetadata): Promise<{id: string, path: string}[]> {
    console.log('🔄 Starting upload of imgbb images to Postiz storage...');
    
    const imgbbUrls: string[] = [];
    
    // Extract imgbb URLs from the slideshow
    for (const slide of slideshow.condensedSlides) {
      // Priority 1: Use condensed image URL if it's imgbb
      if (slide.condensedImageUrl?.includes('i.ibb.co')) {
        imgbbUrls.push(slide.condensedImageUrl);
      }
      // Priority 2: Use original image URL if it's imgbb
      else if (slide.originalImageUrl?.includes('i.ibb.co')) {
        imgbbUrls.push(slide.originalImageUrl);
      }
      // Priority 3: Use any http URL available
      else if (slide.condensedImageUrl?.startsWith('http')) {
        imgbbUrls.push(slide.condensedImageUrl);
      }
      else if (slide.originalImageUrl?.startsWith('http')) {
        imgbbUrls.push(slide.originalImageUrl);
      }
    }
    
    console.log('📋 Found imgbb URLs to upload:', imgbbUrls);
    
    const postizMedia: {id: string, path: string}[] = [];
    let successCount = 0;
    
    for (let i = 0; i < imgbbUrls.length; i++) {
      const imgbbUrl = imgbbUrls[i];
      
      try {
        console.log(`📤 Uploading imgbb image ${i + 1}/${imgbbUrls.length}: ${imgbbUrl}`);
        
        // Upload from imgbb URL to Postiz storage
        const postizResponse = await this.uploadUrlToPostiz(imgbbUrl);
        
        postizMedia.push({
          id: postizResponse.id,
          path: postizResponse.path
        });
        
        successCount++;
        console.log(`✅ Successfully uploaded imgbb image ${i + 1} to Postiz:`, postizResponse.path);
        
      } catch (error) {
        console.error(`❌ Failed to upload imgbb image ${i + 1}:`, error);
        // Don't add failed uploads - this will cause the posting to fail and provide proper error message
      }
    }
    
    console.log(`🎉 Upload completed: ${successCount}/${imgbbUrls.length} images successfully uploaded to Postiz`);
    
    if (successCount === 0) {
      throw new Error('All image uploads to Postiz storage failed. Please try again or check your Postiz API configuration.');
    }
    
    return postizMedia;
  }
  
  /**
   * Upload image from URL to Postiz storage using upload-from-url endpoint
   */
  private async uploadUrlToPostiz(imageUrl: string): Promise<{id: string, path: string}> {
    console.log(`🌐 Uploading to Postiz from URL: ${imageUrl}`);
    
    try {
      const response = await fetch('/api/postiz-proxy/upload-from-url', {
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
   * Create Postiz post data with imgbb images uploaded to Postiz storage
   * This follows the correct flow: imgbb for slideshow → Postiz storage for posting
   */
  async createOptimizedPostizData(
    slideshow: SlideshowMetadata,
    profileIds: string[],
    scheduledAt?: Date,
    postNow: boolean = false
  ) {
    console.log('🔄 Creating Postiz post data with imgbb → Postiz storage flow...');
    
    // Step 1: Upload imgbb images to Postiz storage (required for posting)
    const postizMedia = await this.uploadImgbbImagesToPostiz(slideshow);
    
    if (postizMedia.length === 0) {
      throw new Error('No images were successfully uploaded to Postiz storage. Cannot create post without images.');
    }
    
    const postData = {
      text: this.formatCaptionForBuffer(slideshow.caption, slideshow.hashtags),
      profileIds: profileIds,
      mediaUrls: postizMedia.map(media => media.path), // Use Postiz storage paths
      scheduledAt: scheduledAt?.toISOString(),
      publishedAt: postNow ? new Date().toISOString() : undefined,
      _postizMedia: postizMedia // Keep for debugging and API call
    };
    
    console.log('✅ Created Postiz post data with Postiz storage paths');
    console.log('📊 Final media to reference in post:', postizMedia);
    return postData;
  }
  
  /**
   * Format caption with hashtags for Postiz
   */
  private formatCaptionForBuffer(caption: string, hashtags: string[]): string {
    const hashtagText = hashtags.map(tag => `#${tag}`).join(' ');
    return `${caption}\n\n${hashtagText}`;
  }
}

export const postizUploadService = new PostizUploadService();
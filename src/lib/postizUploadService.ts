import { uploadToImgbb } from './imgbb';
import { CondensedSlide, SlideshowMetadata } from '@/types';

export class PostizUploadService {
  /**
   * Upload consolidated slideshow images to imgbb and return optimized URLs for Postiz
   */
  async uploadConsolidatedImagesToImgbb(slideshow: SlideshowMetadata): Promise<string[]> {
    console.log('🖼️ Starting upload of consolidated images to imgbb...');
    
    const uploadedUrls: string[] = [];
    
    for (let i = 0; i < slideshow.condensedSlides.length; i++) {
      const slide = slideshow.condensedSlides[i];
      
      try {
        console.log(`📤 Uploading slide ${i + 1}/${slideshow.condensedSlides.length}: ${slide.id}`);
        
        // Convert base64 data URL to File object
        const imageFile = await this.dataUrlToFile(slide.condensedImageUrl, `slide_${i + 1}.jpg`);
        
        // Upload to imgbb
        const imgbbResponse = await uploadToImgbb(imageFile);
        
        console.log(`✅ Successfully uploaded slide ${i + 1} to imgbb:`, imgbbResponse.data.url);
        uploadedUrls.push(imgbbResponse.data.url);
        
      } catch (error) {
        console.error(`❌ Failed to upload slide ${i + 1} to imgbb:`, error);
        
        // Fallback to original image URL if consolidated image fails
        if (slide.originalImageUrl) {
          console.warn(`⚠️ Falling back to original image for slide ${i + 1}`);
          uploadedUrls.push(slide.originalImageUrl);
        } else {
          // Last resort: placeholder image
          console.error(`❌ No fallback available for slide ${i + 1}`);
          uploadedUrls.push('https://via.placeholder.com/1080x1920/000000/FFFFFF?text=Upload+Failed');
        }
      }
    }
    
    console.log(`🎉 Completed upload of ${uploadedUrls.length} images to imgbb`);
    return uploadedUrls;
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
   * Create optimized Postiz post data with imgbb-hosted images
   */
  async createOptimizedPostizData(
    slideshow: SlideshowMetadata,
    profileIds: string[],
    scheduledAt?: Date,
    postNow: boolean = false
  ) {
    console.log('🔄 Creating optimized Postiz data with imgbb uploads...');
    
    // Upload consolidated images to imgbb
    const imgbbUrls = await this.uploadConsolidatedImagesToImgbb(slideshow);
    
    const postData = {
      text: this.formatCaptionForBuffer(slideshow.caption, slideshow.hashtags),
      profileIds: profileIds,
      mediaUrls: imgbbUrls,
      scheduledAt: scheduledAt?.toISOString(),
      publishedAt: postNow ? new Date().toISOString() : undefined
    };
    
    console.log('✅ Created optimized Postiz data with imgbb URLs');
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
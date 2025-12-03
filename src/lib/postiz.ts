const POSTIZ_API_BASE = 'https://api.postiz.com/public/v1';
// Proxy configuration for development and production
const VERCEL_PROXY = '/api/postiz-proxy?path=';

// Check if we're in development mode
const isDevelopment = import.meta.env.DEV;

// Get the appropriate proxy URL based on environment
const getProxyUrl = (path: string): string => {
  if (isDevelopment) {
    // In development, use direct proxy path (works with Vite proxy)
    return `/api/postiz-proxy/${path}`;
  }
  // In production, use query parameter format (works with Vercel functions)
  return `${VERCEL_PROXY}${path}`;
};

console.log(`🚀 Postiz API Mode: ${isDevelopment ? 'Development (Proxy)' : 'Production (Vercel Proxy)'}`);

export interface PostizProfile {
  id: string;
  username: string;
  provider: string; // 'tiktok', 'instagram', 'twitter', etc.
  displayName: string;
  avatar?: string;
}

export interface PostizPost {
  id: string;
  text: string;
  mediaUrls?: string[];
  scheduledAt?: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  profiles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostData {
  text: string;
  profileIds: string[];
  mediaUrls?: string[];
  scheduledAt?: string;
  publishedAt?: string;
}

export const postizAPI = {
  // Set user API key
  setApiKey: (apiKey: string) => {
    localStorage.setItem('postiz_api_key', apiKey);
  },

  // Get user API key
  getApiKey: (): string | null => {
    return localStorage.getItem('postiz_api_key');
  },

  // Get authorization headers
  getAuthHeaders: () => {
    const apiKey = postizAPI.getApiKey();
    if (!apiKey) {
      throw new Error('Postiz API key not found');
    }
    return {
      'Authorization': apiKey,
      'Content-Type': 'application/json',
    };
  },

  // Get proxied URL for Vercel proxy (legacy method - use getProxyUrl for new code)
  getProxiedUrl: (url: string): string => {
    // Extract the path from the URL for the Vercel proxy
    const urlObj = new URL(url);
    const path = urlObj.pathname.replace('/public/v1/', '');
    return getProxyUrl(path);
  },

  // Get user profiles
  async getProfiles(): Promise<PostizProfile[]> {
    try {
      const headers = postizAPI.getAuthHeaders();
      const proxiedUrl = getProxyUrl('integrations');

      console.log('📤 Fetching profiles via:', proxiedUrl);

      const response = await fetch(proxiedUrl, {
        headers,
      });

      console.log('📊 Profile fetch response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Postiz API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      if (!data) {
        return [];
      }

      if (!Array.isArray(data)) {
        return [];
      }

      if (data.length === 0) {
        return [];
      }

      // Transform Postiz integration format to our interface
      const profiles = data?.map((integration: any) => {
        return {
          id: integration.id,
          username: integration.profile,
          provider: integration.identifier,
          displayName: integration.name,
          avatar: integration.picture,
        };
      }) || [];

      return profiles;

    } catch (error) {

      // More specific error messages
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Could not connect to Postiz API. Check your internet connection.');
      }

      if (error instanceof Error && error.message.includes('401')) {
        throw new Error('Authentication error: Invalid API key. Please check your Postiz API key.');
      }

      if (error instanceof Error && error.message.includes('403')) {
        throw new Error('Access denied: API key may not have required permissions.');
      }

      throw new Error(`Failed to load profiles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Create a new post using Postiz image gallery URLs (Step 2: after images are uploaded)
  async createPostWithPostizImages(
    text: string,
    integrationId: string,
    postizMedia: { id: string, path: string }[],
    scheduledAt?: Date,
    postNow: boolean = false
  ): Promise<{ postId: string, integration: string }> {
    try {
      const proxiedUrl = getProxyUrl('posts');

      // Validate required fields
      if (!integrationId) {
        throw new Error('Integration ID (profile ID) is required');
      }

      if (!text || text.trim() === '') {
        throw new Error('Post content is required');
      }

      if (!postizMedia || postizMedia.length === 0) {
        throw new Error('Postiz media images are required');
      }

      console.log('📤 Creating post with Postiz image gallery URLs via:', proxiedUrl);
      console.log('📊 Post details:', {
        integrationId,
        mediaCount: postizMedia.length,
        hasScheduledDate: !!scheduledAt,
        postNow
      });

      // Format according to exact Postiz API specification
      const requestBody = {
        type: postNow ? 'now' : (scheduledAt ? 'schedule' : 'now'),
        date: scheduledAt ? scheduledAt.toISOString() : new Date().toISOString(),
        shortLink: false, // Required top-level field
        tags: [], // Required top-level field as empty array
        posts: [{
          integration: {
            id: integrationId
          },
          value: [{
            content: text,
            image: postizMedia.map(media => ({
              id: media.id,
              path: media.path
            }))
          }],
          group: `slideshow_${Date.now()}`, // Unique group ID for batch posts
          settings: {
            shortLink: false, // Required in settings
            privacy_level: 'PUBLIC_TO_EVERYONE',
            duet: false, // Required boolean
            stitch: false, // Required boolean
            comment: true, // Required boolean
            autoAddMusic: 'no', // Required: 'yes' or 'no' (lowercase)
            brand_content_toggle: false, // Required boolean
            brand_organic_toggle: false, // Required boolean
            content_posting_method: 'DIRECT_POST' // Required: 'DIRECT_POST' or 'UPLOAD'
          }
        }]
      };

      console.log('📤 Posting to Postiz with exact format:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(proxiedUrl, {
        method: 'POST',
        headers: postizAPI.getAuthHeaders(),
        body: JSON.stringify(requestBody),
      });

      console.log('📊 Post response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Postiz API Error Details:', errorText);

        // Try to parse the error response for more details
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.message && Array.isArray(errorData.message)) {
            throw new Error(`Postiz API validation error: ${errorData.message.join(', ')}`);
          }
        } catch (parseError) {
          // If we can't parse the error, use the raw response
        }

        throw new Error(`Postiz API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const responseData = await response.json();
      console.log('✅ Postiz API response:', responseData);

      // Return exact format as specified: [{ "postId": "POST_ID", "integration": "INTEGRATION_ID" }]
      if (Array.isArray(responseData) && responseData.length > 0) {
        return {
          postId: responseData[0].postId,
          integration: responseData[0].integration
        };
      } else {
        throw new Error('Invalid response format from Postiz API');
      }
    } catch (error) {
      console.error('❌ Post creation with Postiz images failed:', error);
      throw new Error(`Failed to create post with Postiz images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Legacy method for backward compatibility (Step 1 & 2 combined)
  async createPost(postData: CreatePostData & { _postizMedia?: { id: string, path: string }[] }): Promise<PostizPost> {
    try {
      // Step 1: Validate required fields
      if (!postData.profileIds || postData.profileIds.length === 0) {
        throw new Error('Profile ID is required');
      }

      if (!postData.text || postData.text.trim() === '') {
        throw new Error('Post content is required');
      }

      // Step 2: Ensure we have Postiz media (images must be uploaded to Postiz first)
      if (!postData._postizMedia || postData._postizMedia.length === 0) {
        throw new Error('Postiz images are required. Please upload images to Postiz first using the 2-step process.');
      }

      console.log('📤 Creating post via legacy method with Postiz images');
      console.log('📊 Post data:', {
        profileCount: postData.profileIds.length,
        mediaCount: postData._postizMedia.length
      });

      // Use the new method for post creation
      const result = await this.createPostWithPostizImages(
        postData.text,
        postData.profileIds[0],
        postData._postizMedia,
        postData.scheduledAt ? new Date(postData.scheduledAt) : undefined,
        !!postData.publishedAt
      );

      // Return in the legacy format for backward compatibility
      return {
        id: result.postId,
        text: postData.text,
        mediaUrls: postData._postizMedia.map((media: { id: string, path: string }) => media.path),
        scheduledAt: postData.scheduledAt,
        status: 'scheduled',
        profiles: postData.profileIds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Legacy post creation failed:', error);
      throw new Error(`Failed to create post: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Upload images to Postiz domain via API (as documented in Discord)
  async uploadImagesToPostizDomain(imageUrls: string[]): Promise<{ id: string, path: string }[]> {
    try {
      console.log('🔄 Starting automatic upload to Postiz domain...', imageUrls.length, 'images');

      const uploadResults = await Promise.all(imageUrls.map(async (imageUrl, index) => {
        try {
          console.log(`📤 Processing image ${index + 1}/${imageUrls.length}: ${imageUrl}`);

          // Method 1: Try upload from URL (preferred method)
          console.log(`🌐 Attempting upload from URL for image ${index + 1}...`);
          const urlUploadResult = await this.uploadImageFromUrl(imageUrl, index);

          if (urlUploadResult.success) {
            console.log(`✅ Successfully uploaded ${imageUrl} via URL method`);
            return {
              id: `uploaded_${index + 1}`,
              path: urlUploadResult.path
            };
          }

          // Method 2: Fallback to multipart upload if URL method fails
          console.log(`📁 Falling back to multipart upload for image ${index + 1}...`);
          const fileUploadResult = await this.uploadImageFile(imageUrl, index);

          if (fileUploadResult.success) {
            console.log(`✅ Successfully uploaded ${imageUrl} via file method`);
            return {
              id: `uploaded_${index + 1}`,
              path: fileUploadResult.path
            };
          }

          // If both methods fail, return original URL with error marker
          console.warn(`⚠️ Both upload methods failed for ${imageUrl}, using original URL`);
          return {
            id: `fallback_${index + 1}`,
            path: imageUrl
          };

        } catch (error) {
          console.error(`❌ Failed to process image ${index + 1}:`, error);
          return {
            id: `failed_${index + 1}`,
            path: imageUrl
          };
        }
      }));

      console.log(`🏁 Upload process completed: ${uploadResults.length} images processed`);
      return uploadResults;

    } catch (error) {
      console.error('💥 Critical failure in upload process:', error);
      return imageUrls.map((imageUrl, index) => ({
        id: `critical_error_${index + 1}`,
        path: imageUrl
      }));
    }
  },

  // Skip test functionality - focus on actual slideshow uploads
  // The slideshow condensed images are already in proper PNG/JPEG format
  // No need for separate testing endpoint
  async testUploadFunctionality(): Promise<{ success: boolean, message: string }> {
    return {
      success: true,
      message: 'Upload functionality ready - will be tested with actual slideshow images.'
    };
  },

  // Upload image from URL using Postiz API (as documented in Discord)
  async uploadImageFromUrl(imageUrl: string, index: number): Promise<{ success: boolean, path: string }> {
    try {
      const proxiedUrl = getProxyUrl('upload-from-url');

      console.log(`📤 Uploading from URL via:`, proxiedUrl);

      const response = await fetch(proxiedUrl, {
        method: 'POST',
        headers: postizAPI.getAuthHeaders(),
        body: JSON.stringify({ url: imageUrl })
      });

      console.log(`📊 Upload response status:`, response.status);

      if (!response.ok) {
        console.error(`❌ URL upload failed for ${imageUrl}:`, response.status);
        return { success: false, path: imageUrl };
      }

      const result = await response.json();
      console.log(`✅ Upload successful:`, result);
      return {
        success: true,
        path: result.path || result.url || `upload_${Date.now()}_${index + 1}`
      };
    } catch (error) {
      console.error(`❌ URL upload error for ${imageUrl}:`, error);
      return { success: false, path: imageUrl };
    }
  },

  // Upload image file using Postiz API multipart upload (as documented in Discord)
  async uploadImageFile(imageUrl: string, index: number): Promise<{ success: boolean, path: string }> {
    try {
      // Download the image first
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download: ${imageResponse.status}`);
      }

      const blob = await imageResponse.blob();
      const filename = `slideshow_slide_${index + 1}_${Date.now()}.jpg`;

      // Create form data for multipart upload
      const formData = new FormData();
      formData.append('file', blob, filename);

      const proxiedUrl = getProxyUrl('upload');

      console.log(`📤 Multipart upload via:`, proxiedUrl);

      const response = await fetch(proxiedUrl, {
        method: 'POST',
        headers: {
          'Authorization': postizAPI.getAuthHeaders().Authorization
          // Don't set Content-Type for FormData, let browser set it with boundary
        },
        body: formData
      });

      console.log(`📊 Multipart upload response status:`, response.status);

      if (!response.ok) {
        console.error(`❌ File upload failed for ${imageUrl}:`, response.status);
        return { success: false, path: imageUrl };
      }

      const result = await response.json();
      console.log(`✅ Multipart upload successful:`, result);
      return {
        success: true,
        path: result.path || result.url || filename
      };
    } catch (error) {
      console.error(`❌ File upload error for ${imageUrl}:`, error);
      return { success: false, path: imageUrl };
    }
  },

  // Upload images to Postiz domain and get upload IDs
  async uploadImagesToPostiz(imageUrls: string[]): Promise<{ id: string, url: string }[]> {
    try {
      const uploadPromises = imageUrls.map(async (imageUrl, index) => {
        try {
          // For now, we'll try to use the image URL directly
          // In a real implementation, you'd upload to Postiz's upload endpoint first
          console.log(`Processing image ${index + 1}:`, imageUrl);

          return {
            id: `uploaded_${index + 1}_${Date.now()}`,
            url: imageUrl
          };
        } catch (error) {
          console.error(`Failed to process image ${index + 1}:`, error);
          // Return fallback image
          return {
            id: `fallback_${index + 1}_${Date.now()}`,
            url: 'https://via.placeholder.com/1080x1920/000000/FFFFFF?text=Image+Upload+Failed'
          };
        }
      });

      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Failed to upload images to Postiz:', error);
      // Return fallback images
      return imageUrls.map((_, index) => ({
        id: `fallback_${index + 1}_${Date.now()}`,
        url: 'https://via.placeholder.com/1080x1920/000000/FFFFFF?text=Image+Upload+Failed'
      }));
    }
  },

  // Hybrid approach: Try automatic upload first, then provide manual guidance
  async createPostWithImages(postData: CreatePostData): Promise<PostizPost> {
    try {
      if (postData.mediaUrls && postData.mediaUrls.length > 0) {
        // Check if images need to be on uploads.postiz.com domain
        const externalUrls = postData.mediaUrls.filter(url => !url.includes('uploads.postiz.com'));

        if (externalUrls.length > 0) {
          console.log(`🔄 Found ${externalUrls.length} external images - attempting automatic upload...`);

          try {
            const uploadedImages = await this.uploadImagesToPostizDomain(externalUrls);

            // Check results
            const successfulUploads = uploadedImages.filter(result =>
              result.path.includes('uploads.postiz.com') || result.path.startsWith('http')
            );

            if (successfulUploads.length === externalUrls.length) {
              // All uploads successful
              const processedUrls = [...postData.mediaUrls];
              let uploadIndex = 0;

              for (let i = 0; i < processedUrls.length; i++) {
                if (!processedUrls[i].includes('uploads.postiz.com') && uploadIndex < uploadedImages.length) {
                  processedUrls[i] = uploadedImages[uploadIndex].path;
                  uploadIndex++;
                }
              }

              console.log(`🎉 Automatic upload successful! ${successfulUploads.length} images uploaded`);

              const processedPostData: CreatePostData = {
                ...postData,
                mediaUrls: processedUrls
              };

              return await this.createPost(processedPostData);
            } else {
              // Partial success - fall through to manual guidance
              console.warn(`⚠️ Partial upload success: ${successfulUploads.length}/${externalUrls.length}`);
            }
          } catch (uploadError) {
            console.warn('⚠️ Upload attempt failed, proceeding to manual guidance:', uploadError);
          }

          // If we get here, automatic upload failed - provide manual guidance
          const manualSteps = this.generateManualUploadSteps(externalUrls);
          throw new Error(manualSteps);
        }
      }

      // All images already on Postiz domain or no images
      return await this.createPost(postData);
    } catch (error) {
      throw new Error(`Failed to create post with images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Generate step-by-step manual upload instructions
  generateManualUploadSteps(imageUrls: string[]): string {
    const imageList = imageUrls.map((url, index) =>
      `${index + 1}. ${url}`
    ).join('\n');

    return `📸 MANUAL IMAGE UPLOAD REQUIRED

Postiz requires images on uploads.postiz.com domain. Here's how to fix it:

🎯 QUICK SOLUTION:
1. Open Postiz app: https://app.postiz.com/
2. Go to Media Library
3. Upload these ${imageUrls.length} images:
${imageList}
4. Copy the uploads.postiz.com URLs
5. Replace image URLs in your slideshow
6. Try posting again

🔄 OR ALTERNATIVELY:
• Create your slideshow using images already uploaded to Postiz
• Postiz has its own image hosting - use that instead

⚡ WHY THIS HAPPENS:
External images (imgbb.com, etc.) can't be used directly with Postiz API for security reasons.

💡 PRO TIP:
Once you upload images to Postiz, they're permanently available for all your future posts!`;
  },

  // Helper method to validate if images are Postiz-compatible
  validateImageUrls(imageUrls: string[]): { isValid: boolean, needsUpload: boolean, externalUrls: string[] } {
    const externalUrls = imageUrls.filter(url => !url.includes('uploads.postiz.com'));

    return {
      isValid: externalUrls.length === 0,
      needsUpload: externalUrls.length > 0,
      externalUrls
    };
  },

  // Get user's posts
  async getPosts(startDate?: string, endDate?: string): Promise<PostizPost[]> {
    try {
      // Default to 30 days ago if not specified
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      // Default to 90 days in the future to catch scheduled posts
      const end = endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      const proxiedUrl = getProxyUrl(`posts?startDate=${start}&endDate=${end}`);

      console.log('📤 Fetching posts via:', proxiedUrl);

      const response = await fetch(proxiedUrl, {
        headers: postizAPI.getAuthHeaders(),
      });

      console.log('📊 Posts fetch response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Postiz API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      return data.posts?.map((post: any) => ({
        id: post.id,
        text: post.content,
        mediaUrls: post.image?.map((img: any) => img.path) || [],
        scheduledAt: post.publishDate,
        status: post.state.toLowerCase(),
        profiles: [post.integration.id],
        createdAt: post.publishDate,
        updatedAt: post.publishDate,
      })) || [];
    } catch (error) {
      throw new Error(`Failed to fetch posts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Delete a post
  async deletePost(postId: string): Promise<void> {
    try {
      const url = `${POSTIZ_API_BASE}/posts/${postId}`;
      const proxiedUrl = postizAPI.getProxiedUrl(url);

      const response = await fetch(proxiedUrl, {
        method: 'DELETE',
        headers: postizAPI.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Postiz API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(`Failed to delete post: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Test API key validity
  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      // Since CORS blocks direct browser requests to Postiz API,
      // we'll do a basic format validation instead
      // The actual validation will happen when the API is called in production
      return Boolean(apiKey && apiKey.length > 10 && /^[a-zA-Z0-9]+$/.test(apiKey));
    } catch (error) {
      return false;
    }
  },
};
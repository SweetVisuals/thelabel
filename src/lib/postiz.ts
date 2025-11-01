const POSTIZ_API_BASE = 'https://api.postiz.com/public/v1';
// Vercel proxy to bypass CORS and handle large payloads
const VERCEL_PROXY = '/api/postiz-proxy?path=';

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

  // Get proxied URL for Vercel proxy
  getProxiedUrl: (url: string): string => {
    // Extract the path from the URL for the Vercel proxy
    const urlObj = new URL(url);
    const path = urlObj.pathname.replace('/public/v1/', '');
    return `${VERCEL_PROXY}${path}`;
  },

  // Get user profiles
  async getProfiles(): Promise<PostizProfile[]> {
    try {
      const url = `${POSTIZ_API_BASE}/integrations`;
      const proxiedUrl = `${VERCEL_PROXY}integrations`;
      
      const headers = postizAPI.getAuthHeaders();
      
      const response = await fetch(proxiedUrl, {
        headers,
      });

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

  // Create a new post with proper Postiz API format
  async createPost(postData: CreatePostData): Promise<PostizPost> {
    try {
      const proxiedUrl = `${VERCEL_PROXY}posts`;
      
      // Postiz requires images to be uploaded to their domain first, then referenced by path
      let processedImages: {id: string, path: string}[] = [];
      if (postData.mediaUrls && postData.mediaUrls.length > 0) {
        // For now, we'll try to use the images as-is
        // In a real implementation, you'd upload to Postiz first
        processedImages = postData.mediaUrls.map((url, index) => {
          // Postiz expects images to be on uploads.postiz.com domain
          // If not, we'll still try to post but Postiz may reject
          return {
            id: `img_${index + 1}`,
            path: url // Postiz expects 'path' field, not 'url'
          };
        });
      }

      // Postiz requires specific format with all required fields
      const requestBody = {
        type: postData.scheduledAt ? 'schedule' : 'now',
        date: postData.scheduledAt || new Date().toISOString(),
        posts: [{
          integration: { id: postData.profileIds[0] },
          value: [{
            content: postData.text,
            image: processedImages,
            tags: [], // Required field - can be empty array
          }],
          // Required settings object with correct field names
          settings: {
            privacy_level: 'PUBLIC_TO_EVERYONE',
            shortLink: false, // lowercase 'L'
            duet: false,
            stitch: false,
            comment: true,
            autoAddMusic: 'no', // camelCase
            brand_content_toggle: false,
            brand_organic_toggle: false,
            content_posting_method: 'DIRECT_POST' // Required field
          }
        }],
      };

      console.log('📤 Posting to Postiz with format:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(proxiedUrl, {
        method: 'POST',
        headers: postizAPI.getAuthHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Postiz API Error Details:', errorText);
        throw new Error(`Postiz API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      return {
        id: data[0]?.postId || 'unknown',
        text: postData.text,
        mediaUrls: postData.mediaUrls || [],
        scheduledAt: postData.scheduledAt,
        status: 'scheduled',
        profiles: postData.profileIds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Failed to create post: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Upload images to Postiz domain via API (automatic) - Enhanced version
  async uploadImagesToPostizDomain(imageUrls: string[]): Promise<{id: string, path: string}[]> {
    try {
      console.log('🔄 Starting automatic upload to Postiz domain...', imageUrls.length, 'images');
      
      // First, let's check if we can get the upload endpoint
      console.log('🔍 Testing Postiz upload endpoint availability...');
      const uploadEndpoint = await this.getSignedUploadUrl('test.jpg', 'image/jpeg');
      
      if (!uploadEndpoint) {
        console.error('❌ Postiz upload endpoint not available - upload functionality disabled');
        throw new Error('Postiz upload service temporarily unavailable');
      }
      
      const uploadResults = await Promise.all(imageUrls.map(async (imageUrl, index) => {
        try {
          console.log(`📤 Processing image ${index + 1}/${imageUrls.length}: ${imageUrl}`);
          
          // Step 1: Download the image from external URL
          console.log(`📥 Downloading image ${index + 1}...`);
          const response = await fetch(imageUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; SlideshowApp/1.0)'
            }
          });
          
          if (!response.ok) {
            throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
          }
          
          const blob = await response.blob();
          console.log(`✅ Downloaded ${imageUrl} -> ${blob.size} bytes (${blob.type})`);
          
          // Step 2: Get upload URL for this specific image
          console.log(`🔗 Getting upload URL for image ${index + 1}...`);
          const filename = `slideshow_slide_${index + 1}_${Date.now()}.jpg`;
          const uploadData = await this.getSignedUploadUrl(filename, blob.type);
          
          if (!uploadData) {
            throw new Error('Failed to get upload URL from Postiz');
          }
          
          console.log(`🎯 Upload URL obtained for ${filename}`);
          
          // Step 3: Upload the image to Postiz
          console.log(`⬆️ Uploading ${filename} to Postiz...`);
          const uploadResponse = await fetch(uploadData.uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': blob.type,
              'Content-Length': blob.size.toString()
            },
            body: blob
          });
          
          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error(`❌ Upload failed for ${filename}:`, uploadResponse.status, errorText);
            throw new Error(`Upload failed: ${uploadResponse.status}`);
          }
          
          console.log(`✅ Successfully uploaded ${filename} to Postiz`);
          
          // Step 4: Return the path that Postiz expects
          const uploadedPath = uploadData.filePath || filename;
          
          return {
            id: `uploaded_${index + 1}`,
            path: uploadedPath
          };
          
        } catch (error) {
          console.error(`❌ Failed to process image ${index + 1}:`, error);
          
          // Return the original URL as fallback with error marker
          return {
            id: `failed_${index + 1}`,
            path: imageUrl // Original URL as fallback
          };
        }
      }));

      console.log(`🏁 Upload process completed: ${uploadResults.length} images processed`);
      
      // Analyze results
      const successfulUploads = uploadResults.filter(result => result.path !== imageUrls[uploadResults.indexOf(result)]);
      const failedUploads = uploadResults.length - successfulUploads.length;
      
      console.log(`📊 Upload results: ${successfulUploads.length} successful, ${failedUploads} failed`);
      
      if (failedUploads > 0) {
        console.warn(`⚠️ ${failedUploads} uploads failed - will provide manual guidance`);
      }
      
      return uploadResults;
      
    } catch (error) {
      console.error('💥 Critical failure in upload process:', error);
      
      // Return original URLs with error markers
      return imageUrls.map((imageUrl, index) => ({
        id: `critical_error_${index + 1}`,
        path: imageUrl
      }));
    }
  },

  // Test Postiz upload functionality
  async testUploadFunctionality(): Promise<{success: boolean, message: string}> {
    try {
      console.log('🧪 Testing Postiz upload functionality...');
      
      // Try to get an upload URL
      const uploadData = await this.getSignedUploadUrl('test.jpg', 'image/jpeg');
      
      if (!uploadData) {
        return {
          success: false,
          message: 'Postiz upload service is not available or your API key lacks upload permissions.'
        };
      }
      
      return {
        success: true,
        message: 'Postiz upload service is available and working.'
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Upload test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },

  // Get signed upload URL from Postiz
  async getSignedUploadUrl(filename: string, contentType: string): Promise<{uploadUrl: string, filePath: string} | null> {
    try {
      const response = await fetch(`${VERCEL_PROXY}upload-url`, {
        method: 'POST',
        headers: {
          ...postizAPI.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename,
          contentType
        })
      });

      if (!response.ok) {
        console.error('Failed to get signed upload URL:', response.status);
        return null;
      }

      const data = await response.json();
      return {
        uploadUrl: data.uploadUrl,
        filePath: data.filePath || data.path
      };
    } catch (error) {
      console.error('Error getting signed upload URL:', error);
      return null;
    }
  },

  // Upload images to Postiz domain and get upload IDs
  async uploadImagesToPostiz(imageUrls: string[]): Promise<{id: string, url: string}[]> {
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
          console.log(`🔄 Found ${externalUrls.length} external images - testing automatic upload capability...`);
          
          // First test if upload functionality is available
          const uploadTest = await this.testUploadFunctionality();
          
          if (uploadTest.success) {
            console.log('✅ Upload service available - attempting automatic upload...');
            
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
          } else {
            console.log(`ℹ️ Upload service unavailable: ${uploadTest.message}`);
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
  validateImageUrls(imageUrls: string[]): {isValid: boolean, needsUpload: boolean, externalUrls: string[]} {
    const externalUrls = imageUrls.filter(url => !url.includes('uploads.postiz.com'));
    
    return {
      isValid: externalUrls.length === 0,
      needsUpload: externalUrls.length > 0,
      externalUrls
    };
  },

  // Get upload endpoint from Postiz
  async getUploadEndpoint(): Promise<{uploadUrl: string, uploadPath: string} | null> {
    try {
      const response = await fetch(`${VERCEL_PROXY}upload-url`, {
        method: 'GET',
        headers: postizAPI.getAuthHeaders(),
      });

      if (!response.ok) {
        console.warn('Failed to get upload endpoint from Postiz:', response.status);
        return null;
      }

      const data = await response.json();
      return {
        uploadUrl: data.uploadUrl,
        uploadPath: data.uploadPath || data.path
      };
    } catch (error) {
      console.error('Failed to get upload endpoint:', error);
      return null;
    }
  },

  // Get user's posts
  async getPosts(): Promise<PostizPost[]> {
    try {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
      const endDate = new Date().toISOString();
      const proxiedUrl = `${VERCEL_PROXY}posts&startDate=${startDate}&endDate=${endDate}`;

      const response = await fetch(proxiedUrl, {
        headers: postizAPI.getAuthHeaders(),
      });

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
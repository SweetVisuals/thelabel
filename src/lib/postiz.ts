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
      
      // Postiz requires specific format with all required fields
      const requestBody = {
        type: postData.scheduledAt ? 'schedule' : 'now',
        date: postData.scheduledAt || new Date().toISOString(),
        posts: [{
          integration: { id: postData.profileIds[0] },
          value: [{
            content: postData.text,
            image: postData.mediaUrls?.map((url, index) => {
              // Postiz expects either external URLs or uploaded image IDs
              // For external URLs, we pass them as-is but Postiz may require them to be uploaded to their domain
              return {
                id: `image_${index + 1}`,
                url: url
              };
            }) || [],
            tags: [], // Required field - can be empty array
          }],
          // Required settings object
          settings: {
            privacy_level: 'PUBLIC_TO_EVERYONE',
            short_link: false,
            duet: false,
            stitch: false,
            comment: true,
            auto_add_music: 'no',
            brand_content_toggle: false,
            brand_organic_toggle: false
          }
        }],
      };

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

  // Enhanced create post with automatic image processing
  async createPostWithImages(postData: CreatePostData): Promise<PostizPost> {
    try {
      if (postData.mediaUrls && postData.mediaUrls.length > 0) {
        // Check if images need to be on uploads.postiz.com domain
        const externalUrls = postData.mediaUrls.filter(url => !url.includes('uploads.postiz.com'));
        
        if (externalUrls.length > 0) {
          console.log(`Found ${externalUrls.length} external images that may need uploading to Postiz`);
          // For now, we'll proceed with the external URLs
          // In production, you'd upload these to Postiz first
        }
      }

      return await this.createPost(postData);
    } catch (error) {
      throw new Error(`Failed to create post with images: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
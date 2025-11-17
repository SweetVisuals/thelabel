// IM.GE API Key (primary service)
const IMGE_API_KEY = 'imge_5Vvy_4378238aa286a4d62a6d663f395e5c680798e12d2c48ebb25d3da539cfc8b4992c6a7eac72327980c8b7c01fa9f0535f386e1d299de575fdd81230ef710801ea';
const IMGE_UPLOAD_URL = 'https://im.ge/api/1/upload';

// ImgBB API Keys with automatic fallback (final fallback)
const IMGBB_API_KEYS = [
  '424cc4e82ae2d9d31f09dc79f1fe8276', // Primary key
  '52473df17c0bb10090ca74a0d50ad884', // Backup key
  'f87254710198f566746ed01f0115dbce', // Third key for enhanced resilience
  '0d3ed300109c2db7fba6d3192190cbb3', // Fourth key for maximum resilience
  'd4983a1269fd78812a0405c475e065fe' // Fifth key for maximum resilience
];

// Rate limiting tracking per API key
let rateLimitTracker = {
  currentKeyIndex: 0,
  keyUsageStats: IMGBB_API_KEYS.map(() => ({
    lastRequestTime: 0,
    requestCount: 0,
    lastResetTime: Date.now()
  }))
};

const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 20, // Max requests per time window
  timeWindow: 60000, // 1 minute in milliseconds
  minDelayBetweenRequests: 3000 // 3 second minimum delay
};

export interface ImgbbUploadResponse {
  data: {
    id: string;
    title: string;
    url_viewer: string;
    url: string;
    display_url: string;
    width: number;
    height: number;
    size: number;
    time: string;
    expiration: string;
    image: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    thumb: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    delete_url: string;
  };
  success: boolean;
  status: number;
}

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const checkRateLimit = () => {
  const now = Date.now();
  const currentKeyStats = rateLimitTracker.keyUsageStats[rateLimitTracker.currentKeyIndex];
  
  // Reset counter if time window has passed
  if (now - currentKeyStats.lastResetTime > RATE_LIMIT.timeWindow) {
    currentKeyStats.requestCount = 0;
    currentKeyStats.lastResetTime = now;
  }
  
  // Check if we're within rate limits
  if (currentKeyStats.requestCount >= RATE_LIMIT.maxRequests) {
    const waitTime = RATE_LIMIT.timeWindow - (now - currentKeyStats.lastResetTime);
    throw new Error(`🚦 Rate Limited: Too many requests. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
  }
  
  // Check minimum delay between requests
  const timeSinceLastRequest = now - currentKeyStats.lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT.minDelayBetweenRequests) {
    const waitTime = RATE_LIMIT.minDelayBetweenRequests - timeSinceLastRequest;
    return delay(waitTime);
  }
  
  // Update tracker
  currentKeyStats.requestCount++;
  currentKeyStats.lastRequestTime = now;
};

const switchToNextApiKey = (): number => {
  const currentIndex = rateLimitTracker.currentKeyIndex;
  const nextIndex = (currentIndex + 1) % IMGBB_API_KEYS.length;
  
  // Only switch if we have multiple keys and haven't tried all of them recently
  if (IMGBB_API_KEYS.length > 1 && nextIndex !== currentIndex) {
    rateLimitTracker.currentKeyIndex = nextIndex;
    console.log(`🔄 Switching to backup API key ${nextIndex + 1}/${IMGBB_API_KEYS.length}`);
    return nextIndex;
  }
  
  return currentIndex;
};

const getCurrentApiKey = (): string => {
  return IMGBB_API_KEYS[rateLimitTracker.currentKeyIndex];
};

const isRateLimitError = (status: number, errorText: string): boolean => {
  const errorLower = errorText.toLowerCase();
  const rateLimitKeywords = [
    'rate limit', 'rate limit exceeded', 'too many requests', 'quota exceeded',
    'api limit', 'request limit', 'too many', 'limit reached', 'exceeded quota'
  ];
  
  return status === 429 || rateLimitKeywords.some(keyword => errorLower.includes(keyword));
};

const uploadToImgbbWithRetry = async (file: File, maxRetries = 3): Promise<ImgbbUploadResponse> => {
  // Try ImgBB with retries
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check rate limiting before each attempt
      await checkRateLimit();
      
      // Validate file before upload
      if (file.size === 0) {
        throw new Error('File is empty');
      }

      if (file.size > 25 * 1024 * 1024) { // 25MB limit
        throw new Error('File too large (max 25MB)');
      }

      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        console.warn(`Unexpected MIME type: ${file.type}, attempting upload anyway`);
      }

      console.log(`📤 Uploading to ImgBB (attempt ${attempt}/${maxRetries}): ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB, ${file.type})`);

      const formData = new FormData();
      formData.append('key', getCurrentApiKey());
      formData.append('image', file);
      formData.append('name', file.name);

      const response = await fetch(IMGBB_UPLOAD_URL, {
        method: 'POST',
        body: formData,
      });

      console.log(`📊 ImgBB Response Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ ImgBB Error Response (attempt ${attempt}): ${response.status} ${response.statusText}`);
        console.error(`❌ Error Body: ${errorText}`);
        
        let errorMessage = `ImgBB upload failed: ${response.status} ${response.statusText}`;
        let isRateLimited = false;
        let shouldRetry = false;
        
        // Convert error text to lowercase for analysis
        const errorLower = errorText.toLowerCase();
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.message) {
            errorMessage = `ImgBB Error: ${errorData.error.message}`;
          } else if (errorData.error && typeof errorData.error === 'string') {
            errorMessage = `ImgBB Error: ${errorData.error}`;
          }
        } catch (parseError) {
          console.warn('Could not parse error response as JSON');
        }

        // Enhanced rate limiting detection using helper function
        isRateLimited = isRateLimitError(response.status, errorText);

        if (isRateLimited) {
          shouldRetry = attempt < maxRetries;
          
          // Try switching to backup API key if we haven't exhausted all keys
          if (attempt === 1 && IMGBB_API_KEYS.length > 1) {
            const nextKeyIndex = switchToNextApiKey();
            errorMessage = `🚦 Rate Limited: Switching to backup API key (${nextKeyIndex + 1}/${IMGBB_API_KEYS.length}). Attempt ${attempt}/${maxRetries}.`;
          } else {
            errorMessage = `🚦 Rate Limited: ImgBB API rate limit exceeded. Attempt ${attempt}/${maxRetries}.`;
          }
        }
        // Check for other retryable errors (5xx server errors)
        else if (response.status >= 500 && response.status < 600) {
          shouldRetry = attempt < maxRetries;
          errorMessage = `🔧 Server Error: ImgBB service issue (${response.status}). Attempt ${attempt}/${maxRetries}.`;
        }
        // Provide specific error messages for non-retryable issues
        else if (response.status === 400) {
          if (errorLower.includes('invalid api key') || errorLower.includes('unauthorized')) {
            errorMessage = '❌ Invalid API Key: ImgBB API key is invalid or expired. Please check your configuration.';
          } else if (errorLower.includes('image') && (errorLower.includes('corrupt') || errorLower.includes('invalid'))) {
            errorMessage = '🖼️ Invalid Image: Image file is corrupted or in an unsupported format.';
          } else if (errorLower.includes('file') && errorLower.includes('large')) {
            errorMessage = '📏 File Too Large: Image exceeds ImgBB size limits.';
          } else {
            errorMessage = `❌ Upload Rejected: ${errorText}`;
          }
        } else if (response.status === 413) {
          errorMessage = '📏 File Too Large: Image exceeds ImgBB maximum size (25MB).';
        } else if (response.status === 401) {
          errorMessage = '🔐 Authentication Failed: Invalid ImgBB API key.';
        }
        
        // Log rate limiting for analytics/monitoring
        if (isRateLimited) {
          console.warn('🚦 Rate Limited Detected:', {
            timestamp: new Date().toISOString(),
            status: response.status,
            error: errorText,
            fileName: file.name,
            fileSize: file.size,
            attempt,
            currentApiKey: rateLimitTracker.currentKeyIndex + 1,
            totalApiKeys: IMGBB_API_KEYS.length
          });
        }

        // Retry logic for rate limiting and server errors
        if (shouldRetry) {
          const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
          console.log(`⏳ Retrying in ${backoffTime}ms...`);
          await delay(backoffTime);
          continue; // Skip to next attempt
        }
        
        throw new Error(errorMessage);
      }

      const data: ImgbbUploadResponse = await response.json();
      console.log(`✅ ImgBB Upload Success:`, data);

      if (!data.success) {
        throw new Error('ImgBB upload was not successful - API returned success: false');
      }

      if (!data.data || !data.data.url) {
        throw new Error('ImgBB upload incomplete - missing image data');
      }

      return data;
      
    } catch (error) {
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        if (error instanceof Error) {
          console.error(`❌ ImgBB Upload Failed (final attempt):`, error.message);
          throw error;
        } else {
          console.error('❌ ImgBB Upload Failed (final attempt): Unknown error');
          throw new Error('ImgBB upload failed with unknown error after all retries');
        }
      }
      
      // For network errors or other issues, wait before retrying
      const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`⏳ Network error, retrying in ${backoffTime}ms... (attempt ${attempt}/${maxRetries})`);
      await delay(backoffTime);
    }
  }

  throw new Error('ImgBB upload failed');
};

export const uploadToImgbb = async (file: File): Promise<ImgbbUploadResponse> => {
  return uploadToImgbbWithRetry(file);
};

// Upload to IM.GE API via proxy (primary service)
export const uploadToImge = async (file: File): Promise<ImgbbUploadResponse> => {
  try {
    // Validate file before upload
    if (file.size === 0) {
      throw new Error('File is empty');
    }

    if (file.size > 25 * 1024 * 1024) { // 25MB limit
      throw new Error('File too large (max 25MB)');
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      console.warn(`Unexpected MIME type: ${file.type}, attempting upload anyway`);
    }

    console.log(`📤 Uploading to IM.GE via proxy: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB, ${file.type})`);

    // Create form data for IM.GE proxy
    const formData = new FormData();
    formData.append('source', file);

    // Upload to IM.GE via proxy
    const response = await fetch('/api/imge-proxy', {
      method: 'POST',
      body: formData,
    });

    console.log(`📊 IM.GE proxy response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ IM.GE proxy error: ${response.status} ${response.statusText}`);
      console.error(`❌ Error body: ${errorText}`);

      let errorMessage = `IM.GE upload failed: ${response.status} ${response.statusText}`;
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          errorMessage = `IM.GE Error: ${errorData.error}`;
        }
      } catch (parseError) {
        console.warn('Could not parse error response as JSON');
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log(`✅ IM.GE proxy upload success:`, data);

    if (!data.success || !data.data || !data.data.url) {
      throw new Error('IM.GE upload incomplete - missing image data');
    }

    return data;

  } catch (error) {
    console.error('❌ IM.GE upload failed:', error);
    throw error;
  }
};

// Upload to FreeImage.host via proxy
export const uploadToFreeImage = async (file: File): Promise<ImgbbUploadResponse> => {
  try {
    // Validate file before upload
    if (file.size === 0) {
      throw new Error('File is empty');
    }

    if (file.size > 25 * 1024 * 1024) { // 25MB limit
      throw new Error('File too large (max 25MB)');
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      console.warn(`Unexpected MIME type: ${file.type}, attempting upload anyway`);
    }

    console.log(`📤 Uploading to FreeImage.host: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB, ${file.type})`);

    // Create form data for FreeImage.host proxy
    const formData = new FormData();
    formData.append('source', file);

    // Upload to FreeImage.host via proxy
    const response = await fetch('/api/freeimage-proxy', {
      method: 'POST',
      body: formData,
    });

    console.log(`📊 FreeImage.host proxy response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ FreeImage.host proxy error: ${response.status} ${response.statusText}`);
      console.error(`❌ Error body: ${errorText}`);

      let errorMessage = `FreeImage.host upload failed: ${response.status} ${response.statusText}`;
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          errorMessage = `FreeImage Error: ${errorData.error}`;
        }
      } catch (parseError) {
        console.warn('Could not parse error response as JSON');
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log(`✅ FreeImage.host upload success:`, data);

    if (!data.success || !data.data || !data.data.url) {
      throw new Error('FreeImage.host upload incomplete - missing image data');
    }

    return data;

  } catch (error) {
    console.error('❌ FreeImage upload failed:', error);
    throw error;
  }
};

// Upload with multi-level fallback: FreeImage -> ImgBB (skip IM.GE due to CORS issues)
export const uploadWithFallback = async (file: File): Promise<ImgbbUploadResponse> => {
  // Try FreeImage first (primary service)
  try {
    console.log('🆓 Trying FreeImage upload first...');
    const freeImageResponse = await uploadToFreeImage(file);
    console.log('✅ FreeImage upload successful');
    return freeImageResponse;
  } catch (freeImageError) {
    console.warn('⚠️ FreeImage upload failed, falling back to ImgBB:', freeImageError);

    // Final fallback to ImgBB
    return await uploadToImgbb(file);
  }
};

// Export rate limit info for monitoring
export const getRateLimitStatus = () => {
  const now = Date.now();
  const currentKeyStats = rateLimitTracker.keyUsageStats[rateLimitTracker.currentKeyIndex];
  const timeUntilReset = Math.max(0, RATE_LIMIT.timeWindow - (now - currentKeyStats.lastResetTime));
  
  return {
    currentRequests: currentKeyStats.requestCount,
    maxRequests: RATE_LIMIT.maxRequests,
    timeUntilReset: Math.ceil(timeUntilReset / 1000),
    canMakeRequest: currentKeyStats.requestCount < RATE_LIMIT.maxRequests,
    currentApiKey: rateLimitTracker.currentKeyIndex + 1,
    totalApiKeys: IMGBB_API_KEYS.length,
    allKeyStats: rateLimitTracker.keyUsageStats.map((stats, index) => ({
      keyIndex: index + 1,
      requestCount: stats.requestCount,
      timeUntilReset: Math.max(0, RATE_LIMIT.timeWindow - (now - stats.lastResetTime))
    }))
  };
};

// Export function to manually switch API key
export const switchApiKey = (keyIndex?: number) => {
  if (keyIndex !== undefined && keyIndex >= 0 && keyIndex < IMGBB_API_KEYS.length) {
    rateLimitTracker.currentKeyIndex = keyIndex;
    console.log(`🔄 Manually switched to API key ${keyIndex + 1}/${IMGBB_API_KEYS.length}`);
  } else {
    switchToNextApiKey();
  }
};

// Test individual API keys by attempting a minimal upload
export const testApiKey = async (keyIndex: number = 0): Promise<{ success: boolean; message: string; details?: any; error?: any }> => {
  if (keyIndex < 0 || keyIndex >= IMGBB_API_KEYS.length) {
    return { success: false, message: `Invalid key index: ${keyIndex}` };
  }

  const apiKey = IMGBB_API_KEYS[keyIndex];
  
  // Create a minimal 1x1 pixel PNG test image
  const testImageData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const testImageBlob = new Blob([Uint8Array.from(atob(testImageData), c => c.charCodeAt(0))], { type: 'image/png' });
  const testImageFile = new File([testImageBlob], 'test.png', { type: 'image/png' });

  try {
    console.log(`🔍 Testing API key ${keyIndex + 1}/${IMGBB_API_KEYS.length}: ${apiKey.substring(0, 8)}...`);

    const formData = new FormData();
    formData.append('key', apiKey);
    formData.append('image', testImageFile);
    formData.append('name', 'api_test');

    const response = await fetch(IMGBB_UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });

    console.log(`📊 API Test Response: ${response.status} ${response.statusText}`);

    const responseText = await response.text();
    console.log(`📊 API Test Response Body:`, responseText);

    if (response.ok) {
      try {
        const jsonResponse = JSON.parse(responseText);
        if (jsonResponse.success) {
          return {
            success: true,
            message: `API key ${keyIndex + 1} is valid and working`,
            details: `Uploaded test image: ${jsonResponse.data?.url || 'URL not available'}`
          };
        } else {
          return {
            success: false,
            message: `API key ${keyIndex + 1} returned success:false`,
            details: responseText
          };
        }
      } catch (parseError) {
        return {
          success: false,
          message: `API key ${keyIndex + 1} returned invalid JSON`,
          details: responseText
        };
      }
    } else {
      return {
        success: false,
        message: `API key ${keyIndex + 1} failed: ${response.status} ${response.statusText}`,
        details: responseText
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `API key ${keyIndex + 1} test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error
    };
  }
};

// Test all API keys and return results
export const testAllApiKeys = async (): Promise<{ keyIndex: number; success: boolean; message: string }[]> => {
  console.log('🧪 Testing all ImgBB API keys...');
  
  const results = await Promise.all(
    IMGBB_API_KEYS.map((_, index) => testApiKey(index))
  );

  const formattedResults = results.map((result, index) => ({
    keyIndex: index + 1,
    success: result.success,
    message: result.message
  }));

  console.log('🧪 API Key Test Results:', formattedResults);
  
  return formattedResults;
};

// Add a new API key dynamically
export const addApiKey = (apiKey: string, setAsActive: boolean = false): void => {
  if (!apiKey || apiKey.length < 10) {
    throw new Error('Invalid API key format');
  }

  // Check if key already exists
  if (IMGBB_API_KEYS.includes(apiKey)) {
    console.log(`⚠️ API key already exists: ${apiKey.substring(0, 8)}...`);
    return;
  }

  // Add to the array (though this won't persist across restarts since it's const)
  // In a real app, this should be stored in a database or config
  console.log(`➕ Adding new API key: ${apiKey.substring(0, 8)}...`);
  console.log('⚠️ Note: API keys are hardcoded and need to be updated in the source code to persist');
  
  if (setAsActive) {
    rateLimitTracker.currentKeyIndex = IMGBB_API_KEYS.length;
  }
};

// Enhanced error logging for debugging
export const logDetailedError = (error: any, context: string) => {
  console.error(`❌ ${context}:`, {
    error: error,
    errorMessage: error?.message,
    errorStack: error?.stack,
    timestamp: new Date().toISOString(),
    currentApiKey: rateLimitTracker.currentKeyIndex + 1,
    totalApiKeys: IMGBB_API_KEYS.length,
    rateLimitStatus: getRateLimitStatus()
  });
};

export const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      reject(new Error('Failed to get image dimensions'));
    };
    img.src = URL.createObjectURL(file);
  });
};

export const deleteFromImgbb = async (deleteUrl: string): Promise<void> => {
  const response = await fetch(deleteUrl, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Imgbb delete failed: ${response.statusText}`);
  }
};
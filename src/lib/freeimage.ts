// FreeImage.host API integration
const FREEIMAGE_UPLOAD_PROXY = '/api/freeimage-upload';

export interface FreeImageUploadResponse {
  status_code: number;
  success: {
    message: string;
    code: number;
  };
  image: {
    name: string;
    extension: string;
    width: number;
    height: number;
    size: number;
    filesize: number;
    mime: string;
    path: string;
    url: string;
    id: string;
    delete_url: string;
    page: string;
  };
  status_txt: string;
}

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 50, // 50 requests per minute
  timeWindow: 60000, // 1 minute
  minDelayBetweenRequests: 1000 // 200ms minimum delay between requests
};

let rateLimitTracker = {
  requestCount: 0,
  lastResetTime: Date.now(),
  lastRequestTime: 0
};

const checkRateLimit = () => {
  const now = Date.now();

  // Reset counter if time window has passed
  if (now - rateLimitTracker.lastResetTime > RATE_LIMIT.timeWindow) {
    rateLimitTracker.requestCount = 0;
    rateLimitTracker.lastResetTime = now;
  }

  // Check if we're within rate limits
  if (rateLimitTracker.requestCount >= RATE_LIMIT.maxRequests) {
    const waitTime = RATE_LIMIT.timeWindow - (now - rateLimitTracker.lastResetTime);
    throw new Error(`🚦 Rate Limited: Too many requests. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
  }

  // Check minimum delay between requests
  const timeSinceLastRequest = now - rateLimitTracker.lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT.minDelayBetweenRequests) {
    const waitTime = RATE_LIMIT.minDelayBetweenRequests - timeSinceLastRequest;
    return delay(waitTime);
  }

  // Update tracker
  rateLimitTracker.requestCount++;
  rateLimitTracker.lastRequestTime = now;
};

const isRateLimitError = (status: number, errorText: string): boolean => {
  const errorLower = errorText.toLowerCase();
  const rateLimitKeywords = [
    'rate limit', 'rate limit exceeded', 'too many requests', 'quota exceeded',
    'api limit', 'request limit', 'too many', 'limit reached', 'exceeded quota'
  ];

  return status === 429 || rateLimitKeywords.some(keyword => errorLower.includes(keyword));
};

const uploadToFreeImageWithRetry = async (file: File, maxRetries = 3): Promise<FreeImageUploadResponse> => {
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

      console.log(`📤 Uploading to FreeImage.host via proxy (attempt ${attempt}/${maxRetries}): ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB, ${file.type})`);

      const formData = new FormData();
      formData.append('source', file);

      const response = await fetch(FREEIMAGE_UPLOAD_PROXY, {
        method: 'POST',
        body: formData,
      });

      console.log(`📊 FreeImage.host Response Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          const errorText = await response.text();
          console.error(`❌ FreeImage proxy Error Response (attempt ${attempt}): ${response.status} ${response.statusText}`);
          console.error(`❌ Error Body: ${errorText}`);
          throw new Error(`FreeImage upload failed: ${response.status} ${response.statusText}`);
        }

        console.error(`❌ FreeImage proxy Error Response (attempt ${attempt}): ${response.status} ${response.statusText}`);
        console.error(`❌ Error Details:`, errorData);

        let errorMessage = errorData.error || `FreeImage upload failed: ${response.status} ${response.statusText}`;
        let shouldRetry = false;

        // Check for rate limiting
        if (response.status === 429 || errorMessage.toLowerCase().includes('rate limit')) {
          shouldRetry = attempt < maxRetries;
          errorMessage = `🚦 Rate Limited: FreeImage API rate limit exceeded. Attempt ${attempt}/${maxRetries}.`;
        }
        // Check for other retryable errors (5xx server errors)
        else if (response.status >= 500 && response.status < 600) {
          shouldRetry = attempt < maxRetries;
          errorMessage = `🔧 Server Error: FreeImage service issue (${response.status}). Attempt ${attempt}/${maxRetries}.`;
        }
        // Provide specific error messages for non-retryable issues
        else if (response.status === 400) {
          if (errorMessage.toLowerCase().includes('file too large')) {
            errorMessage = '📏 File Too Large: Image exceeds FreeImage maximum size (25MB).';
          } else if (errorMessage.toLowerCase().includes('unsupported file type')) {
            errorMessage = '🖼️ Invalid Image: Image file is in an unsupported format.';
          } else {
            errorMessage = `❌ Upload Rejected: ${errorMessage}`;
          }
        }

        // Log rate limiting for analytics/monitoring
        if (response.status === 429) {
          console.warn('🚦 Rate Limited Detected:', {
            timestamp: new Date().toISOString(),
            status: response.status,
            error: errorData,
            fileName: file.name,
            fileSize: file.size,
            attempt,
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

      const data: FreeImageUploadResponse = await response.json();
      console.log(`✅ FreeImage.host Upload Success:`, data);

      if (data.status_code !== 200 || !data.success) {
        throw new Error('FreeImage.host upload was not successful - API returned error status');
      }

      if (!data.image || !data.image.url) {
        throw new Error('FreeImage.host upload incomplete - missing image data');
      }

      return data;

    } catch (error) {
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        if (error instanceof Error) {
          console.error(`❌ FreeImage.host Upload Failed (final attempt):`, error.message);
          throw error;
        } else {
          console.error('❌ FreeImage.host Upload Failed (final attempt): Unknown error');
          throw new Error('FreeImage.host upload failed with unknown error after all retries');
        }
      }

      // For network errors or other issues, wait before retrying
      const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`⏳ Network error, retrying in ${backoffTime}ms... (attempt ${attempt}/${maxRetries})`);
      await delay(backoffTime);
    }
  }

  throw new Error('Max retries exceeded');
};

export const uploadToFreeImage = async (file: File): Promise<FreeImageUploadResponse> => {
  return uploadToFreeImageWithRetry(file);
};

// Export rate limit info for monitoring
export const getRateLimitStatus = () => {
  const now = Date.now();
  const timeUntilReset = Math.max(0, RATE_LIMIT.timeWindow - (now - rateLimitTracker.lastResetTime));

  return {
    currentRequests: rateLimitTracker.requestCount,
    maxRequests: RATE_LIMIT.maxRequests,
    timeUntilReset: Math.ceil(timeUntilReset / 1000),
    canMakeRequest: rateLimitTracker.requestCount < RATE_LIMIT.maxRequests,
  };
};

// Enhanced error logging for debugging
export const logDetailedError = (error: any, context: string) => {
  console.error(`❌ ${context}:`, {
    error: error,
    errorMessage: error?.message,
    errorStack: error?.stack,
    timestamp: new Date().toISOString(),
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
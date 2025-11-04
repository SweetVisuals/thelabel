import { ASPECT_RATIO_PRESETS, AspectRatioPreset } from '../types';

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CroppedImageResult {
  blob: Blob;
  width: number;
  height: number;
  aspectRatio: number;
}

/**
 * Parse aspect ratio string to numeric value
 */
export const parseAspectRatio = (ratio: string): number => {
  if (ratio === 'free') return 0; // Special case for free-form
  
  const [width, height] = ratio.split(':').map(Number);
  return width / height;
};

/**
 * Convert numeric aspect ratio to string format
 */
export const aspectRatioToString = (ratio: number): string => {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const roundedRatio = Math.round(ratio * 1000) / 1000; // Round to 3 decimal places
  const width = Math.round(roundedRatio * 1000);
  const height = 1000;
  const divisor = gcd(width, height);
  
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
};

/**
 * Get preset by ratio string
 */
export const getPresetByRatio = (ratio: string): AspectRatioPreset | undefined => {
  return ASPECT_RATIO_PRESETS.find(preset => preset.ratio === ratio);
};

/**
 * Calculate crop area for maintaining aspect ratio with smart positioning
 */
export const calculateCropArea = (
  imageWidth: number,
  imageHeight: number,
  targetAspectRatio: number,
  imageElement?: HTMLImageElement
): CropArea => {
  const currentAspectRatio = imageWidth / imageHeight;
  
  let x = 0;
  let y = 0;
  let newWidth: number;
  let newHeight: number;
  
  if (currentAspectRatio > targetAspectRatio) {
    // Image is wider than target, crop width
    newWidth = Math.round(imageHeight * targetAspectRatio);
    newHeight = imageHeight;
    
    // Smart positioning - try to find the most content-rich area
    if (imageElement && imageElement.naturalWidth > 0) {
      x = smartCropX(imageElement, newWidth, targetAspectRatio);
    } else {
      // Default: center, but slightly bias towards center-left for portrait content
      x = Math.round((imageWidth - newWidth) * 0.4);
      x = Math.max(0, Math.min(x, imageWidth - newWidth));
    }
  } else {
    // Image is taller than target, crop height
    newWidth = imageWidth;
    newHeight = Math.round(imageWidth / targetAspectRatio);
    
    // Smart positioning - try to find the most content-rich area
    if (imageElement && imageElement.naturalHeight > 0) {
      y = smartCropY(imageElement, newHeight, targetAspectRatio);
    } else {
      // Default: center, but slightly bias towards top for better content
      y = Math.round((imageHeight - newHeight) * 0.3);
      y = Math.max(0, Math.min(y, imageHeight - newHeight));
    }
  }
  
  return {
    x,
    y,
    width: newWidth,
    height: newHeight
  };
};

/**
 * Smart X-axis cropping - finds the most content-rich area
 */
const smartCropX = (imageElement: HTMLImageElement, targetWidth: number, aspectRatio: number): number => {
  const imageWidth = imageElement.naturalWidth;
  const imageHeight = imageElement.naturalHeight;
  const maxX = imageWidth - targetWidth;
  
  if (maxX <= 0) return 0;
  
  try {
    // Create a smaller canvas to analyze content distribution
    const analysisWidth = 100;
    const analysisHeight = Math.round(analysisWidth / (imageWidth / imageHeight));
    
    const canvas = document.createElement('canvas');
    canvas.width = analysisWidth;
    canvas.height = analysisHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return Math.round(maxX / 2);
    
    ctx.drawImage(imageElement, 0, 0, analysisWidth, analysisHeight);
    const imageData = ctx.getImageData(0, 0, analysisWidth, analysisHeight);
    
    // Analyze content distribution in columns
    const columnScores: number[] = [];
    const step = Math.max(1, Math.floor(maxX / analysisWidth));
    
    for (let i = 0; i <= maxX; i += step) {
      const cropX = i;
      const sampleWidth = Math.min(targetWidth, maxX - cropX);
      const score = analyzeContentInRegion(
        imageData,
        cropX,
        0,
        sampleWidth,
        imageHeight,
        analysisWidth,
        analysisHeight
      );
      columnScores.push(score);
    }
    
    // Find the position with highest content score
    let bestX = 0;
    let bestScore = -1;
    
    for (let i = 0; i < columnScores.length; i++) {
      if (columnScores[i] > bestScore) {
        bestScore = columnScores[i];
        bestX = i * step;
      }
    }
    
    return Math.round(Math.min(bestX, maxX));
    
  } catch (error) {
    // Fallback to center-left bias
    return Math.round(maxX * 0.4);
  }
};

/**
 * Smart Y-axis cropping - finds the most content-rich area
 */
const smartCropY = (imageElement: HTMLImageElement, targetHeight: number, aspectRatio: number): number => {
  const imageWidth = imageElement.naturalWidth;
  const imageHeight = imageElement.naturalHeight;
  const maxY = imageHeight - targetHeight;
  
  if (maxY <= 0) return 0;
  
  try {
    // Create a smaller canvas to analyze content distribution
    const analysisHeight = 100;
    const analysisWidth = Math.round(analysisHeight * (imageWidth / imageHeight));
    
    const canvas = document.createElement('canvas');
    canvas.width = analysisWidth;
    canvas.height = analysisHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return Math.round(maxY / 2);
    
    ctx.drawImage(imageElement, 0, 0, analysisWidth, analysisHeight);
    const imageData = ctx.getImageData(0, 0, analysisWidth, analysisHeight);
    
    // Analyze content distribution in rows
    const rowScores: number[] = [];
    const step = Math.max(1, Math.floor(maxY / analysisHeight));
    
    for (let i = 0; i <= maxY; i += step) {
      const cropY = i;
      const sampleHeight = Math.min(targetHeight, maxY - cropY);
      const score = analyzeContentInRegion(
        imageData,
        0,
        cropY,
        imageWidth,
        sampleHeight,
        analysisWidth,
        analysisHeight
      );
      rowScores.push(score);
    }
    
    // Find the position with highest content score
    let bestY = 0;
    let bestScore = -1;
    
    for (let i = 0; i < rowScores.length; i++) {
      if (rowScores[i] > bestScore) {
        bestScore = rowScores[i];
        bestY = i * step;
      }
    }
    
    return Math.round(Math.min(bestY, maxY));
    
  } catch (error) {
    // Fallback to top bias
    return Math.round(maxY * 0.3);
  }
};

/**
 * Analyze content density in a specific region of the image
 */
const analyzeContentInRegion = (
  imageData: ImageData,
  x: number,
  y: number,
  width: number,
  height: number,
  analysisWidth: number,
  analysisHeight: number
): number => {
  const scaleX = analysisWidth / width;
  const scaleY = analysisHeight / height;
  
  let totalVariance = 0;
  let pixelCount = 0;
  
  for (let i = Math.max(0, Math.floor(y * scaleY));
       i < Math.min(analysisHeight, Math.floor((y + height) * scaleY));
       i++) {
    for (let j = Math.max(0, Math.floor(x * scaleX));
         j < Math.min(analysisWidth, Math.floor((x + width) * scaleX));
         j++) {
      const index = (i * analysisWidth + j) * 4;
      const r = imageData.data[index];
      const g = imageData.data[index + 1];
      const b = imageData.data[index + 2];
      
      // Calculate luminance and color variance
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      const colorVariance = Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
      
      // Higher score for areas with more color variance and interesting contrast
      totalVariance += colorVariance + Math.abs(luminance - 128) * 0.1;
      pixelCount++;
    }
  }
  
  return pixelCount > 0 ? totalVariance / pixelCount : 0;
};

/**
 * Crop image with specified aspect ratio using smart positioning
 */
export const cropImage = async (
  imageFile: File,
  targetAspectRatio: number,
  quality: number = 0.9
): Promise<CroppedImageResult> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        console.log('🖼️ Cropping image with smart positioning...', {
          original: `${img.width}x${img.height}`,
          targetAspect: targetAspectRatio,
          fileSize: imageFile.size
        });
        
        // Calculate smart crop area
        const cropArea = calculateCropArea(img.width, img.height, targetAspectRatio, img);
        
        console.log('✂️ Calculated crop area:', cropArea);
        
        // Create canvas for high-quality cropping
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        
        // Set canvas dimensions to crop area
        canvas.width = cropArea.width;
        canvas.height = cropArea.height;
        
        // Enable high-quality image rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw the cropped image with enhanced quality
        ctx.drawImage(
          img,
          cropArea.x, cropArea.y, cropArea.width, cropArea.height,
          0, 0, cropArea.width, cropArea.height
        );
        
        // Convert to blob with optimized format
        const format = imageFile.type.includes('png') ? 'image/png' : 'image/jpeg';
        const finalQuality = format === 'image/jpeg' ? quality : undefined;
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log('✅ Image cropped successfully', {
                cropSize: `${cropArea.width}x${cropArea.height}`,
                originalSize: `${img.width}x${img.height}`,
                fileSize: blob.size,
                compressionRatio: (blob.size / imageFile.size).toFixed(3)
              });
              
              resolve({
                blob,
                width: cropArea.width,
                height: cropArea.height,
                aspectRatio: targetAspectRatio
              });
            } else {
              reject(new Error('Failed to create blob from canvas'));
            }
          },
          format,
          finalQuality
        );
      } catch (error) {
        console.error('❌ Cropping failed:', error);
        reject(new Error(`Failed to crop image: ${error instanceof Error ? error.message : 'Unknown error'}`));
      } finally {
        // Clean up object URL
        URL.revokeObjectURL(img.src);
      }
    };
    
    img.onerror = () => {
      console.error('❌ Failed to load image for cropping');
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image for cropping'));
    };
    
    // Load image with crossOrigin for CORS compatibility
    img.crossOrigin = 'anonymous';
    img.src = URL.createObjectURL(imageFile);
  });
};

/**
 * Batch crop multiple images with same aspect ratio
 */
export const batchCropImages = async (
  imageFiles: File[],
  targetAspectRatio: number,
  quality: number = 0.9
): Promise<CroppedImageResult[]> => {
  const results = await Promise.all(
    imageFiles.map(file => cropImage(file, targetAspectRatio, quality))
  );
  return results;
};

/**
 * Resize image to specific dimensions while maintaining aspect ratio
 */
export const resizeImage = (
  imageFile: File,
  targetWidth: number,
  targetHeight: number,
  quality: number = 0.9
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      // Use high-quality image rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        quality
      );
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(imageFile);
  });
};

/**
 * Get optimal dimensions for display based on container size and aspect ratio
 */
export const getOptimalDimensions = (
  containerWidth: number,
  containerHeight: number,
  aspectRatio: number
): { width: number; height: number } => {
  const containerAspectRatio = containerWidth / containerHeight;
  
  if (aspectRatio > containerAspectRatio) {
    // Aspect ratio is wider than container, fit to width
    return {
      width: containerWidth,
      height: Math.round(containerWidth / aspectRatio)
    };
  } else {
    // Aspect ratio is taller than container, fit to height
    return {
      width: Math.round(containerHeight * aspectRatio),
      height: containerHeight
    };
  }
};
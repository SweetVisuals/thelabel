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
 * Calculate crop area for maintaining aspect ratio
 */
export const calculateCropArea = (
  imageWidth: number,
  imageHeight: number,
  targetAspectRatio: number
): CropArea => {
  const currentAspectRatio = imageWidth / imageHeight;
  
  if (currentAspectRatio > targetAspectRatio) {
    // Image is wider than target, crop width
    const newWidth = Math.round(imageHeight * targetAspectRatio);
    const x = Math.round((imageWidth - newWidth) / 2);
    return {
      x,
      y: 0,
      width: newWidth,
      height: imageHeight
    };
  } else {
    // Image is taller than target, crop height
    const newHeight = Math.round(imageWidth / targetAspectRatio);
    const y = Math.round((imageHeight - newHeight) / 2);
    return {
      x: 0,
      y,
      width: imageWidth,
      height: newHeight
    };
  }
};

/**
 * Crop image with specified aspect ratio
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
        const cropArea = calculateCropArea(img.width, img.height, targetAspectRatio);
        
        // Create canvas for cropping
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        
        canvas.width = cropArea.width;
        canvas.height = cropArea.height;
        
        // Draw the cropped image
        ctx.drawImage(
          img,
          cropArea.x, cropArea.y, cropArea.width, cropArea.height,
          0, 0, cropArea.width, cropArea.height
        );
        
        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({
                blob,
                width: cropArea.width,
                height: cropArea.height,
                aspectRatio: targetAspectRatio
              });
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          'image/jpeg',
          quality
        );
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
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
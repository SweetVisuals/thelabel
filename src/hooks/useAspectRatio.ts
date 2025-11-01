import { useState, useCallback } from 'react';
import { imageService } from '@/lib/imageService';
import { UploadedImage } from '@/types';

interface UseAspectRatioProps {
  selectedImages: UploadedImage[];
  onImagesUpdate: (images: UploadedImage[]) => void;
}

export const useAspectRatio = ({ selectedImages, onImagesUpdate }: UseAspectRatioProps) => {
  const [isCropping, setIsCropping] = useState(false);
  const [croppingProgress, setCroppingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const changeAspectRatio = useCallback(async (aspectRatio: string) => {
    if (selectedImages.length === 0) return;

    setIsCropping(true);
    setError(null);
    setCroppingProgress(0);

    try {
      const imageIds = selectedImages.map(img => img.id);
      
      // Show progress
      const updateProgress = (progress: number) => {
        setCroppingProgress(progress);
      };

      updateProgress(25);

      // Use the existing changeAspectRatio method from imageService
      const croppedImages = await imageService.changeAspectRatio(imageIds, aspectRatio);
      
      updateProgress(75);

      // Update the selected images with the new cropped versions
      const updatedImages = selectedImages.map(originalImage => {
        const croppedVersion = croppedImages.find(cropped => cropped.id === originalImage.id);
        const finalImage = croppedVersion || originalImage;
        return finalImage;
      });

      onImagesUpdate(updatedImages);
      
      updateProgress(100);
      
      setTimeout(() => {
        setCroppingProgress(0);
      }, 1000);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to change aspect ratio';
      setError(errorMessage);
      console.error('❌ Aspect ratio change failed:', err);
    } finally {
      setIsCropping(false);
    }
  }, [selectedImages, onImagesUpdate]);

  const resetToOriginal = useCallback(async () => {
    // This would reset all images to their original aspect ratios
    // For now, we just clear any cropping by using 'free' aspect ratio
    if (selectedImages.length === 0) return;
    
    setIsCropping(true);
    setError(null);
    
    try {
      const imageIds = selectedImages.map(img => img.id);
      const originalImages = await imageService.changeAspectRatio(imageIds, 'free');
      
      const updatedImages = selectedImages.map(originalImage => {
        const resetVersion = originalImages.find(reset => reset.id === originalImage.id);
        return resetVersion || originalImage;
      });

      onImagesUpdate(updatedImages);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset aspect ratios';
      setError(errorMessage);
      console.error('Reset aspect ratios failed:', err);
    } finally {
      setIsCropping(false);
    }
  }, [selectedImages, onImagesUpdate]);

  return {
    changeAspectRatio,
    resetToOriginal,
    isCropping,
    croppingProgress,
    error,
    clearError: () => setError(null)
  };
};
"use client";

import React, { useState } from "react";
import { X, Plus, Upload, AlertCircle, Check, Link, Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { imageService } from "@/lib/imageService";
import { UploadedImage } from "@/types";

interface UrlUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onImagesUploaded: (images: UploadedImage[]) => void;
  currentFolderId?: string | null;
}

interface UrlInput {
  id: string;
  url: string;
  filename: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  progress?: number;
}

export const UrlUploader: React.FC<UrlUploaderProps> = ({
  isOpen,
  onClose,
  onImagesUploaded,
  currentFolderId
}) => {
  const [urlInputs, setUrlInputs] = useState<UrlInput[]>([
    { id: '1', url: '', filename: '', status: 'pending' }
  ]);
  const [isUploading, setIsUploading] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState('');

  const addUrlInput = () => {
    const newId = (urlInputs.length + 1).toString();
    setUrlInputs([...urlInputs, { id: newId, url: '', filename: '', status: 'pending' }]);
  };

  const removeUrlInput = (id: string) => {
    if (urlInputs.length > 1) {
      setUrlInputs(urlInputs.filter(input => input.id !== id));
    }
  };

  const updateUrlInput = (id: string, field: 'url' | 'filename', value: string) => {
    setUrlInputs(urlInputs.map(input => {
      if (input.id === id) {
        const updated = { ...input, [field]: value };
        
        // Auto-generate filename from URL if filename is empty
        if (field === 'url' && value && !updated.filename) {
          try {
            const url = new URL(value);
            const pathname = url.pathname;
            const fileName = pathname.split('/').pop() || 'image';
            const cleanFileName = fileName.split('?')[0].split('#')[0];
            updated.filename = cleanFileName || 'image';
          } catch {
            // Invalid URL, don't auto-generate filename
          }
        }
        
        // Auto-add new input field when URL field has content and this is the last input
        if (field === 'url' && value.trim()) {
          const isLastInput = id === urlInputs[urlInputs.length - 1].id;
          
          if (isLastInput) {
            const newId = (urlInputs.length + 1).toString();
            setUrlInputs(prev => [...prev, { id: newId, url: '', filename: '', status: 'pending' }]);
            
            // Focus the new input field after a short delay
            setTimeout(() => {
              const nextInput = document.querySelector(`input[data-url-id="${newId}"]`) as HTMLInputElement;
              if (nextInput) {
                nextInput.focus();
              }
            }, 100);
          }
        }
        
        return updated;
      }
      return input;
    }));
  };

  const validateUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const downloadImageFromUrl = async (url: string, filename: string): Promise<File> => {
    try {
      console.log(`📥 Downloading image from URL: ${url}`);
      
      // Method 1: Use our server-side image proxy (best approach)
      try {
        const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
        console.log(`🔄 Using server-side image proxy: ${proxyUrl}`);
        
        const response = await fetch(proxyUrl, {
          method: 'GET',
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.startsWith('image/')) {
            const blob = await response.blob();
            console.log(`✅ Server proxy download successful for ${filename}`);
            return new File([blob], filename, { type: blob.type });
          } else {
            // Handle JSON error responses from the proxy
            const errorData = await response.json();
            throw new Error(`Proxy error: ${errorData.error}`);
          }
        } else {
          const errorData = await response.json();
          console.warn(`Server proxy failed: ${errorData.error}`);
        }
      } catch (proxyError) {
        console.error('Server proxy error:', proxyError);
      }

      // Method 2: Direct fetch attempt (sometimes works for some domains)
      try {
        const response = await fetch(url, {
          method: 'GET',
          mode: 'cors',
          headers: {
            'Accept': 'image/*',
          },
        });

        if (response.ok) {
          const blob = await response.blob();
          const mimeType = blob.type || 'image/jpeg';
          console.log(`✅ Direct download successful for ${filename}`);
          return new File([blob], filename, { type: mimeType });
        }
      } catch (directError) {
        console.log(`⚠️ Direct download failed: ${directError}`);
      }

      // Method 3: Try alternative proxy services
      const alternativeProxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        `https://images.weserv.nl/?url=${encodeURIComponent(new URL(url).hostname + new URL(url).pathname)}`,
      ];

      for (const proxyUrl of alternativeProxies) {
        try {
          console.log(`🔄 Trying alternative proxy: ${proxyUrl}`);
          
          const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
              'Accept': 'image/*',
            },
          });

          if (response.ok) {
            const blob = await response.blob();
            const mimeType = blob.type || 'image/jpeg';
            console.log(`✅ Alternative proxy successful for ${filename}`);
            return new File([blob], filename, { type: mimeType });
          }
        } catch (proxyError) {
          console.warn(`Alternative proxy ${proxyUrl} failed:`, proxyError);
          continue;
        }
      }

      // Method 4: Pinterest-specific handling
      try {
        const urlObj = new URL(url);
        
        if (urlObj.hostname.includes('pinimg.com')) {
          console.log('🔍 Detected Pinterest URL, trying Pinterest-specific handling...');
          
          const pathParts = urlObj.pathname.split('/');
          const directUrl = `https://i.pinimg.com/originals/${pathParts[pathParts.length - 1]}`;
          console.log(`🔄 Trying direct Pinterest URL: ${directUrl}`);
          
          try {
            const response = await fetch(directUrl, {
              method: 'GET',
              mode: 'cors',
            });
            
            if (response.ok) {
              const blob = await response.blob();
              const mimeType = blob.type || 'image/jpeg';
              console.log(`✅ Pinterest direct URL successful for ${filename}`);
              return new File([blob], filename, { type: mimeType });
            }
          } catch (pinterestError) {
            console.warn('Pinterest direct URL failed:', pinterestError);
          }
        }
      } catch (urlError) {
        console.warn('URL parsing failed:', urlError);
      }

      // If all methods fail, provide a helpful error message
      throw new Error(`Unable to download image from ${url}. The server-side proxy may be temporarily unavailable. Please try again in a moment, or download the image manually and upload it directly.`);
      
    } catch (error) {
      console.error('❌ All download methods failed:', error);
      throw new Error(`Failed to download image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => reject(new Error('Failed to load image for dimension detection'));
      img.src = URL.createObjectURL(file);
    });
  };

  const uploadFromUrl = async (urlInput: UrlInput): Promise<UploadedImage> => {
    try {
      // Update status to uploading
      setUrlInputs(prev => prev.map(input => 
        input.id === urlInput.id 
          ? { ...input, status: 'uploading', progress: 0 }
          : input
      ));

      // Download image from URL
      const file = await downloadImageFromUrl(urlInput.url, urlInput.filename || 'image');
      
      // Get image dimensions
      const dimensions = await getImageDimensions(file);

      // Update progress
      setUrlInputs(prev => prev.map(input => 
        input.id === urlInput.id 
          ? { ...input, progress: 50 }
          : input
      ));

      // Upload using existing imageService (which uploads to imgbb and saves to database)
      const uploadedImage = await imageService.uploadImage(file, currentFolderId || undefined);

      // Update status to success
      setUrlInputs(prev => prev.map(input => 
        input.id === urlInput.id 
          ? { ...input, status: 'success', progress: 100 }
          : input
      ));

      return uploadedImage;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      setUrlInputs(prev => prev.map(input => 
        input.id === urlInput.id 
          ? { ...input, status: 'error', error: errorMessage, progress: 0 }
          : input
      ));
      
      throw error;
    }
  };

  const handleUpload = async () => {
    const validInputs = urlInputs.filter(input => input.url.trim());
    
    if (validInputs.length === 0) {
      toast.error('Please add at least one image URL');
      return;
    }

    // Validate all URLs
    const invalidUrls = validInputs.filter(input => !validateUrl(input.url));
    if (invalidUrls.length > 0) {
      toast.error('Please enter valid URLs (http/https only)');
      return;
    }

    setIsUploading(true);
    const uploadedImages: UploadedImage[] = [];
    const errors: string[] = [];

    try {
      // Upload all images concurrently
      const uploadPromises = validInputs.map(async (input) => {
        try {
          const uploadedImage = await uploadFromUrl(input);
          uploadedImages.push(uploadedImage);
        } catch (error) {
          const errorMessage = `${input.filename || input.url}: ${error instanceof Error ? error.message : 'Upload failed'}`;
          errors.push(errorMessage);
        }
      });

      await Promise.all(uploadPromises);

      // Report results
      if (uploadedImages.length > 0) {
        onImagesUploaded(uploadedImages);
        toast.success(`Successfully uploaded ${uploadedImages.length} image${uploadedImages.length !== 1 ? 's' : ''} from URLs!`);
      }

      if (errors.length > 0) {
        toast.error(`${errors.length} image${errors.length !== 1 ? 's' : ''} failed to upload`);
        console.error('Upload errors:', errors);
      }

      if (uploadedImages.length > 0) {
        onClose();
        // Reset form
        setUrlInputs([{ id: '1', url: '', filename: '', status: 'pending' }]);
      }
    } catch (error) {
      toast.error('Upload failed. Please try again.');
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusIcon = (status: UrlInput['status']) => {
    switch (status) {
      case 'uploading':
        return <Upload className="w-4 h-4 animate-spin text-blue-400" />;
      case 'success':
        return <Check className="w-4 h-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Link className="w-4 h-4 text-neutral-400" />;
    }
  };

  const getStatusColor = (status: UrlInput['status']) => {
    switch (status) {
      case 'uploading':
        return 'border-blue-500 bg-blue-900/20';
      case 'success':
        return 'border-green-500 bg-green-900/20';
      case 'error':
        return 'border-red-500 bg-red-900/20';
      default:
        return 'border-neutral-700 bg-neutral-900/20';
    }
  };

  const handleBulkPaste = () => {
    if (!bulkPasteText.trim()) return;

    // Extract URLs from text using regex
    const urlRegex = /https?:\/\/[^\s<>"'()]+/g;
    const urls = bulkPasteText.match(urlRegex) || [];
    
    if (urls.length === 0) {
      toast.error('No valid URLs found in the text');
      return;
    }

    // Clear existing inputs and create new ones from URLs
    const newInputs: UrlInput[] = urls.map((url, index) => {
      let filename = '';
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const fileName = pathname.split('/').pop() || `image_${index + 1}`;
        const cleanFileName = fileName.split('?')[0].split('#')[0];
        filename = cleanFileName || `image_${index + 1}`;
      } catch {
        filename = `image_${index + 1}`;
      }
      
      return {
        id: (index + 1).toString(),
        url,
        filename,
        status: 'pending'
      };
    });

    setUrlInputs(newInputs);
    setBulkPasteText('');
    toast.success(`Added ${urls.length} URLs from bulk paste`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        className="bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Bulk Upload from URLs</h2>
            <p className="text-sm text-neutral-400 mt-1">
              Bulk paste 50+ URLs or enter manually below
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!bulkPasteText) {
                  // Switch to bulk paste mode - copy individual URLs to bulk text
                  const existingUrls = urlInputs
                    .filter(input => input.url.trim())
                    .map(input => input.url.trim())
                    .join('\n');
                  
                  setBulkPasteText(existingUrls);
                } else {
                  // Clear bulk paste mode
                  setBulkPasteText('');
                }
              }}
              className="text-neutral-400 hover:text-white hover:bg-neutral-800"
            >
              <Clipboard className="w-4 h-4 mr-1" />
              {bulkPasteText ? 'Hide Bulk' : 'Show Bulk'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-neutral-400 hover:text-white hover:bg-neutral-800"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 overflow-y-auto max-h-[70vh]">
          {/* Always show manual entry mode */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-neutral-300">Individual URLs</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={addUrlInput}
                disabled={isUploading}
                className="text-neutral-400 hover:text-white text-xs px-2 py-1"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            </div>
            <AnimatePresence>
              {urlInputs.map((input, index) => (
                <motion.div
                  key={input.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`p-2 rounded border transition-all ${getStatusColor(input.status)}`}
                >
                  <div className="space-y-2">
                    {/* URL Input - Condensed */}
                    <div className="flex space-x-2">
                      <input
                        type="url"
                        value={input.url}
                        onChange={(e) => updateUrlInput(input.id, 'url', e.target.value)}
                        placeholder="https://example.com/image.jpg"
                        data-url-id={input.id}
                        autoFocus={index === 0}
                        className="flex-1 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                        disabled={isUploading}
                      />
                      
                      {/* Filename Input - Condensed */}
                      <input
                        type="text"
                        value={input.filename}
                        onChange={(e) => updateUrlInput(input.id, 'filename', e.target.value)}
                        placeholder="filename"
                        className="w-24 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                        disabled={isUploading}
                      />

                      {/* Remove Button */}
                      {urlInputs.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeUrlInput(input.id)}
                          disabled={isUploading}
                          className="text-neutral-400 hover:text-red-400 hover:bg-neutral-800 w-6 h-6 p-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>

                    {/* Status Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(input.status)}
                        <span className="text-xs text-neutral-400">
                          {input.status === 'pending' && 'Ready'}
                          {input.status === 'uploading' && 'Uploading...'}
                          {input.status === 'success' && '✓'}
                          {input.status === 'error' && 'Error'}
                        </span>
                      </div>

                      {input.status === 'uploading' && input.progress !== undefined && (
                        <div className="flex items-center space-x-1">
                          <div className="w-12 h-1 bg-neutral-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all duration-300"
                              style={{ width: `${input.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-neutral-400">{input.progress}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Bulk paste mode - always available when bulkPasteText has content */}
          {bulkPasteText && (
            <div className="space-y-3 border-t border-neutral-800 pt-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Bulk Paste (URLs from individual inputs above)
                </label>
                <textarea
                  value={bulkPasteText}
                  onChange={(e) => setBulkPasteText(e.target.value)}
                  placeholder="URLs will appear here when switching to bulk paste mode"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-none"
                  disabled={isUploading}
                />
              </div>
              
              <div className="flex justify-between items-center">
                <div className="text-sm text-neutral-400">
                  {bulkPasteText.match(/https?:\/\/[^\s<>"'()]+/g)?.length || 0} URLs detected
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkPaste}
                    disabled={!bulkPasteText.trim() || isUploading}
                    className="text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-white text-xs px-2 py-1"
                  >
                    Extract & Add URLs
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBulkPasteText('')}
                    disabled={isUploading}
                    className="text-neutral-400 hover:text-white text-xs px-2 py-1"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-neutral-800">
          <div className="text-xs text-neutral-400">
            {urlInputs.filter(input => input.url.trim()).length} ready • {urlInputs.filter(input => input.status === 'success').length} done
          </div>
          <div className="flex space-x-2">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={isUploading}
              className="bg-neutral-800 hover:bg-neutral-700 text-white h-7 text-xs px-3"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || urlInputs.every(input => !input.url.trim())}
              className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 h-7 text-xs px-3"
            >
              {isUploading ? (
                <>
                  <Upload className="w-3 h-3 mr-1 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-3 h-3 mr-1" />
                  Upload All
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

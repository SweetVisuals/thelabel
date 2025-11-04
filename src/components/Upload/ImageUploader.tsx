import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, CheckSquare, Square, Trash2, Play, Settings } from 'lucide-react';
import { UploadedImage, SlideshowTemplate, TemplateApplicationResult } from '../../types';
import { uploadToImgbb, getImageDimensions, deleteFromImgbb } from '../../lib/imgbb';
import { slideshowService } from '../../lib/slideshowService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface ImageUploaderProps {
  onImagesUploaded: (images: UploadedImage[]) => void;
  images: UploadedImage[];
  selectedImages?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  onTemplateApplied?: (result: TemplateApplicationResult) => void;
  availableTemplates?: SlideshowTemplate[];
  onApplyTemplateToBulk?: (templateId: string, images: UploadedImage[]) => Promise<void>;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImagesUploaded,
  images,
  selectedImages = [],
  onSelectionChange,
  onTemplateApplied,
  availableTemplates = [],
  onApplyTemplateToBulk,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith('image/')
    );
    
    processFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
  };

  const processFiles = async (files: File[]) => {
    if (!user) {
      setUploadError('You must be logged in to upload images');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const uploadPromises = files.map(async (file) => {
        // Get image dimensions
        const dimensions = await getImageDimensions(file);

        // Upload to Imgbb
        const imgbbResponse = await uploadToImgbb(file);

        // Save to database
        const { data: dbImage, error: dbError } = await supabase
          .from('images')
          .insert({
            user_id: user.id,
            filename: imgbbResponse.data.image.filename,
            file_path: imgbbResponse.data.url,
            file_size: imgbbResponse.data.size,
            mime_type: imgbbResponse.data.image.mime,
            width: imgbbResponse.data.width,
            height: imgbbResponse.data.height,
          })
          .select()
          .single();

        if (dbError) {
          throw new Error(`Database error: ${dbError.message}`);
        }

        return {
          id: dbImage.id,
          file,
          url: imgbbResponse.data.url,
          preview: URL.createObjectURL(file),
          permanentUrl: imgbbResponse.data.url,
          deleteUrl: imgbbResponse.data.delete_url,
          filename: imgbbResponse.data.image.filename,
          fileSize: imgbbResponse.data.size,
          mimeType: imgbbResponse.data.image.mime,
          width: imgbbResponse.data.width,
          height: imgbbResponse.data.height,
        } as UploadedImage;
      });

      const newImages = await Promise.all(uploadPromises);
      onImagesUploaded([...images, ...newImages]);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = async (imageId: string) => {
    const imageToRemove = images.find(img => img.id === imageId);
    if (!imageToRemove) return;

    try {
      // Delete from Imgbb if delete URL is available
      if (imageToRemove.deleteUrl) {
        await deleteFromImgbb(imageToRemove.deleteUrl);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('images')
        .delete()
        .eq('id', imageId);

      if (dbError) {
        console.error('Database delete error:', dbError);
        // Continue with local removal even if DB delete fails
      }

      // Remove from local state
      const updatedImages = images.filter(img => img.id !== imageId);
      onImagesUploaded(updatedImages);
      // Remove from selection if selected
      if (onSelectionChange) {
        onSelectionChange(selectedImages.filter(id => id !== imageId));
      }
    } catch (error) {
      console.error('Delete error:', error);
      // Still remove from local state even if remote delete fails
      const updatedImages = images.filter(img => img.id !== imageId);
      onImagesUploaded(updatedImages);
      if (onSelectionChange) {
        onSelectionChange(selectedImages.filter(id => id !== imageId));
      }
    }
  };

  const handleApplyTemplateToSelected = async (templateId: string) => {
    if (!user || !onApplyTemplateToBulk) return;

    const targetImages = selectedImages.length > 0
      ? images.filter(img => selectedImages.includes(img.id))
      : images;

    if (targetImages.length === 0) {
      setUploadError('No images selected to apply template to');
      return;
    }

    setIsApplyingTemplate(true);
    setUploadError(null);

    try {
      await onApplyTemplateToBulk(templateId, targetImages);
      // Clear selection after successful application
      if (onSelectionChange) {
        onSelectionChange([]);
      }
    } catch (error) {
      console.error('Failed to apply template:', error);
      setUploadError('Failed to apply template. Please try again.');
    } finally {
      setIsApplyingTemplate(false);
    }
  };

  const handleApplyTemplateToAll = async (templateId: string) => {
    if (!user || !onApplyTemplateToBulk || images.length === 0) return;

    setIsApplyingTemplate(true);
    setUploadError(null);

    try {
      await onApplyTemplateToBulk(templateId, images);
    } catch (error) {
      console.error('Failed to apply template:', error);
      setUploadError('Failed to apply template. Please try again.');
    } finally {
      setIsApplyingTemplate(false);
    }
  };

  const removeSelectedImages = async () => {
    if (selectedImages.length === 0) return;

    try {
      const deletePromises = selectedImages.map(async (imageId) => {
        const imageToRemove = images.find(img => img.id === imageId);
        if (!imageToRemove) return;

        // Delete from Imgbb if delete URL is available
        if (imageToRemove.deleteUrl) {
          await deleteFromImgbb(imageToRemove.deleteUrl);
        }

        // Delete from database
        const { error: dbError } = await supabase
          .from('images')
          .delete()
          .eq('id', imageId);

        if (dbError) {
          console.error('Database delete error:', dbError);
        }
      });

      await Promise.all(deletePromises);

      // Remove from local state
      const updatedImages = images.filter(img => !selectedImages.includes(img.id));
      onImagesUploaded(updatedImages);
      // Clear selection
      if (onSelectionChange) {
        onSelectionChange([]);
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
      // Still remove from local state even if remote delete fails
      const updatedImages = images.filter(img => !selectedImages.includes(img.id));
      onImagesUploaded(updatedImages);
      if (onSelectionChange) {
        onSelectionChange([]);
      }
    }
  };

  const toggleSelection = (imageId: string) => {
    if (!onSelectionChange) return;
    if (selectedImages.includes(imageId)) {
      onSelectionChange(selectedImages.filter(id => id !== imageId));
    } else {
      onSelectionChange([...selectedImages, imageId]);
    }
  };

  const selectAll = () => {
    if (!onSelectionChange) return;
    if (selectedImages.length === images.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(images.map(img => img.id));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  return (
    <div className="space-y-6">
      {uploadError && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive text-sm">{uploadError}</p>
        </div>
      )}

      <div
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 hover-lift ${
            isDragOver
              ? 'border-primary bg-primary/10 scale-[1.02] shadow-xl shadow-primary/20'
              : isUploading
              ? 'border-primary/50 bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-accent/10'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="space-y-4">
          <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center transition-all duration-200 ${
            isDragOver ? 'bg-primary/20' : isUploading ? 'bg-primary/10' : 'bg-accent/30'
          }`}>
            <Upload className={`w-8 h-8 transition-colors duration-200 ${
              isDragOver ? 'text-primary' : isUploading ? 'text-primary' : 'text-muted-foreground'
            }`} />
          </div>

          <div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              {isUploading ? 'Uploading Images...' : 'Upload Your Images'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {isUploading
                ? 'Please wait while your images are being uploaded and stored permanently'
                : 'Drag and drop your images here, or click to browse'
              }
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || !user}
              className={`inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg text-white transition-all duration-200 hover-lift ${
                isUploading || !user
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'btn-modern bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50'
              }`}
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              {isUploading ? 'Uploading...' : user ? 'Choose Images' : 'Login Required'}
            </button>
          </div>
        </div>
      </div>

      {images.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {onSelectionChange && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={selectAll}
                  className="flex items-center space-x-2 bg-accent hover:bg-accent/80 text-accent-foreground px-3 py-2 h-8 text-sm border-border hover-lift transition-all duration-200"
                >
                  {selectedImages.length === images.length ? (
                    <CheckSquare className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Square className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span>{selectedImages.length === images.length ? 'Deselect All' : 'Select All'}</span>
                </Button>
              )}
              <h4 className="text-lg font-medium text-foreground">
                Uploaded Images ({images.length})
              </h4>
            </div>
            <div className="flex items-center space-x-2">
              {selectedImages.length > 0 && onSelectionChange && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={removeSelectedImages}
                    className="flex items-center space-x-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 px-3 py-2 h-8 text-sm transition-all duration-200 hover-lift"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete ({selectedImages.length})</span>
                  </Button>
                  
                  {/* Template Application for Selected Images */}
                  {availableTemplates.length > 0 && onApplyTemplateToBulk && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">Apply to selected:</span>
                      <select
                        className="text-xs bg-card border border-border rounded px-2 py-1 h-8 input-modern"
                        onChange={(e) => {
                          const templateId = e.target.value;
                          if (templateId) {
                            handleApplyTemplateToSelected(templateId);
                            e.target.value = ''; // Reset selection
                          }
                        }}
                        disabled={isApplyingTemplate}
                      >
                        <option value="">Choose template...</option>
                        {availableTemplates.map(template => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
              
              <button
                onClick={() => onImagesUploaded([])}
                className="text-sm text-muted-foreground hover:text-destructive transition-colors duration-200"
              >
                Clear All
              </button>
              
              {/* Template Application for All Images */}
              {images.length > 0 && availableTemplates.length > 0 && onApplyTemplateToBulk && (
                <div className="flex items-center space-x-2 border-l border-border/50 pl-2">
                  <span className="text-sm text-muted-foreground">Apply to all:</span>
                  <select
                    className="text-xs bg-card border border-border rounded px-2 py-1 h-8 input-modern"
                    onChange={(e) => {
                      const templateId = e.target.value;
                      if (templateId) {
                        handleApplyTemplateToAll(templateId);
                        e.target.value = ''; // Reset selection
                      }
                    }}
                    disabled={isApplyingTemplate}
                  >
                    <option value="">Choose template...</option>
                    {availableTemplates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {images.map((image) => (
              <div
                key={image.id}
                className={cn(
                  "relative group aspect-square rounded-lg overflow-hidden bg-accent/20 hover:shadow-xl hover-lift transition-all duration-200 cursor-pointer border border-border/50",
                  selectedImages.includes(image.id) && "ring-2 ring-primary shadow-lg shadow-primary/25"
                )}
                onClick={() => onSelectionChange && toggleSelection(image.id)}
              >
                <img
                  src={image.preview}
                  alt="Uploaded"
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                {selectedImages.includes(image.id) && (
                  <div className="absolute top-2 left-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-lg">
                    <CheckSquare className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(image.id);
                  }}
                  className="absolute top-2 right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-destructive/90 hover-lift"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
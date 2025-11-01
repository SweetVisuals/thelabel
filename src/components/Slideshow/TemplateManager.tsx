import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { 
  Save, 
  Trash2, 
  Play, 
  Download, 
  Upload, 
  Copy, 
  Settings,
  Image as ImageIcon,
  FileText,
  Hash,
  Music,
  Palette,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { SlideshowMetadata, SlideshowTemplate, UploadedImage, TemplateApplicationResult } from '../../types';
import { slideshowService } from '../../lib/slideshowService';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface TemplateManagerProps {
  currentSlideshow?: SlideshowMetadata | null;
  uploadedImages: UploadedImage[];
  selectedImages: string[];
  onTemplateApplied: (result: TemplateApplicationResult) => void;
  onImagesSelectForBulk: (images: UploadedImage[]) => void;
  // Additional props for creating templates from current settings
  currentTitle?: string;
  currentPostTitle?: string;
  currentCaption?: string;
  currentHashtags?: string[];
  currentTextOverlays?: any[];
  currentAspectRatio?: string;
  currentTransitionEffect?: 'fade' | 'slide' | 'zoom';
  currentMusicEnabled?: boolean;
}

interface CreateTemplateModalProps {
  isOpen: boolean;
  slideshow?: SlideshowMetadata | null;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
}

const CreateTemplateModal: React.FC<CreateTemplateModalProps> = ({ 
  isOpen, 
  slideshow, 
  onClose, 
  onSave 
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (slideshow) {
      setName(`${slideshow.title} Template`);
      setDescription(`Template created from "${slideshow.title}" slideshow`);
    }
  }, [slideshow]);

  const handleSave = async () => {
    if (!name.trim()) return; // Only require name, slideshow is optional now
    
    setIsSaving(true);
    try {
      await onSave(name.trim(), description.trim());
      onClose();
      setName('');
      setDescription('');
    } catch (error) {
      console.error('Failed to create template:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        className="bg-background rounded-lg shadow-xl max-w-md w-full border border-border"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Create Template</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <XCircle className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">Template Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter template name..."
                className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Description (Optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter template description..."
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:border-primary focus:outline-none resize-none"
              />
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium text-sm mb-2">Template Preview</h4>
              <div className="space-y-2 text-xs text-muted-foreground">
                {slideshow ? (
                  <>
                    <div className="flex items-center gap-2">
                      <FileText className="w-3 h-3" />
                      <span>Title: {slideshow.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Hash className="w-3 h-3" />
                      <span>{slideshow.hashtags.length} hashtags</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-3 h-3" />
                      <span>{slideshow.condensedSlides.length} slides</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Palette className="w-3 h-3" />
                      <span>Text overlays: {slideshow.textOverlays.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-3 h-3" />
                      <span>Aspect ratio: {slideshow.aspectRatio}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <FileText className="w-3 h-3" />
                      <span>Title: From current settings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Hash className="w-3 h-3" />
                      <span>Hashtags: From current settings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-3 h-3" />
                      <span>Slides: Based on selected images</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Palette className="w-3 h-3" />
                      <span>Text overlays: From current settings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-3 h-3" />
                      <span>Aspect ratio: From current settings</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={!name.trim() || isSaving}
                className="flex-1"
              >
                {isSaving ? 'Creating...' : 'Create Template'}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

interface ApplyTemplateModalProps {
  isOpen: boolean;
  templates: SlideshowTemplate[];
  uploadedImages: UploadedImage[];
  selectedImages: string[];
  onClose: () => void;
  onApply: (templateId: string, customizations?: any) => void;
}

const ApplyTemplateModal: React.FC<ApplyTemplateModalProps> = ({ 
  isOpen, 
  templates, 
  uploadedImages, 
  selectedImages,
  onClose, 
  onApply 
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [customTitle, setCustomTitle] = useState('');
  const [customCaption, setCustomCaption] = useState('');
  const [customHashtags, setCustomHashtags] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (templates.length > 0 && !selectedTemplate) {
      setSelectedTemplate(templates[0].id);
    }
  }, [templates, selectedTemplate]);

  const handleApply = async () => {
    if (!selectedTemplate) return;
    
    setIsApplying(true);
    try {
      const template = templates.find(t => t.id === selectedTemplate);
      if (!template) return;

      const customizations = {
        title: customTitle || undefined,
        caption: customCaption || undefined,
        hashtags: customHashtags ? customHashtags.split(',').map(tag => tag.trim()).filter(Boolean) : undefined
      };

      await onApply(selectedTemplate, customizations);
      onClose();
    } catch (error) {
      console.error('Failed to apply template:', error);
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  const selectedTemplateData = templates.find(t => t.id === selectedTemplate);
  const targetImages = selectedImages.length > 0 
    ? uploadedImages.filter(img => selectedImages.includes(img.id))
    : uploadedImages;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-border"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Apply Template</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
          {templates.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No templates available</p>
              <p className="text-sm text-muted-foreground">Create a template first to use this feature</p>
            </div>
          ) : (
            <>
              {/* Template Selection */}
              <div>
                <label className="text-sm font-medium block mb-3">Choose Template</label>
                <div className="grid gap-3">
                  {templates.map(template => (
                    <div
                      key={template.id}
                      className={cn(
                        "border rounded-lg p-4 cursor-pointer transition-all",
                        selectedTemplate === template.id 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => setSelectedTemplate(template.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{template.name}</h4>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" />
                              {template.slideCount} slides
                            </span>
                            <span className="flex items-center gap-1">
                              <Hash className="w-3 h-3" />
                              {template.hashtags.length} hashtags
                            </span>
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              {template.aspectRatio}
                            </span>
                          </div>
                        </div>
                        {selectedTemplate === template.id && (
                          <CheckCircle className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customizations */}
              {selectedTemplateData && (
                <>
                  <Separator />
                  
                  <div>
                    <h4 className="font-medium mb-3">Customizations (Optional)</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium block mb-2">Custom Title</label>
                        <input
                          type="text"
                          value={customTitle}
                          onChange={(e) => setCustomTitle(e.target.value)}
                          placeholder={`Default: ${selectedTemplateData.title}`}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:border-primary focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium block mb-2">Custom Caption</label>
                        <textarea
                          value={customCaption}
                          onChange={(e) => setCustomCaption(e.target.value)}
                          placeholder={`Default: ${selectedTemplateData.caption}`}
                          rows={3}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:border-primary focus:outline-none resize-none"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium block mb-2">Custom Hashtags</label>
                        <input
                          type="text"
                          value={customHashtags}
                          onChange={(e) => setCustomHashtags(e.target.value)}
                          placeholder="tag1, tag2, tag3"
                          className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Preview */}
              <Separator />
              
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-3">Application Preview</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Images to process:</span>
                    <div className="font-medium">{targetImages.length} images</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Slides to create:</span>
                    <div className="font-medium">
                      {selectedTemplateData ? Math.min(targetImages.length, selectedTemplateData.slideCount) : 0} slides
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  onClick={handleApply} 
                  disabled={!selectedTemplate || isApplying}
                  className="flex-1"
                >
                  {isApplying ? 'Applying...' : 'Apply Template'}
                </Button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export const TemplateManager: React.FC<TemplateManagerProps> = ({
  currentSlideshow,
  uploadedImages,
  selectedImages,
  onTemplateApplied,
  onImagesSelectForBulk,
  currentTitle,
  currentPostTitle,
  currentCaption,
  currentHashtags,
  currentTextOverlays,
  currentAspectRatio,
  currentTransitionEffect,
  currentMusicEnabled,
}) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<SlideshowTemplate[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | null }>({ message: '', type: null });
  const [isLoading, setIsLoading] = useState(false);

  // Load templates on mount and when user changes
  useEffect(() => {
    if (user) {
      loadTemplates();
    }
  }, [user]);

  // Listen for template updates from other components
  useEffect(() => {
    const handleTemplatesUpdate = () => {
      if (user) {
        loadTemplates();
      }
    };

    window.addEventListener('templatesUpdated', handleTemplatesUpdate);
    
    return () => {
      window.removeEventListener('templatesUpdated', handleTemplatesUpdate);
    };
  }, [user]);

  // Auto-hide notifications
  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => {
        setNotification({ message: '', type: null });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const loadTemplates = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Load from database first
      await slideshowService.loadUserTemplates(user.id);
      // Get from memory
      const userTemplates = slideshowService.getSavedTemplates(user.id);
      setTemplates(userTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setNotification({ message: 'Failed to load templates', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTemplate = async (name: string, description: string) => {
    if (!user) return;
    
    try {
      // Use current slideshow if available, otherwise create from current settings
      if (currentSlideshow) {
        await slideshowService.createTemplateFromSlideshow(
          name,
          description,
          currentSlideshow,
          user.id
        );
      } else {
        // Create template from current settings when no slideshow exists
        await createTemplateFromCurrentSettings(name, description);
      }
      
      setNotification({ message: 'Template created successfully!', type: 'success' });
      await loadTemplates();
    } catch (error) {
      console.error('Failed to create template:', error);
      setNotification({ message: 'Failed to create template', type: 'error' });
    }
  };

  // Check if we can create a template (either from slideshow or current settings)
  const canCreateTemplate = () => {
    if (!user) return false;
    if (currentSlideshow) return true;
    // Check if we have minimum required settings
    return !!(currentTitle && currentCaption && currentHashtags && currentHashtags.length > 0);
  };

  const createTemplateFromCurrentSettings = async (name: string, description: string) => {
    if (!user || !currentTitle || !currentCaption || !currentHashtags) {
      throw new Error('Missing required settings for template creation');
    }

    // Create a temporary slideshow-like object from current settings
    const tempSlideshow: SlideshowMetadata = {
      id: `temp_${Date.now()}`,
      title: currentTitle,
      postTitle: currentPostTitle || currentTitle,
      caption: currentCaption,
      hashtags: currentHashtags,
      condensedSlides: [], // Empty for templates
      textOverlays: currentTextOverlays || [],
      aspectRatio: currentAspectRatio || '9:16',
      transitionEffect: currentTransitionEffect || 'fade',
      musicEnabled: currentMusicEnabled || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: user.id,
      folder_id: null
    };

    await slideshowService.createTemplateFromSlideshow(
      name,
      description,
      tempSlideshow,
      user.id
    );
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await slideshowService.deleteTemplate(templateId);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      setNotification({ message: 'Template deleted', type: 'success' });
    } catch (error) {
      console.error('Failed to delete template:', error);
      setNotification({ message: 'Failed to delete template', type: 'error' });
    }
  };

  const handleApplyTemplate = async (templateId: string, customizations?: any) => {
    if (!user) return;
    
    try {
      const template = templates.find(t => t.id === templateId);
      if (!template) {
        setNotification({ message: 'Template not found', type: 'error' });
        return;
      }

      const targetImages = selectedImages.length > 0 
        ? uploadedImages.filter(img => selectedImages.includes(img.id))
        : uploadedImages;

      if (targetImages.length === 0) {
        setNotification({ message: 'No images to process', type: 'error' });
        return;
      }

      const result = await slideshowService.applyTemplateToImages(
        template,
        targetImages,
        user.id,
        customizations
      );

      onTemplateApplied(result);
      
      if (result.success) {
        setNotification({ 
          message: `Template applied successfully! Created ${result.processedImages} slides.`, 
          type: 'success' 
        });
      } else {
        setNotification({ 
          message: `Template application failed: ${result.error}`, 
          type: 'error' 
        });
      }
    } catch (error) {
      console.error('Failed to apply template:', error);
      setNotification({ message: 'Failed to apply template', type: 'error' });
    }
  };

  const handleSelectAllForBulk = () => {
    onImagesSelectForBulk(uploadedImages);
  };

  return (
    <div className="space-y-4">
      {/* Notification */}
      {notification.message && (
        <motion.div 
          className={cn(
            "px-3 py-2 rounded-lg text-sm",
            notification.type === 'success'
              ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-200 dark:border-green-800"
              : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800"
          )}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          {notification.message}
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-muted-foreground flex items-center">
          <Settings className="w-4 h-4 mr-2" />
          Templates & Bulk Upload
        </h4>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          disabled={!canCreateTemplate()}
          variant="outline"
          className="flex items-center gap-2"
          title={!user ? 'Please log in to save templates' :
                 !currentSlideshow && (!currentTitle || !currentCaption || !currentHashtags?.length)
                   ? 'Please fill in title, caption, and hashtags to save as template' : 'Save current settings as template'}
        >
          <Save className="w-4 h-4" />
          Save as Template
        </Button>

        <Button
          onClick={() => setIsApplyModalOpen(true)}
          disabled={!user || templates.length === 0}
          variant="outline"
          className="flex items-center gap-2"
        >
          <Play className="w-4 h-4" />
          Apply Template
        </Button>
      </div>

      {/* Bulk Upload Helper */}
      {uploadedImages.length > 0 && (
        <>
          <Separator />
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="font-medium text-sm">Bulk Upload Helper</h5>
              <Button
                onClick={handleSelectAllForBulk}
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                Select All ({uploadedImages.length})
              </Button>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Ready for Template</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {uploadedImages.length} images available. Use "Apply Template" to create a slideshow with all images at once.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Saved Templates */}
      <Separator />
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="font-medium text-sm">Saved Templates</h5>
          {isLoading && <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-6 bg-muted/30 rounded-lg">
            <Settings className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No templates saved</p>
            <p className="text-xs text-muted-foreground">
              Create a template from a slideshow to reuse its settings
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.slice(0, 5).map(template => (
              <motion.div
                key={template.id}
                className="flex items-center justify-between p-3 border border-border rounded-lg"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex-1 min-w-0">
                  <h6 className="font-medium text-sm truncate">{template.name}</h6>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      {template.slideCount} slides
                    </span>
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      {template.hashtags.length} tags
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      {template.aspectRatio}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 ml-3">
                  <Button
                    onClick={() => handleApplyTemplate(template.id)}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    title="Apply Template"
                  >
                    <Play className="w-3 h-3" />
                  </Button>
                  <Button
                    onClick={() => handleDeleteTemplate(template.id)}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    title="Delete Template"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </motion.div>
            ))}
            
            {templates.length > 5 && (
              <Button
                onClick={() => setIsApplyModalOpen(true)}
                variant="ghost"
                size="sm"
                className="w-full text-xs"
              >
                View All {templates.length} Templates
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateTemplateModal
        isOpen={isCreateModalOpen}
        slideshow={currentSlideshow || null}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateTemplate}
      />

      <ApplyTemplateModal
        isOpen={isApplyModalOpen}
        templates={templates}
        uploadedImages={uploadedImages}
        selectedImages={selectedImages}
        onClose={() => setIsApplyModalOpen(false)}
        onApply={handleApplyTemplate}
      />
    </div>
  );
};
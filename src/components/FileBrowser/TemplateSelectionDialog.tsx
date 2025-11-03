import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XCircle,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
  Hash,
  Zap,
  FileText,
  Settings,
  ChevronDown,
  ChevronUp,
  Shuffle,
  Tags
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { SlideshowTemplate } from '@/types';
import { slideshowService } from '@/lib/slideshowService';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface TemplateSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (
    templateId: string, 
    aspectRatio: string,
    randomizeHashtags: boolean,
    randomizePictures: boolean
  ) => void; // For creating slideshows
  onApplyToSettings?: (template: SlideshowTemplate, aspectRatio: string) => void; // For applying to edit settings
  applyToSettingsMode?: boolean; // If true, shows "Apply to Settings" instead of "Create Slideshows"
}

interface AspectRatioOption {
  value: string;
  label: string;
  description: string;
}

const aspectRatioOptions: AspectRatioOption[] = [
  { value: '9:16', label: '9:16', description: 'Portrait (TikTok standard)' },
  { value: '16:9', label: '16:9', description: 'Landscape (YouTube/TikTok)' },
  { value: '1:1', label: '1:1', description: 'Square (Instagram/Posts)' },
  { value: '4:5', label: '4:5', description: 'Portrait (Instagram)' },
  { value: '3:4', label: '3:4', description: 'Portrait (Alternative)' },
  { value: 'free', label: 'Free', description: 'Use image aspect ratio' }
];

export const TemplateSelectionDialog: React.FC<TemplateSelectionDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onApplyToSettings,
  applyToSettingsMode = false
}) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<SlideshowTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('9:16');
  const [randomizeHashtags, setRandomizeHashtags] = useState(false);
  const [randomizePictures, setRandomizePictures] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && user) {
      loadTemplates();
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (templates.length > 0 && !selectedTemplate) {
      setSelectedTemplate(templates[0].id);
      // Set default aspect ratio from first template
      setSelectedAspectRatio(templates[0].aspectRatio || '9:16');
    }
  }, [templates, selectedTemplate]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      await slideshowService.loadUserTemplates(user!.id);
      const userTemplates = slideshowService.getSavedTemplates(user!.id);
      setTemplates(userTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedAspectRatio(template.aspectRatio || '9:16');
    }
  };

  const handleConfirm = async () => {
    if (!selectedTemplate) return;
    
    setIsConfirming(true);
    try {
      if (applyToSettingsMode && onApplyToSettings) {
        const template = templates.find(t => t.id === selectedTemplate);
        if (template) {
          await onApplyToSettings(template, selectedAspectRatio);
        }
      } else if (onConfirm) {
        await onConfirm(selectedTemplate, selectedAspectRatio, randomizeHashtags, randomizePictures);
      }
      onClose();
    } catch (error) {
      console.error('Failed to apply template:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  const toggleTemplateExpansion = (templateId: string) => {
    const newExpanded = new Set(expandedTemplates);
    if (newExpanded.has(templateId)) {
      newExpanded.delete(templateId);
    } else {
      newExpanded.add(templateId);
    }
    setExpandedTemplates(newExpanded);
  };

  const selectedTemplateData = templates.find(t => t.id === selectedTemplate);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        className="bg-background rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden border border-border"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{applyToSettingsMode ? 'Apply Template to Settings' : 'Create from Template'}</h3>
            <Button variant="ghost" size="sm" onClick={() => onClose()} disabled={isConfirming}>
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {applyToSettingsMode
              ? 'Select a template to populate your edit settings'
              : 'Select a template and configure the aspect ratio to create your slideshow'
            }
          </p>
        </div>

        <div className="p-4 max-h-[calc(85vh-120px)] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-muted-foreground">Loading templates...</span>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-6">
              <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No templates available</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a template first in the Slideshow Manager
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Template Selection */}
              <div>
                <h4 className="font-medium mb-3 flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Select Template
                </h4>
                <div className="grid gap-2">
                  {templates.map(template => (
                    <motion.div
                      key={template.id}
                      className={cn(
                        "border rounded-lg p-3 cursor-pointer transition-all",
                        selectedTemplate === template.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => handleTemplateSelect(template.id)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h5 className="font-medium text-sm">{template.name}</h5>
                            {selectedTemplate === template.id && (
                              <CheckCircle className="w-4 h-4 text-primary" />
                            )}
                          </div>
                          
                          {template.description && (
                            <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                          )}
                          
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
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
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTemplateExpansion(template.id);
                          }}
                          className="ml-2 p-1"
                        >
                          {expandedTemplates.has(template.id) ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      
                      {/* Expanded Template Details */}
                      <AnimatePresence>
                        {expandedTemplates.has(template.id) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-2 pt-2 border-t border-border"
                          >
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="text-muted-foreground">Title:</span>
                                <div className="font-medium">{template.title}</div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Post Title:</span>
                                <div className="font-medium">{template.postTitle || template.title}</div>
                              </div>
                              <div className="col-span-2">
                                <span className="text-muted-foreground">Caption:</span>
                                <div className="font-medium text-xs bg-muted/50 rounded p-2 mt-1">
                                  {template.caption}
                                </div>
                              </div>
                              <div className="col-span-2">
                                <span className="text-muted-foreground">Hashtags:</span>
                                <div className="font-medium text-xs mt-1">
                                  {template.hashtags.map(tag => `#${tag}`).join(' ')}
                                </div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Transition:</span>
                                <div className="font-medium capitalize">{template.transitionEffect}</div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Music:</span>
                                <div className="font-medium">{template.musicEnabled ? 'Enabled' : 'Disabled'}</div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio Selection */}
              {selectedTemplateData && (
                <>
                  <div>
                    <h4 className="font-medium mb-3 flex items-center">
                      <Settings className="w-4 h-4 mr-2" />
                      Aspect Ratio
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {aspectRatioOptions.map(option => (
                        <motion.div
                          key={option.value}
                          className={cn(
                            "border rounded-lg p-2 cursor-pointer transition-all text-center",
                            selectedAspectRatio === option.value
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border hover:border-primary/50"
                          )}
                          onClick={() => setSelectedAspectRatio(option.value)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="font-medium text-sm">{option.label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{option.description}</div>
                          {selectedAspectRatio === option.value && (
                            <CheckCircle className="w-3 h-3 text-primary mx-auto mt-1" />
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {!applyToSettingsMode && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center">
                        <Shuffle className="w-4 h-4 mr-2" />
                        Randomization Options
                      </h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-2 border rounded-lg">
                          <div>
                            <label htmlFor="randomize-pictures" className="font-medium text-sm">Randomize Pictures</label>
                            <p className="text-xs text-muted-foreground">Shuffle the order of images for each slideshow.</p>
                          </div>
                          <Switch
                            id="randomize-pictures"
                            checked={randomizePictures}
                            onCheckedChange={setRandomizePictures}
                          />
                        </div>
                        <div className="flex items-center justify-between p-2 border rounded-lg">
                          <div>
                            <label htmlFor="randomize-hashtags" className="font-medium text-sm">Randomize Hashtags</label>
                            <p className="text-xs text-muted-foreground">Use a different set of hashtags for each slide.</p>
                          </div>
                          <Switch
                            id="randomize-hashtags"
                            checked={randomizeHashtags}
                            onCheckedChange={setRandomizeHashtags}
                          />
                        </div>
                        {randomizeHashtags && selectedTemplateData && selectedTemplateData.hashtags.length > 0 && (
                          <div className="p-2 bg-muted/50 rounded-lg">
                            <h6 className="font-medium text-sm mb-2 flex items-center">
                              <Tags className="w-4 h-4 mr-2" />
                              Available Hashtags
                            </h6>
                            <div className="flex flex-wrap gap-1 text-xs">
                              {selectedTemplateData.hashtags.map(tag => (
                                <span key={tag} className="bg-primary/10 text-primary px-2 py-1 rounded-full">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Preview */}
                  <div className="bg-muted/30 rounded-lg p-3">
                    <h5 className="font-medium mb-2 text-sm">Configuration Preview</h5>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Template:</span>
                        <div className="font-medium">{selectedTemplateData.name}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Aspect Ratio:</span>
                        <div className="font-medium">{selectedAspectRatio}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Slides:</span>
                        <div className="font-medium">{selectedTemplateData.slideCount} slides</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Content:</span>
                        <div className="font-medium">
                          {selectedTemplateData.title} + {selectedTemplateData.hashtags.length} hashtags
                        </div>
                      </div>
                      {!applyToSettingsMode && (
                        <>
                          <div>
                            <span className="text-muted-foreground">Randomize Pictures:</span>
                            <div className="font-medium">{randomizePictures ? 'Enabled' : 'Disabled'}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Randomize Hashtags:</span>
                            <div className="font-medium">{randomizeHashtags ? 'Enabled' : 'Disabled'}</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {templates.length > 0 && (
          <div className="p-4 border-t border-border">
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => onClose()}
                disabled={isConfirming}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!selectedTemplate || isConfirming}
                className="bg-green-600 hover:bg-green-700 text-white"
                size="sm"
              >
                {isConfirming ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    {applyToSettingsMode ? 'Applying...' : 'Creating...'}
                  </>
                ) : (
                  applyToSettingsMode ? 'Apply to Settings' : 'Create Slideshows'
                )}
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

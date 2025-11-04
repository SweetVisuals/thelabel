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
import { AspectRatioSelector } from '@/components/ui/aspectRatioSelector';

interface HashtagSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  availableHashtags: string[];
  selectedHashtags: string[];
  onConfirm: (selectedHashtags: string[]) => void;
}

interface TemplateSelectionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: (
      templateId: string,
      randomizeHashtags: boolean,
      randomizePictures: boolean,
      aspectRatioOverride?: string
    ) => void; // For creating slideshows
    onApplyToSettings?: (template: SlideshowTemplate) => void; // For applying to edit settings
    applyToSettingsMode?: boolean; // If true, shows "Apply to Settings" instead of "Create Slideshows"
    defaultAspectRatio?: string; // Default aspect ratio to use
  }


const HashtagSelectionDialog: React.FC<HashtagSelectionDialogProps> = ({
isOpen,
onClose,
availableHashtags,
selectedHashtags: initialSelectedHashtags,
onConfirm
}) => {
const [selectedHashtags, setSelectedHashtags] = useState<string[]>(initialSelectedHashtags);
const [searchTerm, setSearchTerm] = useState('');

useEffect(() => {
  setSelectedHashtags(initialSelectedHashtags);
}, [initialSelectedHashtags]);

const filteredHashtags = availableHashtags.filter(tag =>
  tag.toLowerCase().includes(searchTerm.toLowerCase())
);

const toggleHashtag = (hashtag: string) => {
  setSelectedHashtags(prev => {
    if (prev.includes(hashtag)) {
      return prev.filter(h => h !== hashtag);
    } else if (prev.length < 20) {
      return [...prev, hashtag];
    }
    return prev;
  });
};

const handleConfirm = () => {
  onConfirm(selectedHashtags);
  onClose();
};

if (!isOpen) return null;

return (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
    <motion.div
      className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-border"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Select Hashtags (Max 20)</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XCircle className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Selected: {selectedHashtags.length}/20 hashtags
        </p>
      </div>

      <div className="p-4 max-h-[calc(80vh-140px)] overflow-y-auto">
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search hashtags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-background/80 backdrop-blur-sm border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent placeholder-muted-foreground transition-all duration-200"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {filteredHashtags.map(hashtag => (
            <motion.button
              key={hashtag}
              onClick={() => toggleHashtag(hashtag)}
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium transition-all",
                selectedHashtags.includes(hashtag)
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted",
                selectedHashtags.includes(hashtag) ? "ring-2 ring-primary/30" : ""
              )}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={!selectedHashtags.includes(hashtag) && selectedHashtags.length >= 20}
            >
              #{hashtag}
            </motion.button>
          ))}
        </div>

        {filteredHashtags.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            No hashtags found matching "{searchTerm}"
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedHashtags.length === 0}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            size="sm"
          >
            Select {selectedHashtags.length} Hashtags
          </Button>
        </div>
      </div>
    </motion.div>
  </div>
);
};

export const TemplateSelectionDialog: React.FC<TemplateSelectionDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    onApplyToSettings,
    applyToSettingsMode = false,
    defaultAspectRatio = ''
  }) => {
   const { user } = useAuth();
   const [templates, setTemplates] = useState<SlideshowTemplate[]>([]);
   const [selectedTemplate, setSelectedTemplate] = useState<string>('');
   const [randomizeHashtags, setRandomizeHashtags] = useState(false);
   const [randomizePictures, setRandomizePictures] = useState(false);
   const [aspectRatioOverride, setAspectRatioOverride] = useState<string>('');
   // Removed selectedHashtags and showHashtagSelection as hashtags are now automatically randomized
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
    // Reset aspect ratio override when selecting a different template
    setAspectRatioOverride('');
  };

  const handleConfirm = async () => {
    if (!selectedTemplate) return;

    setIsConfirming(true);
    try {
      if (applyToSettingsMode && onApplyToSettings) {
        const template = templates.find(t => t.id === selectedTemplate);
        if (template) {
          await onApplyToSettings(template);
        }
      } else if (onConfirm) {
        await onConfirm(selectedTemplate, randomizeHashtags, randomizePictures, aspectRatioOverride || undefined);
      }
      onClose();
    } catch (error) {
      console.error('Failed to apply template:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  // Removed handleHashtagSelection as hashtags are now automatically randomized

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
              : 'Select a template to create your slideshow'
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
                          Hashtag Randomization
                        </h6>
                        <p className="text-xs text-muted-foreground mb-3">
                          4 random hashtags will be automatically selected from the template for each slideshow variant.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedTemplateData.hashtags.slice(0, 6).map(tag => (
                            <span key={tag} className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs">
                              #{tag}
                            </span>
                          ))}
                          {selectedTemplateData.hashtags.length > 6 && (
                            <span className="text-xs text-muted-foreground px-2 py-1">
                              +{selectedTemplateData.hashtags.length - 6} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Aspect Ratio Override */}
              {!applyToSettingsMode && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center">
                    <Settings className="w-4 h-4 mr-2" />
                    Aspect Ratio Override
                  </h4>
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <label className="font-medium text-sm">Override Template Aspect Ratio</label>
                        <p className="text-xs text-muted-foreground">
                          {aspectRatioOverride
                            ? `Will use ${aspectRatioOverride} instead of template's ${selectedTemplateData?.aspectRatio}`
                            : `Uses template's ${selectedTemplateData?.aspectRatio} aspect ratio`
                          }
                        </p>
                      </div>
                    </div>
                    <AspectRatioSelector
                      selectedAspectRatio={aspectRatioOverride || selectedTemplateData?.aspectRatio || '9:16'}
                      onAspectRatioChange={(ratio) => {
                        setAspectRatioOverride(ratio);
                      }}
                      className="w-full"
                      showPreview={true}
                    />
                    {aspectRatioOverride && (
                      <div className="mt-2 text-xs text-primary font-medium">
                        ✓ Override active: {aspectRatioOverride}
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
                    <div className="font-medium">{selectedTemplateData?.name}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Slides:</span>
                    <div className="font-medium">{selectedTemplateData?.slideCount} slides</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Content:</span>
                    <div className="font-medium">
                      {selectedTemplateData?.title} + {selectedTemplateData?.hashtags.length} hashtags
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Aspect Ratio:</span>
                    <div className="font-medium">
                      {aspectRatioOverride || selectedTemplateData?.aspectRatio}
                      {aspectRatioOverride && <span className="text-xs text-primary ml-1">(override)</span>}
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

      {/* Hashtag Selection Dialog - Removed as hashtags are now automatically randomized */}
    </div>
  );
};

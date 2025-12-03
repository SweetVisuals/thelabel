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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[60] p-4">
      <motion.div
        className="bg-background/90 backdrop-blur-xl rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-white/10 ring-1 ring-white/5"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, type: "spring", damping: 25, stiffness: 300 }}
      >
        <div className="p-5 border-b border-white/10 bg-white/5">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Select Hashtags</h3>
            <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-white/10 rounded-full">
              <XCircle className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
            <Tags className="w-4 h-4" />
            Selected: <span className="text-primary font-medium">{selectedHashtags.length}</span>/20 hashtags
          </p>
        </div>

        <div className="p-5 max-h-[calc(80vh-160px)] overflow-y-auto custom-scrollbar">
          <div className="mb-6 relative">
            <input
              type="text"
              placeholder="Search hashtags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent placeholder-muted-foreground transition-all duration-200 pl-10"
            />
            <Hash className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          <div className="flex flex-wrap gap-2">
            {filteredHashtags.map(hashtag => (
              <motion.button
                key={hashtag}
                onClick={() => toggleHashtag(hashtag)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border",
                  selectedHashtags.includes(hashtag)
                    ? "bg-primary/20 border-primary/50 text-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                    : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:border-white/20 hover:text-foreground"
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
            <div className="text-center py-12 text-muted-foreground">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <Hash className="w-8 h-8 opacity-50" />
              </div>
              <p>No hashtags found matching "{searchTerm}"</p>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-white/10 bg-white/5 flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            className="hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedHashtags.length === 0}
            className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white shadow-lg shadow-primary/20"
          >
            Select {selectedHashtags.length} Hashtags
          </Button>
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <motion.div
        className="bg-background/90 backdrop-blur-xl rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-white/10 ring-1 ring-white/5 flex flex-col"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, type: "spring", damping: 25, stiffness: 300 }}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 bg-white/5 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent">
              {applyToSettingsMode ? 'Apply Template' : 'Create from Template'}
            </h3>
            <Button variant="ghost" size="icon" onClick={() => onClose()} disabled={isConfirming} className="hover:bg-white/10 rounded-full">
              <XCircle className="w-6 h-6 text-muted-foreground" />
            </Button>
          </div>
          <p className="text-muted-foreground">
            {applyToSettingsMode
              ? 'Select a template to instantly configure your settings.'
              : 'Choose a template to generate a new slideshow with pre-configured styles.'
            }
          </p>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Panel: Template List */}
          <div className="w-full md:w-1/2 p-6 overflow-y-auto custom-scrollbar border-r border-white/10">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-muted-foreground">Loading templates...</span>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 px-6 bg-white/5 rounded-xl border border-white/10 border-dashed">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 opacity-50" />
                </div>
                <h4 className="text-lg font-medium mb-2">No Templates Found</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a template in the Slideshow Manager to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="font-medium flex items-center text-sm uppercase tracking-wider text-muted-foreground mb-4">
                  <FileText className="w-4 h-4 mr-2" />
                  Available Templates
                </h4>
                <div className="grid gap-3">
                  {templates.map(template => (
                    <motion.div
                      key={template.id}
                      className={cn(
                        "group relative border rounded-xl p-4 cursor-pointer transition-all duration-300",
                        selectedTemplate === template.id
                          ? "border-primary bg-primary/10 shadow-[0_0_20px_rgba(var(--primary),0.15)]"
                          : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                      )}
                      onClick={() => handleTemplateSelect(template.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className={cn(
                              "font-semibold text-base",
                              selectedTemplate === template.id ? "text-primary" : "text-foreground"
                            )}>
                              {template.name}
                            </h5>
                            {selectedTemplate === template.id && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring" }}
                              >
                                <CheckCircle className="w-4 h-4 text-primary" />
                              </motion.div>
                            )}
                          </div>

                          {template.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{template.description}</p>
                          )}

                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded-md">
                              <ImageIcon className="w-3 h-3" />
                              {template.slideCount} slides
                            </span>
                            <span className="flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded-md">
                              <Hash className="w-3 h-3" />
                              {template.hashtags.length} tags
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Configuration & Preview */}
          <div className="w-full md:w-1/2 p-6 bg-black/20 overflow-y-auto custom-scrollbar">
            {selectedTemplateData ? (
              <div className="space-y-6">
                {!applyToSettingsMode && (
                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center text-sm uppercase tracking-wider text-muted-foreground">
                      <Settings className="w-4 h-4 mr-2" />
                      Configuration
                    </h4>

                    <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <label htmlFor="randomize-pictures" className="font-medium text-sm block">Randomize Pictures</label>
                          <p className="text-xs text-muted-foreground">Shuffle image order</p>
                        </div>
                        <Switch
                          id="randomize-pictures"
                          checked={randomizePictures}
                          onCheckedChange={setRandomizePictures}
                        />
                      </div>

                      <div className="w-full h-px bg-white/5" />

                      <div className="flex items-center justify-between">
                        <div>
                          <label htmlFor="randomize-hashtags" className="font-medium text-sm block">Randomize Hashtags</label>
                          <p className="text-xs text-muted-foreground">Shuffle hashtag selection</p>
                        </div>
                        <Switch
                          id="randomize-hashtags"
                          checked={randomizeHashtags}
                          onCheckedChange={setRandomizeHashtags}
                        />
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                      <label className="font-medium text-sm block mb-2">Aspect Ratio Override</label>
                      <AspectRatioSelector
                        selectedAspectRatio={aspectRatioOverride || selectedTemplateData?.aspectRatio || '9:16'}
                        onAspectRatioChange={setAspectRatioOverride}
                        className="w-full"
                        showPreview={false}
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        {aspectRatioOverride
                          ? `Overriding template default (${selectedTemplateData?.aspectRatio})`
                          : `Using template default (${selectedTemplateData?.aspectRatio})`
                        }
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h4 className="font-medium flex items-center text-sm uppercase tracking-wider text-muted-foreground">
                    <Zap className="w-4 h-4 mr-2" />
                    Template Preview
                  </h4>

                  <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-xl border border-white/10 p-5 space-y-4 shadow-inner">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Title</span>
                        <div className="font-medium text-sm truncate">{selectedTemplateData.title}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Transition</span>
                        <div className="font-medium text-sm capitalize flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          {selectedTemplateData.transitionEffect}
                        </div>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Caption</span>
                        <div className="font-medium text-sm bg-black/20 p-2 rounded-lg border border-white/5">
                          {selectedTemplateData.caption}
                        </div>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Hashtags</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedTemplateData.hashtags.slice(0, 5).map(tag => (
                            <span key={tag} className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                              #{tag}
                            </span>
                          ))}
                          {selectedTemplateData.hashtags.length > 5 && (
                            <span className="text-xs text-muted-foreground px-2 py-0.5">
                              +{selectedTemplateData.hashtags.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                <Settings className="w-12 h-12 mb-4" />
                <p>Select a template to view details</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-white/5 flex-shrink-0">
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => onClose()}
              disabled={isConfirming}
              className="hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedTemplate || isConfirming}
              className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white shadow-lg shadow-primary/25 min-w-[140px]"
            >
              {isConfirming ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                applyToSettingsMode ? 'Apply Template' : 'Create Slideshow'
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

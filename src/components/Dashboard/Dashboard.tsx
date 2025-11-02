import React, { useState, useEffect } from 'react';
import { Header1 as Header } from './Header';
import { FileBrowser } from '../FileBrowser/FileBrowser';
import { TikTokPreview } from '../TikTokPreview/TikTokPreview';
import { ImageEditor } from '../ImageEditor/ImageEditor';
import { SlideshowManager } from '../Slideshow/SlideshowManager';
import { UrlUploader } from '../Upload/UrlUploader';
import { UploadedImage, Folder, Hashtag, SlideshowMetadata, TikTokTextOverlay } from '../../types';
import {
  SidebarProvider,
  SidebarInset
} from '../ui/sidebar';
import { DetailSidebar } from './NewSidebar';
import { Button } from '../ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Separator } from '../ui/separator';
import {
  Settings,
  Upload,
  Download,
  Edit3,
  Image,
  Palette,
  Filter,
  Music,
  Video,
  Share,
  Star,
  Clock,
  ChevronDown,
  ChevronRight,
  Zap,
  Sparkles,
  Crop,
  Type,
  Volume2,
  Bold,
  Italic,
  Square,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { postizAPI } from '../../lib/postiz';
import { PostizPoster } from '../Postiz/PostizPoster';

interface TextOverlay {
  id: string;
  slideIndex: number; // Added slideIndex
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  alignment: 'left' | 'center' | 'right';
  outlineColor: string;
  outlineWidth: number;
  outlinePosition: 'outer' | 'middle' | 'inner';
  bold: boolean;
  italic: boolean;
  outline: boolean;
  glow: boolean;
  glowColor: string;
  glowIntensity: number;
  isEditing?: boolean;
  isSelected?: boolean;
}

export const Dashboard: React.FC = () => {
    const { user } = useAuth();
      const [images, setImages] = useState<UploadedImage[]>([]);
      const [folders, setFolders] = useState<Folder[]>([]);
      const [selectedImages, setSelectedImages] = useState<string[]>([]);
      // Track images in selection order
      const [selectedImagesOrdered, setSelectedImagesOrdered] = useState<string[]>([]);
      const [selectedSlideshows, setSelectedSlideshows] = useState<string[]>([]);
    const [editingImage, setEditingImage] = useState<UploadedImage | null>(null);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [currentSlide, setCurrentSlide] = useState(0); // Added currentSlide state

    const [sidebarExpanded, setSidebarExpanded] = useState({
      upload: true,
      edit: true,
      export: false,
      tools: false,
      recent: false
    });
    const [activeSection, setActiveSection] = useState('main');

  // Edit settings state
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [title, setTitle] = useState('Amazing TikTok Slideshow');
  const [postTitle, setPostTitle] = useState('');
  const [caption, setCaption] = useState('Your amazing TikTok slideshow! 🎉');
  const [hashtags, setHashtags] = useState(['tiktok', 'slideshow', 'viral']);
  const [savedHashtags, setSavedHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [selectedSavedHashtags, setSelectedSavedHashtags] = useState<Set<string>>(new Set());

  // Slideshow state
  const [transitionEffect, setTransitionEffect] = useState<'fade' | 'slide' | 'zoom'>('fade');
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [cutLength, setCutLength] = useState<number>(5); // Store slideshow limit
  const [currentSlideshow, setCurrentSlideshow] = useState<SlideshowMetadata | null>(null);

  // Template functionality
  const [textTemplates, setTextTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | null }>({ message: '', type: null });

  // Postiz API key state
  const [postizApiKey, setPostizApiKey] = useState('');
  const [showPostizSettings, setShowPostizSettings] = useState(false);
  const [isValidatingApiKey, setIsValidatingApiKey] = useState(false);
  const [showPostizPoster, setShowPostizPoster] = useState(false);
  const [showUrlUploader, setShowUrlUploader] = useState(false);

  // Handle images select for bulk operations
  const handleImagesSelectForBulk = (selectedImages: UploadedImage[]) => {
    // Update the selected images array
    const imageIds = selectedImages.map(img => img.id);
    setSelectedImages(imageIds);
  };

  // Load saved hashtags and text templates on component mount
  useEffect(() => {
    if (user) {
      loadSavedHashtags();
      loadTextTemplates();
      loadPostizApiKey();
      loadUserSlideshows();
    }
  }, [user]);

  const loadUserSlideshows = async () => {
    if (!user) return;

    try {
      const { slideshowService } = await import('../../lib/slideshowService');
      await slideshowService.loadUserSlideshows(user.id);
    } catch (error) {
      console.error('Error loading user slideshows:', error);
    }
  };

  // Auto-hide notifications
  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => {
        setNotification({ message: '', type: null });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleImagesUploaded = (newImages: UploadedImage[]) => {
    // Only update images if we're in root folder (currentFolderId === null)
    // This prevents images from being duplicated when uploading to folders
    if (currentFolderId === null) {
      setImages(newImages);
    }
  };

  const loadSavedHashtags = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('hashtags')
        .select('tag')
        .eq('user_id', user.id);

      if (error) throw error;

      setSavedHashtags(data.map(item => item.tag));
    } catch (error) {
      console.error('Error loading saved hashtags:', error);
    }
  };

  const loadTextTemplates = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('text_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTextTemplates(data || []);
    } catch (error) {
      console.error('Error loading text templates:', error);
    }
  };

  const saveHashtag = async (tag: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('hashtags')
        .upsert({
          user_id: user.id,
          tag: tag,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      // Reload saved hashtags
      await loadSavedHashtags();
    } catch (error) {
      console.error('Error saving hashtag:', error);
    }
  };

  const deleteSavedHashtag = async (tag: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('hashtags')
        .delete()
        .eq('user_id', user.id)
        .eq('tag', tag);

      if (error) throw error;

      // Reload saved hashtags
      await loadSavedHashtags();
    } catch (error) {
      console.error('Error deleting saved hashtag:', error);
    }
  };

  const addHashtag = () => {
    const tag = hashtagInput.trim();
    if (tag && !hashtags.includes(tag)) {
      setHashtags((prev: string[]) => [...prev, tag]);
      setHashtagInput('');
    }
  };

  const removeHashtag = (tagToRemove: string) => {
    setHashtags((prev: string[]) => prev.filter((tag: string) => tag !== tagToRemove));
  };

  const loadSelectedHashtags = () => {
    const tagsToLoad = Array.from(selectedSavedHashtags);
    const newHashtags = [...hashtags];

    tagsToLoad.forEach((tag: string) => {
      if (!newHashtags.includes(tag)) {
        newHashtags.push(tag);
      }
    });

    setHashtags(newHashtags);
    setSelectedSavedHashtags(new Set()); // Clear selection after loading
  };

  const toggleSavedHashtagSelection = (tag: string) => {
    const newSelection = new Set(selectedSavedHashtags);
    if (newSelection.has(tag)) {
      newSelection.delete(tag);
    } else {
      newSelection.add(tag);
    }
    setSelectedSavedHashtags(newSelection);
  };

  // Text overlay functions
  const addTextOverlay = () => {
    const newText: TextOverlay = {
      id: Math.random().toString(36).substr(2, 9),
      slideIndex: currentSlide, // Added slideIndex
      text: 'Your Text Here',
      x: 50,
      y: 50,
      width: 60,
      height: 15,
      fontSize: 24,
      color: '#ffffff',
      fontFamily: 'TikTok Sans',
      fontWeight: '400',
      alignment: 'center',
      outlineColor: '#000000',
      outlineWidth: 1.9,
      outlinePosition: 'outer',
      bold: false,
      italic: false,
      outline: false,
      glow: false,
      glowColor: '#ffffff',
      glowIntensity: 5,
    };

    setTextOverlays((prev: TextOverlay[]) => [...prev, newText]);
  };

  const updateTextOverlay = (id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays((prev: TextOverlay[]) => prev.map((overlay: TextOverlay) =>
      overlay.id === id ? { ...overlay, ...updates } : overlay
    ));
  };

  const removeTextOverlay = (id: string) => {
    setTextOverlays((prev: TextOverlay[]) => prev.filter((overlay: TextOverlay) => overlay.id !== id));
  };

  const saveTextOverlayAsTemplate = async (overlay: TextOverlay) => {
    if (!user) {
      setNotification({ message: 'Please log in to save templates', type: 'error' });
      return;
    }

    if (!overlay.text.trim()) {
      setNotification({ message: 'Cannot save template with empty text', type: 'error' });
      return;
    }

    try {
      const templateName = overlay.text.trim(); // Use the text content as the template name
      const templateData = {
        user_id: user.id,
        name: templateName,
        text_content: templateName, // Save the template name as the text content
        slide_index: overlay.slideIndex,
        x: overlay.x,
        y: overlay.y,
        width: overlay.width,
        height: overlay.height,
        font_size: overlay.fontSize,
        color: overlay.color,
        font_family: overlay.fontFamily,
        font_weight: overlay.fontWeight,
        alignment: overlay.alignment,
        bold: overlay.bold,
        italic: overlay.italic,
        outline: overlay.outline,
        outline_color: overlay.outlineColor,
        outline_width: overlay.outlineWidth,
        outline_position: overlay.outlinePosition,
        glow: overlay.glow,
        glow_color: overlay.glowColor,
        glow_intensity: overlay.glowIntensity,
      };

      const { error } = await supabase
        .from('text_templates')
        .upsert(templateData);

      if (error) throw error;

      await loadTextTemplates();
      setNotification({ message: 'Template saved successfully!', type: 'success' });
    } catch (error) {
      console.error('Error saving template:', error);
      setNotification({ message: 'Failed to save template. Please try again.', type: 'error' });
    }
  };

  const applyTextTemplate = (template: any) => {
    const newText: TextOverlay = {
      id: Math.random().toString(36).substr(2, 9),
      slideIndex: currentSlide, // Apply to current slide
      text: template.text_content,
      x: template.x,
      y: template.y,
      width: template.width,
      height: template.height,
      fontSize: template.font_size,
      color: template.color,
      fontFamily: template.font_family,
      fontWeight: template.font_weight,
      alignment: template.alignment,
      outlineColor: template.outline_color,
      outlineWidth: template.outline_width,
      outlinePosition: template.outline_position,
      bold: template.bold,
      italic: template.italic,
      outline: template.outline,
      glow: template.glow,
      glowColor: template.glow_color,
      glowIntensity: template.glow_intensity,
    };

    setTextOverlays((prev: TextOverlay[]) => [...prev, newText]);
  };

  const deleteTextTemplate = async (templateId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('text_templates')
        .delete()
        .eq('id', templateId)
        .eq('user_id', user.id);

      if (error) throw error;

      await loadTextTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const loadPostizApiKey = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('postiz_api_key')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data?.postiz_api_key) {
        setPostizApiKey(data.postiz_api_key);
        postizAPI.setApiKey(data.postiz_api_key);
      }
    } catch (error) {
      console.error('Error loading Postiz API key:', error);
    }
  };

  const savePostizApiKey = async () => {
    if (!user) return;

    setIsValidatingApiKey(true);
    try {
      // First validate the API key
      const isValid = await postizAPI.testApiKey(postizApiKey);
      if (!isValid) {
        setNotification({ message: 'Invalid Postiz API key. Please check and try again.', type: 'error' });
        return;
      }

      // Save to database
      const { error } = await supabase
        .from('users')
        .update({ postiz_api_key: postizApiKey })
        .eq('id', user.id);

      if (error) throw error;

      // Set in local storage and API
      postizAPI.setApiKey(postizApiKey);

      setNotification({ message: 'Postiz API key saved successfully!', type: 'success' });
      setShowPostizSettings(false);
    } catch (error) {
      console.error('Error saving Postiz API key:', error);
      setNotification({ message: 'Failed to save API key. Please try again.', type: 'error' });
    } finally {
      setIsValidatingApiKey(false);
    }
  };

  const handleItemClick = (label: string) => {
    switch (label) {
      case "Upload Images":
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'image/*';
        input.onchange = (e) => {
          const files = Array.from((e.target as HTMLInputElement).files || []);
          if (files.length > 0) {
            handleImagesUploaded(files.map(file => ({
              id: Math.random().toString(36).substr(2, 9),
              file,
              url: URL.createObjectURL(file),
              preview: URL.createObjectURL(file),
            })));
          }
        };
        input.click();
        break;
      case "Import Folder":
        // similar for folder
        break;
      case "From URL":
        setShowUrlUploader(true);
        break;
      case "Batch Edit":
        if (selectedImages.length > 0) {
          const image = images.find((img: UploadedImage) => img.id === selectedImages[0]);
          if (image) {
            setEditingImage(image);
          }
        }
        break;
      case "Apply Filters":
        // apply filters
        break;
      case "AI Enhance":
        // ai enhance
        break;
      case "Add Music":
        // add music
        break;
      case "Export Video":
        // export video
        break;
      case "Export Slideshow":
        // export slideshow
        break;
      case "Schedule to Buffer":
        // the buffer code
        break;
      case "Post to TikTok":
        if (selectedSlideshows.length > 0) {
          setShowPostizPoster(true);
        } else {
          setNotification({ message: 'Please select a slideshow to post to TikTok', type: 'error' });
        }
        break;
      case "Templates":
        // templates
        break;
      case "Transitions":
        // transitions
        break;
      case "Settings":
        // settings
        break;
      default:
        break;
    }
  };

  const handleNavigateUpFromHeader = () => {
    const parentId = folders.find((f: Folder) => f.id === currentFolderId)?.parent_id || null;
    setCurrentFolderId(parentId);
  };

  const handleCurrentFolderIdChange = (folderId: string | null) => {
    setCurrentFolderId(folderId);
  };

  const handleSlideshowLoad = (slideshow: SlideshowMetadata) => {
    setCurrentSlideshow(slideshow);
    setSelectedImages([]);
    setTitle(slideshow.title);
    setPostTitle(slideshow.postTitle || '');
    setCaption(slideshow.caption);
    setHashtags(slideshow.hashtags);
    setTextOverlays([]);
    setTransitionEffect(slideshow.transitionEffect || 'fade');
    setMusicEnabled(slideshow.musicEnabled || false);
  };

  const handleSlideshowUnload = () => {
    setCurrentSlideshow(null);
    setSelectedSlideshows([]);
  };

  // Handle slideshow selection changes
  const handleSlideshowSelectionChange = (selectedIds: string[]) => {
    const wasSelected = selectedSlideshows.length > 0;
    const willBeSelected = selectedIds.length > 0;
    const newlySelected = selectedIds.find(id => !selectedSlideshows.includes(id));
    
    setSelectedSlideshows(selectedIds);
    
    // Clear image selection when slideshows are selected (mutually exclusive)
    if (selectedIds.length > 0) {
      setSelectedImages([]);
    }
    
    // Handle load if we have a newly selected slideshow
    if (newlySelected) {
      (async () => {
        try {
          const { slideshowService } = await import('../../lib/slideshowService');
          const slideshow = await slideshowService.loadSlideshow(newlySelected);
          if (slideshow) {
            await handleSlideshowLoad(slideshow);
          }
        } catch (error) {
          // Error handled silently for better UX
        }
      })();
    }
    
    // Handle unload if we were selected but now we're not
    if (wasSelected && !willBeSelected) {
      if (currentSlideshow) {
        setCurrentSlideshow(null);
      }
    }
  };

  // Handle image selection changes
  const handleImageSelectionChange = (selectedIds: string[]) => {
    setSelectedImages(selectedIds);
    
    // Maintain selection order by tracking when images are selected
    if (selectedIds.length > selectedImagesOrdered.length) {
      // New image was added
      const newImageId = selectedIds.find(id => !selectedImagesOrdered.includes(id));
      if (newImageId) {
        setSelectedImagesOrdered([...selectedImagesOrdered, newImageId]);
      }
    } else {
      // Image was removed or selection changed
      setSelectedImagesOrdered(selectedIds);
    }
    
    // Clear slideshow selection when images are selected (mutually exclusive)
    if (selectedIds.length > 0) {
      setSelectedSlideshows([]);
    }
  };

  // Handle selection order changes from remix operations
  useEffect(() => {
    const handleSelectionOrderChange = (event: CustomEvent) => {
      const { newOrderedSelection } = event.detail;
      setSelectedImagesOrdered(newOrderedSelection);
    };

    window.addEventListener('selectionOrderChange', handleSelectionOrderChange as EventListener);
    
    return () => {
      window.removeEventListener('selectionOrderChange', handleSelectionOrderChange as EventListener);
    };
  }, []);

  return (
    <SidebarProvider>
      <div className="h-screen bg-background flex w-full overflow-hidden">
        {/* Sidebar */}
        <DetailSidebar
          activeSection={activeSection}
          onItemClick={handleItemClick}
          images={images}
          selectedImages={selectedImages}
        />

        {/* Main Content */}
        <SidebarInset className="flex-1 h-screen overflow-hidden">
          <Header
            currentFolderId={currentFolderId}
            folders={folders}
            onNavigateUp={handleNavigateUpFromHeader}
          />

          <main className="flex h-full w-full overflow-hidden">
            {/* Left Panel - File Browser */}
            <div className="w-[50%] border-r border-border min-w-0">
              <div className="h-full overflow-hidden">
                <FileBrowser
                  images={images}
                  onImagesUploaded={handleImagesUploaded}
                  selectedImages={selectedImages}
                  onSelectionChange={setSelectedImages}
                  folders={folders}
                  onFoldersChange={setFolders}
                  currentFolderId={currentFolderId}
                  onCurrentFolderIdChange={handleCurrentFolderIdChange}
                  onNavigateUp={handleNavigateUpFromHeader}
                  onSlideshowLoad={handleSlideshowLoad}
                  onSlideshowUnload={handleSlideshowUnload}
                  selectedSlideshows={selectedSlideshows}
                  onSlideshowSelectionChange={handleSlideshowSelectionChange}
                  cutLength={cutLength}
                  onCutLengthChange={setCutLength}
                />
              </div>
            </div>

            {/* Middle Panel - TikTok Preview */}
            <div className="w-[30%] min-w-0">
              <TikTokPreview
                images={images}
                selectedImages={selectedImagesOrdered} // Use ordered selection for proper image order
                textOverlays={textOverlays}
                title={title}
                postTitle={postTitle}
                caption={caption}
                hashtags={hashtags}
                transitionEffect={transitionEffect}
                musicEnabled={musicEnabled}
                aspectRatio="9:16"
                cutLength={cutLength}
                previewMode={!!currentSlideshow} // Enable preview mode when slideshow is loaded
                onTextOverlaysChange={setTextOverlays}
                onTitleChange={setTitle}
                onPostTitleChange={setPostTitle}
                onCaptionChange={setCaption}
                onHashtagsChange={setHashtags}
                onTransitionEffectChange={setTransitionEffect}
                onMusicEnabledChange={setMusicEnabled}
                onCurrentSlideChange={setCurrentSlide}
                onImagesUpdate={(updatedImages) => {
                  // Force React to detect the change by creating new array reference
                  const newImagesArray = [...updatedImages];

                  // Also update other images that weren't cropped
                  const otherImages = images.filter(img => !updatedImages.some(updated => updated.id === img.id));
                  const finalImages = [...otherImages, ...newImagesArray];

                  setImages(finalImages);
                }}
                onSelectionOrderChange={setSelectedImagesOrdered} // Callback to update selection order
                currentSlideshow={currentSlideshow}
              />
            </div>

            {/* Right Panel - Edit Settings */}
            <div className="w-[20%] bg-background border-l border-border flex flex-col min-w-0 overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-foreground flex items-center">
                  <Settings className="w-4 h-4 mr-2" />
                  Edit Settings
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ transition: 'none' }}>
                {/* Slideshow Manager */}
                <SlideshowManager
                  images={images}
                  selectedImages={selectedImages}
                  textOverlays={textOverlays}
                  title={title}
                  postTitle={postTitle}
                  caption={caption}
                  hashtags={hashtags}
                  aspectRatio="9:16" // TODO: Get from TikTokPreview
                  transitionEffect={transitionEffect}
                  musicEnabled={musicEnabled}
                  onTitleChange={setTitle}
                  onPostTitleChange={setPostTitle}
                  onCaptionChange={setCaption}
                  onHashtagsChange={setHashtags}
                  onTextOverlaysChange={setTextOverlays}
                  onAspectRatioChange={() => {}} // TODO: Implement aspect ratio change
                  onTransitionEffectChange={setTransitionEffect}
                  onMusicEnabledChange={setMusicEnabled}
                  onImagesSelectForBulk={handleImagesSelectForBulk}
                  currentSlideshow={currentSlideshow}
                />

                {/* Text Edit Controls - Only show when not in preview mode */}
                {!currentSlideshow && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-muted-foreground">Text Editor</h4>
                    <Button
                      onClick={addTextOverlay}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <Type className="w-4 h-4 mr-2" />
                      Add Text
                    </Button>

                    {/* List of text overlays */}
                    {textOverlays.length > 0 && (
                      <div className="space-y-4">
                        <label className="text-muted-foreground text-sm">Text Overlays</label>
                        <div className="space-y-4">
                          {textOverlays.map((overlay: TextOverlay, index: number) => (
                            <div
                              key={overlay.id}
                              className={cn(
                                "p-3 rounded-lg border transition-colors",
                                overlay.isSelected
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/50"
                              )}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2 flex-1">
                                  <span className="text-sm font-medium text-foreground truncate">
                                    {overlay.text || `Text ${index + 1}`}
                                  </span>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                    Slide {overlay.slideIndex + 1}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => saveTextOverlayAsTemplate(overlay)}
                                    className="text-muted-foreground hover:text-green-500 text-xs"
                                    title="Save as template"
                                  >
                                    💾
                                  </button>
                                  <button
                                    onClick={() => removeTextOverlay(overlay.id)}
                                    className="text-muted-foreground hover:text-destructive"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>

                              {/* Text Input */}
                              <div className="mb-3">
                                <textarea
                                  value={overlay.text}
                                  onChange={(e) => updateTextOverlay(overlay.id, { text: e.target.value })}
                                  className="w-full px-2 py-1 text-sm bg-input text-foreground rounded border border-border focus:border-primary focus:outline-none resize-none"
                                  rows={2}
                                  placeholder="Enter multi-line text..."
                                />
                              </div>

                              {/* Text Edit Options - Always Visible */}
                              <div className="space-y-2">
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant={overlay.bold ? "default" : "outline"}
                                    onClick={() => updateTextOverlay(overlay.id, { bold: !overlay.bold })}
                                    className="text-xs px-2 py-1 h-7"
                                    title="Bold"
                                  >
                                    <Bold className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={overlay.italic ? "default" : "outline"}
                                    onClick={() => updateTextOverlay(overlay.id, { italic: !overlay.italic })}
                                    className="text-xs px-2 py-1 h-7"
                                    title="Italic"
                                  >
                                    <Italic className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={overlay.outline ? "default" : "outline"}
                                    onClick={() => updateTextOverlay(overlay.id, { outline: !overlay.outline })}
                                    className="text-xs px-2 py-1 h-7"
                                    title="Outline"
                                  >
                                    <Square className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={overlay.glow ? "default" : "outline"}
                                    onClick={() => updateTextOverlay(overlay.id, { glow: !overlay.glow })}
                                    className="text-xs px-2 py-1 h-7"
                                    title="Glow"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                  </Button>
                                  <div className="w-px bg-border mx-1"></div>
                                  <Button
                                    size="sm"
                                    variant={overlay.alignment === 'left' ? "default" : "outline"}
                                    onClick={() => updateTextOverlay(overlay.id, { alignment: 'left' })}
                                    className="text-xs px-2 py-1 h-7"
                                    title="Align Left"
                                  >
                                    <AlignLeft className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={overlay.alignment === 'center' ? "default" : "outline"}
                                    onClick={() => updateTextOverlay(overlay.id, { alignment: 'center' })}
                                    className="text-xs px-2 py-1 h-7"
                                    title="Align Center"
                                  >
                                    <AlignCenter className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={overlay.alignment === 'right' ? "default" : "outline"}
                                    onClick={() => updateTextOverlay(overlay.id, { alignment: 'right' })}
                                    className="text-xs px-2 py-1 h-7"
                                    title="Align Right"
                                  >
                                    <AlignRight className="w-3 h-3" />
                                  </Button>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                  <div className="flex items-center gap-1">
                                    <label className="text-xs text-muted-foreground">Size:</label>
                                    <input
                                      type="number"
                                      min="12"
                                      max="200"
                                      value={overlay.fontSize}
                                      onChange={(e) => updateTextOverlay(overlay.id, { fontSize: parseInt(e.target.value) || 24 })}
                                      className="w-12 px-1 py-0.5 text-xs bg-input text-foreground rounded border border-border focus:border-primary focus:outline-none"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <label className="text-xs text-muted-foreground">Text:</label>
                                    <input
                                      type="color"
                                      value={overlay.color}
                                      onChange={(e) => updateTextOverlay(overlay.id, { color: e.target.value })}
                                      className="w-8 h-7 rounded border border-border"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <label className="text-xs text-muted-foreground">Outline:</label>
                                    <input
                                      type="color"
                                      value={overlay.outlineColor}
                                      onChange={(e) => updateTextOverlay(overlay.id, { outlineColor: e.target.value })}
                                      className="w-6 h-6 rounded border border-border"
                                    />
                                    <input
                                      type="number"
                                      min="0.1"
                                      max="20"
                                      step="0.1"
                                      value={overlay.outlineWidth}
                                      onChange={(e) => updateTextOverlay(overlay.id, { outlineWidth: parseFloat(e.target.value) || 1.9 })}
                                      className="w-12 px-1 py-0.5 text-xs bg-input text-foreground rounded border border-border focus:border-primary focus:outline-none"
                                    />
                                  </div>
                                </div>


                                {overlay.glow && (
                                  <div className="flex items-center gap-1">
                                    <label className="text-xs text-muted-foreground">Glow:</label>
                                    <input
                                      type="color"
                                      value={overlay.glowColor}
                                      onChange={(e) => updateTextOverlay(overlay.id, { glowColor: e.target.value })}
                                      className="w-6 h-6 rounded border border-border"
                                    />
                                    <input
                                      type="number"
                                      min="1"
                                      max="50"
                                      value={overlay.glowIntensity}
                                      onChange={(e) => updateTextOverlay(overlay.id, { glowIntensity: parseInt(e.target.value) || 5 })}
                                      className="w-10 px-1 py-0.5 text-xs bg-input text-foreground rounded border border-border focus:border-primary focus:outline-none"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Text Templates Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-muted-foreground">Text Templates</h4>
                    <Button
                      onClick={() => setShowTemplates(!showTemplates)}
                      size="sm"
                      variant="outline"
                    >
                      {showTemplates ? 'Hide' : 'Show'} ({textTemplates.length})
                    </Button>
                  </div>

                  {showTemplates && (
                    <div className="space-y-3">
                      {textTemplates.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No saved templates yet</p>
                      ) : (
                        <div className="space-y-2">
                          {textTemplates.map((template: any) => (
                            <div
                              key={template.id}
                              className="p-3 rounded-lg border border-border bg-muted/50 hover:bg-muted/70 transition-colors"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium text-foreground">
                                      {template.name}
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                      Slide {template.slide_index + 1}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 truncate">
                                    "{template.text_content}"
                                  </p>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Button
                                    onClick={() => applyTextTemplate(template)}
                                    size="sm"
                                    variant="outline"
                                    className="text-xs px-2 py-1 h-6"
                                  >
                                    Apply
                                  </Button>
                                  <button
                                    onClick={() => deleteTextTemplate(template.id)}
                                    className="text-muted-foreground hover:text-destructive text-xs"
                                    title="Delete template"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Caption & Hashtags Only - Title & Post Title are handled in SlideshowManager */}
                <div className="space-y-4">
                  <div>
                    <label className="text-muted-foreground text-sm block mb-2">Caption</label>
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      className="w-full px-3 py-2 bg-input text-foreground rounded border border-border focus:border-primary focus:outline-none resize-none"
                      rows={3}
                      placeholder="Write your TikTok caption..."
                    />
                  </div>

                  <div>
                    <label className="text-muted-foreground text-sm block mb-2">Hashtags</label>

                    {/* Current hashtags as badges */}
                    {hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {hashtags.map((tag: string, index: number) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/20"
                          >
                            #{tag}
                            <button
                              onClick={() => removeHashtag(tag)}
                              className="ml-1 hover:text-destructive"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Add hashtag input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={hashtagInput}
                        onChange={(e) => setHashtagInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addHashtag()}
                        className="flex-1 px-3 py-2 bg-input text-foreground rounded border border-border focus:border-primary focus:outline-none"
                        placeholder="Add hashtag..."
                      />
                      <Button
                        onClick={addHashtag}
                        size="sm"
                        className="px-3"
                      >
                        Add
                      </Button>
                    </div>

                    {/* Save hashtags button */}
                    <div className="mt-2">
                      <Button
                        onClick={async () => {
                          if (!user) return;
                          try {
                            const hashtagsToSave = hashtags.filter(tag => !savedHashtags.includes(tag));
                            if (hashtagsToSave.length === 0) return;

                            const { error } = await supabase
                              .from('hashtags')
                              .upsert(
                                hashtagsToSave.map(tag => ({
                                  user_id: user.id,
                                  tag: tag,
                                  updated_at: new Date().toISOString()
                                }))
                              );

                            if (error) throw error;
                            await loadSavedHashtags();
                          } catch (error) {
                            console.error('Error saving hashtags:', error);
                          }
                        }}
                        size="sm"
                        className="w-full"
                        disabled={!user || hashtags.length === 0}
                      >
                        Save Hashtags
                      </Button>
                    </div>

                    {/* Saved hashtags */}
                    {savedHashtags.length > 0 && (
                      <div className="mt-2">
                        <label className="text-muted-foreground text-xs block mb-1">Saved hashtags:</label>
                        <div className="flex flex-wrap gap-1">
                          {savedHashtags.map((tag: string, index: number) => (
                            <div
                              key={index}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-secondary text-secondary-foreground border border-border group"
                            >
                              <button
                                onClick={() => {
                                  if (!hashtags.includes(tag)) {
                                    setHashtags((prev: string[]) => [...prev, tag]);
                                  }
                                }}
                                className="hover:text-primary"
                                title="Add to current hashtags"
                              >
                                #{tag}
                              </button>
                              <button
                                onClick={() => deleteSavedHashtag(tag)}
                                className="ml-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                                title="Remove from saved hashtags"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bulk Load Saved Hashtags Section */}
                    {savedHashtags.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <label className="text-muted-foreground text-xs block mb-2">Select & Load Multiple:</label>

                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {savedHashtags.map((tag: string, index: number) => (
                            <label
                              key={index}
                              className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-1 rounded"
                            >
                              <input
                                type="checkbox"
                                checked={selectedSavedHashtags.has(tag)}
                                onChange={() => toggleSavedHashtagSelection(tag)}
                                className="w-3 h-3 text-primary border-border rounded focus:ring-primary focus:ring-1"
                              />
                              <span className="text-sm text-foreground">#{tag}</span>
                            </label>
                          ))}
                        </div>

                        <Button
                          onClick={loadSelectedHashtags}
                          disabled={selectedSavedHashtags.size === 0}
                          size="sm"
                          className="w-full mt-3 bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          Load Selected Hashtags ({selectedSavedHashtags.size})
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Postiz API Settings */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-muted-foreground">Social Media Integration</h4>
                    <Button
                      onClick={() => setShowPostizSettings(!showPostizSettings)}
                      size="sm"
                      variant="outline"
                    >
                      {showPostizSettings ? 'Hide' : 'Show'} Settings
                    </Button>
                  </div>

                  {showPostizSettings && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-muted-foreground text-sm block mb-2">Postiz API Key</label>
                        <input
                          type="password"
                          value={postizApiKey}
                          onChange={(e) => setPostizApiKey(e.target.value)}
                          className="w-full px-3 py-2 bg-input text-foreground rounded border border-border focus:border-primary focus:outline-none"
                          placeholder="Enter your Postiz API key..."
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Get your API key from <a href="https://postiz.app" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Postiz</a>
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={savePostizApiKey}
                          disabled={isValidatingApiKey || !postizApiKey.trim()}
                          className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                          {isValidatingApiKey ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Validating...
                            </>
                          ) : (
                            <>
                              <Settings className="w-4 h-4 mr-2" />
                              Save API Key
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => setShowPostizSettings(false)}
                          variant="outline"
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </main>
        </SidebarInset>
      </div>

      {/* Notification Toast */}
      {notification.message && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right-5">
          <div className={cn(
            "px-4 py-2 rounded-lg shadow-lg border max-w-sm",
            notification.type === 'success'
              ? "bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-200 dark:border-green-800"
              : "bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800"
          )}>
            <div className="flex items-center space-x-2">
              {notification.type === 'success' && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <span className="text-sm font-medium">{notification.message}</span>
              <button
                onClick={() => setNotification({ message: '', type: null })}
                className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Editor Modal */}
      {editingImage && (
        <ImageEditor
          image={editingImage}
          onSave={(editedImage) => {
            const updatedImages = images.map((img: UploadedImage) =>
              img.id === editedImage.id ? editedImage : img
            );
            setImages(updatedImages);
            setEditingImage(null);
          }}
          onCancel={() => setEditingImage(null)}
        />
      )}

      {/* Postiz Poster Modal */}
      {showPostizPoster && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6">
              {currentSlideshow ? (
                <PostizPoster
                  slideshow={currentSlideshow}
                  onPostSuccess={(postId) => {
                    setNotification({ 
                      message: 'Slideshow posted to TikTok successfully!', 
                      type: 'success' 
                    });
                    setShowPostizPoster(false);
                  }}
                  onClose={() => setShowPostizPoster(false)}
                />
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-4">No slideshow selected</p>
                  <Button onClick={() => setShowPostizPoster(false)} variant="outline">
                    Close
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* URL Uploader Modal */}
      <UrlUploader
        isOpen={showUrlUploader}
        onClose={() => setShowUrlUploader(false)}
        onImagesUploaded={(newImages) => {
          // Merge new images with existing ones
          const updatedImages = [...images, ...newImages];
          setImages(updatedImages);
        }}
        currentFolderId={currentFolderId}
      />
    </SidebarProvider>
  );
};

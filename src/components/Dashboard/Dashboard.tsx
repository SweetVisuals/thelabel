import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Header1 as Header } from './Header';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { FileBrowser } from '../FileBrowser/FileBrowser';
import { TikTokPreview } from '../TikTokPreview/TikTokPreview';
import { UrlUploader } from '../Upload/UrlUploader';
import { UploadedImage, Folder, SlideshowMetadata, TikTokTextOverlay, SlideshowTemplate } from '../../types';
import { SettingsPanel } from './SettingsPanel';
import { cn } from '@/lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { PostizPoster } from '../Postiz/PostizPoster';
import { Toaster } from 'sonner';
import { BulkCreateFromTemplateModal, CreateTemplateModal } from '../Slideshow/TemplateManager';
import { BulkPostizPoster } from '../Postiz/BulkPostizPoster';
import { QueueViewer } from '../Postiz/QueueViewer';
import { toast } from 'sonner';
import { slideshowService } from '../../lib/slideshowService';
import { postizAPI } from '../../lib/postiz';
import { userService } from '../../lib/userService';
import { Folder as FolderIcon, Film as FilmIcon, Settings2 as SettingsIcon } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { folderId } = useParams<{ folderId?: string }>();

  // Data State
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);

  // Selection State
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedImagesOrdered, setSelectedImagesOrdered] = useState<string[]>([]);
  const [selectedSlideshows, setSelectedSlideshows] = useState<string[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<SlideshowTemplate[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(folderId || null);

  // Slideshow/Editor State
  const [currentSlideshow, setCurrentSlideshow] = useState<SlideshowMetadata | null>(null);

  // Clear current slideshow when selecting individual images to ensure instant preview
  useEffect(() => {
    if (selectedImages.length > 0 && selectedSlideshows.length === 0) {
      setCurrentSlideshow(null);
    }
  }, [selectedImages, selectedSlideshows]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [textOverlays, setTextOverlays] = useState<TikTokTextOverlay[]>([]);
  const [title, setTitle] = useState('Amazing TikTok Slideshow');
  const [postTitle, setPostTitle] = useState('');
  const [caption, setCaption] = useState('Your amazing TikTok slideshow! 🎉');
  const [hashtags, setHashtags] = useState(['tiktok', 'slideshow', 'viral']);
  const [savedHashtags, setSavedHashtags] = useState<string[]>([]);

  // Sync state when currentSlideshow changes
  useEffect(() => {
    if (currentSlideshow) {
      setTitle(currentSlideshow.title || '');
      setPostTitle(currentSlideshow.postTitle || currentSlideshow.title || '');
      setCaption(currentSlideshow.caption || '');
      setHashtags(currentSlideshow.hashtags || []);
      // If the slideshow has condensed slides (it's a generated slideshow), 
      // we don't want to load the text overlays into the editor state
      // because the text is already baked into the images.
      // This prevents duplicate text from showing in the preview.
      if (currentSlideshow.condensedSlides && currentSlideshow.condensedSlides.length > 0) {
        setTextOverlays([]);
      } else {
        setTextOverlays(currentSlideshow.textOverlays || []);
      }
      setAspectRatio(currentSlideshow.aspectRatio || '9:16');
      setTransitionEffect(currentSlideshow.transitionEffect || 'fade');
      setMusicEnabled(currentSlideshow.musicEnabled || false);
    }
  }, [currentSlideshow]);

  // Settings State
  const [transitionEffect, setTransitionEffect] = useState<'fade' | 'slide' | 'zoom'>('fade');
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  const [apiKeys, setApiKeys] = useState({
    postizApiKey: postizAPI.getApiKey() || '',
    tiktokAccessToken: ''
  });
  const [selectedTemplate, setSelectedTemplate] = useState('modern');

  // Load user settings (API Key) from DB
  useEffect(() => {
    const loadUserSettings = async () => {
      if (user) {
        const apiKey = await userService.getPostizApiKey(user.id);
        if (apiKey) {
          // Only update if different to avoid unnecessary re-renders/saves
          setApiKeys(prev => {
            if (prev.postizApiKey !== apiKey) {
              postizAPI.setApiKey(apiKey); // Sync to localStorage
              return { ...prev, postizApiKey: apiKey };
            }
            return prev;
          });
        }
      }
    };
    loadUserSettings();
  }, [user]);

  // Persist Postiz API Key to DB and LocalStorage
  useEffect(() => {
    if (apiKeys.postizApiKey) {
      postizAPI.setApiKey(apiKeys.postizApiKey);

      // Debounce save to DB
      const timer = setTimeout(() => {
        if (user) {
          userService.updatePostizApiKey(user.id, apiKeys.postizApiKey);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [apiKeys.postizApiKey, user]);

  // UI State
  const [showSettingsPanel, setShowSettingsPanel] = useState(true);
  const [showPostizPoster, setShowPostizPoster] = useState(false);
  const [showUrlUploader, setShowUrlUploader] = useState(false);
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false);
  const [showBulkPostModal, setShowBulkPostModal] = useState(false);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [showQueueViewer, setShowQueueViewer] = useState(false);

  const [slideshowsForBulkPost, setSlideshowsForBulkPost] = useState<SlideshowMetadata[]>([]);
  const [activeMobileTab, setActiveMobileTab] = useState<'files' | 'preview' | 'settings'>('files');

  const handleCreateFromTemplate = () => {
    setShowBulkCreateModal(true);
  };

  const handleBulkPost = () => {
    if (selectedSlideshows.length === 0) {
      toast.error('Please select slideshows to post');
      return;
    }
    const allSlideshows = slideshowService.getAllSlideshows();
    const selected = allSlideshows.filter(s => selectedSlideshows.includes(s.id));
    setSlideshowsForBulkPost(selected);
    setShowBulkPostModal(true);
  };

  const handleCreateTemplate = async (name: string, description: string) => {
    if (!user) return;
    try {
      if (currentSlideshow) {
        await slideshowService.createTemplateFromSlideshow(name, description, currentSlideshow, user.id);
      } else {
        const tempSlideshow: SlideshowMetadata = {
          id: `temp_${Date.now()}`,
          title: title,
          postTitle: postTitle || title,
          caption: caption,
          hashtags: hashtags,
          condensedSlides: [{}, {}, {}] as any,
          textOverlays: textOverlays || [],
          aspectRatio: aspectRatio || '9:16',
          transitionEffect: transitionEffect || 'fade',
          musicEnabled: musicEnabled || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_id: user.id,
          folder_id: null
        };
        await slideshowService.createTemplateFromSlideshow(name, description, tempSlideshow, user.id);
      }
      toast.success('Template created successfully!');
      await loadUserSlideshows(); // Reload templates
      setShowCreateTemplateModal(false);
    } catch (error) {
      console.error('Failed to create template:', error);
      toast.error('Failed to create template');
    }
  };

  // Update currentFolderId when URL param changes
  useEffect(() => {
    setCurrentFolderId(folderId || null);
  }, [folderId]);

  // Load initial data
  useEffect(() => {
    if (user) {
      loadSavedHashtags();
      loadUserSlideshows();
    }
  }, [user]);

  const loadUserSlideshows = async () => {
    if (!user) return;
    try {
      const { slideshowService } = await import('../../lib/slideshowService');
      await slideshowService.loadUserSlideshows(user.id);
      await slideshowService.loadUserTemplates(user.id);
      const templates = slideshowService.getSavedTemplates(user.id);
      setSavedTemplates(templates);
    } catch (error) {
      console.error('Error loading user slideshows/templates:', error);
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

  const handleAddHashtag = async (tag: string) => {
    if (!user) return;
    if (hashtags.includes(tag)) return;

    setHashtags([...hashtags, tag]);

    // Save to library if not exists
    if (!savedHashtags.includes(tag)) {
      try {
        const { error } = await supabase
          .from('hashtags')
          .upsert({
            user_id: user.id,
            tag: tag,
            updated_at: new Date().toISOString()
          });
        if (!error) {
          setSavedHashtags([...savedHashtags, tag]);
        }
      } catch (error) {
        console.error('Error saving hashtag:', error);
      }
    }
  };

  // Text Overlay Handlers
  const handleAddTextOverlay = () => {
    const newText: TikTokTextOverlay = {
      id: Math.random().toString(36).substr(2, 9),
      slideIndex: currentSlide,
      text: 'New Text',
      x: 50,
      y: 50,
      width: 60,
      height: 15,
      fontSize: 24,
      color: '#ffffff',
      fontFamily: 'TikTok Sans',
      fontWeight: '700',
      alignment: 'center',
      outlineColor: '#000000',
      outlineWidth: 2,
      outlinePosition: 'outer',
      bold: true,
      italic: false,
      outline: true,
      glow: false,
      glowColor: '#ffffff',
      glowIntensity: 5,
    };
    setTextOverlays([...textOverlays, newText]);
  };

  const handleUpdateTextOverlay = (id: string, updates: Partial<TikTokTextOverlay>) => {
    setTextOverlays(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleRemoveTextOverlay = (id: string) => {
    setTextOverlays(prev => prev.filter(t => t.id !== id));
  };

  // Slideshow Handlers
  const handleSaveSlideshow = async () => {
    if (!user) return;
    console.log('Saving slideshow...');
    // Implementation would go here
  };

  const handlePostToTikTok = () => {
    if (selectedImages.length > 0 || currentSlideshow) {
      setShowPostizPoster(true);
    } else {
      // toast.error('Please select images or a slideshow first');
    }
  };

  // Navigation & Path
  const getFolderPath = (folderId: string | null, allFolders: Folder[]) => {
    const path: { id: string; name: string }[] = [];
    let current: Folder | undefined = allFolders.find(f => f.id === folderId);

    while (current) {
      const folder = current;
      path.unshift({ id: folder.id, name: folder.name });
      const nextFolder = folder.parent_id ? allFolders.find(f => f.id === folder.parent_id) : undefined;
      current = nextFolder;
    }
    return path;
  };

  const folderPath = useMemo(() => getFolderPath(currentFolderId, folders), [currentFolderId, folders]);

  // Helper: Get images for current folder context
  const getCurrentImages = () => {
    if (currentFolderId === null) {
      return images; // Root level images
    } else {
      const currentFolder = folders.find(f => f.id === currentFolderId);
      return currentFolder ? currentFolder.images : [];
    }
  };

  const derivedCurrentImages = useMemo(() => getCurrentImages(), [currentFolderId, images, folders]);

  // Helper: Filter selected images to only include those from current folder
  const getCurrentSelectedImages = () => {
    const currentImageIds = derivedCurrentImages.map(img => img.id);
    const filtered = selectedImages.filter(id => currentImageIds.includes(id));
    return filtered;
  };

  const currentSelectedImages = getCurrentSelectedImages();

  // Sync selection when folder changes
  useEffect(() => {
    const currentImageIds = new Set(derivedCurrentImages.map(img => img.id));
    const validSelectionIds = selectedImagesOrdered.filter(id => currentImageIds.has(id));

    if (validSelectionIds.length !== selectedImagesOrdered.length) {
      setSelectedImages(validSelectionIds);
    }
  }, [currentFolderId, derivedCurrentImages]);

  // Event Listener for Selection Order
  const handleSelectionOrderChange = (event: CustomEvent<string[]>) => {
    setSelectedImagesOrdered(event.detail);
  };

  useEffect(() => {
    window.addEventListener('selectionOrderChange', handleSelectionOrderChange as EventListener);
    return () => {
      window.removeEventListener('selectionOrderChange', handleSelectionOrderChange as EventListener);
    };
  }, []);

  // Handle Header Actions
  const handleItemClick = (action: string) => {
    switch (action) {
      case 'upload':
        setShowUrlUploader(true);
        break;
      case 'settings':
        setShowSettingsPanel(!showSettingsPanel);
        break;
      case 'queue':
        setShowQueueViewer(true);
        break;
      default:
        console.log('Unknown action:', action);
    }
  };

  return (
    <ThemeProvider>
      <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
        {/* Topbar */}
        <Header
          path={folderPath}
          onNavigateToFolder={setCurrentFolderId}
          onAction={handleItemClick}
        />

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Left: File Browser */}
          <div className={cn(
            "flex-1 flex flex-col min-w-0 bg-background/50 backdrop-blur-sm border-r border-white/10",
            activeMobileTab === 'files' ? 'flex' : 'hidden xl:flex'
          )}>
            <FileBrowser
              images={images}
              onImagesUploaded={setImages}
              selectedImages={selectedImages}
              onSelectionChange={(ids) => {
                setSelectedImages(ids);
                setSelectedImagesOrdered(ids);
              }}
              selectedSlideshows={selectedSlideshows}
              onSlideshowSelectionChange={setSelectedSlideshows}
              folders={folders}
              onFoldersChange={setFolders}
              currentFolderId={currentFolderId}
              onCurrentFolderIdChange={setCurrentFolderId}
              onSlideshowLoad={setCurrentSlideshow}
              onCreateFromTemplate={handleCreateFromTemplate}
              onBulkPost={handleBulkPost}
            />
          </div>

          {/* Middle: TikTok Preview */}
          <div className={cn(
            "flex flex-col min-w-0 bg-black/40 backdrop-blur-sm border-r border-white/10",
            "w-full xl:w-[500px]",
            activeMobileTab === 'preview' ? 'flex' : 'hidden xl:flex'
          )}>
            <TikTokPreview
              images={derivedCurrentImages}
              selectedImages={currentSelectedImages}
              textOverlays={textOverlays}
              title={title}
              postTitle={postTitle}
              caption={caption}
              hashtags={hashtags}
              transitionEffect={transitionEffect}
              musicEnabled={musicEnabled}
              aspectRatio={aspectRatio}
              previewMode={!!currentSlideshow}
              onTextOverlaysChange={setTextOverlays}
              onTitleChange={setTitle}
              onPostTitleChange={setPostTitle}
              onCaptionChange={setCaption}
              onHashtagsChange={setHashtags}
              onTransitionEffectChange={setTransitionEffect}
              onMusicEnabledChange={setMusicEnabled}
              onAspectRatioChange={setAspectRatio}
              onCurrentSlideChange={setCurrentSlide}
              onImagesUpdate={(updatedImages) => {
                // Handle image updates logic
                if (currentFolderId === null) {
                  const newImagesArray = [...updatedImages];
                  const otherImages = images.filter(img => !updatedImages.some(updated => updated.id === img.id));
                  setImages([...otherImages, ...newImagesArray]);
                } else {
                  const updatedFolders = folders.map(f => {
                    if (f.id === currentFolderId) {
                      const folderImageIds = new Set(updatedImages.map(img => img.id));
                      const otherFolderImages = f.images.filter(img => !folderImageIds.has(img.id));
                      return { ...f, images: [...otherFolderImages, ...updatedImages] };
                    }
                    return f;
                  });
                  setFolders(updatedFolders);
                }
              }}
              onSelectionOrderChange={setSelectedImagesOrdered}
              currentSlideshow={currentSlideshow}
            />
          </div>

          {/* Right: Settings Panel */}
          <div className={cn(
            "transition-all duration-300 ease-in-out bg-card/30 backdrop-blur-md",
            showSettingsPanel ? "xl:w-[500px] xl:translate-x-0" : "xl:w-0 xl:translate-x-full xl:opacity-0 xl:overflow-hidden",
            activeMobileTab === 'settings' ? "w-full translate-x-0 block" : "hidden xl:block"
          )}>
            <SettingsPanel
              title={title}
              setTitle={setTitle}
              postTitle={postTitle}
              setPostTitle={setPostTitle}
              caption={caption}
              setCaption={setCaption}
              hashtags={hashtags}
              setHashtags={setHashtags}
              textOverlays={textOverlays}
              setTextOverlays={setTextOverlays}

              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              onSaveSlideshow={handleSaveSlideshow}
              onPostToTikTok={handlePostToTikTok}
              onAddTextOverlay={handleAddTextOverlay}
              onRemoveTextOverlay={handleRemoveTextOverlay}
              onUpdateTextOverlay={handleUpdateTextOverlay}
              savedHashtags={savedHashtags}
              onAddHashtag={handleAddHashtag}
              selectedImagesCount={selectedImages.length}
              apiKeys={apiKeys}
              setApiKeys={setApiKeys}
              selectedTemplate={selectedTemplate}
              setSelectedTemplate={setSelectedTemplate}
              savedTemplates={savedTemplates}
              onLoadTemplate={(template) => {
                setCurrentSlideshow({
                  ...template,
                  id: `slideshow_${Date.now()}`, // Create new ID for the slideshow
                  textOverlays: template.textOverlays.map(o => ({ ...o, id: `overlay_${Date.now()}_${Math.random()}` })),
                  condensedSlides: []
                } as SlideshowMetadata);
                setTitle(template.title);
                setPostTitle(template.postTitle || template.title);
                setCaption(template.caption);
                setHashtags(template.hashtags);
                setTextOverlays(template.textOverlays);
                setAspectRatio(template.aspectRatio);
                setTransitionEffect(template.transitionEffect);
                setMusicEnabled(template.musicEnabled);
                setSelectedTemplate(template.id);
              }}
              onSaveTemplate={() => setShowCreateTemplateModal(true)}
            />
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="xl:hidden bg-black/80 backdrop-blur-lg border-t border-white/10 p-2 flex justify-around items-center z-50 shrink-0 safe-area-bottom">
          <button
            onClick={() => setActiveMobileTab('files')}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
              activeMobileTab === 'files' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-white'
            )}
          >
            <FolderIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium">Files</span>
          </button>
          <button
            onClick={() => setActiveMobileTab('preview')}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
              activeMobileTab === 'preview' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-white'
            )}
          >
            <FilmIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium">Preview</span>
          </button>
          <button
            onClick={() => setActiveMobileTab('settings')}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
              activeMobileTab === 'settings' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-white'
            )}
          >
            <SettingsIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium">Settings</span>
          </button>
        </div>

        {/* Modals & Overlays */}
        {showUrlUploader && (
          <UrlUploader
            isOpen={showUrlUploader}
            onClose={() => setShowUrlUploader(false)}
            onImagesUploaded={(newImages) => {
              setImages([...images, ...newImages]);
              setShowUrlUploader(false);
            }}
            currentFolderId={currentFolderId}
          />
        )}

        {showPostizPoster && (
          <PostizPoster
            onClose={() => setShowPostizPoster(false)}
            slideshow={currentSlideshow}
          />
        )}

        {showBulkCreateModal && (
          <BulkCreateFromTemplateModal
            isOpen={showBulkCreateModal}
            onClose={() => setShowBulkCreateModal(false)}
            templates={savedTemplates}
            uploadedImages={derivedCurrentImages}
            selectedImageIds={currentSelectedImages}
            onBulkCreate={async (templateId, options, imagesToUse, onProgress) => {
              try {
                const template = savedTemplates.find(t => t.id === templateId);
                if (!template) {
                  return {
                    success: false,
                    slideshows: [],
                    error: 'Template not found',
                    slideshowCount: 0,
                    totalImages: 0
                  };
                }

                const result = await slideshowService.createBulkSlideshowsFromTemplate(
                  template,
                  imagesToUse,
                  user?.id || '',
                  options,
                  onProgress
                );

                if (result.success) {
                  // Trigger refresh
                  await loadUserSlideshows();
                  window.dispatchEvent(new CustomEvent('slideshowUpdated'));
                }

                return result;
              } catch (error) {
                console.error('Error in bulk create:', error);
                return {
                  success: false,
                  slideshows: [],
                  error: error instanceof Error ? error.message : 'Unknown error',
                  slideshowCount: 0,
                  totalImages: 0
                };
              }
            }}
          />
        )}

        {showBulkPostModal && (
          <BulkPostizPoster
            slideshows={slideshowsForBulkPost}
            onClose={() => setShowBulkPostModal(false)}
            onPostSuccess={(postIds) => {
              toast.success(`Successfully posted ${postIds.length} slideshows!`);
              setShowBulkPostModal(false);
            }}
          />
        )}

        {showCreateTemplateModal && (
          <CreateTemplateModal
            isOpen={showCreateTemplateModal}
            slideshow={currentSlideshow || null}
            onClose={() => setShowCreateTemplateModal(false)}
            onSave={handleCreateTemplate}
          />
        )}

        {showQueueViewer && (
          <QueueViewer onClose={() => setShowQueueViewer(false)} />
        )}

        <Toaster />
      </div>
    </ThemeProvider >
  );
};

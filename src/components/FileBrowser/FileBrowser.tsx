import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  FileImage,
  Upload,
  X,
  CheckSquare,
  Square,
  MoreVertical,
  Edit3,
  Trash2,
  Copy,
  Move,
  Grid3X3,
  List,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  MousePointer,
  RectangleHorizontal,
  Lasso,
  FolderPlus,
  FilePlus,
  Download,
  Share,
  Star,
  Tag,
  Eye,
  EyeOff,
  Crop,
  FolderIcon,
  Pencil,
  Play,
  Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UploadedImage, Folder, SlideshowMetadata } from '@/types';
import { ImageEditor } from '../ImageEditor/ImageEditor';
import { motion, AnimatePresence } from 'framer-motion';
import { imageService } from '@/lib/imageService';
import { slideshowService } from '@/lib/slideshowService';
import { toast } from 'sonner';
import { PostizPoster } from '../Postiz/PostizPoster';
import { BulkPostizPoster } from '../Postiz/BulkPostizPoster';
import { TemplateSelectionDialog } from './TemplateSelectionDialog';

interface FileBrowserProps {
  images: UploadedImage[];
  onImagesUploaded: (images: UploadedImage[]) => void;
  selectedImages: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  selectedSlideshows?: string[];
  onSlideshowSelectionChange?: (selectedIds: string[]) => void;
  folders?: Folder[];
  onFoldersChange?: (folders: Folder[]) => void;
  currentFolderId?: string | null;
  onCurrentFolderIdChange?: (folderId: string | null) => void;
  onNavigateUp?: () => void;
  onSlideshowLoad?: (slideshow: SlideshowMetadata) => void;
  onSlideshowUnload?: () => void;
  cutLength?: number;
  onCutLengthChange?: (cutLength: number) => void;
}

interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder' | 'slideshow';
  size?: number;
  modified?: Date;
  image?: UploadedImage;
  slideshow?: SlideshowMetadata;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({
  images,
  onImagesUploaded,
  selectedImages,
  onSelectionChange,
  selectedSlideshows = [],
  onSlideshowSelectionChange,
  folders = [],
  onFoldersChange,
  currentFolderId: externalCurrentFolderId,
  onCurrentFolderIdChange,
  onNavigateUp,
  onSlideshowLoad,
  onSlideshowUnload,
  cutLength = 5,
  onCutLengthChange,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [editingImage, setEditingImage] = useState<UploadedImage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: string[]; type: 'general' | 'folder' | 'slideshow'; targetId?: string } | null>(null);
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameInputValue, setRenameInputValue] = useState('');
  const [renamingSlideshowId, setRenamingSlideshowId] = useState<string | null>(null);
  const [renameSlideshowInputValue, setRenameSlideshowInputValue] = useState('');
  const [showPostizPoster, setShowPostizPoster] = useState(false);
  const [slideshowToPost, setSlideshowToPost] = useState<SlideshowMetadata | null>(null);
  const [showBulkPostizPoster, setShowBulkPostizPoster] = useState(false);
  const [bulkSlideshowsToPost, setBulkSlideshowsToPost] = useState<SlideshowMetadata[]>([]);
  const [isCreatingFromTemplate, setIsCreatingFromTemplate] = useState(false);
  const [showTemplateSelectionDialog, setShowTemplateSelectionDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileTileRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Use external currentFolderId
  const currentFolderId = externalCurrentFolderId;

  // Debugging: Log changes to images and folders props
  useEffect(() => {
    console.log('🔄 FileBrowser props updated:', {
      imagesCount: images.length,
      foldersCount: folders.length,
      currentFolderId,
    });
  }, [images, folders, currentFolderId]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [loadedImages, loadedFolders] = await Promise.all([
          imageService.loadImages(),
          imageService.loadFolders(),
        ]);
        onImagesUploaded(loadedImages);
        onFoldersChange?.(loadedFolders);
        console.log('✅ Initial data loaded:', { loadedImagesCount: loadedImages.length, loadedFoldersCount: loadedFolders.length });
      } catch (error) {
        console.error('❌ Failed to load data:', error);
        onImagesUploaded([]);
        onFoldersChange?.([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []); // Load data once on mount

  // Force re-render when slideshows change (triggered by saving)
  const [, forceUpdate] = useState({});
  const triggerReRender = useCallback(() => {
    console.log('🔄 Triggering FileBrowser re-render due to slideshow update.');
    forceUpdate({});
  }, []);

  // Listen for slideshow changes in localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'savedSlideshows') {
        triggerReRender();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom slideshow update events
    const handleSlideshowUpdate = () => {
      triggerReRender();
    };

    window.addEventListener('slideshowUpdated', handleSlideshowUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('slideshowUpdated', handleSlideshowUpdate);
    };
  }, [triggerReRender]);

  // Load slideshows from service on mount and ensure proper sync
  useEffect(() => {
    const loadSlideshows = async () => {
      try {
        // Load from localStorage to ensure we have the latest data
        slideshowService.loadFromLocalStorage();
        
        // Force a re-render to show slideshow files
        triggerReRender();
      } catch (error) {
        console.error('Failed to load slideshows:', error);
      }
    };

    loadSlideshows();
  }, [triggerReRender]);

  // Get slideshows from service instead of directly from localStorage
  const getSlideshowsFromService = () => {
    try {
      // Load slideshows from the service to ensure fresh data
      slideshowService.loadFromLocalStorage();
      
      // Get slideshows directly from memory
      const allSlideshows = Array.from((slideshowService as any)['slideshows'].values());
      
      console.log('📊 Loading slideshows from service:', {
        total: allSlideshows.length,
        currentFolderId,
        slideshowsWithFolderId: allSlideshows.filter((s: any) => s.folder_id).length
      });
      
      // Filter slideshows by current folder for proper folder display
      const filteredSlideshows = currentFolderId === null
        ? allSlideshows.filter((slideshow: any) => !slideshow.folder_id)
        : allSlideshows.filter((slideshow: any) => slideshow.folder_id === currentFolderId);
      
      console.log('📁 Filtered slideshows for current folder:', {
        currentFolderId,
        filteredCount: filteredSlideshows.length,
        slideshowTitles: filteredSlideshows.map((s: any) => s.title)
      });
      
      return filteredSlideshows.map((slideshow: any) => {
        return {
          id: slideshow.id,
          name: `${slideshow.title || 'Untitled'}.slideshow`,
          type: 'slideshow' as const,
          modified: new Date(slideshow.updated_at || slideshow.created_at || Date.now()),
          slideshow: slideshow,
        };
      });
    } catch (error) {
      console.error('❌ Failed to get slideshows from service:', error);
      return [];
    }
  };

  const handleFolderClick = (folderId: string) => {
    if (onCurrentFolderIdChange) {
      onCurrentFolderIdChange(folderId);
    }
  };

  const currentFolder = folders.find(f => f.id === currentFolderId);
  const currentImages = currentFolder ? currentFolder.images : images.filter(img =>
    !folders.some(f => f.images.some(fImg => fImg.id === img.id))
  );


  const fileItems: FileItem[] = [
    ...folders
      .filter(f => f.parent_id === currentFolderId)
      .map(folder => ({
        id: folder.id,
        name: folder.name,
        type: 'folder' as const,
        modified: new Date(folder.created_at),
      })),
    ...currentImages.map(img => ({
      id: img.id,
      name: img.file.name,
      type: 'file' as const,
      size: img.file.size,
      modified: new Date(img.file.lastModified),
      image: img,
    })),
    // Add slideshow files from service (loaded in memory)
    ...getSlideshowsFromService()
  ];

  const filteredAndSortedItems = [...fileItems]
    .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      // Sort by type: folders first, then slideshows, then files
      const typeOrder = { folder: 0, slideshow: 1, file: 2 };
      const aOrder = typeOrder[a.type];
      const bOrder = typeOrder[b.type];
      if (aOrder !== bOrder) return aOrder - bOrder;

      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = (a.modified?.getTime() || 0) - (b.modified?.getTime() || 0);
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });


  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Separate slideshow files from image files
    const slideshowFiles = files.filter(file => file.name.endsWith('.slideshow'));
    const imageFiles = files.filter(file => !file.name.endsWith('.slideshow'));

    // Handle slideshow files
    if (slideshowFiles.length > 0) {
      for (const file of slideshowFiles) {
        try {
          const { slideshowService } = await import('@/lib/slideshowService');
          const slideshow = await slideshowService.loadSlideshowFromFile(file);
          if (onSlideshowLoad) {
            onSlideshowLoad(slideshow);
            toast.success(`Loaded slideshow: ${slideshow.title}`);
          }
        } catch (error) {
          console.error('Failed to load slideshow:', error);
          toast.error(`Failed to load slideshow: ${file.name}`);
        }
      }
    }

    // Handle image files
    if (imageFiles.length > 0) {
      const uploadPromise = new Promise<UploadedImage[]>(async (resolve, reject) => {
        try {
          const uploadPromises = imageFiles.map(file => imageService.uploadImage(file, currentFolderId || undefined));
          const newImages = await Promise.all(uploadPromises);
          onImagesUploaded([...images, ...newImages]);
          resolve(newImages);
        } catch (error) {
          reject(error);
        }
      });

      toast.promise(uploadPromise, {
        loading: `Uploading ${imageFiles.length} images...`,
        success: (newImages) => `Successfully uploaded ${newImages.length} images!`,
        error: 'Upload failed. Please try again.',
      });
    }

    if (e.target) e.target.value = '';
  };

  // State for tracking modifier keys
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const [shiftPressed, setShiftPressed] = useState(false);

  // Track modifier key state and handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) setCtrlPressed(true);
      if (e.shiftKey) setShiftPressed(true);
      
      // Handle Delete key for bulk operations
      if (e.key === 'Delete') {
        const hasSelectedItems = selectedImages.length > 0 || selectedSlideshows.length > 0;
        if (hasSelectedItems) {
          e.preventDefault();
          removeSelected();
        }
      }
      
      // Handle Ctrl+A for select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) setCtrlPressed(false);
      if (!e.shiftKey) setShiftPressed(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedImages, selectedSlideshows]);

  const toggleSelection = (id: string) => {
    const item = filteredAndSortedItems.find(item => item.id === id);
    if (!item || (item.type !== 'file' && item.type !== 'slideshow')) return;

    // Handle slideshow selection differently
    if (item.type === 'slideshow') {
      if (onSlideshowSelectionChange) {
        // Use dedicated slideshow selection state
        const wasSelected = selectedSlideshows.includes(id);
        const newSelection = wasSelected
          ? selectedSlideshows.filter(sid => sid !== id)
          : [...selectedSlideshows, id];
        onSlideshowSelectionChange(newSelection);
        
        // If we're deselecting a slideshow, unload it from TikTok preview
        if (wasSelected && onSlideshowUnload) {
          onSlideshowUnload();
        }
      } else {
        // Fallback to original behavior for images
        const wasSelected = selectedImages.includes(id);
        const isDeselecting = wasSelected && item.type === 'slideshow';
        
        const newSelection = selectedImages.includes(id)
          ? selectedImages.filter(sid => sid !== id)
          : [...selectedImages, id];
        onSelectionChange(newSelection);
        
        // If we're deselecting a slideshow, unload it from TikTok preview
        if (isDeselecting && onSlideshowUnload) {
          onSlideshowUnload();
        }
      }
    } else {
      // Handle image selection
      if (shiftPressed) {
        // Shift+click: select range
        const allSelectableIds = filteredAndSortedItems
          .filter(item => item.type === 'file' || item.type === 'slideshow')
          .map(item => item.id);

        const currentIndex = allSelectableIds.indexOf(id);
        const lastSelectedIndex = selectedImages.length > 0 ?
          Math.max(...selectedImages.map(sid => allSelectableIds.indexOf(sid))) : currentIndex;

        const startIndex = Math.min(currentIndex, lastSelectedIndex);
        const endIndex = Math.max(currentIndex, lastSelectedIndex);

        const rangeIds = allSelectableIds.slice(startIndex, endIndex + 1);
        const newSelection = Array.from(new Set([...selectedImages, ...rangeIds]));
        onSelectionChange(newSelection);
      } else if (ctrlPressed) {
        // Ctrl/Cmd+click: toggle individual selection
        const newSelection = selectedImages.includes(id)
          ? selectedImages.filter(sid => sid !== id)
          : [...selectedImages, id];
        onSelectionChange(newSelection);
      } else {
        // Regular click: toggle selection (select if not selected, deselect if selected)
        const newSelection = selectedImages.includes(id)
          ? selectedImages.filter(sid => sid !== id)
          : [...selectedImages, id];
        onSelectionChange(newSelection);
      }
    }
  };

  const selectAll = () => {
    // Handle images and slideshows separately
    const imageIds = filteredAndSortedItems.filter(item => item.type === 'file').map(item => item.id);
    const slideshowIds = filteredAndSortedItems.filter(item => item.type === 'slideshow').map(item => item.id);
    
    // Check if we have any images or slideshows
    if (imageIds.length === 0 && slideshowIds.length === 0) return;
    
    // Toggle selection for images
    if (imageIds.length > 0) {
      const allImagesSelected = imageIds.every(id => selectedImages.includes(id));
      if (allImagesSelected) {
        onSelectionChange(selectedImages.filter(id => !imageIds.includes(id)));
      } else {
        onSelectionChange([...new Set([...selectedImages, ...imageIds])]);
      }
    }
    
    // Toggle selection for slideshows  
    if (slideshowIds.length > 0 && onSlideshowSelectionChange) {
      const allSlideshowsSelected = slideshowIds.every(id => selectedSlideshows.includes(id));
      if (allSlideshowsSelected) {
        onSlideshowSelectionChange(selectedSlideshows.filter(id => !slideshowIds.includes(id)));
      } else {
        onSlideshowSelectionChange([...new Set([...selectedSlideshows, ...slideshowIds])]);
      }
    }
  };

  const handleSlideshowClick = async (slideshow: SlideshowMetadata) => {
    if (onSlideshowLoad) {
      try {
        // If slideshow data is incomplete or null, try to load from file data
        let loadedSlideshow = slideshow;
        
        if (!slideshow || !slideshow.id || !slideshow.title) {
          // Try to get the file data and load it
          const fileKey = `slideshow_file_${slideshow?.id}`;
          const fileData = localStorage.getItem(fileKey);
          if (fileData) {
            const fileObj = JSON.parse(fileData);
            loadedSlideshow = await slideshowService.loadSlideshowFromFileData(fileObj.blob);
          }
        }

        if (loadedSlideshow) {
          onSlideshowLoad(loadedSlideshow);
        } else {
          console.error('Failed to load slideshow data');
        }
      } catch (error) {
        console.error('Error loading slideshow:', error);
      }
    }
  };

  const handleSlideshowClickFromId = async (slideshowId: string) => {
    if (onSlideshowLoad) {
      try {
        const slideshow = await slideshowService.loadSlideshow(slideshowId);
        if (slideshow) {
          onSlideshowLoad(slideshow);
          toast.success(`Loaded slideshow: ${slideshow.title}`);
        } else {
          toast.error('Failed to load slideshow');
        }
      } catch (error) {
        console.error('Error loading slideshow:', error);
        toast.error('Failed to load slideshow');
      }
    }
  };

  const handleSlideshowContextMenu = (slideshowId: string, x: number, y: number) => {
    const items = selectedSlideshows.length > 1
      ? ['Load', 'Open', 'Unload', 'Post Multiple to TikTok', 'Rename', 'Delete']
      : ['Load', 'Open', 'Unload', 'Post to TikTok', 'Rename', 'Delete'];
    setContextMenu({
      x,
      y,
      items,
      type: 'slideshow',
      targetId: slideshowId
    });
  };

  const handlePostSlideshowToTikTok = async (slideshowId: string) => {
    try {
      // Load the slideshow
      const slideshow = await slideshowService.loadSlideshow(slideshowId);
      if (slideshow) {
        setSlideshowToPost(slideshow);
        setShowPostizPoster(true);
        toast.success(`Ready to post: ${slideshow.title}`);
      } else {
        toast.error('Failed to load slideshow for posting');
      }
    } catch (error) {
      console.error('Error loading slideshow for posting:', error);
      toast.error('Failed to load slideshow for posting');
    }
  };

  const handleBulkPostSlideshowsToTikTok = async () => {
    if (selectedSlideshows.length === 0) return;
    
    try {
      // Load all selected slideshows
      const slideshowPromises = selectedSlideshows.map(id => slideshowService.loadSlideshow(id));
      const slideshows = await Promise.all(slideshowPromises);
      
      // Filter out any that failed to load
      const validSlideshows = slideshows.filter(slideshow => slideshow !== null) as SlideshowMetadata[];
      
      if (validSlideshows.length === 0) {
        toast.error('Failed to load any slideshows for posting');
        return;
      }
      
      if (validSlideshows.length < selectedSlideshows.length) {
        toast.warning(`Loaded ${validSlideshows.length}/${selectedSlideshows.length} slideshows`);
      }
      
      setBulkSlideshowsToPost(validSlideshows);
      setShowBulkPostizPoster(true);
      toast.success(`Ready to post ${validSlideshows.length} slideshow(s)`);
    } catch (error) {
      console.error('Error loading slideshows for bulk posting:', error);
      toast.error('Failed to load slideshows for posting');
    }
  };
  const removeSelected = async () => {
    if (selectedImages.length === 0 && selectedSlideshows.length === 0) return;
    
    const imageCount = selectedImages.length;
    const slideshowCount = selectedSlideshows.length;
    const totalCount = imageCount + slideshowCount;
    
    // Create confirmation message
    let confirmMessage = '';
    if (imageCount > 0 && slideshowCount > 0) {
      confirmMessage = `Are you sure you want to delete ${imageCount} image${imageCount !== 1 ? 's' : ''} and ${slideshowCount} slideshow${slideshowCount !== 1 ? 's' : ''}? This action cannot be undone.`;
    } else if (imageCount > 0) {
      confirmMessage = `Are you sure you want to delete ${imageCount} image${imageCount !== 1 ? 's' : ''}? This action cannot be undone.`;
    } else {
      confirmMessage = `Are you sure you want to delete ${slideshowCount} slideshow${slideshowCount !== 1 ? 's' : ''}? This action cannot be undone.`;
    }
    
    // Show confirmation dialog
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
const deletePromise = new Promise<void>(async (resolve, reject) => {
  try {
    const deletePromises = [];
    const errors: string[] = [];
    
    // Delete images
    if (imageCount > 0) {
      const imageDeletePromises = selectedImages.map(async (id) => {
        try {
          await imageService.deleteImage(id);
        } catch (error) {
          errors.push(`Failed to delete image: ${error}`);
          console.error('Failed to delete image:', id, error);
        }
      });
      deletePromises.push(...imageDeletePromises);
    }
    
    // Delete slideshows
    if (slideshowCount > 0) {
      const slideshowDeletePromises = selectedSlideshows.map(async (id) => {
        try {
          await slideshowService.deleteSlideshow(id);
        } catch (error) {
          errors.push(`Failed to delete slideshow: ${error}`);
          console.error('Failed to delete slideshow:', id, error);
        }
      });
      deletePromises.push(...slideshowDeletePromises);
    }
    
    // Wait for all deletions to complete
    await Promise.allSettled(deletePromises);
    
    // Update local state regardless of individual errors
    if (imageCount > 0) {
      const updatedImages = images.filter(img => !selectedImages.includes(img.id));
      onImagesUploaded(updatedImages);
      onSelectionChange([]);
    }
    
    if (slideshowCount > 0 && onSlideshowSelectionChange) {
      onSlideshowSelectionChange([]);
    }
    
    // If there were errors, show them but still resolve
    if (errors.length > 0) {
      console.warn('Some deletions failed:', errors);
      toast.error(`${errors.length} item${errors.length !== 1 ? 's' : ''} failed to delete`);
    }
    
    resolve();
  } catch (error) {
    reject(error);
  }
});

    // Create dynamic success message based on what's being deleted
    let successMessage = '';
    if (imageCount > 0 && slideshowCount > 0) {
      successMessage = `Successfully deleted ${imageCount} image${imageCount !== 1 ? 's' : ''} and ${slideshowCount} slideshow${slideshowCount !== 1 ? 's' : ''}!`;
    } else if (imageCount > 0) {
      successMessage = `Successfully deleted ${imageCount} image${imageCount !== 1 ? 's' : ''}!`;
    } else {
      successMessage = `Successfully deleted ${slideshowCount} slideshow${slideshowCount !== 1 ? 's' : ''}!`;
    }
    
    // Create dynamic loading message
    let loadingMessage = 'Deleting items...';
    if (imageCount > 0 && slideshowCount > 0) {
      loadingMessage = `Deleting ${imageCount} image${imageCount !== 1 ? 's' : ''} and ${slideshowCount} slideshow${slideshowCount !== 1 ? 's' : ''}...`;
    } else if (imageCount > 0) {
      loadingMessage = `Deleting ${imageCount} image${imageCount !== 1 ? 's' : ''}...`;
    } else {
      loadingMessage = `Deleting ${slideshowCount} slideshow${slideshowCount !== 1 ? 's' : ''}...`;
    }

    toast.promise(deletePromise, {
      loading: loadingMessage,
      success: successMessage,
      error: 'Delete failed. Please try again.',
    });
  };

  const handleCreateFolderSubmit = async () => {
    if (newFolderName.trim()) {
      const createPromise = imageService.createFolder(newFolderName.trim(), currentFolderId || undefined);
      toast.promise(createPromise, {
        loading: 'Creating folder...',
        success: (newFolder) => {
          onFoldersChange?.([...folders, newFolder]);
          setNewFolderName('');
          setShowCreateFolderDialog(false);
          return 'Folder created successfully!';
        },
        error: 'Failed to create folder. Please try again.',
      });
    }
  };

  const handleMoveImagesToFolder = async (folderId: string, imageIds: string[]) => {
    console.log('🗂️ handleMoveImagesToFolder called:', { folderId, imageIds, totalImages: images.length, totalFolders: folders.length });
    
    const movePromise = imageService.moveImagesToFolder(imageIds, folderId);
    toast.promise(movePromise, {
      loading: `Moving ${imageIds.length} image(s)...`,
      success: () => {
        console.log('✅ Image move promise resolved, updating UI...');
        
        // Optimistic update - remove from all folders first
        const updatedFolders = folders.map(f => ({
          ...f,
          images: f.images.filter(img => !imageIds.includes(img.id))
        }));
        
        // Add to target folder
        const targetFolderIndex = updatedFolders.findIndex(f => f.id === folderId);
        console.log('📁 Target folder index:', targetFolderIndex);
        
        if (targetFolderIndex !== -1) {
          const movedImages = images.filter(img => imageIds.includes(img.id));
          console.log('🖼️ Images to move:', movedImages.map(img => ({ id: img.id, name: img.file.name })));
          
          updatedFolders[targetFolderIndex] = {
            ...updatedFolders[targetFolderIndex],
            images: [...updatedFolders[targetFolderIndex].images, ...movedImages]
          };
        } else {
          console.log('❌ Target folder not found!');
        }
        
        console.log('📊 Updated folders structure:', updatedFolders.map(f => ({ id: f.id, name: f.name, imageCount: f.images.length })));
        
        onFoldersChange?.(updatedFolders);
        onSelectionChange([]);
        return `Successfully moved ${imageIds.length} image(s)!`;
      },
      error: (error) => {
        console.error('❌ Image move failed:', error);
        return 'Failed to move images. Please try again.';
      },
    });
  };

  const handleMoveImagesToRoot = async (imageIds: string[]) => {
    console.log('📤 handleMoveImagesToRoot called:', imageIds);
    
    const movePromise = imageService.removeImagesFromFolder(imageIds);
    toast.promise(movePromise, {
      loading: 'Moving images to root...',
      success: () => {
        console.log('✅ Images moved to root, updating UI...');
        
        // Optimistic update
        const movedImages = folders.flatMap(f => f.images.filter(img => imageIds.includes(img.id)));
        const updatedImages = [...images, ...movedImages];
        const updatedFolders = folders.map(f => ({
          ...f,
          images: f.images.filter(img => !imageIds.includes(img.id)),
        }));
        onImagesUploaded(updatedImages);
        onFoldersChange?.(updatedFolders);
        onSelectionChange([]);
        return 'Images moved to root successfully!';
      },
      error: 'Failed to move images to root.',
    });
  };

  const handleMoveSlideshowToFolder = async (slideshowIds: string[], folderId: string | null) => {
    try {
      console.log(`📁 Moving ${slideshowIds.length} slideshow(s) to folder ${folderId || 'root'}`);

      // Move each slideshow to the folder
      await Promise.all(slideshowIds.map(slideshowId =>
        slideshowService.moveSlideshowToFolder(slideshowId, folderId)
      ));

      // Force re-render to update the file list
      triggerReRender();

      toast.success(`${slideshowIds.length} slideshow(s) moved to ${folderId || 'root'} successfully!`);
    } catch (error) {
      console.error('Failed to move slideshows to folder:', error);
      toast.error('Failed to move slideshows to folder');
    }
  };

  const handleCreateFromTemplate = () => {
    if (selectedImages.length === 0) {
      toast.error('Please select some images first');
      return;
    }

    // Show template selection dialog
    setShowTemplateSelectionDialog(true);
  };

  const handleTemplateSelectionConfirm = async (templateId: string, aspectRatio: string) => {
    if (selectedImages.length === 0) {
      toast.error('Please select some images first');
      return;
    }

    setIsCreatingFromTemplate(true);

    try {
      // Get the current user
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        toast.error('Please log in to create slideshows');
        return;
      }

      const userId = session.user.id;

      // Load the selected template
      const template = await slideshowService.loadTemplate(templateId);
      
      if (!template) {
        toast.error('Template not found. Please try again.');
        return;
      }

      // Split selected images into chunks based on cut length
      const imageChunks: UploadedImage[][] = [];
      for (let i = 0; i < selectedImages.length; i += cutLength) {
        const chunk = selectedImages
          .slice(i, i + cutLength)
          .map(id => images.find(img => img.id === id))
          .filter(img => img !== undefined) as UploadedImage[];
        
        if (chunk.length > 0) {
          imageChunks.push(chunk);
        }
      }

      console.log(`📸 Creating ${imageChunks.length} slideshow(s) from ${selectedImages.length} images with cut length ${cutLength}`);

      let successCount = 0;
      let errorCount = 0;

      // Create slideshows for each chunk with unique naming
      for (let i = 0; i < imageChunks.length; i++) {
        const chunk = imageChunks[i];
        const chunkNumber = i + 1;
        const slideshowTitle = `Post ${chunkNumber}`;
        const postTitle = template.postTitle || slideshowTitle;
        const caption = template.caption; // Use original caption without numbering
        
        try {
          console.log(`🎬 Creating slideshow ${chunkNumber}/${imageChunks.length}: ${slideshowTitle}`);

          let slideshow: SlideshowMetadata;
          
          // Check if we need to create with custom aspect ratio
          if (aspectRatio && aspectRatio !== template.aspectRatio) {
            // Create slideshow with custom aspect ratio - avoid duplicates by using createOptimizedSlideshow
            const textOverlays = template.textOverlays.map(overlay => ({
              ...overlay,
              id: `${overlay.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            }));
            
            slideshow = await slideshowService.createOptimizedSlideshow(
              slideshowTitle,
              postTitle,
              caption,
              template.hashtags,
              chunk,
              textOverlays,
              aspectRatio,
              template.transitionEffect,
              template.musicEnabled,
              userId
            );
          } else {
            // Use the template application method for standard aspect ratio
            const result = await slideshowService.applyTemplateToImages(
              template,
              chunk,
              userId,
              {
                title: slideshowTitle,
                caption: caption,
                hashtags: template.hashtags
              }
            );

            if (!result.success || !result.slideshow) {
              errorCount++;
              console.error(`❌ Failed to create slideshow ${slideshowTitle}:`, result.error);
              continue;
            }
            
            slideshow = result.slideshow;
          }

          if (slideshow) {
            successCount++;
            console.log(`✅ Successfully created slideshow: ${slideshowTitle}`);
          } else {
            errorCount++;
            console.error(`❌ Failed to create slideshow ${slideshowTitle}`);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ Error creating slideshow ${slideshowTitle}:`, error);
        }
      }

      // Show results to user
      if (successCount > 0) {
        toast.success(`Successfully created ${successCount} slideshow(s)${errorCount > 0 ? ` (${errorCount} failed)` : ''}!`);
        
        // Clear selection after successful creation
        onSelectionChange([]);
        
        // Trigger re-render to show new slideshows
        triggerReRender();
      } else {
        toast.error(`Failed to create any slideshows. Please try again.`);
      }

    } catch (error) {
      console.error('Failed to create slideshows from template:', error);
      toast.error('Failed to create slideshows. Please try again.');
    } finally {
      setIsCreatingFromTemplate(false);
    }
  };

  // Enhanced drag and drop state management
  const [draggedItem, setDraggedItem] = useState<{ type: string; id: string; name: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentDragOverFolder, setCurrentDragOverFolder] = useState<string | null>(null);
  const [isDragOverMainArea, setIsDragOverMainArea] = useState(false);

  // Global drop event handler to ensure drops are caught
  useEffect(() => {
    const handleGlobalDrop = (e: DragEvent) => {
      console.log('🌍 Global drop event detected:', {
        hasFiles: e.dataTransfer?.files?.length ? e.dataTransfer.files.length > 0 : false,
        hasDragData: e.dataTransfer?.types?.includes('application/json') || false,
        types: Array.from(e.dataTransfer?.types || [])
      });
      
      // Handle internal drag and drop (between folders)
      if (draggedItem && currentDragOverFolder) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('🌍 Processing internal global drop:', { draggedItem, targetFolder: currentDragOverFolder });
        
        // Handle the drop
        if (draggedItem.type === 'file') {
          const itemsToMove = selectedImages.includes(draggedItem.id) ? selectedImages : [draggedItem.id];
          handleMoveImagesToFolder(currentDragOverFolder, itemsToMove);
        } else if (draggedItem.type === 'slideshow') {
          const itemsToMove = selectedSlideshows.includes(draggedItem.id) ? selectedSlideshows : [draggedItem.id];
          handleMoveSlideshowToFolder(itemsToMove, currentDragOverFolder);
        }
        
        // Reset drag state
        setCurrentDragOverFolder(null);
        setDraggedItem(null);
        setIsDragging(false);
        return;
      }
      
      // Handle external file drops (from OS file browser) that land outside specific drop zones
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('🌍 Processing external file drop globally');
        
        // Reset drag over states
        setIsDragOverMainArea(false);
        setCurrentDragOverFolder(null);
        
        // Handle the file upload similar to main area drop
        const files = Array.from(e.dataTransfer.files);
        const slideshowFiles = files.filter(file => file.name.endsWith('.slideshow'));
        const imageFiles = files.filter(file => file.type.startsWith('image/'));

        (async () => {
          try {
            // Handle slideshow files
            if (slideshowFiles.length > 0) {
              for (const file of slideshowFiles) {
                try {
                  const slideshow = await slideshowService.loadSlideshowFromFile(file);
                  if (onSlideshowLoad) {
                    onSlideshowLoad(slideshow);
                    toast.success(`Loaded slideshow: ${slideshow.title}`);
                  }
                } catch (error) {
                  console.error('Failed to load slideshow:', error);
                  toast.error(`Failed to load slideshow: ${file.name}`);
                }
              }
            }

            // Handle image files
            if (imageFiles.length > 0) {
              const uploadPromise = new Promise<UploadedImage[]>(async (resolve, reject) => {
                try {
                  const uploadPromises = imageFiles.map(file => imageService.uploadImage(file, currentFolderId || undefined));
                  const newImages = await Promise.all(uploadPromises);
                  onImagesUploaded([...images, ...newImages]);
                  resolve(newImages);
                } catch (error) {
                  reject(error);
                }
              });

              toast.promise(uploadPromise, {
                loading: `Uploading ${imageFiles.length} images...`,
                success: (newImages) => `Successfully uploaded ${newImages.length} images!`,
                error: 'Upload failed. Please try again.',
              });
            }

            // Show a summary message
            const totalFiles = imageFiles.length + slideshowFiles.length;
            if (totalFiles > 0) {
              toast.success(`Successfully processed ${totalFiles} file(s)!`);
            }
          } catch (error) {
            console.error('Failed to handle global file drop:', error);
            toast.error('Failed to process dropped files. Please try again.');
          }
        })();
      }
    };

    const handleGlobalDragOver = (e: DragEvent) => {
      // Allow external file drops
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy';
        }
        return;
      }
      
      // Allow internal drag and drop
      if (currentDragOverFolder) {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
      }
    };

    // Add global listeners
    document.addEventListener('drop', handleGlobalDrop);
    document.addEventListener('dragover', handleGlobalDragOver);

    return () => {
      document.removeEventListener('drop', handleGlobalDrop);
      document.removeEventListener('dragover', handleGlobalDragOver);
    };
  }, [draggedItem, currentDragOverFolder, selectedImages, selectedSlideshows, currentFolderId, images, onImagesUploaded, onSlideshowLoad]);

  // Handle drag over for the main file browser area (for file uploads)
  const handleMainAreaDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only show drag over for actual file drops
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOverMainArea(true);
      e.dataTransfer.dropEffect = 'copy';
      console.log('🗂️ Main area drag over - files detected');
    }
  };

  // Handle drag leave for the main file browser area
  const handleMainAreaDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only clear drag over if we're actually leaving the main area
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOverMainArea(false);
    }
  };

  // Handle drop on the main file browser area (for file uploads)
  const handleMainAreaDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverMainArea(false);

    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    const files = Array.from(e.dataTransfer.files);
    console.log('📁 Files dropped on main area:', files.length, 'files');

    // Separate slideshow files from image files
    const slideshowFiles = files.filter(file => file.name.endsWith('.slideshow'));
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    try {
      // Handle slideshow files
      if (slideshowFiles.length > 0) {
        for (const file of slideshowFiles) {
          try {
            const slideshow = await slideshowService.loadSlideshowFromFile(file);
            if (onSlideshowLoad) {
              onSlideshowLoad(slideshow);
              toast.success(`Loaded slideshow: ${slideshow.title}`);
            }
          } catch (error) {
            console.error('Failed to load slideshow:', error);
            toast.error(`Failed to load slideshow: ${file.name}`);
          }
        }
      }

      // Handle image files
      if (imageFiles.length > 0) {
        const uploadPromise = new Promise<UploadedImage[]>(async (resolve, reject) => {
          try {
            const uploadPromises = imageFiles.map(file => imageService.uploadImage(file, currentFolderId || undefined));
            const newImages = await Promise.all(uploadPromises);
            onImagesUploaded([...images, ...newImages]);
            resolve(newImages);
          } catch (error) {
            reject(error);
          }
        });

        toast.promise(uploadPromise, {
          loading: `Uploading ${imageFiles.length} images...`,
          success: (newImages) => `Successfully uploaded ${newImages.length} images!`,
          error: 'Upload failed. Please try again.',
        });
      }

      // Show a summary message
      const totalFiles = imageFiles.length + slideshowFiles.length;
      if (totalFiles > 0) {
        toast.success(`Successfully processed ${totalFiles} file(s)!`);
      }
    } catch (error) {
      console.error('Failed to handle dropped files:', error);
      toast.error('Failed to process dropped files. Please try again.');
    }
  };

  // Handle drag start from file and slideshow tiles
  const handleDragStart = (e: React.DragEvent, item: FileItem) => {
    const dragData = {
      type: item.type,
      id: item.id,
      name: item.name
    };
    
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
    
    // Set drag state for better visual feedback
    setDraggedItem(dragData);
    setIsDragging(true);
    
    // Clean up after drag operation starts
    setTimeout(() => setIsDragging(false), 100);
  };

  // Handle drag over for general drop zones
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Enhanced drop handler with better error handling
  const handleDrop = async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      const { type, id, name } = data;

      console.log('🎯 Drop detected:', { type, id, name, targetFolderId });

      if (type === 'file') {
        // Move image to folder
        const itemsToMove = selectedImages.includes(id) ? selectedImages : [id];
        await handleMoveImagesToFolder(targetFolderId, itemsToMove);
      } else if (type === 'slideshow') {
        // Move slideshow to folder
        const itemsToMove = selectedSlideshows.includes(id) ? selectedSlideshows : [id];
        await handleMoveSlideshowToFolder(itemsToMove, targetFolderId);
      }
    } catch (error) {
      console.error('Failed to handle drop:', error);
      toast.error('Failed to move item. Please try again.');
    }
  };

  const handleNavigateUp = () => onCurrentFolderIdChange?.(folders.find(f => f.id === currentFolderId)?.parent_id || null);

  const handleFolderContextMenu = (folderId: string, x: number, y: number) => {
    setContextMenu({
      x,
      y,
      items: ['Rename', 'Delete'],
      type: 'folder',
      targetId: folderId
    });
  };

  const handleRenameSubmit = async (folderId: string, newName: string) => {
    if (newName.trim() && newName !== folders.find(f => f.id === folderId)?.name) {
      const renamePromise = imageService.renameFolder(folderId, newName.trim());
      toast.promise(renamePromise, {
        loading: 'Renaming folder...',
        success: () => {
          const updatedFolders = folders.map(f =>
            f.id === folderId ? { ...f, name: newName.trim() } : f
          );
          onFoldersChange?.(updatedFolders);
          setRenamingFolderId(null);
          return 'Folder renamed successfully!';
        },
        error: 'Failed to rename folder.',
      });
    } else {
      setRenamingFolderId(null);
    }
  };

  const handleRenameSlideshowSubmit = async (slideshowId: string, newTitle: string) => {
    if (newTitle.trim()) {
      try {
        // Get current slideshows from localStorage
        const savedSlideshows = localStorage.getItem('savedSlideshows');
        if (savedSlideshows) {
          const slideshows = JSON.parse(savedSlideshows);
          if (slideshows[slideshowId]) {
            // Update the title
            slideshows[slideshowId].title = newTitle.trim();
            slideshows[slideshowId].updated_at = new Date().toISOString();

            // Save back to localStorage
            localStorage.setItem('savedSlideshows', JSON.stringify(slideshows));

            toast.success('Slideshow renamed successfully!');
            setRenamingSlideshowId(null);
          } else {
            toast.error('Slideshow not found.');
            setRenamingSlideshowId(null);
          }
        } else {
          toast.error('No saved slideshows found.');
          setRenamingSlideshowId(null);
        }
      } catch (error) {
        console.error('Failed to rename slideshow:', error);
        toast.error('Failed to rename slideshow.');
        setRenamingSlideshowId(null);
      }
    } else {
      setRenamingSlideshowId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  const formatDate = (date: Date) => date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="h-full flex flex-col bg-background">
        {/* Enhanced Toolbar */}
        <div className="flex flex-col p-3 border-b border-neutral-800 bg-background">
          {/* Top Row - Navigation and Selection */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              {/* Selection Controls */}
              <Button
                variant="secondary"
                size="sm"
                onClick={selectAll}
                className="flex items-center space-x-2 bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-2 h-8 text-sm border-neutral-700"
              >
                {(() => {
                  const imageIds = filteredAndSortedItems.filter(item => item.type === 'file').map(item => item.id);
                  const slideshowIds = filteredAndSortedItems.filter(item => item.type === 'slideshow').map(item => item.id);
                  const allImagesSelected = imageIds.every(id => selectedImages.includes(id));
                  const allSlideshowsSelected = slideshowIds.every(id => selectedSlideshows.includes(id));
                  const hasItems = imageIds.length > 0 || slideshowIds.length > 0;
                  const allSelected = (imageIds.length === 0 || allImagesSelected) && (slideshowIds.length === 0 || allSlideshowsSelected);
                  return hasItems && allSelected ? (
                    <CheckSquare className="w-4 h-4 text-green-400" />
                  ) : (
                    <Square className="w-4 h-4 text-neutral-300" />
                  );
                })()}
                <span>{(() => {
                  const imageIds = filteredAndSortedItems.filter(item => item.type === 'file').map(item => item.id);
                  const slideshowIds = filteredAndSortedItems.filter(item => item.type === 'slideshow').map(item => item.id);
                  const allImagesSelected = imageIds.every(id => selectedImages.includes(id));
                  const allSlideshowsSelected = slideshowIds.every(id => selectedSlideshows.includes(id));
                  const hasItems = imageIds.length > 0 || slideshowIds.length > 0;
                  const allSelected = (imageIds.length === 0 || allImagesSelected) && (slideshowIds.length === 0 || allSlideshowsSelected);
                  return hasItems && allSelected ? 'Deselect All' : 'Select All';
                })()}</span>
              </Button>

              {/* Unified Bulk Actions */}
              <AnimatePresence>
                {(selectedImages.length > 0 || selectedSlideshows.length > 0) && (
                  <motion.div
                    className="flex items-center space-x-2"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                  >
                    {/* Delete Button - shows when any items are selected */}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={removeSelected}
                      className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-3 py-2 h-8 text-sm transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>
                        {(() => {
                          const imageCount = selectedImages.length;
                          const slideshowCount = selectedSlideshows.length;
                          const totalCount = imageCount + slideshowCount;
                          
                          if (imageCount > 0 && slideshowCount > 0) {
                            return `Delete All (${totalCount})`;
                          } else if (imageCount > 0) {
                            return `Delete (${imageCount})`;
                          } else {
                            return `Delete (${slideshowCount})`;
                          }
                        })()}
                      </span>
                    </Button>
                    
                    {/* Post to TikTok Button - shows only when slideshows are selected */}
                    {selectedSlideshows.length > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          if (selectedSlideshows.length === 1) {
                            // Single slideshow - post immediately
                            handlePostSlideshowToTikTok(selectedSlideshows[0]);
                          } else {
                            // Multiple slideshows - show bulk posting dialog
                            handleBulkPostSlideshowsToTikTok();
                          }
                        }}
                        className="flex items-center space-x-2 bg-pink-600 hover:bg-pink-700 text-white px-3 py-2 h-8 text-sm transition-colors"
                      >
                        <Share className="w-4 h-4" />
                        <span>
                          {selectedSlideshows.length === 1
                            ? 'Post to TikTok'
                            : `Post ${selectedSlideshows.length} to TikTok`
                          }
                        </span>
                      </Button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>

          {/* Bottom Row - Search, Sort, View */}
          <div className="flex items-center justify-between">
            {/* Left side - Search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full text-white placeholder-neutral-400"
              />
            </div>

            <div className="flex items-center space-x-3">
              {/* Slideshow Controls */}
              <div className="flex items-center space-x-2 border-r border-neutral-700 pr-3">
                {/* Slideshow Limit Dropdown */}
                <div className="flex items-center space-x-2">
                  <label className="text-xs text-neutral-400 whitespace-nowrap">Cut Length:</label>
                  <select
                    value={cutLength}
                    onChange={(e) => {
                      const newCutLength = Number(e.target.value);
                      // Update external state if callback provided
                      if (onCutLengthChange) {
                        onCutLengthChange(newCutLength);
                      }
                    }}
                    className="text-sm bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-8 text-white"
                  >
                    <option value={1}>1 slide</option>
                    <option value={2}>2 slides</option>
                    <option value={3}>3 slides</option>
                    <option value={4}>4 slides</option>
                    <option value={5}>5 slides</option>
                  </select>
                </div>

                {/* Create from Template Button */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCreateFromTemplate}
                  disabled={isCreatingFromTemplate || selectedImages.length === 0}
                  className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 h-8 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingFromTemplate ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FilePlus className="w-4 h-4" />
                  )}
                  <span>Create from template</span>
                </Button>
              </div>

              {/* Sort Controls */}
              <div className="flex items-center space-x-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'size')}
                  className="text-sm bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-8 text-white"
                >
                  <option value="name">Name</option>
                  <option value="date">Date</option>
                  <option value="size">Size</option>
                </select>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 h-8 bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
                >
                  {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                </Button>
              </div>

              {/* View Mode Toggle */}
              <div className="flex border border-neutral-700 rounded-lg overflow-hidden bg-neutral-800">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-none border-r border-neutral-700 px-3 py-2 h-8 bg-neutral-900 hover:bg-neutral-800 text-white transition-colors"
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-none px-3 py-2 h-8 bg-neutral-900 hover:bg-neutral-800 text-white transition-colors"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "flex-1 relative overflow-auto bg-background transition-all duration-200",
            isDragOverMainArea ? "bg-blue-900/10 ring-2 ring-blue-400/30" : ""
          )}
          onDragOver={handleMainAreaDragOver}
          onDragLeave={handleMainAreaDragLeave}
          onDrop={handleMainAreaDrop}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              items: ['New Folder', 'Paste', 'Refresh', 'Properties'],
              type: 'general'
            });
          }}
          onClick={() => {
            if (contextMenu) setContextMenu(null);
          }}
        >
          {/* Enhanced drop zone overlay for main area */}
          {isDragOverMainArea && (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-blue-400/10 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center z-50 backdrop-blur-sm animate-pulse">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 rounded-full text-lg font-bold shadow-2xl border-2 border-blue-300 flex items-center space-x-3">
                <Upload className="w-6 h-6" />
                <span>Drop files to upload</span>
              </div>
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-neutral-400">Loading...</div>
          ) : fileItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Upload className="w-16 h-16 text-neutral-600" />
              <p className="text-neutral-500 mt-4">Drop files here or click to upload</p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Select Files
              </Button>
            </div>
          ) : viewMode === 'grid' ? (
           <div className="p-6">
             {currentFolderId && <RootMoveZone selectedImages={selectedImages} selectedSlideshows={selectedSlideshows} handleMoveImagesToRoot={handleMoveImagesToRoot} handleMoveSlideshowToFolder={handleMoveSlideshowToFolder} />}
             <div
               className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 relative"
             >
               {filteredAndSortedItems.map((item) =>
                 item.type === 'folder' ? (
                   <FolderTile
                     key={item.id}
                     item={item}
                     onFolderClick={handleFolderClick}
                     onContextMenu={handleFolderContextMenu}
                     renamingFolderId={renamingFolderId}
                     renameInputValue={renameInputValue}
                     setRenameInputValue={setRenameInputValue}
                     setRenamingFolderId={setRenamingFolderId}
                     handleRenameSubmit={handleRenameSubmit}
                     onImagesUploaded={onImagesUploaded}
                     currentImages={currentImages}
                     selectedImages={selectedImages}
                     handleMoveImagesToFolder={handleMoveImagesToFolder}
                     handleMoveSlideshowToFolder={handleMoveSlideshowToFolder}
                     selectedSlideshows={selectedSlideshows}
                     setCurrentDragOverFolder={setCurrentDragOverFolder}
                   />
                 ) : item.type === 'slideshow' ? (
                   <SlideshowTile
                     key={item.id}
                     item={item}
                     onSlideshowClick={handleSlideshowClick}
                     onContextMenu={handleSlideshowContextMenu}
                     selected={selectedSlideshows.includes(item.id)}
                     onToggleSelection={toggleSelection}
                     renamingSlideshowId={renamingSlideshowId}
                     renameSlideshowInputValue={renameSlideshowInputValue}
                     setRenameSlideshowInputValue={setRenameSlideshowInputValue}
                     setRenamingSlideshowId={setRenamingSlideshowId}
                     handleRenameSlideshowSubmit={handleRenameSlideshowSubmit}
                   />
                 ) : (
                   <FileTile
                     key={item.id}
                     item={item}
                     selected={selectedImages.includes(item.id)}
                     onToggleSelection={toggleSelection}
                     fileTileRefs={fileTileRefs}
                   />
                 )
               )}
             </div>
           </div>
          ) : (
            <table className="w-full text-sm">
              {/* List view implementation */}
            </table>
          )}
        </div>


        {/* Context Menu */}
        <AnimatePresence>
          {contextMenu && (
            <motion.div
              className="fixed z-50 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl py-2 min-w-48 backdrop-blur-sm"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={() => setContextMenu(null)}
            >
              {contextMenu.items.map((item, index) => (
                <button
                  key={index}
                  className="w-full text-left px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800 flex items-center space-x-2 transition-colors"
                  onClick={() => {
                    if (item === 'New Folder') {
                      setShowCreateFolderDialog(true);
                    } else if (item === 'Rename' && contextMenu.type === 'folder' && contextMenu.targetId) {
                      const folder = folders.find(f => f.id === contextMenu.targetId);
                      if (folder) {
                        setRenamingFolderId(contextMenu.targetId);
                        setRenameInputValue(folder.name);
                      }
                    } else if (item === 'Load' && contextMenu.type === 'slideshow' && contextMenu.targetId) {
                      (async () => {
                        try {
                          
                          const slideshow = await slideshowService.loadSlideshow(contextMenu.targetId!);
                          if (slideshow && onSlideshowLoad) {
                            
                            onSlideshowLoad(slideshow);
                            // Also select the slideshow
                            if (onSlideshowSelectionChange) {
                              const wasSelected = selectedSlideshows.includes(contextMenu.targetId!);
                              if (!wasSelected) {
                                onSlideshowSelectionChange([...selectedSlideshows, contextMenu.targetId!]);
                              }
                            }
                            toast.success(`Loaded slideshow: ${slideshow.title}`);
                          } else {
                            
                            toast.error('Slideshow not found.');
                          }
                        } catch (error) {
                          console.error('Failed to load slideshow:', error);
                          toast.error('Failed to load slideshow.');
                        }
                      })();
                    } else if (item === 'Post to TikTok' && contextMenu.type === 'slideshow' && contextMenu.targetId) {
                      (async () => {
                        try {
                          await handlePostSlideshowToTikTok(contextMenu.targetId!);
                        } catch (error) {
                          toast.error('Failed to post slideshow to TikTok.');
                        }
                      })();
                    } else if (item === 'Post Multiple to TikTok' && contextMenu.type === 'slideshow' && contextMenu.targetId) {
                      (async () => {
                        try {
                          // If multiple slideshows are selected, use bulk posting
                          if (selectedSlideshows.length > 1) {
                            await handleBulkPostSlideshowsToTikTok();
                          } else {
                            // If only one slideshow is selected, use single posting
                            await handlePostSlideshowToTikTok(contextMenu.targetId!);
                          }
                        } catch (error) {
                          toast.error('Failed to post slideshow(s) to TikTok.');
                        }
                      })();
                    } else if (item === 'Open' && contextMenu.type === 'slideshow' && contextMenu.targetId) {
                      // Handle "Open" action the same as "Load"
                      (async () => {
                        try {
                          
                          const slideshow = await slideshowService.loadSlideshow(contextMenu.targetId!);
                          if (slideshow && onSlideshowLoad) {
                            
                            onSlideshowLoad(slideshow);
                            // Also select the slideshow
                            if (onSlideshowSelectionChange) {
                              const wasSelected = selectedSlideshows.includes(contextMenu.targetId!);
                              if (!wasSelected) {
                                onSlideshowSelectionChange([...selectedSlideshows, contextMenu.targetId!]);
                              }
                            }
                            toast.success(`Opened slideshow: ${slideshow.title}`);
                          } else {
                            
                            toast.error('Slideshow not found.');
                          }
                        } catch (error) {
                          
                          toast.error('Failed to open slideshow.');
                        }
                      })();
                    } else if (item === 'Unload' && contextMenu.type === 'slideshow' && contextMenu.targetId) {
                      // Unload slideshow from TikTok preview and deselect
                      
                      if (onSlideshowSelectionChange) {
                        const wasSelected = selectedSlideshows.includes(contextMenu.targetId!);
                        if (wasSelected) {
                          onSlideshowSelectionChange(selectedSlideshows.filter(id => id !== contextMenu.targetId));
                        }
                      }
                      if (onSlideshowUnload) {
                        onSlideshowUnload();
                      }
                      toast.success('Slideshow unloaded');
                    } else if (item === 'Rename' && contextMenu.type === 'slideshow' && contextMenu.targetId) {
                      try {
                        const savedSlideshows = localStorage.getItem('savedSlideshows');
                        if (savedSlideshows) {
                          const slideshows = JSON.parse(savedSlideshows);
                          if (slideshows[contextMenu.targetId]) {
                            setRenamingSlideshowId(contextMenu.targetId);
                            setRenameSlideshowInputValue(slideshows[contextMenu.targetId].title);
                          }
                        }
                      } catch (error) {
                        console.error('Failed to get slideshow for renaming:', error);
                      }
                    } else if (item === 'Delete' && contextMenu.type === 'folder' && contextMenu.targetId) {
                      const folder = folders.find(f => f.id === contextMenu.targetId);
                      if (folder && confirm(`Are you sure you want to delete "${folder.name}" and all its contents? This action cannot be undone.`)) {
                        const deletePromise = imageService.deleteFolder(contextMenu.targetId);
                        toast.promise(deletePromise, {
                          loading: 'Deleting folder...',
                          success: () => {
                            onFoldersChange?.(folders.filter(f => f.id !== contextMenu.targetId));
                            return 'Folder deleted successfully!';
                          },
                          error: 'Failed to delete folder.',
                        });
                      }
                    } else if (item === 'Delete' && contextMenu.type === 'slideshow' && contextMenu.targetId) {
                      if (confirm('Are you sure you want to delete this slideshow? This action cannot be undone.')) {
                        (async () => {
                          try {
                            const { slideshowService } = await import('@/lib/slideshowService');
                            await slideshowService.deleteSlideshow(contextMenu.targetId!);
                            toast.success('Slideshow deleted successfully!');
                            triggerReRender(); // Force re-render to update the file list
                          } catch (error) {
                            console.error('Failed to delete slideshow:', error);
                            toast.error('Failed to delete slideshow.');
                          }
                        })();
                      }
                    }
                    setContextMenu(null);
                  }}
                >
                  {item === 'New Folder' && <FolderPlus className="w-4 h-4 text-blue-400" />}
                  {item === 'Paste' && <FilePlus className="w-4 h-4 text-green-400" />}
                  {item === 'Refresh' && <Upload className="w-4 h-4 text-yellow-400" />}
                  {item === 'Properties' && <Eye className="w-4 h-4 text-purple-400" />}
                  {item === 'Rename' && <Pencil className="w-4 h-4 text-orange-400" />}
                  {item === 'Delete' && <Trash2 className="w-4 h-4 text-red-400" />}
                  {item === 'Load' && <Play className="w-4 h-4 text-green-400" />}
                  {item === 'Open' && <Play className="w-4 h-4 text-green-400" />}
                  {item === 'Unload' && <X className="w-4 h-4 text-orange-400" />}
                  {item === 'Post to TikTok' && <Send className="w-4 h-4 text-pink-400" />}
                  <span>{item}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create Folder Dialog */}
        <AnimatePresence>
          {showCreateFolderDialog && (
            <motion.div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowCreateFolderDialog(false);
                setNewFolderName('');
              }}
            >
              <motion.div
                className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 w-96"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-white mb-4">Create New Folder</h3>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateFolderSubmit();
                    } else if (e.key === 'Escape') {
                      setShowCreateFolderDialog(false);
                      setNewFolderName('');
                    }
                  }}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-neutral-400"
                  placeholder="Folder name"
                  autoFocus
                />
                <div className="flex justify-end space-x-2 mt-4">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowCreateFolderDialog(false);
                      setNewFolderName('');
                    }}
                    className="bg-neutral-800 hover:bg-neutral-700 text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateFolderSubmit}
                    disabled={!newFolderName.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <input ref={fileInputRef} type="file" multiple accept="image/*,.slideshow" onChange={handleFileSelect} className="hidden" />

        {/* Postiz Poster Modal */}
        {showPostizPoster && slideshowToPost && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-6">
                <PostizPoster
                  slideshow={slideshowToPost}
                  onPostSuccess={(postId) => {
                    toast.success('Slideshow posted to TikTok successfully!');
                    setShowPostizPoster(false);
                    setSlideshowToPost(null);
                  }}
                  onClose={() => {
                    setShowPostizPoster(false);
                    setSlideshowToPost(null);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Bulk Postiz Poster Modal */}
        {showBulkPostizPoster && bulkSlideshowsToPost.length > 0 && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-6">
                <BulkPostizPoster
                  slideshows={bulkSlideshowsToPost}
                  onPostSuccess={(postIds) => {
                    toast.success(`Successfully posted ${postIds.length} slideshow(s) to TikTok!`);
                    setShowBulkPostizPoster(false);
                    setBulkSlideshowsToPost([]);
                    // Clear selection after successful posting
                    if (onSlideshowSelectionChange) {
                      onSlideshowSelectionChange([]);
                    }
                  }}
                  onClose={() => {
                    setShowBulkPostizPoster(false);
                    setBulkSlideshowsToPost([]);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Template Selection Dialog */}
        <TemplateSelectionDialog
          isOpen={showTemplateSelectionDialog}
          onClose={() => setShowTemplateSelectionDialog(false)}
          onConfirm={handleTemplateSelectionConfirm}
        />
      </div>
    </div>
  );
};

const RootMoveZone: React.FC<{
  selectedImages: string[];
  selectedSlideshows: string[];
  handleMoveImagesToRoot: (imageIds: string[]) => void;
  handleMoveSlideshowToFolder: (slideshowIds: string[], folderId: string | null) => void;
}> = ({ selectedImages, selectedSlideshows, handleMoveImagesToRoot, handleMoveSlideshowToFolder }) => {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      const { type, id } = data;

      if (type === 'file') {
        const itemsToMove = selectedImages.includes(id) ? selectedImages : [id];
        await handleMoveImagesToRoot(itemsToMove);
      } else if (type === 'slideshow') {
        const itemsToMove = selectedSlideshows.includes(id) ? selectedSlideshows : [id];
        await handleMoveSlideshowToFolder(itemsToMove, null);
      }
    } catch (error) {
      console.error('Failed to handle drop:', error);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex items-center justify-center p-4 border-2 border-dashed border-neutral-700 rounded-lg mb-4 transition-colors",
        isOver ? "border-blue-500 bg-blue-900/20" : "hover:border-neutral-600"
      )}
    >
      <div className="text-center">
        <Upload className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
        <p className="text-sm text-neutral-400">Drop files here to move to root</p>
      </div>
    </div>
  );
};

const FolderTile: React.FC<{
  item: FileItem;
  onFolderClick: (id: string) => void;
  onContextMenu: (folderId: string, x: number, y: number) => void;
  renamingFolderId: string | null;
  renameInputValue: string;
  setRenameInputValue: (value: string) => void;
  setRenamingFolderId: (id: string | null) => void;
  handleRenameSubmit: (folderId: string, newName: string) => void;
  onImagesUploaded?: (images: UploadedImage[]) => void;
  currentImages?: UploadedImage[];
  selectedImages?: string[];
  selectedSlideshows?: string[];
  handleMoveImagesToFolder?: (folderId: string, imageIds: string[]) => void;
  handleMoveSlideshowToFolder?: (slideshowIds: string[], folderId: string | null) => void;
  setCurrentDragOverFolder?: (folderId: string | null) => void;
}> = ({
  item,
  onFolderClick,
  onContextMenu,
  renamingFolderId,
  renameInputValue,
  setRenameInputValue,
  setRenamingFolderId,
  handleRenameSubmit,
  onImagesUploaded,
  currentImages = [],
  selectedImages = [],
  selectedSlideshows = [],
  handleMoveImagesToFolder,
  handleMoveSlideshowToFolder,
  setCurrentDragOverFolder
}) => {
  const isRenaming = renamingFolderId === item.id;
  const [isDragOver, setIsDragOver] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(item.id, renameInputValue);
    } else if (e.key === 'Escape') {
      setRenamingFolderId(null);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isRenaming) {
      e.preventDefault();
      e.stopPropagation();
      
      // Only trigger click if not currently dragging
      if (!isDragOver) {
        onFolderClick(item.id);
      }
    }
  };

  // Enhanced drag and drop handlers for internal items (files and slideshows)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check for both internal drags and external file drags
    if (e.dataTransfer.types.includes('application/json') || e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
      e.dataTransfer.dropEffect = 'move';
      console.log('📁 Folder drag over:', item.name, item.id, 'types:', Array.from(e.dataTransfer.types));
      
      // Set this as the current drag target for global drop handling
      setCurrentDragOverFolder && setCurrentDragOverFolder(item.id);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only clear drag over if we're actually leaving the folder area
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
      if (setCurrentDragOverFolder) {
        setCurrentDragOverFolder(null);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    console.log('🎯 Folder drop event fired for:', item.name, item.id);
    console.log('📊 Drop dataTransfer types:', Array.from(e.dataTransfer.types));
    
    try {
      // Handle both internal drag/drop and external file drops
      if (e.dataTransfer.types.includes('application/json')) {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        const { type, id } = data;

        console.log('🎯 Internal drop detected:', { type, id, folderId: item.id });

        if (type === 'file' && handleMoveImagesToFolder) {
          const itemsToMove = selectedImages.includes(id) ? selectedImages : [id];
          await handleMoveImagesToFolder(item.id, itemsToMove);
        } else if (type === 'slideshow' && handleMoveSlideshowToFolder) {
          const itemsToMove = selectedSlideshows.includes(id) ? selectedSlideshows : [id];
          await handleMoveSlideshowToFolder(itemsToMove, item.id);
        }
      } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        console.log('📁 External file drop detected');
        await handleExternalDrop(e);
      }
    } catch (error) {
      console.error('Failed to handle folder drop:', error);
      toast.error('Failed to move item to folder. Please try again.');
    }
  };

  // Handle external file drops (from OS file browser)
  const handleExternalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only show drag over for actual file drops
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  };

  const handleExternalDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only clear drag over if we're actually leaving the folder area
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleExternalDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    const slideshowFiles = files.filter(file => file.name.endsWith('.slideshow'));

    console.log('📁 External files dropped to folder:', {
      folderId: item.id,
      folderName: item.name,
      imageFilesCount: imageFiles.length,
      slideshowFilesCount: slideshowFiles.length
    });

    try {
      // Handle image files
      if (imageFiles.length > 0) {
        toast.loading(`Uploading ${imageFiles.length} images to ${item.name}...`);
        
        const uploadPromises = imageFiles.map(file => imageService.uploadImage(file, item.id));
        const newImages = await Promise.all(uploadPromises);

        if (onImagesUploaded) {
          onImagesUploaded([...currentImages, ...newImages]);
        }

        toast.success(`Successfully uploaded ${newImages.length} images to ${item.name}!`);
      }

      // Handle slideshow files
      if (slideshowFiles.length > 0) {
        for (const file of slideshowFiles) {
          try {
            const slideshow = await slideshowService.loadSlideshowFromFile(file);
            if (slideshow) {
              // Move the loaded slideshow to this folder
              await slideshowService.moveSlideshowToFolder(slideshow.id, item.id);
              toast.success(`Loaded slideshow: ${slideshow.title} in ${item.name}`);
            }
          } catch (error) {
            console.error('Failed to load slideshow:', error);
            toast.error(`Failed to load slideshow: ${file.name}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to upload dropped files:', error);
      toast.error('Failed to upload files. Please try again.');
    }
  };

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(item.id, e.clientX, e.clientY);
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnter={(e) => {
        e.preventDefault();
        console.log('🎯 Folder drag enter:', item.name);
        setIsDragOver(true);
        if (setCurrentDragOverFolder) {
          setCurrentDragOverFolder(item.id);
        }
      }}
      onDropCapture={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🎯 Folder drop capture:', item.name, item.id);
        
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
          await handleExternalDrop(e);
        } else {
          await handleDrop(e);
        }
        
        // Clear the current drag over folder after handling
        if (setCurrentDragOverFolder) {
          setCurrentDragOverFolder(null);
        }
      }}
      className={cn(
        "relative group aspect-square rounded-lg overflow-hidden bg-blue-900/20 border-2 transition-all cursor-pointer",
        isDragOver ? "border-blue-500 ring-4 ring-blue-400/50 bg-blue-500/30 scale-105 shadow-2xl shadow-blue-500/25" : "border-transparent hover:shadow-lg hover:border-blue-400/50"
      )}
      style={{
        zIndex: isDragOver ? 50 : 1,
        cursor: isRenaming ? 'text' : 'pointer',
        transform: isDragOver ? 'scale(1.05)' : 'scale(1)',
      }}
    >
      {/* Enhanced drop zone overlay for better visual feedback */}
      {isDragOver && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-blue-400/20 border-2 border-blue-400 rounded-lg flex items-center justify-center z-10 pointer-events-none backdrop-blur-sm animate-pulse">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-xl border border-blue-300 flex items-center space-x-2">
            <Move className="w-4 h-4" />
            <span>Drop here</span>
          </div>
        </div>
      )}

      {/* Clickable content area - doesn't interfere with drop detection */}
      <div
        className="flex flex-col items-center justify-center h-full relative z-0"
        onClick={handleClick}
      >
        <FolderIcon className="w-1/2 h-1/2 text-blue-400" />
        {isRenaming ? (
          <input
            type="text"
            value={renameInputValue}
            onChange={(e) => setRenameInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => handleRenameSubmit(item.id, renameInputValue)}
            className="text-center text-xs font-medium text-white mt-2 px-2 py-1 border border-blue-500 rounded bg-neutral-900 w-full max-w-20 focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
        ) : (
          <p className="text-center text-xs font-medium text-neutral-200 mt-2 truncate px-2">{item.name}</p>
        )}
      </div>
    </div>
  );
};

const SlideshowTile: React.FC<{
  item: FileItem;
  onSlideshowClick: (slideshow: SlideshowMetadata) => void;
  onContextMenu: (slideshowId: string, x: number, y: number) => void;
  selected: boolean;
  onToggleSelection: (id: string) => void;
  renamingSlideshowId: string | null;
  renameSlideshowInputValue: string;
  setRenameSlideshowInputValue: (value: string) => void;
  setRenamingSlideshowId: (id: string | null) => void;
  handleRenameSlideshowSubmit: (slideshowId: string, newTitle: string) => Promise<void>;
  debugSelected?: boolean;
}> = ({
  item,
  onSlideshowClick,
  onContextMenu,
  selected,
  onToggleSelection,
  renamingSlideshowId,
  renameSlideshowInputValue,
  setRenameSlideshowInputValue,
  setRenamingSlideshowId,
  handleRenameSlideshowSubmit,
  debugSelected
}) => {
  const isRenaming = renamingSlideshowId === item.id;
  const hasValidSlideshow = item.slideshow && item.slideshow.id && item.slideshow.title;
  const [isDragging, setIsDragging] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSlideshowSubmit(item.id, renameSlideshowInputValue);
    } else if (e.key === 'Escape') {
      setRenamingSlideshowId(null);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    console.log('🎬 Starting drag for slideshow:', item.id, item.name);
    
    const dragData = {
      type: 'slideshow',
      id: item.id,
      name: item.name
    };
    
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
    
    // Add visual feedback during drag
    e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    
    // Set dragging state
    setIsDragging(true);
    
    // Clear dragging state after a short delay
    setTimeout(() => setIsDragging(false), 100);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setIsDragging(false);
  };

  // Handle click only if not dragging
  const handleClick = (e: React.MouseEvent) => {
    // Only trigger click if not currently dragging and it's a primary mouse button
    if (!isDragging && !isRenaming && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      console.log('🎬 Slideshow clicked:', item.id);
      onToggleSelection(item.id);
    }
  };

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isRenaming) onContextMenu(item.id, e.clientX, e.clientY);
      }}
      draggable={!isRenaming}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        "relative group aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-2 transition-all",
        selected ? "border-purple-500 ring-2 ring-purple-400/30" : "border-transparent hover:shadow-lg hover:border-purple-400/50",
        isDragging ? "opacity-50 cursor-grabbing" : "cursor-pointer"
      )}
      title={`Slideshow: ${item.slideshow?.title || 'Loading...'}`}
      onClick={handleClick}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mb-2">
          <Play className="w-6 h-6 text-purple-400" />
        </div>
        {/* Add visual indicator even when not selected */}
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center z-10 transition-all"
              style={{
                backgroundColor: selected ? 'rgb(147 51 234)' : 'transparent',
                border: selected ? '2px solid rgb(147 51 234)' : '2px solid transparent'
              }}>
          {selected ? <CheckSquare className="w-3 h-3 text-white" /> : null}
        </div>
        {isRenaming ? (
          <input
            type="text"
            value={renameSlideshowInputValue}
            onChange={(e) => setRenameSlideshowInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => handleRenameSlideshowSubmit(item.id, renameSlideshowInputValue)}
            className="text-center text-xs font-medium text-white mt-2 px-2 py-1 border border-purple-500 rounded bg-neutral-900 w-full max-w-20 focus:outline-none focus:ring-1 focus:ring-purple-500"
            autoFocus
          />
        ) : (
          <p className="text-center text-xs font-medium text-neutral-200 truncate px-2 max-w-full">
            {hasValidSlideshow ? item.slideshow?.title : 'Click to Load'}
          </p>
        )}
        <p className="text-center text-xs text-neutral-400 mt-1">
          {hasValidSlideshow ? (item.slideshow?.condensedSlides?.length || 0) : '?'} slides
        </p>
      </div>
    </div>
  );
};

const FileTile: React.FC<{
  item: FileItem;
  selected: boolean;
  onToggleSelection: (id: string) => void;
  className?: string;
  fileTileRefs?: React.MutableRefObject<Map<string, HTMLDivElement>>;
}> = ({ item, selected, onToggleSelection, className, fileTileRefs }) => {
  const tileRef = useCallback((node: HTMLDivElement | null) => {
    if (node && fileTileRefs) {
      fileTileRefs.current.set(item.id, node);
    } else if (fileTileRefs) {
      fileTileRefs.current.delete(item.id);
    }
  }, [item.id, fileTileRefs]);

  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    console.log('🖼️ Starting drag for file:', item.id, item.name);
    
    const dragData = {
      type: 'file',
      id: item.id,
      name: item.name
    };
    
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
    
    // Add visual feedback during drag
    e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    
    // Set dragging state
    setIsDragging(true);
    
    // Clear dragging state after a short delay
    setTimeout(() => setIsDragging(false), 100);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setIsDragging(false);
  };

  // Handle click only if not dragging
  const handleClick = (e: React.MouseEvent) => {
    // Only trigger click if not currently dragging and it's a primary mouse button
    if (!isDragging && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      if (onToggleSelection) {
        console.log('📁 File clicked:', item.id);
        onToggleSelection(item.id);
      }
    }
  };

  return (
    <>
      <div
        ref={tileRef}
        draggable={!isDragging}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className={cn(
          "relative group aspect-square rounded-lg overflow-hidden bg-neutral-900 border-2 transition-all",
          selected ? "border-blue-500 ring-2 ring-blue-400/30" : "border-transparent hover:shadow-lg hover:border-neutral-700",
          isDragging ? "opacity-50 cursor-grabbing" : "cursor-pointer",
          className
        )}
        title={selected ? "Selected" : ""}
        onClick={handleClick}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {item.image && (
            <img src={item.image.url} alt={item.name} className="w-full h-full object-cover transition-transform hover:scale-105" />
          )}
        </div>
        {selected && <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center z-10"><CheckSquare className="w-3 h-3 text-white" /></div>}
      </div>
    </>
  );
};

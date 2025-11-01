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
import { DndContext, useDraggable, useDroppable, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { PostizPoster } from '../Postiz/PostizPoster';

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
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [draggedOver, setDraggedOver] = useState(false);
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragStartTime, setDragStartTime] = useState<number>(0);
  const [dragStartPosition, setDragStartPosition] = useState<{x: number, y: number} | null>(null);
  const [showPostizPoster, setShowPostizPoster] = useState(false);
  const [slideshowToPost, setSlideshowToPost] = useState<SlideshowMetadata | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileTileRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Use external currentFolderId
  const currentFolderId = externalCurrentFolderId;


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
      } catch (error) {
        console.error('Failed to load data:', error);
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
  const triggerReRender = useCallback(() => forceUpdate({}), []);

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
      // Load slideshows from the service
      slideshowService.loadFromLocalStorage();
      
      // Get slideshows directly from memory
      const allSlideshows = Array.from((slideshowService as any)['slideshows'].values());
      
      // Filter slideshows by current folder for proper folder display
      const filteredSlideshows = currentFolderId === null
        ? allSlideshows.filter((slideshow: any) => !slideshow.folder_id)
        : allSlideshows.filter((slideshow: any) => slideshow.folder_id === currentFolderId);
      
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

  const handleDragStart = (event: DragStartEvent) => {
    const draggedItem = fileItems.find(item => item.id === event.active.id);
    if (draggedItem && (draggedItem.type === 'file' || draggedItem.type === 'slideshow')) {
      setActiveId(event.active.id as string);
      setDragStartTime(Date.now());
      // Note: We'll detect clicks in handleDragEnd if the drag was very short
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


  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedOver(false);
    const files = Array.from(e.dataTransfer.files);

    // Separate slideshow files from image files
    const slideshowFiles = files.filter(file => file.name.endsWith('.slideshow'));
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

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
  }, [images, onImagesUploaded, currentFolderId, onSlideshowLoad]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDraggedOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setDraggedOver(false); }, []);

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

  // Track modifier key state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) setCtrlPressed(true);
      if (e.shiftKey) setShiftPressed(true);
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
  }, []);

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
    const items = ['Load', 'Open', 'Unload', 'Post to TikTok', 'Rename', 'Delete'];
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


  const removeSelected = async () => {
    if (selectedImages.length === 0) return;
    const deletePromise = new Promise<void>(async (resolve, reject) => {
      try {
        await Promise.all(selectedImages.map(id => imageService.deleteImage(id)));
        const updatedImages = images.filter(img => !selectedImages.includes(img.id));
        onImagesUploaded(updatedImages);
        onSelectionChange([]);
        resolve();
      } catch (error) {
        reject(error);
      }
    });

    toast.promise(deletePromise, {
      loading: `Deleting ${selectedImages.length} images...`,
      success: `Successfully deleted ${selectedImages.length} images!`,
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
    const movePromise = imageService.moveImagesToFolder(imageIds, folderId);
    toast.promise(movePromise, {
      loading: `Moving ${imageIds.length} image(s)...`,
      success: () => {
        // Optimistic update - remove from all folders first
        const updatedFolders = folders.map(f => ({
          ...f,
          images: f.images.filter(img => !imageIds.includes(img.id))
        }));
        
        // Add to target folder
        const targetFolderIndex = updatedFolders.findIndex(f => f.id === folderId);
        if (targetFolderIndex !== -1) {
          const movedImages = images.filter(img => imageIds.includes(img.id));
          updatedFolders[targetFolderIndex] = {
            ...updatedFolders[targetFolderIndex],
            images: [...updatedFolders[targetFolderIndex].images, ...movedImages]
          };
        }
        
        onFoldersChange?.(updatedFolders);
        onSelectionChange([]);
        return `Successfully moved ${imageIds.length} image(s)!`;
      },
      error: 'Failed to move images. Please try again.',
    });
  };

  const handleMoveSlideshowToFolder = async (slideshowId: string, folderId: string | null) => {
    try {
      // Get the current slideshow data to check its current folder
      const allSlideshows = getSlideshowsFromService();
      const slideshowItem = allSlideshows.find(item => item.id === slideshowId);
      if (!slideshowItem || !slideshowItem.slideshow) {
        throw new Error('Slideshow not found');
      }
      
      const slideshow = slideshowItem.slideshow;
      const currentFolderId = slideshow.folder_id;
      
      // Don't do anything if moving to the same folder
      if (currentFolderId === folderId) {
        return;
      }
      
      console.log(`📁 Moving slideshow "${slideshow.title}" from folder ${currentFolderId || 'root'} to folder ${folderId || 'root'}`);
      
      // Update the slideshow service
      await slideshowService.moveSlideshowToFolder(slideshowId, folderId);
      
      // CRITICAL: Update ALL slideshow file entries in localStorage
      // First, find all file entries for this slideshow
      const slideshowFileKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('slideshow_file_')) {
          const fileData = localStorage.getItem(key);
          if (fileData) {
            try {
              const parsed = JSON.parse(fileData);
              // Match by slideshow ID (remove the "slideshow_" prefix if present)
              const fileSlideshowId = parsed.id.startsWith('slideshow_') ? parsed.id : `slideshow_${parsed.id}`;
              if (fileSlideshowId === slideshowId) {
                slideshowFileKeys.push(key);
              }
            } catch (error) {
              console.warn('Failed to parse slideshow file data:', key, error);
            }
          }
        }
      }
      
      console.log(`🔍 Found ${slideshowFileKeys.length} file entries for slideshow ${slideshowId}`);
      
      // Update all found file entries to the new folder
      slideshowFileKeys.forEach(fileKey => {
        try {
          const fileData = localStorage.getItem(fileKey);
          if (fileData) {
            const parsedFileData = JSON.parse(fileData);
            parsedFileData.folderId = folderId;
            parsedFileData.updated = new Date().toISOString();
            localStorage.setItem(fileKey, JSON.stringify(parsedFileData));
            console.log(`✅ Updated file entry ${fileKey} to folder ${folderId || 'root'}`);
          }
        } catch (error) {
          console.error(`Failed to update file entry ${fileKey}:`, error);
        }
      });
      
      // Dispatch storage event to trigger re-render
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'savedSlideshows',
        newValue: localStorage.getItem('savedSlideshows')
      }));
      
      // Force re-render to update the file list
      triggerReRender();
      
      toast.success(`Slideshow moved to ${folderId || 'root'} successfully!`);
    } catch (error) {
      console.error('Failed to move slideshow to folder:', error);
      toast.error('Failed to move slideshow to folder');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const dragDuration = Date.now() - dragStartTime;

    // If drag was very short (less than 500ms for more forgiving detection) and no drop target, treat as click
    if (!over && dragDuration < 500) {
      const clickedItem = fileItems.find(item => item.id === active.id);
      if (clickedItem?.type === 'file') {
        toggleSelection(active.id as string);
      } else if (clickedItem?.type === 'slideshow') {
        // Use the same selection logic as regular clicks
        if (onSlideshowSelectionChange && clickedItem) {
          const wasSelected = selectedSlideshows.includes(clickedItem.id);
          if (wasSelected) {
            // Deselect - this should trigger unload
            onSlideshowSelectionChange(selectedSlideshows.filter(id => id !== clickedItem.id));
          } else {
            // Select and load
            onSlideshowSelectionChange([...selectedSlideshows, clickedItem.id]);
          }
        }
      }
      setActiveId(null);
      return;
    }

    console.log('🔄 Drag end event:', {
      active: active.id,
      over: over?.id,
      activeId,
      hasActiveId: !!activeId,
      timestamp: Date.now() - dragStartTime
    });

    // Only process drag operations if we have an active drag and a valid drop target
    if (over && activeId) {
      const draggedItem = fileItems.find(item => item.id === active.id);
      
      console.log('🔄 Drag end - active:', active.id, 'over:', over.id, 'draggedItem:', draggedItem);
      
      if (draggedItem?.type === 'file') {
        // Handle image file dragging
        const itemsToMove = selectedImages.includes(active.id as string) ? selectedImages : [active.id as string];
        console.log('🖼️ Processing image drag - items to move:', itemsToMove, 'target:', over.id);
        
        if (over.id === 'root-move-zone') {
          // Moving images to root
          console.log('📤 Moving images to root:', itemsToMove);
          const removePromise = imageService.removeImagesFromFolder(itemsToMove);
          toast.promise(removePromise, {
            loading: 'Moving images to root...',
            success: () => {
              // Optimistic update
              const movedImages = folders.flatMap(f => f.images.filter(img => itemsToMove.includes(img.id)));
              const updatedImages = [...images, ...movedImages];
              const updatedFolders = folders.map(f => ({
                ...f,
                images: f.images.filter(img => !itemsToMove.includes(img.id)),
              }));
              onImagesUploaded(updatedImages);
              onFoldersChange?.(updatedFolders);
              onSelectionChange([]);
              return 'Images moved to root successfully!';
            },
            error: 'Failed to move images.',
          });
        } else {
          // Moving images to a folder - check if the drop target is a folder
          const targetFolder = fileItems.find(item => item.id === over.id);
          console.log('📁 Target folder check for images:', { targetFolder, overId: over.id, allItems: fileItems.map(i => ({id: i.id, type: i.type})) });
          if (targetFolder?.type === 'folder') {
            console.log('🗂️ Moving images to folder:', over.id, itemsToMove);
            handleMoveImagesToFolder(over.id as string, itemsToMove);
          } else {
            console.log('❌ Drop target is not a folder for images:', over.id, targetFolder);
          }
        }
      } else if (draggedItem?.type === 'slideshow') {
        // Handle slideshow file dragging
        console.log('🎬 Processing slideshow drag - target:', over.id);
        
        if (over.id === 'root-move-zone') {
          // Moving slideshow to root
          console.log('📤 Moving slideshow to root:', active.id);
          handleMoveSlideshowToFolder(active.id as string, null);
        } else {
          // Moving slideshow to a folder - check if the drop target is a folder
          const targetFolder = fileItems.find(item => item.id === over.id);
          console.log('📁 Target folder check for slideshow:', { targetFolder, overId: over.id });
          if (targetFolder?.type === 'folder') {
            console.log('🗂️ Moving slideshow to folder:', active.id, 'to folder:', over.id);
            handleMoveSlideshowToFolder(active.id as string, over.id as string);
          } else {
            console.log('❌ Drop target is not a folder for slideshow:', over.id, targetFolder);
          }
        }
      } else {
        console.log('❌ Dragged item not found or not draggable:', active.id, draggedItem);
      }
    } else {
      console.log('❌ No drop target or no active drag:', { over: over?.id, activeId, hasOver: !!over });
    }

    setActiveId(null);
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

  const activeItem = activeId ? fileItems.find(item => item.id === activeId) : null;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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

              {/* Bulk Actions */}
              <AnimatePresence>
                {selectedImages.length > 0 && (
                  <motion.div
                    className="flex items-center space-x-2"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                  >
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={removeSelected}
                      className="flex items-center space-x-2 bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-2 h-8 text-sm transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete ({selectedImages.length})</span>
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Slideshow Bulk Actions */}
              <AnimatePresence>
                {selectedSlideshows.length > 0 && (
                  <motion.div
                    className="flex items-center space-x-2"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                  >
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        // Post the first selected slideshow to TikTok
                        const firstSlideshowId = selectedSlideshows[0];
                        handlePostSlideshowToTikTok(firstSlideshowId);
                      }}
                      className="flex items-center space-x-2 bg-pink-600 hover:bg-pink-700 text-white px-3 py-2 h-8 text-sm transition-colors"
                    >
                      <Share className="w-4 h-4" />
                      <span>Post to TikTok ({selectedSlideshows.length})</span>
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>

          {/* Bottom Row - Search, Sort, View */}
          <div className="flex items-center justify-between">
            {/* Search */}
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
          className={cn("flex-1 relative overflow-auto bg-background", draggedOver && "bg-blue-900/20")}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
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
             {currentFolderId && <RootMoveZone />}
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
                   />
                 ) : item.type === 'slideshow' ? (
                   <SlideshowTile
                     key={item.id}
                     item={item}
                     onSlideshowClick={handleSlideshowClick}
                     onContextMenu={handleSlideshowContextMenu}
                     selected={selectedSlideshows.includes(item.id)}
                     onToggleSelection={(id) => {
                       if (onSlideshowSelectionChange) {
                         const wasSelected = selectedSlideshows.includes(id);
                         const willBeSelected = !wasSelected;
                         
                         const newSelection = wasSelected
                           ? selectedSlideshows.filter(sid => sid !== id)
                           : [...selectedSlideshows, id];
                         onSlideshowSelectionChange(newSelection);
                         
                         if (willBeSelected) {
                           toast.success('Slideshow selected - loading...');
                         } else {
                           toast.success('Slideshow deselected');
                         }
                         
                         if (willBeSelected) {
                           setTimeout(async () => {
                             try {
                               const slideshowItem = fileItems.find(item => item.id === id && item.type === 'slideshow');
                               if (slideshowItem && onSlideshowLoad) {
                                 if (slideshowItem.slideshow && slideshowItem.slideshow.id && slideshowItem.slideshow.title) {
                                   await onSlideshowLoad(slideshowItem.slideshow);
                                 } else {
                                   const loadedSlideshow = await slideshowService.loadSlideshow(id);
                                   if (loadedSlideshow) {
                                     await onSlideshowLoad(loadedSlideshow);
                                   } else {
                                     toast.error('Failed to load slideshow - no data found');
                                   }
                                 }
                               }
                             } catch (error) {
                               toast.error('Failed to load slideshow');
                             }
                           }, 0);
                         } else {
                           if (onSlideshowUnload) {
                             onSlideshowUnload();
                           }
                         }
                       } else {
                         toggleSelection(id);
                       }
                     }}
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

        {createPortal(
          <DragOverlay>
            {activeItem && activeItem.type === 'file' && activeItem.image ? (
              (() => {
                const isActiveSelected = selectedImages.includes(activeItem.id);
                const itemsToShow = isActiveSelected ? Math.min(selectedImages.length, 4) : 1;
                const itemsDragging = isActiveSelected
                  ? fileItems.filter(item => selectedImages.includes(item.id) && item.type === 'file')
                  : [activeItem];

                return (
                  <div className="relative">
                    {itemsDragging.slice(0, itemsToShow).map((item, index) => (
                      <FileTile
                        key={item.id}
                        item={item}
                        selected={selectedImages.includes(item.id)}
                        onToggleSelection={toggleSelection}
                        className={cn(
                          "absolute",
                          itemsToShow > 1 && index > 0 && `top-${index * 2} left-${index * 2} scale-90`
                        )}
                      />
                    ))}
                    {isActiveSelected && itemsDragging.length > 4 && (
                      <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-black">
                        +{itemsDragging.length - 3}
                      </div>
                    )}
                    {isActiveSelected && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded mb-1 pointer-events-none">
                        Drag {itemsDragging.length} file{itemsDragging.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                );
              })()
            ) : activeItem && activeItem.type === 'slideshow' ? (
              <div className="relative">
                <SlideshowTile
                  item={activeItem}
                  onSlideshowClick={() => {}}
                  onContextMenu={() => {}}
                  selected={false} // Don't show selected state in drag overlay
                  onToggleSelection={() => {}}
                  renamingSlideshowId={null}
                  renameSlideshowInputValue={''}
                  setRenameSlideshowInputValue={() => {}}
                  setRenamingSlideshowId={() => {}}
                  handleRenameSlideshowSubmit={async () => {}}
                  debugSelected={false}
                />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded mb-1 pointer-events-none">
                  Drag slideshow
                </div>
              </div>
            ) : activeItem && activeItem.type === 'folder' ? (
              <FolderTile
                item={activeItem}
                onFolderClick={handleFolderClick}
                onContextMenu={() => {}} // No context menu for drag overlay
                renamingFolderId={null}
                renameInputValue={''}
                setRenameInputValue={() => {}}
                setRenamingFolderId={() => {}}
                handleRenameSubmit={() => {}}
              />
            ) : null}
          </DragOverlay>,
          document.body
        )}

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
      </div>
    </DndContext>
  );
};

const RootDropZone: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isOver, setNodeRef } = useDroppable({ id: 'root-drop-zone' });
  return (
    <div ref={setNodeRef} className={cn("h-full", isOver && "bg-green-50")}>
      {children}
    </div>
  );
};

const RootMoveZone: React.FC = () => {
  const { isOver, setNodeRef } = useDroppable({ id: 'root-move-zone' });
  return (
    <div
      ref={setNodeRef}
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
}> = ({
  item,
  onFolderClick,
  onContextMenu,
  renamingFolderId,
  renameInputValue,
  setRenameInputValue,
  setRenamingFolderId,
  handleRenameSubmit
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: item.id,
    data: {
      type: 'folder',
      folderId: item.id
    }
  });
  const isRenaming = renamingFolderId === item.id;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(item.id, renameInputValue);
    } else if (e.key === 'Escape') {
      setRenamingFolderId(null);
    }
  };

  console.log(`📁 FolderTile render: ${item.name} (${item.id}) - isOver: ${isOver}`);

  return (
    <div onClick={(e) => {
      e.stopPropagation();
      if (!isRenaming) onFolderClick(item.id);
    }}>
      <div
        ref={setNodeRef}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(item.id, e.clientX, e.clientY);
        }}
        className={cn(
          "relative group aspect-square rounded-lg overflow-hidden bg-blue-900/20 border-2 border-transparent cursor-pointer transition-all",
          isOver ? "border-blue-500 ring-2 ring-blue-400/30 bg-blue-500/20" : "hover:shadow-lg hover:border-blue-400/50"
        )}
        style={{
          zIndex: isOver ? 50 : 1,
        }}
      >
        <div className="flex flex-col items-center justify-center h-full">
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
  const [clickStartPos, setClickStartPos] = useState<{x: number, y: number} | null>(null);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: false
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : {};

  const isRenaming = renamingSlideshowId === item.id;
  const hasValidSlideshow = item.slideshow && item.slideshow.id && item.slideshow.title;

  

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSlideshowSubmit(item.id, renameSlideshowInputValue);
    } else if (e.key === 'Escape') {
      setRenamingSlideshowId(null);
    }
  };

  const handleSingleClick = (e: React.MouseEvent) => {
    // SINGLE CLICK: Let parent component handle everything (selection + loading/unloading)
    // Prevent event bubbling to avoid conflicts with drag handlers
    e.stopPropagation();
    
    if (!isRenaming) {
      onToggleSelection(item.id);
    }
  };

  return (
    <div
      onClick={(e) => {
        // Handle regular click - load slideshow
        if (!isRenaming) {
          handleSingleClick(e);
        }
      }}
      onDoubleClick={async (e) => {
        e.stopPropagation();
        if (!isRenaming) {
          // DOUBLE CLICK: Handle selection (for bulk operations)
          onToggleSelection(item.id);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isRenaming) onContextMenu(item.id, e.clientX, e.clientY);
      }}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "relative group aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-2 cursor-pointer transition-all",
        selected ? "border-purple-500 ring-2 ring-purple-400/30" : "border-transparent hover:shadow-lg hover:border-purple-400/50",
        isDragging && "opacity-50"
      )}
      title={`Slideshow: ${item.slideshow?.title || 'Loading...'}`}
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
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: false
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : {};

  const tileRef = useCallback((node: HTMLDivElement | null) => {
    if (node && fileTileRefs) {
      fileTileRefs.current.set(item.id, node);
    } else if (fileTileRefs) {
      fileTileRefs.current.delete(item.id);
    }
  }, [item.id, fileTileRefs]);

  return (
    <>
      <div
        ref={(node) => {
          setNodeRef(node);
          tileRef(node);
        }}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => {
          // Ensure we only select the image, never load a slideshow
          if (onToggleSelection) {
            onToggleSelection(item.id);
          }
        }}
        className={cn(
          "relative group aspect-square rounded-lg overflow-hidden bg-neutral-900 border-2 cursor-pointer transition-all",
          selected ? "border-blue-500 ring-2 ring-blue-400/30" : "border-transparent hover:shadow-lg hover:border-neutral-700",
          isDragging && "opacity-50",
          className
        )}
        title={selected ? "Selected" : ""}
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

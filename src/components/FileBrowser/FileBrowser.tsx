import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { UploadedImage, Folder, SlideshowMetadata } from '../../types';
import {
  Grid,
  List,
  FolderPlus,
  ImagePlus,
  Filter,
  ArrowUpAz,
  ChevronDown,
  Clock,
  Trash2,
  Settings2,
  Film,
  Folder as FolderIcon,
  LayoutTemplate,
  Send,
  CheckSquare,
  Edit,
  RefreshCw,
  X,
  MoreVertical,
  FileText,
  UploadCloud
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from 'date-fns';
import { imageService } from '../../lib/imageService';
import { slideshowService } from '../../lib/slideshowService';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

interface FileBrowserProps {
  images: UploadedImage[];
  onImagesUploaded: (images: UploadedImage[]) => void;
  selectedImages: string[];
  onSelectionChange: (ids: string[]) => void;
  selectedSlideshows: string[];
  onSlideshowSelectionChange: (ids: string[]) => void;
  folders: Folder[];
  onFoldersChange: (folders: Folder[]) => void;
  currentFolderId: string | null;
  onCurrentFolderIdChange: (id: string | null) => void;
  onSlideshowLoad: (slideshow: SlideshowMetadata) => void;
  onSlideshowUnload?: () => void;
  cutLength: number;
  onCutLengthChange: (length: number) => void;
  onCreateFromTemplate: () => void;
  onBulkPost: () => void;
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

export function FileBrowser({
  images,
  onImagesUploaded,
  selectedImages,
  onSelectionChange,
  selectedSlideshows,
  onSlideshowSelectionChange,
  folders,
  onFoldersChange,
  currentFolderId,
  onCurrentFolderIdChange,
  onSlideshowLoad,
  onSlideshowUnload,
  cutLength,
  onCutLengthChange,
  onCreateFromTemplate,
  onBulkPost
}: FileBrowserProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(false);
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const [shiftPressed, setShiftPressed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const dragCounter = useRef(0);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'background' | 'folder' | 'file' | 'slideshow';
    targetId?: string;
    targetName?: string;
  } | null>(null);

  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameItemName, setRenameItemName] = useState('');
  const [renameItemId, setRenameItemId] = useState('');

  // Load initial data
  // Load data function
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [loadedImages, loadedFolders] = await Promise.all([
        imageService.loadImages(),
        imageService.loadFolders(),
      ]);

      // Deduplication logic
      const rootImageIds = new Set(loadedImages.map(img => img.id));
      const folderImageIds = new Set();
      loadedFolders.forEach(folder => {
        folder.images.forEach(img => folderImageIds.add(img.id));
      });

      const dedupedImages = loadedImages.filter(img => !folderImageIds.has(img.id));

      onImagesUploaded(dedupedImages);
      onFoldersChange(loadedFolders);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load files');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [onImagesUploaded, onFoldersChange]);

  // Initial load and Realtime subscription
  useEffect(() => {
    loadData();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('file_browser_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'images' },
        () => {
          console.log('🔔 Realtime update: images changed');
          loadData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'folders' },
        () => {
          console.log('🔔 Realtime update: folders changed');
          loadData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'folder_images' },
        () => {
          console.log('🔔 Realtime update: folder_images changed');
          loadData(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  // Force re-render when slideshows change
  const [, forceUpdate] = useState({});
  const triggerReRender = useCallback(() => forceUpdate({}), []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'savedSlideshows') triggerReRender();
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('slideshowUpdated', triggerReRender);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('slideshowUpdated', triggerReRender);
    };
  }, [triggerReRender]);

  // Load slideshows
  useEffect(() => {
    slideshowService.loadFromLocalStorage();
    triggerReRender();
  }, [triggerReRender]);

  // Handle folder refresh events
  useEffect(() => {
    const handleFolderDataRefresh = async (e: CustomEvent) => {
      try {
        const [loadedImages, loadedFolders] = await Promise.all([
          imageService.loadImages(),
          imageService.loadFolders(),
        ]);

        const folderImageIds = new Set();
        loadedFolders.forEach(folder => {
          folder.images.forEach(img => folderImageIds.add(img.id));
        });
        const dedupedImages = loadedImages.filter(img => !folderImageIds.has(img.id));

        onImagesUploaded(dedupedImages);
        onFoldersChange(loadedFolders);
      } catch (error) {
        console.error('Failed to refresh folder data:', error);
      }
    };

    window.addEventListener('folderDataRefresh', handleFolderDataRefresh as unknown as EventListener);
    return () => {
      window.removeEventListener('folderDataRefresh', handleFolderDataRefresh as unknown as EventListener);
    };
  }, [onImagesUploaded, onFoldersChange]);

  // Keyboard modifiers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) setCtrlPressed(true);
      if (e.shiftKey) setShiftPressed(true);
      if (e.key === 'Delete') removeSelected();
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

  // Drag and Drop Handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    const slideshowFiles = files.filter(file => file.name.endsWith('.slideshow'));
    const imageFiles = files.filter(file => !file.name.endsWith('.slideshow'));

    if (slideshowFiles.length > 0) {
      for (const file of slideshowFiles) {
        try {
          const slideshow = await slideshowService.loadSlideshowFromFile(file);
          onSlideshowLoad(slideshow);
          toast.success(`Loaded slideshow: ${slideshow.title}`);
        } catch (error) {
          toast.error(`Failed to load slideshow: ${file.name}`);
        }
      }
    }

    if (imageFiles.length > 0) {
      setUploadProgress(0);
      const totalFiles = imageFiles.length;
      let completedFiles = 0;
      const newUploadedImages: UploadedImage[] = [];

      try {
        // Simulate progress for better UX since we can't get exact progress from current API
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev === null || prev >= 90) return prev;
            return prev + 5;
          });
        }, 500);

        // Upload files sequentially to avoid rate limits and ensure order
        for (const file of imageFiles) {
          try {
            const uploadedImage = await imageService.uploadImage(file, currentFolderId || undefined);
            newUploadedImages.push(uploadedImage);
            completedFiles++;
            setUploadProgress(Math.min(90, (completedFiles / totalFiles) * 100));
          } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error);
            toast.error(`Failed to upload ${file.name}`);
          }
        }

        clearInterval(progressInterval);
        setUploadProgress(100);

        // Small delay to show 100% before hiding
        setTimeout(() => {
          setUploadProgress(null);
          if (newUploadedImages.length > 0) {
            if (currentFolderId === null) {
              onImagesUploaded([...images, ...newUploadedImages]);
            } else {
              // If in a folder, we need to refresh the folder data
              // But we can also optimistically update if we want
              // For now, let's rely on the realtime subscription or manual refresh
              // Or just trigger a reload
              loadData(true);
            }
            toast.success(`Successfully uploaded ${newUploadedImages.length} images!`);
          }
        }, 500);

      } catch (error) {
        console.error('Upload process failed:', error);
        setUploadProgress(null);
        toast.error('Upload process failed');
      }
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  }, [currentFolderId, images, onImagesUploaded, loadData]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processFiles(files);
    if (e.target) e.target.value = '';
  };

  const getSlideshowsFromService = () => {
    try {
      slideshowService.loadFromLocalStorage();
      const allSlideshows = Array.from((slideshowService as any)['slideshows'].values());

      const filteredSlideshows = currentFolderId === null
        ? allSlideshows.filter((slideshow: any) => !slideshow.folder_id)
        : allSlideshows.filter((slideshow: any) => slideshow.folder_id === currentFolderId);

      return filteredSlideshows.map((slideshow: any) => ({
        id: slideshow.id,
        name: `${slideshow.title || 'Untitled'}.slideshow`,
        type: 'slideshow' as const,
        modified: new Date(slideshow.updated_at || slideshow.created_at || Date.now()),
        slideshow: slideshow,
      }));
    } catch (error) {
      return [];
    }
  };

  const currentImages = useMemo(() => {
    if (currentFolderId === null) {
      return images;
    }
    const currentFolder = folders.find(f => f.id === currentFolderId);
    return currentFolder ? currentFolder.images : [];
  }, [currentFolderId, images, folders]);

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
      name: img.filename || img.file.name,
      type: 'file' as const,
      size: img.fileSize || img.file.size,
      modified: new Date(img.file.lastModified || Date.now()),
      image: img,
    })),
    ...getSlideshowsFromService()
  ];

  const filteredAndSortedItems = fileItems
    .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const typeOrder = { folder: 0, slideshow: 1, file: 2 };
      if (typeOrder[a.type] !== typeOrder[b.type]) return typeOrder[a.type] - typeOrder[b.type];

      let comparison = 0;
      switch (sortBy) {
        case 'name': comparison = a.name.localeCompare(b.name); break;
        case 'date': comparison = (a.modified?.getTime() || 0) - (b.modified?.getTime() || 0); break;
        case 'size': comparison = (a.size || 0) - (b.size || 0); break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const removeSelected = async () => {
    if (selectedImages.length === 0 && selectedSlideshows.length === 0) return;
    if (!window.confirm('Are you sure you want to delete selected items?')) return;

    const total = selectedImages.length + selectedSlideshows.length;
    const toastId = toast.loading(`Deleting 0/${total} items...`);
    let deletedCount = 0;

    try {
      // Delete images
      for (const id of selectedImages) {
        await imageService.deleteImage(id);
        deletedCount++;
        toast.loading(`Deleting ${deletedCount}/${total} items...`, { id: toastId });
      }
      // Delete slideshows
      for (const id of selectedSlideshows) {
        await slideshowService.deleteSlideshow(id);
        deletedCount++;
        toast.loading(`Deleting ${deletedCount}/${total} items...`, { id: toastId });
      }

      // Update UI
      // 1. Update root images
      const remainingImages = images.filter(img => !selectedImages.includes(img.id));
      onImagesUploaded(remainingImages);

      // 2. Update folders (remove deleted images from folders)
      const updatedFolders = folders.map(folder => ({
        ...folder,
        images: folder.images.filter(img => !selectedImages.includes(img.id))
      }));
      onFoldersChange(updatedFolders);

      onSelectionChange([]);
      onSlideshowSelectionChange([]);
      triggerReRender();
      toast.success(`Successfully deleted ${total} items`, { id: toastId });
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete some items', { id: toastId });
    }
  };

  const selectAll = () => {
    const visibleItems = filteredAndSortedItems.filter(item => item.type === 'file' || item.type === 'slideshow');
    const imageIds = visibleItems.filter(item => item.type === 'file').map(item => item.id);
    const slideshowIds = visibleItems.filter(item => item.type === 'slideshow').map(item => item.id);

    const allVisibleImagesSelected = imageIds.every(id => selectedImages.includes(id));
    const allVisibleSlideshowsSelected = slideshowIds.every(id => selectedSlideshows.includes(id));

    if (allVisibleImagesSelected && allVisibleSlideshowsSelected) {
      onSelectionChange([]);
      onSlideshowSelectionChange([]);
    } else {
      onSelectionChange(imageIds);
      onSlideshowSelectionChange(slideshowIds);
    }
  };

  // Helper to format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Context Menu Handlers
  const handleContextMenu = (e: React.MouseEvent, type: 'background' | 'folder' | 'file' | 'slideshow', targetId?: string, targetName?: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Handle selection on right click
    if (targetId) {
      if (type === 'file') {
        if (!selectedImages.includes(targetId)) {
          onSelectionChange([targetId]);
          onSlideshowSelectionChange([]);
        }
      } else if (type === 'slideshow') {
        if (!selectedSlideshows.includes(targetId)) {
          onSlideshowSelectionChange([targetId]);
          onSelectionChange([]);
        }
      }
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type,
      targetId,
      targetName
    });
  };

  const closeContextMenu = () => setContextMenu(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return;
      }
      closeContextMenu();
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, []);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await imageService.createFolder(newFolderName, currentFolderId || undefined);
      setNewFolderName('');
      setShowNewFolderDialog(false);
      loadData(true);
      toast.success('Folder created');
    } catch (e) {
      console.error(e);
      toast.error('Failed to create folder');
    }
  };

  const handleRenameFolder = async () => {
    if (!renameItemName.trim() || !renameItemId) return;
    try {
      await imageService.renameFolder(renameItemId, renameItemName);
      setRenameItemId('');
      setRenameItemName('');
      setShowRenameDialog(false);
      loadData(true);
      toast.success('Folder renamed');
    } catch (e) {
      console.error(e);
      toast.error('Failed to rename folder');
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!window.confirm('Are you sure you want to delete this folder and all its contents?')) return;
    try {
      await imageService.deleteFolder(folderId);
      loadData(true);
      toast.success('Folder deleted');
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete folder');
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-black/20 backdrop-blur-sm relative"
      onContextMenu={(e) => handleContextMenu(e, 'background')}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center border-2 border-dashed border-primary/50 m-4 rounded-3xl"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              className="flex flex-col items-center gap-4 text-white"
            >
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                <UploadCloud className="w-12 h-12 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">Drop files to upload</h3>
              <p className="text-white/60">Upload to {currentFolderId ? 'current folder' : 'root directory'}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Progress Bar */}
      <AnimatePresence>
        {uploadProgress !== null && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
          >
            <div className="bg-black/90 backdrop-blur-xl border border-white/10 p-4 rounded-xl shadow-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">Uploading...</span>
                <span className="text-xs text-white/60">{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 bg-black/40 backdrop-blur-xl border-b border-white/10 p-4 z-20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left: Search & Sort */}
          <div className="flex flex-col md:flex-row items-center gap-3 flex-1 w-full">
            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-11 px-4 bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/30 hover:text-primary transition-all duration-300 rounded-xl gap-2 group flex-1 md:flex-none">
                    <ArrowUpAz className="w-4 h-4 text-white/60 group-hover:text-primary transition-colors" />
                    <span className="text-sm font-medium text-white/80 group-hover:text-white">Sort</span>
                    <ChevronDown className="w-3 h-3 text-white/40 group-hover:text-primary/70 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 bg-black/90 border-white/10 backdrop-blur-2xl p-2 rounded-xl shadow-2xl shadow-black/50">
                  <DropdownMenuLabel className="text-xs font-medium text-white/40 px-2 py-1.5 uppercase tracking-wider">Sort By</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setSortBy('date')} className="rounded-lg focus:bg-primary/20 focus:text-primary cursor-pointer">
                    <Clock className="w-4 h-4 mr-2 opacity-70" />
                    Date Modified
                    {sortBy === 'date' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('name')} className="rounded-lg focus:bg-primary/20 focus:text-primary cursor-pointer">
                    <ArrowUpAz className="w-4 h-4 mr-2 opacity-70" />
                    Name
                    {sortBy === 'name' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('size')} className="rounded-lg focus:bg-primary/20 focus:text-primary cursor-pointer">
                    <Filter className="w-4 h-4 mr-2 opacity-70" />
                    Size
                    {sortBy === 'size' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10 my-1" />
                  <DropdownMenuItem onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="rounded-lg focus:bg-primary/20 focus:text-primary cursor-pointer">
                    {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                onClick={selectAll}
                className="h-11 px-4 bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/30 hover:text-primary transition-all duration-300 rounded-xl gap-2 group flex-1 md:flex-none"
              >
                <CheckSquare className="w-4 h-4 text-white/60 group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium text-white/80 group-hover:text-white">Select All</span>
              </Button>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 w-full md:w-auto">
            {(selectedImages.length > 0 || selectedSlideshows.length > 0) && (
              <Button
                variant="destructive"
                onClick={removeSelected}
                className="h-11 px-4 bg-red-500/10 border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 text-red-500 hover:text-red-400 transition-all duration-300 rounded-xl gap-2 group"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-sm font-medium">Delete ({selectedImages.length + selectedSlideshows.length})</span>
              </Button>
            )}

            {/* Cut Length Slider */}
            <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/10 h-11 flex-1 md:flex-none min-w-[200px]">
              <label className="text-xs font-medium text-white/60 whitespace-nowrap">Cut Length:</label>
              <div className="w-full md:w-24">
                <Slider
                  value={[cutLength]}
                  onValueChange={(value) => onCutLengthChange(value[0])}
                  min={1}
                  max={20}
                  step={1}
                  className="py-2"
                />
              </div>
              <span className="text-xs font-mono text-primary w-12 text-right">{cutLength}s</span>
            </div>

            <Button
              variant="outline"
              onClick={onCreateFromTemplate}
              className="h-11 px-4 bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/30 hover:text-primary transition-all duration-300 rounded-xl gap-2 group"
            >
              <LayoutTemplate className="w-4 h-4 text-white/60 group-hover:text-primary transition-colors" />
              <span className="text-sm font-medium text-white/80 group-hover:text-white">Template</span>
            </Button>

            <Button
              variant="outline"
              onClick={onBulkPost}
              className="h-11 px-4 bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/30 hover:text-primary transition-all duration-300 rounded-xl gap-2 group"
            >
              <Send className="w-4 h-4 text-white/60 group-hover:text-primary transition-colors" />
              <span className="text-sm font-medium text-white/80 group-hover:text-white">Bulk Post</span>
            </Button>

            <div className="relative">
              <input
                type="file"
                multiple
                accept="image/*,.slideshow"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <Button className="h-11 px-6 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 border-0 rounded-xl gap-2 transition-all duration-300 hover:scale-105 active:scale-95">
                <ImagePlus className="w-4 h-4" />
                <span className="text-sm font-medium">Upload</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-4 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredAndSortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
            <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 shadow-xl">
              <ImagePlus className="w-10 h-10 opacity-30" />
            </div>
            <p className="text-lg font-medium text-white/60">No files found</p>
            <p className="text-sm text-white/30 mt-1">Upload images to get started</p>
          </div>
        ) : (
          <div className={cn(
            "grid gap-4 transition-all duration-300",
            viewMode === 'grid' ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "grid-cols-1"
          )}>
            {filteredAndSortedItems.map(item => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "group relative rounded-xl border transition-all duration-300 cursor-pointer overflow-hidden",
                  viewMode === 'list' ? "flex items-center p-3 gap-4" : "aspect-[4/3] flex flex-col",
                  // Specific Styles based on Type
                  item.type === 'folder' && "bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/40",
                  item.type === 'slideshow' && "bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20 hover:border-purple-500/40",
                  item.type === 'file' && "bg-white/5 border-white/10 hover:bg-white/10",

                  // Selection Styles
                  (item.type === 'file' && selectedImages.includes(item.id)) && "ring-2 ring-primary border-primary/50",
                  (item.type === 'slideshow' && selectedSlideshows.includes(item.id)) && "ring-2 ring-primary border-primary/50"
                )}
                onClick={() => {
                  if (item.type === 'folder') {
                    onCurrentFolderIdChange(item.id);
                  } else if (item.type === 'file') {
                    const newSelection = selectedImages.includes(item.id)
                      ? selectedImages.filter(id => id !== item.id)
                      : [...selectedImages, item.id];
                    onSelectionChange(newSelection);
                  } else if (item.type === 'slideshow') {
                    const newSelection = selectedSlideshows.includes(item.id)
                      ? selectedSlideshows.filter(id => id !== item.id)
                      : [...selectedSlideshows, item.id];
                    onSlideshowSelectionChange(newSelection);
                    if (item.slideshow) onSlideshowLoad(item.slideshow);
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, item.type, item.id, item.name)}
              >
                {item.type === 'folder' ? (
                  <>
                    <div className={cn(
                      "flex items-center justify-center text-blue-400 group-hover:text-blue-300 transition-colors",
                      viewMode === 'list' ? "w-10 h-10 bg-blue-500/20 rounded-lg" : "flex-1"
                    )}>
                      <FolderIcon className={cn(viewMode === 'list' ? "w-5 h-5" : "w-12 h-12")} />
                    </div>
                    <div className={cn(
                      "flex flex-col",
                      viewMode === 'grid' && "p-3 bg-black/40 backdrop-blur-sm border-t border-blue-500/10"
                    )}>
                      <span className="font-medium text-sm truncate text-blue-100 group-hover:text-white">{item.name}</span>
                      <span className="text-[10px] text-blue-200/50">Folder</span>
                    </div>
                  </>
                ) : item.type === 'slideshow' ? (
                  <>
                    <div className={cn(
                      "flex items-center justify-center text-purple-400 group-hover:text-purple-300 transition-colors",
                      viewMode === 'list' ? "w-10 h-10 bg-purple-500/20 rounded-lg" : "flex-1"
                    )}>
                      <Film className={cn(viewMode === 'list' ? "w-5 h-5" : "w-12 h-12")} />
                    </div>
                    <div className={cn(
                      "flex flex-col",
                      viewMode === 'grid' && "p-3 bg-black/40 backdrop-blur-sm border-t border-purple-500/10"
                    )}>
                      <span className="font-medium text-sm truncate text-purple-100 group-hover:text-white">{item.name}</span>
                      <span className="text-[10px] text-purple-200/50">Slideshow</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={cn(
                      "relative overflow-hidden",
                      viewMode === 'list' ? "w-12 h-12 rounded-lg shrink-0" : "w-full h-full"
                    )}>
                      <img
                        src={item.image?.url}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

                      {/* Selection Indicator */}
                      <div className={cn(
                        "absolute top-2 right-2 w-5 h-5 rounded-full border-2 border-white/50 transition-all duration-200 flex items-center justify-center",
                        selectedImages.includes(item.id) ? "bg-primary border-primary scale-100" : "scale-0 group-hover:scale-100 bg-black/50"
                      )}>
                        {selectedImages.includes(item.id) && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                    </div>

                    {viewMode === 'grid' && (
                      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <p className="text-xs font-medium text-white truncate">{item.name}</p>
                        <p className="text-[10px] text-white/60">{formatFileSize(item.size || 0)}</p>
                      </div>
                    )}

                    {viewMode === 'list' && (
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/90 truncate">{item.name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatFileSize(item.size || 0)}</span>
                          <span>•</span>
                          <span>{format(new Date(), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && createPortal(
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[160px] bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: contextMenu.y,
            left: contextMenu.x
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {contextMenu.type === 'background' && (
            <>
              <button
                onClick={() => {
                  setShowNewFolderDialog(true);
                  closeContextMenu();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-left"
              >
                <FolderPlus className="w-4 h-4" />
                New Folder
              </button>
              <button
                onClick={() => {
                  loadData();
                  closeContextMenu();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-left"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </>
          )}

          {contextMenu.type === 'folder' && (
            <>
              <button
                onClick={() => {
                  if (contextMenu.targetId) onCurrentFolderIdChange(contextMenu.targetId);
                  closeContextMenu();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-left"
              >
                <FolderIcon className="w-4 h-4" />
                Open
              </button>
              <button
                onClick={() => {
                  if (contextMenu.targetId && contextMenu.targetName) {
                    setRenameItemId(contextMenu.targetId);
                    setRenameItemName(contextMenu.targetName);
                    setShowRenameDialog(true);
                  }
                  closeContextMenu();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-left"
              >
                <Edit className="w-4 h-4" />
                Rename
              </button>
              <div className="h-px bg-white/10 my-1" />
              <button
                onClick={() => {
                  if (contextMenu.targetId) handleDeleteFolder(contextMenu.targetId);
                  closeContextMenu();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors text-left"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </>
          )}

          {(contextMenu.type === 'file' || contextMenu.type === 'slideshow') && (
            <>
              <button
                onClick={() => {
                  removeSelected();
                  closeContextMenu();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors text-left"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </>
          )}
        </div>,
        document.body
      )}

      {/* New Folder Dialog */}
      {showNewFolderDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-medium text-white mb-4">Create New Folder</h3>
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="bg-white/5 border-white/10 text-white mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') setShowNewFolderDialog(false);
              }}
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setShowNewFolderDialog(false)}
                className="hover:bg-white/5 text-white/60 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateFolder}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Dialog */}
      {showRenameDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-medium text-white mb-4">Rename Folder</h3>
            <Input
              value={renameItemName}
              onChange={(e) => setRenameItemName(e.target.value)}
              placeholder="Folder name"
              className="bg-white/5 border-white/10 text-white mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameFolder();
                if (e.key === 'Escape') setShowRenameDialog(false);
              }}
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setShowRenameDialog(false)}
                className="hover:bg-white/5 text-white/60 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRenameFolder}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                Rename
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

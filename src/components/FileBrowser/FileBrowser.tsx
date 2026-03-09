import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { UploadedImage, Folder, SlideshowMetadata } from '../../types';
import {
  FolderPlus,
  ImagePlus,

  Trash2,
  Film,
  Folder as FolderIcon,
  LayoutTemplate,
  Send,
  CheckSquare,
  Edit,
  RefreshCw,
  UploadCloud,
  CornerLeftUp,
  MousePointer2,
  List,
  LayoutGrid,
  ArrowUpDown,
  Zap,
  Unlink,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

import { format } from 'date-fns';
import { imageService } from '../../lib/imageService';
import { slideshowService } from '../../lib/slideshowService';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { QuickModeDialog } from './QuickModeDialog';
import { postizAPI, PostizProfile } from '../../lib/postiz';
import { useAuth } from '../../hooks/useAuth';

interface FileBrowserProps {
  images: UploadedImage[];
  onImagesUploaded: (images: UploadedImage[]) => void;
  selectedImages: string[];
  onSelectionChange: (ids: string[]) => void;
  selectedSlideshows: string[];
  onSlideshowSelectionChange: (ids: string[]) => void;
  selectedFolders: string[];
  onFolderSelectionChange: (ids: string[]) => void;
  folders: Folder[];
  onFoldersChange: (folders: Folder[]) => void;
  currentFolderId: string | null;
  onCurrentFolderIdChange: (id: string | null) => void;
  onSlideshowLoad: (slideshow: SlideshowMetadata) => void;
  onSlideshowUnload?: () => void;
  onCreateFromTemplate: () => void;
  onBulkPost: () => void;
}

interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder' | 'slideshow';
  size?: number;
  itemCount?: number;
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
  selectedFolders,
  onFolderSelectionChange,
  folders,
  onFoldersChange,
  currentFolderId,
  onCurrentFolderIdChange,
  onSlideshowLoad,
  onSlideshowUnload,
  onCreateFromTemplate,
  onBulkPost,
}: FileBrowserProps) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(false);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const dragCounter = useRef(0);
  const lastTapRef = useRef(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

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

  // Accounts Tab State
  const [activeTab, setActiveTab] = useState<'files' | 'accounts' | 'quickmode'>('files');
  const [tikTokProfiles, setTikTokProfiles] = useState<PostizProfile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);

  // Quick Mode State
  const [quickModeFolder, setQuickModeFolder] = useState<{ id: string; name: string; accountId: string } | null>(null);

  // Assign Folder Dialog State
  const [showAssignFolderDialog, setShowAssignFolderDialog] = useState(false);
  const [folderToAssign, setFolderToAssign] = useState<{ id: string; name: string } | null>(null);
  const [assignTargetAccountId, setAssignTargetAccountId] = useState('');

  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(true);

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

  // Load TikTok profiles
  useEffect(() => {
    const loadProfiles = async () => {
      setIsLoadingProfiles(true);
      try {
        const profiles = await postizAPI.getProfiles();
        setTikTokProfiles(profiles.filter(p => p.provider === 'tiktok'));
      } catch (error) {
        console.error('Failed to load TikTok profiles:', error);
      } finally {
        setIsLoadingProfiles(false);
      }
    };
    loadProfiles();
  }, []);

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
    const handleFolderDataRefresh = async () => {
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
      if (e.key === 'Delete') removeSelected();
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedImages, selectedSlideshows]);

  // Drag and Drop Handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;

    // Check if it's a file upload (has 'Files') and NOT an internal drag (has 'application/json')
    const types = Array.from(e.dataTransfer.types);
    const isFileUpload = types.includes('Files');
    const isInternalDrag = types.includes('application/json');

    if (isFileUpload && !isInternalDrag) {
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

    // Handle internal drag and drop (moving files between folders)
    const dragData = e.dataTransfer.getData('application/json');
    if (dragData) {
      // This is an internal drop on the background - do nothing or maybe move to root?
      // For now, let's only handle drops on specific targets (folders/parent)
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  }, [currentFolderId, images, onImagesUploaded, loadData]);

  // Internal Drag and Drop Handlers
  const handleItemDragStart = (e: React.DragEvent, item: FileItem) => {
    // Set drag data
    const data = {
      id: item.id,
      type: item.type,
      selectedIds: item.type === 'file'
        ? (selectedImages.includes(item.id) ? selectedImages : [item.id])
        : (selectedSlideshows.includes(item.id) ? selectedSlideshows : [item.id])
    };
    e.dataTransfer.setData('application/json', JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'move';

    // Create a custom drag image if multiple items are selected
    if ((item.type === 'file' && selectedImages.length > 1) || (item.type === 'slideshow' && selectedSlideshows.length > 1)) {
      const count = item.type === 'file' ? selectedImages.length : selectedSlideshows.length;
      const dragImage = document.createElement('div');
      dragImage.className = 'bg-primary text-white px-3 py-1 rounded-none shadow-xl font-medium text-sm';
      dragImage.textContent = `Moving ${count} items`;
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    }
  };

  const handleAccountDrop = async (e: React.DragEvent, accountId: string) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;

      const data = JSON.parse(dataStr);
      const idsToMove = data.selectedIds as string[];

      if (idsToMove.length === 0) return;

      toast.loading(`Moving ${idsToMove.length} items to account...`);

      if (data.type === 'file') {
        for (const id of idsToMove) {
          const img = images.find(i => i.id === id);
          // Set account_id for organization, while keeping account_ids for linking
          await imageService.assignImageToAccount(id, accountId, img?.account_ids || []);
        }
        toast.dismiss();
        toast.success(`Moved ${idsToMove.length} images to account folder`);
      } else if (data.type === 'slideshow') {
        for (const id of idsToMove) {
          const slideshow = slideshowService.getSlideshowById(id);
          // Set account_id for organization
          await slideshowService.assignSlideshowToAccount(id, accountId, slideshow?.account_ids || []);
        }
        toast.dismiss();
        toast.success(`Moved ${idsToMove.length} slideshows to account folder`);
      } else if (data.type === 'folder') {
        for (const id of idsToMove) {
          const folder = folders.find(f => f.id === id);
          // Set account_id for organization
          await imageService.assignFolderToAccount(id, accountId, folder?.account_ids || []);
        }
        toast.dismiss();
        toast.success(`Moved ${idsToMove.length} folders to account folder`);
      }

      loadData(true);
      onSelectionChange([]);
      onSlideshowSelectionChange([]);
      onFolderSelectionChange([]);

    } catch (error) {
      console.error('Failed to move items to account:', error);
      toast.dismiss();
      toast.error('Failed to move items to account');
    }
  };

  const handleFolderDrop = async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;

      const data = JSON.parse(dataStr);
      const idsToMove = data.selectedIds as string[];

      if (idsToMove.length === 0) return;

      // Don't allow dropping a folder into itself (though we don't support dragging folders yet)
      if (data.type === 'folder' && idsToMove.includes(targetFolderId)) return;

      // Move items
      if (data.type === 'file') {
        await imageService.moveImagesToFolder(idsToMove, targetFolderId);
        toast.success(`Moved ${idsToMove.length} images to folder`);
      } else if (data.type === 'slideshow') {
        // Use the new moveSlideshowToFolder method
        await slideshowService.moveSlideshowToFolder(idsToMove[0], targetFolderId);

        // If multiple slideshows selected, move them all (though current UI only supports single drag usually)
        if (idsToMove.length > 1) {
          for (let i = 1; i < idsToMove.length; i++) {
            await slideshowService.moveSlideshowToFolder(idsToMove[i], targetFolderId);
          }
        }

        toast.success(`Moved ${idsToMove.length} slideshows to folder`);
      }

      // Refresh data
      loadData(true);

      // Clear selection
      onSelectionChange([]);
      onSlideshowSelectionChange([]);

    } catch (error) {
      console.error('Failed to move items:', error);
      toast.error('Failed to move items');
    }
  };

  const handleParentDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;

      const data = JSON.parse(dataStr);
      const idsToMove = data.selectedIds as string[];

      if (idsToMove.length === 0) return;

      // Determine target (parent of current folder)
      const currentFolder = folders.find(f => f.id === currentFolderId);
      const parentId = currentFolder?.parent_id;

      const isUnassigningFromAccount = activeAccountId !== null && currentFolderId === null;

      if (data.type === 'file') {
        if (isUnassigningFromAccount) {
          for (const id of idsToMove) {
            const img = images.find(i => i.id === id);
            await imageService.unassignImageFromAccount(id, activeAccountId, img?.account_ids || []);
            // Force account_id to null since we are moving it out of the account organization
            await supabase.from('images').update({ account_id: null }).eq('id', id);
          }
          toast.success(`Removed ${idsToMove.length} images from account folder`);
        } else if (parentId) {
          await imageService.moveImagesToFolder(idsToMove, parentId);
          toast.success(`Moved ${idsToMove.length} images to parent folder`);
        } else {
          await imageService.removeImagesFromFolder(idsToMove);
          toast.success(`Moved ${idsToMove.length} images to root`);
        }
      } else if (data.type === 'slideshow') {
        if (isUnassigningFromAccount) {
          for (const id of idsToMove) {
            const slideshow = slideshowService.getSlideshowById(id);
            await slideshowService.unassignSlideshowFromAccount(id, activeAccountId, slideshow?.account_ids || []);
            await supabase.from('slideshows').update({ account_id: null }).eq('id', id.replace('slideshow_', ''));
            // Update memory
            if (slideshow) {
              slideshow.account_id = null;
              slideshowService.saveToLocalStorage();
            }
          }
          toast.success(`Removed ${idsToMove.length} slideshows from account folder`);
        } else {
          const targetId = parentId || null;

          for (const id of idsToMove) {
            await slideshowService.moveSlideshowToFolder(id, targetId);
          }

          toast.success(`Moved ${idsToMove.length} slideshows to ${parentId ? 'parent folder' : 'root'}`);
        }
      } else if (data.type === 'folder') {
        if (isUnassigningFromAccount) {
          for (const id of idsToMove) {
            const folder = folders.find(f => f.id === id);
            await imageService.unassignFolderFromAccount(id, activeAccountId, folder?.account_ids || []);
            await supabase.from('folders').update({ account_id: null }).eq('id', id);
          }
          toast.success(`Removed ${idsToMove.length} folders from account folder`);
        } else if (parentId) {
          // Folder moving to parent is not fully supported yet in FileBrowser drag drop, but if it is:
          await supabase.from('folders').update({ parent_id: parentId }).eq('id', idsToMove[0]);
        } else {
          await supabase.from('folders').update({ parent_id: null }).eq('id', idsToMove[0]);
        }
      }

      // Refresh data
      loadData(true);

      // Clear selection
      onSelectionChange([]);
      onSlideshowSelectionChange([]);
      onFolderSelectionChange([]);

    } catch (error) {
      console.error('Failed to move items:', error);
      toast.error('Failed to move items');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processFiles(files);
    if (e.target) e.target.value = '';
  };


  const currentImages = useMemo(() => {
    if (currentFolderId === null) {
      return images;
    }
    const currentFolder = folders.find(f => f.id === currentFolderId);
    return currentFolder ? currentFolder.images : [];
  }, [currentFolderId, images, folders]);

  const fileItems: FileItem[] = useMemo(() => {
    const items: FileItem[] = [];

    // 1. Add Parent Directory if in a folder or account
    if (currentFolderId || activeAccountId) {
      items.push({
        id: 'parent-directory',
        name: '..',
        type: 'folder',
        modified: new Date(),
      });
    }

    // 2. Add TikTok accounts as "folders" if in root and no active account
    if (currentFolderId === null && activeAccountId === null) {
      tikTokProfiles.forEach(profile => {
        // Calculate item count for this account (organized items)
        const organizedFolders = folders.filter(f => f.account_id === profile.id).length;
        const organizedImages = currentImages.filter(img => img.account_id === profile.id).length;
        const organizedSlideshows = slideshowService.getAllSlideshows().filter(s => s.account_id === profile.id).length;

        items.push({
          id: `account_${profile.id}`,
          name: profile.displayName || profile.username,
          type: 'folder',
          modified: new Date(),
          itemCount: organizedFolders + organizedImages + organizedSlideshows,
          // @ts-ignore - adding custom properties for rendering
          isAccount: true,
          avatar: profile.avatar,
        } as any);
      });
    }

    // 3. Filter items based on activeAccountId and currentFolderId
    // ORGANIZATION (singular account_id): Moves items into the account folder.
    // LINKING (plural account_ids): Used for posting, does not move item.

    // Filter Folders
    const filteredFolders = folders.filter(f => {
      const isInCurrentFolder = f.parent_id === currentFolderId;
      if (!isInCurrentFolder) return false;

      // If we are inside an account, show only items organized into it
      if (activeAccountId) {
        return f.account_id === activeAccountId;
      }

      // If at root, show only items NOT organized into any account
      return f.account_id === null || f.account_id === undefined;
    });

    items.push(...filteredFolders.map(folder => ({
      id: folder.id,
      name: folder.name,
      type: 'folder' as const,
      itemCount: folder.images.length,
      modified: new Date(folder.created_at),
    })));

    // Filter Images
    const filteredImagesData = currentImages.filter(img => {
      // If we are inside an account, show only items organized into it
      if (activeAccountId) {
        return img.account_id === activeAccountId;
      }

      // If at root, show only items NOT organized into any account
      return img.account_id === null || img.account_id === undefined;
    });

    items.push(...filteredImagesData.map(img => ({
      id: img.id,
      name: img.filename || img.file.name,
      type: 'file' as const,
      size: img.fileSize || img.file.size,
      modified: new Date(img.file.lastModified || Date.now()),
      image: img,
    })));

    // Filter Slideshows
    const allSlideshows = slideshowService.getAllSlideshows();
    const filteredSlideshows = allSlideshows.filter(s => {
      const isInCurrentFolder = s.folder_id === currentFolderId;
      if (!isInCurrentFolder) return false;

      // If we are inside an account, show only items organized into it
      if (activeAccountId) {
        return s.account_id === activeAccountId;
      }

      // If at root, show only items NOT organized into any account
      return s.account_id === null || s.account_id === undefined;
    });

    items.push(...filteredSlideshows.map(slideshow => ({
      id: slideshow.id,
      name: `${slideshow.title || 'Untitled'}.slideshow`,
      type: 'slideshow' as const,
      itemCount: slideshow.condensedSlides?.length || 0,
      modified: new Date(slideshow.updated_at || slideshow.created_at || Date.now()),
      slideshow: slideshow,
    })));

    return items;
  }, [currentFolderId, activeAccountId, tikTokProfiles, folders, currentImages]);

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
    if (selectedImages.length === 0 && selectedSlideshows.length === 0 && selectedFolders.length === 0) return;
    if (!window.confirm('Are you sure you want to delete selected items?')) return;

    const total = selectedImages.length + selectedSlideshows.length + selectedFolders.length;
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
      // Delete folders
      for (const id of selectedFolders) {
        await imageService.deleteFolder(id);
        deletedCount++;
        toast.loading(`Deleting ${deletedCount}/${total} items...`, { id: toastId });
      }

      // Update UI
      // 1. Update root images
      const remainingImages = images.filter(img => !selectedImages.includes(img.id));
      onImagesUploaded(remainingImages);

      // 2. Update folders (remove deleted images from folders)
      // Also remove deleted folders
      const updatedFolders = folders
        .filter(f => !selectedFolders.includes(f.id))
        .map(folder => ({
          ...folder,
          images: folder.images.filter(img => !selectedImages.includes(img.id))
        }));
      onFoldersChange(updatedFolders);

      onSelectionChange([]);
      onSlideshowSelectionChange([]);
      onFolderSelectionChange([]);
      triggerReRender();
      toast.success(`Successfully deleted ${total} items`, { id: toastId });
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete some items', { id: toastId });
    }
  };

  const selectAll = () => {
    const visibleItems = filteredAndSortedItems.filter(item => item.type === 'file' || item.type === 'slideshow' || item.type === 'folder');
    const imageIds = visibleItems.filter(item => item.type === 'file').map(item => item.id);
    const slideshowIds = visibleItems.filter(item => item.type === 'slideshow').map(item => item.id);
    const folderIds = visibleItems.filter(item => item.type === 'folder' && item.id !== 'parent-directory').map(item => item.id);

    const allVisibleImagesSelected = imageIds.length > 0 && imageIds.every(id => selectedImages.includes(id));
    const allVisibleSlideshowsSelected = slideshowIds.length > 0 && slideshowIds.every(id => selectedSlideshows.includes(id));
    const allVisibleFoldersSelected = folderIds.length > 0 && folderIds.every(id => selectedFolders.includes(id));

    // If everything visible is selected, deselect all
    // Otherwise, select all visible
    if ((imageIds.length === 0 || allVisibleImagesSelected) &&
      (slideshowIds.length === 0 || allVisibleSlideshowsSelected) &&
      (folderIds.length === 0 || allVisibleFoldersSelected)) {
      onSelectionChange([]);
      onSlideshowSelectionChange([]);
      onFolderSelectionChange([]);
    } else {
      onSelectionChange(imageIds);
      onSlideshowSelectionChange(slideshowIds);
      onFolderSelectionChange(folderIds);
    }
  };

  const handleShiftClick = (clickedItem: FileItem) => {
    if (!lastSelectedId || clickedItem.id === 'parent-directory') return;

    const currentIndex = filteredAndSortedItems.findIndex(item => item.id === clickedItem.id);
    const lastIndex = filteredAndSortedItems.findIndex(item => item.id === lastSelectedId);

    if (currentIndex === -1 || lastIndex === -1) return;

    const start = Math.min(currentIndex, lastIndex);
    const end = Math.max(currentIndex, lastIndex);
    const itemsInRange = filteredAndSortedItems.slice(start, end + 1);

    const newSelectedImages = new Set(selectedImages);
    const newSelectedSlideshows = new Set(selectedSlideshows);
    const newSelectedFolders = new Set(selectedFolders);

    itemsInRange.forEach(item => {
      if (item.id === 'parent-directory') return;
      if (item.type === 'file') newSelectedImages.add(item.id);
      if (item.type === 'slideshow') newSelectedSlideshows.add(item.id);
      if (item.type === 'folder') newSelectedFolders.add(item.id);
    });

    onSelectionChange(Array.from(newSelectedImages));
    onSlideshowSelectionChange(Array.from(newSelectedSlideshows));
    onFolderSelectionChange(Array.from(newSelectedFolders));
  };

  const handleItemClick = (item: FileItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.id === 'parent-directory') {
      if (activeAccountId && !currentFolderId) {
        setActiveAccountId(null);
      } else {
        const currentFolder = folders.find(f => f.id === currentFolderId);
        onCurrentFolderIdChange(currentFolder?.parent_id || null);
      }
      return;
    }

    // Handle account "folder" click
    if (item.id.startsWith('account_')) {
      const accountId = item.id.replace('account_', '');
      setActiveAccountId(accountId);
      return;
    }

    if (e.shiftKey && lastSelectedId) {
      handleShiftClick(item);
      return;
    }

    // Handle Ctrl/Cmd click or Multi-Select Mode (toggle selection)
    if (e.ctrlKey || e.metaKey || isMultiSelectMode) {
      if (item.type === 'file') {
        const isSelected = selectedImages.includes(item.id);
        const newSelection = isSelected
          ? selectedImages.filter(id => id !== item.id)
          : [...selectedImages, item.id];
        onSelectionChange(newSelection);
        if (!isSelected) setLastSelectedId(item.id);
      } else if (item.type === 'slideshow') {
        const isSelected = selectedSlideshows.includes(item.id);
        const newSelection = isSelected
          ? selectedSlideshows.filter(id => id !== item.id)
          : [...selectedSlideshows, item.id];
        onSlideshowSelectionChange(newSelection);
        if (!isSelected) {
          setLastSelectedId(item.id);
          // NEW: Load the slideshow even in multi-select mode if it was just selected
          if (item.slideshow) onSlideshowLoad(item.slideshow);
        }
      } else if (item.type === 'folder') {
        const isSelected = selectedFolders.includes(item.id);
        const newSelection = isSelected
          ? selectedFolders.filter(id => id !== item.id)
          : [...selectedFolders, item.id];
        onFolderSelectionChange(newSelection);
        if (!isSelected) setLastSelectedId(item.id);
      }
      return;
    }

    // Handle normal click (select only this item, unless it's already selected then maybe do nothing or deselect others?)
    // Standard behavior: Select this item, deselect others.

    // For files:
    if (item.type === 'file') {
      onSelectionChange([item.id]);
      onSlideshowSelectionChange([]);
      onFolderSelectionChange([]);
      setLastSelectedId(item.id);

      // Unload slideshow if previously selected
      if (selectedSlideshows.length > 0 && onSlideshowUnload) {
        onSlideshowUnload();
      }
    }
    // For slideshows:
    else if (item.type === 'slideshow') {
      onSelectionChange([]);
      onSlideshowSelectionChange([item.id]);
      onFolderSelectionChange([]);
      setLastSelectedId(item.id);

      if (item.slideshow) onSlideshowLoad(item.slideshow);
    }
    // For folders:
    // For folders:
    else if (item.type === 'folder') {
      // Single click to open folder immediately
      onCurrentFolderIdChange(item.id);

      // Clear selections as we are navigating away from current view context essentially
      onSelectionChange([]);
      onSlideshowSelectionChange([]);
      onFolderSelectionChange([]);
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

  useEffect(() => {
    async function fetchProfiles() {
      setIsLoadingProfiles(true);
      try {
        const profiles = await postizAPI.getProfiles();
        const tiktok = profiles.filter((p: any) => p.provider === 'tiktok');
        setTikTokProfiles(tiktok);
      } catch (e) {
        console.error('Failed to load TikTok profiles', e);
      } finally {
        setIsLoadingProfiles(false);
      }
    }
    fetchProfiles();
  }, [activeTab]);

  const handleAssignFolder = async () => {
    if (!folderToAssign || !assignTargetAccountId) return;
    try {
      const folder = folders.find(f => f.id === folderToAssign.id);
      await imageService.assignFolderToAccount(folderToAssign.id, assignTargetAccountId, folder?.account_ids || []);
      toast.success('Folder assigned to account successfully');
      setShowAssignFolderDialog(false);
      loadData(true);
    } catch (e) {
      console.error(e);
      toast.error('Failed to assign folder');
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-black/20 backdrop-blur-sm relative"
      onContextMenu={(e) => {
        if (activeTab === 'files') handleContextMenu(e, 'background');
      }}
      onDragEnter={activeTab === 'files' ? handleDragEnter : undefined}
      onDragLeave={activeTab === 'files' ? handleDragLeave : undefined}
      onDragOver={activeTab === 'files' ? handleDragOver : undefined}
      onDrop={activeTab === 'files' ? handleDrop : undefined}
      onDoubleClick={(e) => {
        if (activeTab === 'files' && e.target === e.currentTarget) {
          setShowNewFolderDialog(true);
        }
      }}
      onTouchEnd={(e) => {
        if (activeTab === 'files' && e.target === e.currentTarget) {
          const now = Date.now();
          if (now - lastTapRef.current < 300) {
            setShowNewFolderDialog(true);
          }
          lastTapRef.current = now;
        }
      }}
    >
      {/* Tab Navigation */}
      <div className="flex border-b border-white/10 px-4 shrink-0">
        <button
          className={cn(
            "px-6 py-4 text-sm font-medium transition-all relative",
            activeTab === 'files' ? "text-primary" : "text-white/60 hover:text-white"
          )}
          onClick={() => setActiveTab('files')}
        >
          Files
          {activeTab === 'files' && (
            <motion.div layoutId="activeTab" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          className={cn(
            "px-6 py-4 text-sm font-medium transition-all relative flex items-center gap-2",
            activeTab === 'accounts' ? "text-primary" : "text-white/60 hover:text-white"
          )}
          onClick={() => setActiveTab('accounts')}
        >
          {isLoadingProfiles && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
          Accounts
          {activeTab === 'accounts' && (
            <motion.div layoutId="activeTab" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          className={cn(
            "px-6 py-4 text-sm font-medium transition-all relative flex items-center gap-2",
            activeTab === 'quickmode' ? "text-primary" : "text-white/60 hover:text-white"
          )}
          onClick={() => setActiveTab('quickmode')}
        >
          <Zap className="w-3.5 h-3.5" />
          Quick Mode
          {activeTab === 'quickmode' && (
            <motion.div layoutId="activeTab" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        <QuickModeDialog
          isOpen={!!quickModeFolder}
          onClose={() => setQuickModeFolder(null)}
          folderId={quickModeFolder?.id || ''}
          folderName={quickModeFolder?.name || ''}
          accountId={quickModeFolder?.accountId || ''}
          userId={user?.id || ''}
        />
        {activeTab === 'files' && (
          <div className="flex flex-col h-full w-full relative">
            {/* Drag Overlay */}
            <AnimatePresence>
              {isDragging && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center border-dashed m-4 rounded-none"
                >
                  <motion.div
                    initial={{ scale: 0.8, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.8, y: 20 }}
                    className="flex flex-col items-center gap-4 text-white"
                  >
                    <div className="w-24 h-24 rounded-none bg-primary/20 flex items-center justify-center animate-pulse">
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
                  <div className="bg-black/90 backdrop-blur-xl  p-4 rounded-none shadow-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">Uploading...</span>
                      <span className="text-xs text-white/60">{Math.round(uploadProgress)}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col gap-2 bg-black/40 backdrop-blur-xl  p-2 z-20">
              <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-1">
                {/* Left: Select All & Multi-Select Group */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={selectAll}
                    className="h-8 px-3 bg-white/5 hover:bg-white/10 hover:border-primary/30 hover:text-primary transition-all duration-300 rounded-none gap-2 group"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-white/60 group-hover:text-primary transition-colors" />
                    <span className="text-xs font-medium text-white/80 group-hover:text-white">Select All</span>
                  </Button>

                  <Button
                    variant={isMultiSelectMode ? "default" : "outline"}
                    onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
                    className={cn(
                      "h-8 px-3 transition-all duration-300 rounded-none gap-2 group",
                      isMultiSelectMode
                        ? "bg-primary border-primary text-white hover:bg-primary/90"
                        : "bg-white/5 hover:bg-white/10 hover:border-primary/30 hover:text-primary"
                    )}
                    title="Toggle click-to-select mode"
                  >
                    <MousePointer2 className={cn("w-3.5 h-3.5 transition-colors", isMultiSelectMode ? "text-white" : "text-white/60 group-hover:text-primary")} />
                    <span className={cn("text-xs font-medium", isMultiSelectMode ? "text-white" : "text-white/80 group-hover:text-white")}>
                      {isMultiSelectMode ? 'Multi-Select On' : 'Multi-Select'}
                    </span>
                  </Button>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                    className="h-8 w-8 bg-white/5 hover:bg-white/10 hover:border-primary/30 hover:text-primary transition-all duration-300 rounded-none"
                    title={viewMode === 'grid' ? "Switch to List View" : "Switch to Grid View"}
                  >
                    {viewMode === 'grid' ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-8 px-3 bg-white/5 hover:bg-white/10 hover:border-primary/30 hover:text-primary transition-all duration-300 rounded-none gap-2 group"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5 text-white/60 group-hover:text-primary transition-colors" />
                        <span className="text-xs font-medium text-white/80 group-hover:text-white hidden sm:inline">Sort</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                        <DropdownMenuRadioItem value="date">Date</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="size">Size</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Order</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup value={sortOrder} onValueChange={(v) => setSortOrder(v as any)}>
                        <DropdownMenuRadioItem value="desc">Descending</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="asc">Ascending</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Delete Button */}
                  <AnimatePresence>
                    {(selectedImages.length > 0 || selectedSlideshows.length > 0) && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, width: 0 }}
                        animate={{ opacity: 1, scale: 1, width: 'auto' }}
                        exit={{ opacity: 0, scale: 0.9, width: 0 }}
                        className="overflow-hidden"
                      >
                        <Button
                          variant="destructive"
                          onClick={removeSelected}
                          className="h-8 px-3 bg-red-500/10 hover:bg-red-500/20 hover:border-0 text-red-500 hover:text-red-400 transition-all duration-300 rounded-none gap-2 whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">Delete ({selectedImages.length + selectedSlideshows.length + selectedFolders.length})</span>
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Button
                    variant="outline"
                    onClick={onCreateFromTemplate}
                    className="h-8 px-3 bg-white/5 hover:bg-white/10 hover:border-primary/30 hover:text-primary transition-all duration-300 rounded-none gap-2 group"
                  >
                    <LayoutTemplate className="w-3.5 h-3.5 text-white/60 group-hover:text-primary transition-colors" />
                    <span className="text-xs font-medium text-white/80 group-hover:text-white">Template</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={onBulkPost}
                    className="h-8 px-3 bg-white/5 hover:bg-white/10 hover:border-primary/30 hover:text-primary transition-all duration-300 rounded-none gap-2 group"
                  >
                    <Send className="w-3.5 h-3.5 text-white/60 group-hover:text-primary transition-colors" />
                    <span className="text-xs font-medium text-white/80 group-hover:text-white">Bulk Post</span>
                  </Button>

                  <div className="relative hidden sm:block">
                    <input
                      type="file"
                      multiple
                      accept="image/*,.slideshow"
                      onChange={handleFileSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <Button className="h-8 px-4 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 border-0 rounded-none gap-2 transition-all duration-300 hover:scale-105 active:scale-95">
                      <ImagePlus className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Upload</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Upload FAB */}
            <div className="absolute bottom-6 right-6 z-50 sm:hidden">
              <div className="relative group">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-none opacity-50 group-hover:opacity-100 transition-opacity" />
                <input
                  type="file"
                  multiple
                  accept="image/*,.slideshow"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <Button className="h-14 w-14 rounded-none bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 border-0 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95">
                  <ImagePlus className="w-6 h-6" />
                </Button>
              </div>
            </div>

            {/* Content Area */}
            <div
              className="flex-1 p-4 overflow-auto min-h-0"
              onClick={() => {
                onSelectionChange([]);
                onSlideshowSelectionChange([]);
                onFolderSelectionChange([]);
              }}
              onDoubleClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowNewFolderDialog(true);
                }
              }}
              onTouchEnd={(e) => {
                if (e.target === e.currentTarget) {
                  const now = Date.now();
                  if (now - lastTapRef.current < 300) {
                    setShowNewFolderDialog(true);
                  }
                  lastTapRef.current = now;
                }
              }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-none h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredAndSortedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
                  <div className="w-20 h-20 rounded-none bg-white/5 flex items-center justify-center mb-6  shadow-xl">
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
                  <AnimatePresence>
                    {filteredAndSortedItems.map(item => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className={cn(
                          "group relative rounded-none transition-all duration-150 cursor-pointer overflow-hidden border border-transparent",
                          viewMode === 'list' ? "flex items-center p-3 gap-4 border-b border-white/5" : "aspect-[4/3] flex flex-col",
                          // Specific Styles based on Type
                          item.type === 'folder' && (
                            selectedFolders.includes(item.id)
                              ? "bg-white/10 ring-1 ring-white"
                              : "bg-white/5 hover:bg-white/10"
                          ),
                          item.type === 'slideshow' && (
                            (item.slideshow?.lastUploadStatus === 'failed') ? "bg-white/10 hover:bg-white/15" :
                              (item.slideshow?.uploadCount || 0) > 1 ? "bg-white/5 hover:bg-white/15" :
                                (item.slideshow?.uploadCount === 1) ? "bg-white/5 hover:bg-white/15" :
                                  "bg-white/5 hover:bg-white/10"
                          ),
                          item.type === 'file' && "bg-white/5 hover:bg-white/10",

                          // Selection Styles
                          (item.type === 'file' && selectedImages.includes(item.id)) && "bg-white/20 ring-1 ring-white",
                          (item.type === 'slideshow' && selectedSlideshows.includes(item.id)) && "bg-white/20 ring-1 ring-white",
                          // Drop Target Styles
                          (item.id === 'parent-directory' || item.type === 'folder' || (item as any).isAccount) && "hover:bg-white/15"
                        )}
                        draggable={item.id !== 'parent-directory'}
                        onDragStart={(e: any) => handleItemDragStart(e, item)}
                        onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
                          if (item.type === 'folder' || item.id === 'parent-directory' || (item as any).isAccount) {
                            e.preventDefault(); // Allow drop
                            e.currentTarget.classList.add('ring-1', 'ring-white', 'bg-white/20');
                          }
                        }}
                        onDragLeave={(e) => {
                          if (item.type === 'folder' || item.id === 'parent-directory' || (item as any).isAccount) {
                            e.currentTarget.classList.remove('ring-1', 'ring-white', 'bg-white/20');
                          }
                        }}
                        onDrop={(e) => {
                          e.currentTarget.classList.remove('ring-1', 'ring-white', 'bg-white/20');
                          if (item.id === 'parent-directory') {
                            handleParentDrop(e);
                          } else if (item.type === 'folder') {
                            if ((item as any).isAccount) {
                              const accountId = item.id.replace('account_', '');
                              handleAccountDrop(e, accountId);
                            } else {
                              handleFolderDrop(e, item.id);
                            }
                          }
                        }}
                        onDoubleClick={() => {
                          if (item.type === 'folder' && item.id !== 'parent-directory') {
                            if ((item as any).isAccount) {
                              const accountId = item.id.replace('account_', '');
                              setActiveAccountId(accountId);
                            } else {
                              onCurrentFolderIdChange(item.id);
                            }
                          }
                        }}
                        onClick={(e) => handleItemClick(item, e)}
                        onContextMenu={(e) => handleContextMenu(e, item.type, item.id, item.name)}
                        onTouchStart={(e) => {
                          const touch = e.touches[0];
                          const clientX = touch.clientX;
                          const clientY = touch.clientY;
                          longPressTimer.current = setTimeout(() => {
                            handleContextMenu({
                              preventDefault: () => { },
                              stopPropagation: () => { },
                              clientX,
                              clientY,
                            } as React.MouseEvent, item.type, item.id, item.name);
                          }, 500);
                        }}
                        onTouchEnd={() => {
                          if (longPressTimer.current) {
                            clearTimeout(longPressTimer.current);
                            longPressTimer.current = null;
                          }
                        }}
                        onTouchMove={() => {
                          if (longPressTimer.current) {
                            clearTimeout(longPressTimer.current);
                            longPressTimer.current = null;
                          }
                        }}
                      >
                        {item.type === 'folder' ? (
                          <>
                            <div className={cn(
                              "flex items-center justify-center text-white/50 group-hover:text-white transition-colors",
                              viewMode === 'list' ? "w-10 h-10 rounded-none bg-white/5" : "flex-1"
                            )}>
                              {item.id === 'parent-directory' ? (
                                <CornerLeftUp className={cn(viewMode === 'list' ? "w-5 h-5" : "w-12 h-12")} />
                              ) : (item as any).isAccount ? (
                                (item as any).avatar ? (
                                  <img
                                    src={(item as any).avatar}
                                    className={cn("object-cover transition-all rounded-none border-none", viewMode === 'list' ? "w-6 h-6" : "w-16 h-16")}
                                    alt={item.name}
                                  />
                                ) : (
                                  <Users className={cn(viewMode === 'list' ? "w-5 h-5" : "w-14 h-14")} />
                                )
                              ) : (
                                <FolderIcon strokeWidth={1} className={cn(viewMode === 'list' ? "w-5 h-5" : "w-14 h-14")} />
                              )}
                            </div>
                            <div className={cn(
                              "flex flex-col",
                              viewMode === 'grid' && "p-3 bg-white/5 border-t border-white/10 group-hover:bg-white/10 transition-colors"
                            )}>
                              <span className="font-mono text-xs truncate text-white/80 group-hover:text-white uppercase tracking-wider">{item.name}</span>
                              <span className="text-[10px] text-white/40 font-mono mt-0.5">{item.itemCount} ITEMS</span>
                            </div>
                          </>
                        ) : item.type === 'slideshow' ? (
                          <>
                            <div className={cn(
                              "flex items-center justify-center transition-colors",
                              (item.slideshow?.lastUploadStatus === 'failed') ? "text-red-400 group-hover:text-red-300" :
                                (item.slideshow?.uploadCount || 0) > 1 ? "text-white/70 group-hover:text-white" :
                                  (item.slideshow?.uploadCount === 1) ? "text-white/70 group-hover:text-white" :
                                    "text-white/50 group-hover:text-white",
                              viewMode === 'list' ? (
                                (item.slideshow?.lastUploadStatus === 'failed') ? "w-10 h-10 bg-red-500/20 rounded-none" :
                                  "w-10 h-10 bg-white/5 rounded-none"
                              ) : "flex-1"
                            )}>
                              <Film strokeWidth={1} className={cn(viewMode === 'list' ? "w-5 h-5" : "w-14 h-14")} />
                            </div>
                            <div className={cn(
                              "flex flex-col",
                              viewMode === 'grid' && (
                                (item.slideshow?.lastUploadStatus === 'failed') ? "p-3 bg-red-500/5 backdrop-blur-sm border-red-500/10 border-t" :
                                  "p-3 bg-white/5 backdrop-blur-sm border-white/10 border-t group-hover:bg-white/10 transition-colors"
                              )
                            )}>
                              <span className={cn(
                                "font-mono text-xs truncate group-hover:text-white uppercase tracking-wider",
                                (item.slideshow?.lastUploadStatus === 'failed') ? "text-red-200" :
                                  "text-white/80"
                              )}>{item.name}</span>
                              <span className={cn(
                                "text-[10px] font-mono mt-0.5",
                                (item.slideshow?.lastUploadStatus === 'failed') ? "text-red-200/50" :
                                  "text-white/40"
                              )}>{item.itemCount} SLIDES</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className={cn(
                              "relative overflow-hidden",
                              viewMode === 'list' ? "w-12 h-12 rounded-none shrink-0" : "w-full h-full"
                            )}>
                              <img
                                src={item.image?.url}
                                alt={item.name}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

                              {/* Selection Indicator */}
                              <div className={cn(
                                "absolute top-2 right-2 w-5 h-5 rounded-none border-white/50 transition-all duration-200 flex items-center justify-center",
                                selectedImages.includes(item.id) ? "bg-white border-white scale-100" : "scale-0 group-hover:scale-100 bg-black/50"
                              )}>
                                {selectedImages.includes(item.id) && <div className="w-2 h-2 bg-black rounded-none" />}
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
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ACCOUNTS VIEW START */}
        {activeTab === 'accounts' && (
          <div className="flex-1 overflow-auto p-4 flex flex-col gap-8 min-h-0">
            {isLoadingProfiles ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : tikTokProfiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center border rounded-none border-dashed border-white/10 bg-black/20">
                <div className="w-16 h-16 rounded-none bg-white/5 flex items-center justify-center mb-4">
                  <Film className="w-8 h-8 text-white/40" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No Connected Accounts</h3>
                <p className="text-sm text-white/60 max-w-md">
                  Connect a TikTok account in the Settings to start organizing folders by account.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {tikTokProfiles.map(profile => {
                  const accountFolders = folders.filter(f => f.account_ids?.includes(profile.id));

                  return (
                    <div key={profile.id} className="bg-black/40 border-transparent rounded-sm overflow-hidden flex flex-col h-full">
                      {/* Account Header */}
                      <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-white/5 pb-3">
                        {profile.avatar ? (
                          <img src={profile.avatar} alt={profile.displayName} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                            {profile.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-white line-clamp-2 leading-tight" title={profile.displayName}>{profile.displayName}</h4>
                          <p className="text-xs text-white/50 truncate mt-0.5">TikTok Account</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-white/60 hover:text-white"
                          onClick={() => {
                            setAssignTargetAccountId(profile.id);
                            setShowAssignFolderDialog(true);
                          }}
                          title="Assign existing folder"
                        >
                          <FolderPlus className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Account Folders */}
                      <div className="p-3 flex-1 overflow-y-auto">
                        {accountFolders.length === 0 ? (
                          <div className="h-full min-h-[100px] flex flex-col items-center justify-center text-center p-4">
                            <p className="text-xs text-white/40 mb-2">No folders assigned</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs bg-white/5 border-transparent hover:bg-white/10"
                              onClick={() => {
                                setAssignTargetAccountId(profile.id);
                                setShowAssignFolderDialog(true);
                              }}
                            >
                              Assign Folder
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {accountFolders.map(folder => (
                              <div
                                key={folder.id}
                                className="group flex items-center gap-3 p-2 rounded-sm hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/10"
                                onClick={() => {
                                  onCurrentFolderIdChange(folder.id);
                                  setActiveTab('files');
                                }}
                              >
                                <div className="w-8 h-8 rounded-sm bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                                  <FolderIcon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-blue-100 truncate group-hover:text-white transition-colors">{folder.name}</p>
                                  <p className="text-[10px] text-white/40">{folder.images?.length || 0} items</p>
                                </div>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary hover:bg-primary/20 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setQuickModeFolder({ id: folder.id, name: folder.name, accountId: profile.id });
                                  }}
                                  title="Quick Mode"
                                >
                                  <Zap className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-400 hover:bg-red-500/20 shrink-0 ml-1"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`Unassign this folder from ${profile.displayName}?`)) {
                                      try {
                                        await imageService.unassignFolderFromAccount(folder.id, profile.id, folder.account_ids || []);
                                        toast.success('Folder unassigned');
                                        loadData(true);
                                      } catch (err) {
                                        toast.error('Failed to unassign folder');
                                      }
                                    }
                                  }}
                                  title="Unassign Folder"
                                >
                                  <Unlink className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* QUICK MODE VIEW START */}
        {activeTab === 'quickmode' && (
          <div className="flex-1 overflow-auto p-4 flex flex-col gap-8 min-h-0">
            {isLoadingProfiles ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : folders.filter(f => f.account_ids && f.account_ids.length > 0).length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center border-none rounded-none bg-black/20">
                <div className="w-16 h-16 rounded-none bg-white/5 flex items-center justify-center mb-4">
                  <Zap className="w-8 h-8 text-white/40" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2 uppercase tracking-wider">No Folders Assigned</h3>
                <p className="text-xs text-white/40 max-w-md uppercase tracking-widest leading-relaxed">
                  Assign folders to your TikTok accounts in the Accounts tab to use Quick Mode.
                </p>
                <Button
                  onClick={() => setActiveTab('accounts')}
                  className="mt-8 bg-white/10 hover:bg-white/20 text-white rounded-none border-none uppercase tracking-[0.2em] text-[10px] font-bold h-10 px-8"
                >
                  Go to Accounts Tab
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-8 max-w-4xl mxauto w-full pb-20">
                {tikTokProfiles
                  .filter(profile => folders.some(f => f.account_ids?.includes(profile.id)))
                  .map(profile => {
                    const accountFolders = folders.filter(f => f.account_ids?.includes(profile.id));
                    return (
                      <div
                        key={profile.id}
                        className="bg-[#0f0f0f] border border-white/5 shadow-2xl rounded-none overflow-hidden flex flex-col"
                      >
                        {/* Profile Header */}
                        <div className="flex items-center gap-4 p-5 border-b border-white/5 bg-white/[0.03]">
                          <div className="relative">
                            {profile.avatar ? (
                              <img src={profile.avatar} alt={profile.displayName} className="w-10 h-10 rounded-none object-cover border border-white/10" />
                            ) : (
                              <div className="w-10 h-10 rounded-none bg-primary/20 flex items-center justify-center text-primary font-bold text-sm border border-primary/20 uppercase">
                                {profile.displayName.charAt(0)}
                              </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-black border border-white/10 flex items-center justify-center">
                              <Zap className="w-2.5 h-2.5 text-primary fill-primary" />
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">{profile.displayName}</h4>
                            <p className="text-[9px] text-white/30 uppercase tracking-widest mt-1">
                              {accountFolders.length} linked {accountFolders.length === 1 ? 'folder' : 'folders'}
                            </p>
                          </div>
                        </div>

                        {/* Associated Folders */}
                        <div className="divide-y divide-white/5 bg-black/20">
                          {accountFolders.map(folder => (
                            <div key={folder.id} className="flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors group">
                              <div className="flex items-center gap-5">
                                <div className="w-12 h-12 rounded-none bg-white/5 flex items-center justify-center border border-white/5 text-white/20 group-hover:border-primary/30 group-hover:text-primary transition-all duration-300">
                                  <FolderIcon className="w-6 h-6 fill-current opacity-20" />
                                </div>
                                <div>
                                  <h5 className="text-white font-bold text-sm tracking-wide group-hover:text-primary transition-colors">{folder.name}</h5>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-white/20 text-[9px] uppercase tracking-widest border border-white/5 px-1.5 py-0.5">FOLDER</span>
                                    <span className="text-white/40 text-[10px] uppercase tracking-tighter">{folder.images?.length || 0} assets</span>
                                  </div>
                                </div>
                              </div>
                              <Button
                                onClick={() => {
                                  setQuickModeFolder({ id: folder.id, name: folder.name, accountId: profile.id });
                                }}
                                className="bg-primary hover:bg-primary/90 text-white gap-3 rounded-none border-none uppercase tracking-[0.15em] text-[10px] font-black h-11 px-8 shadow-lg shadow-primary/20 transition-all hover:translate-x-1"
                              >
                                <Zap className="w-4 h-4 fill-current" />
                                Launch Quick Mode
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Assign Folder Dialog */}
      {showAssignFolderDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] rounded-sm p-6 w-full max-w-sm shadow-2xl border border-transparent">
            <h3 className="text-lg font-medium text-white mb-4">Assign Folder to Account</h3>

            <div className="flex flex-col gap-4 mb-6">
              {folders.filter(f => !f.parent_id && !f.account_ids?.includes(assignTargetAccountId)).length === 0 ? (
                <p className="text-sm text-white/60">No unassigned root folders available.</p>
              ) : (
                <div className="max-h-[200px] overflow-y-auto pr-2 flex flex-col gap-2">
                  {folders.filter(f => !f.parent_id && !f.account_ids?.includes(assignTargetAccountId)).map(folder => (
                    <div
                      key={folder.id}
                      className={cn(
                        "p-3 rounded-sm border cursor-pointer transition-all flex items-center gap-3",
                        folderToAssign?.id === folder.id
                          ? "bg-primary/20 border-primary text-white"
                          : "bg-white/5 border-transparent text-white/70 hover:bg-white/10 hover:text-white"
                      )}
                      onClick={() => setFolderToAssign({ id: folder.id, name: folder.name })}
                    >
                      <FolderIcon className={cn("w-4 h-4", folderToAssign?.id === folder.id ? "text-primary" : "text-white/50")} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{folder.name}</span>
                        <span className="text-[10px] opacity-60">{folder.images?.length || 0} items</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowAssignFolderDialog(false);
                  setFolderToAssign(null);
                  setAssignTargetAccountId('');
                }}
                className="hover:bg-white/5 text-white/60 hover:text-white rounded-sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssignFolder}
                disabled={!folderToAssign}
                className="bg-primary hover:bg-primary/90 text-white rounded-sm"
              >
                Assign
              </Button>
            </div>
          </div>
        </div>
      )}


      {/* Context Menu */}
      {
        contextMenu && createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 min-w-[160px] bg-black/90 backdrop-blur-xl  rounded-none shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100"
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
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-none transition-colors text-left"
                >
                  <FolderPlus className="w-4 h-4" />
                  New Folder
                </button>
                <button
                  onClick={() => {
                    loadData();
                    closeContextMenu();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-none transition-colors text-left"
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
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-none transition-colors text-left"
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
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-none transition-colors text-left"
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
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-none transition-colors text-left"
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
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-none transition-colors text-left"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </>
            )}
          </div>,
          document.body
        )
      }

      {/* New Folder Dialog */}
      {
        showNewFolderDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-[#1a1a1a]  rounded-none p-6 w-full max-w-sm shadow-2xl">
              <h3 className="text-lg font-medium text-white mb-4">Create New Folder</h3>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="bg-white/5 text-white mb-4"
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
        )
      }

      {/* Rename Dialog */}
      {
        showRenameDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-[#1a1a1a]  rounded-none p-6 w-full max-w-sm shadow-2xl">
              <h3 className="text-lg font-medium text-white mb-4">Rename Folder</h3>
              <Input
                value={renameItemName}
                onChange={(e) => setRenameItemName(e.target.value)}
                placeholder="Folder name"
                className="bg-white/5 text-white mb-4"
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
        )
      }
    </div >
  );
}

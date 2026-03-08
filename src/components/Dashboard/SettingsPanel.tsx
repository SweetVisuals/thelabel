import React, { useState, useEffect } from 'react';
import { SlideshowTemplate } from '../../types';
import {
    Type,
    Hash,
    Settings,
    Save,
    Send,
    Layers,
    Image as ImageIcon,
    Clock,
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    ChevronRight,
    Plus,
    X,
    Play,
    Wand2,
    Palette,
    LayoutTemplate,
    Key,
    Trash2,
    Pencil,
    RefreshCw,
    Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { TikTokTextOverlay } from '@/types';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ApiKeys {
    postizApiKey: string;
    tiktokAccessToken: string;
}

interface SettingsPanelProps {
    // State
    title: string;
    setTitle: (value: string) => void;
    postTitle: string;
    setPostTitle: (value: string) => void;
    caption: string;
    setCaption: (value: string) => void;
    hashtags: string[];
    setHashtags: (value: string[]) => void;
    textOverlays: TikTokTextOverlay[];
    setTextOverlays: (value: TikTokTextOverlay[]) => void;

    aspectRatio: string;
    setAspectRatio: (value: string) => void;

    // New Props
    apiKeys: ApiKeys;
    setApiKeys: (value: ApiKeys) => void;
    selectedTemplate: string;
    setSelectedTemplate: (value: string) => void;

    // Actions
    onSaveSlideshow: () => void;
    onPostToTikTok: () => void;
    onAddTextOverlay: () => void;
    onRemoveTextOverlay: (id: string) => void;
    onUpdateTextOverlay: (id: string, updates: Partial<TikTokTextOverlay>) => void;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;

    // Data
    savedHashtags: string[];
    onAddHashtag: (tag: string) => void;
    selectedImagesCount: number;
    savedTemplates: SlideshowTemplate[];
    onLoadTemplate: (template: SlideshowTemplate) => void;
    onSaveTemplate: () => void;
    onDeleteTemplate: (templateId: string) => void;
    onUpdateTemplateMetadata: (templateId: string, name: string, description: string) => void;
    onOverwriteTemplate: (templateId: string) => void;
}

export function SettingsPanel({
    title, setTitle,
    postTitle, setPostTitle,
    caption, setCaption,
    hashtags, setHashtags,
    textOverlays, setTextOverlays,

    aspectRatio, setAspectRatio,
    apiKeys, setApiKeys,
    selectedTemplate, setSelectedTemplate,
    onSaveSlideshow,
    onPostToTikTok,
    onAddTextOverlay,
    onRemoveTextOverlay,
    onUpdateTextOverlay,
    isCollapsed = false,
    onToggleCollapse,
    savedHashtags,
    onAddHashtag,
    selectedImagesCount,
    savedTemplates = [],
    onLoadTemplate,
    onSaveTemplate,
    onDeleteTemplate,
    onUpdateTemplateMetadata,
    onOverwriteTemplate
}: SettingsPanelProps) {
    const [hashtagInput, setHashtagInput] = useState('');
    const [openSections, setOpenSections] = useState<string[]>(['general', 'templates', 'visual', 'text', 'api', 'export']);
    const [isSavingKey, setIsSavingKey] = useState(false);

    // Edit Template State
    const [isEditTemplateOpen, setIsEditTemplateOpen] = useState(false);
    const [templateToEdit, setTemplateToEdit] = useState<{ id: string, name: string, description: string } | null>(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

    const handleEditClick = (e: React.MouseEvent, template: SlideshowTemplate) => {
        e.stopPropagation();
        setTemplateToEdit({
            id: template.id,
            name: template.name,
            description: template.description || ''
        });
        setEditName(template.name);
        setEditDescription(template.description || '');
        setIsEditTemplateOpen(true);
    };

    const handleSaveEdit = () => {
        if (templateToEdit && editName.trim()) {
            onUpdateTemplateMetadata(templateToEdit.id, editName.trim(), editDescription.trim());
            setIsEditTemplateOpen(false);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent, templateId: string) => {
        e.stopPropagation();
        setTemplateToDelete(templateId);
        setIsDeleteAlertOpen(true);
    };

    const confirmDelete = () => {
        if (templateToDelete) {
            onDeleteTemplate(templateToDelete);
            setIsDeleteAlertOpen(false);
            setTemplateToDelete(null);
            if (selectedTemplate === templateToDelete) {
                setSelectedTemplate('');
            }
        }
    };

    const [timezone, setTimezone] = useState('UTC');
    const [availableTimezones] = useState((Intl as any).supportedValuesOf ? (Intl as any).supportedValuesOf('timeZone') : ['UTC']);

    // Loading state
    useEffect(() => {
        const loadUserData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data, error } = await supabase
                    .from('users')
                    .select('postiz_api_key, timezone')
                    .eq('id', user.id)
                    .single();

                if (data) {
                    if (data.postiz_api_key) {
                        setApiKeys((prev: ApiKeys) => ({ ...prev, postizApiKey: data.postiz_api_key }));
                    }
                    if (data.timezone) {
                        setTimezone(data.timezone);
                    }
                }
            }
        };
        loadUserData();
    }, []);

    const toggleSection = (section: string) => {
        setOpenSections(prev =>
            prev.includes(section)
                ? prev.filter(s => s !== section)
                : [...prev, section]
        );
    };

    const handleAddHashtag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && hashtagInput.trim()) {
            onAddHashtag(hashtagInput.trim());
            setHashtagInput('');
        }
    };

    const handleSaveUserData = async () => {
        setIsSavingKey(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('You must be logged in to save settings');
                return;
            }

            const { error } = await supabase
                .from('users')
                .update({
                    postiz_api_key: apiKeys.postizApiKey,
                    timezone: timezone,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.id);

            if (error) throw error;
            toast.success('Settings saved securely');
        } catch (error) {
            console.error('Failed to save settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setIsSavingKey(false);
        }
    };

    return (
        <div className={cn("h-full flex flex-col bg-black/40 backdrop-blur-xl rounded-none transition-all duration-300",
            isCollapsed ? "w-16" : "w-full"
        )}>
            {/* Header */}
            <div className={cn(
                "p-5 bg-white/5 flex items-center border-b border-white/5",
                isCollapsed ? "justify-center flex-col gap-4 py-6" : "justify-between"
            )}>
                {!isCollapsed && (
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Settings className="w-5 h-5" />
                            Editor Settings
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1">Customize your slideshow</p>
                    </div>
                )}

                {onToggleCollapse && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggleCollapse}
                        className={cn(
                            "h-8 w-8 rounded-full text-foreground hover:text-white hover:bg-white/10",
                            isCollapsed && "mt-2" // Adjust spacing when collapsed
                        )}
                        title={isCollapsed ? "Expand Settings" : "Collapse Settings"}
                    >
                        {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </Button>
                )}
            </div>

            {/* Collapsed State Minimal View */}
            {isCollapsed && (
                <div className="flex-1 flex flex-col items-center py-4 space-y-6">
                    <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full" title="Settings" onClick={onToggleCollapse}>
                        <Settings className="w-5 h-5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full" title="Templates" onClick={onToggleCollapse}>
                        <LayoutTemplate className="w-5 h-5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full" title="Text" onClick={onToggleCollapse}>
                        <Type className="w-5 h-5 text-muted-foreground" />
                    </Button>
                </div>
            )}

            {/* Content (Hidden when collapsed) */}
            {!isCollapsed && (
                <>
                    <ScrollArea className="flex-1 px-4 py-2">
                        <div className="space-y-4 py-4">

                            {/* General Settings Section */}
                            <Collapsible
                                open={openSections.includes('general')}
                                onOpenChange={() => toggleSection('general')}
                                className="space-y-2"
                            >
                                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-none hover:bg-white/5 transition-colors group">
                                    <div className="flex items-center gap-2 font-medium text-sm text-foreground/90">
                                        <Wand2 className="w-4 h-4 transition-colors" />
                                        General Info
                                    </div>
                                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", openSections.includes('general') && "rotate-180")} />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="space-y-4 pt-1 pb-3 px-2">
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground ml-1">Slideshow Title</Label>
                                            <Input
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                                className="bg-black/20 rounded-none h-9"
                                                placeholder="My Awesome Slideshow"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground ml-1">Post Title (TikTok)</Label>
                                            <Input
                                                value={postTitle}
                                                onChange={(e) => setPostTitle(e.target.value)}
                                                className="bg-black/20 rounded-none h-9"
                                                placeholder="Check this out!"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground ml-1">Caption</Label>
                                            <Input
                                                value={caption}
                                                onChange={(e) => setCaption(e.target.value)}
                                                className="bg-black/20 rounded-none h-9"
                                                placeholder="Write a caption..."
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-2">
                                        <Label className="flex items-center gap-2 text-xs text-muted-foreground ml-1">
                                            <Hash className="w-3 h-3 text-primary" />
                                            Hashtags
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input
                                                value={hashtagInput}
                                                onChange={(e) => setHashtagInput(e.target.value)}
                                                onKeyDown={handleAddHashtag}
                                                className="bg-black/20 rounded-none h-8 text-xs"
                                                placeholder="Add tag..."
                                            />
                                            <Button size="icon" variant="secondary" className="h-8 w-8 bg-white/10 hover:bg-white/20 rounded-none" onClick={() => {
                                                if (hashtagInput.trim()) {
                                                    onAddHashtag(hashtagInput.trim());
                                                    setHashtagInput('');
                                                }
                                            }}>
                                                <Plus className="w-3 h-3" />
                                            </Button>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {hashtags.map(tag => (
                                                <span key={tag} className="px-2 py-1 rounded-none bg-white/10 text-white text-[10px] font-medium flex items-center gap-1 hover:bg-white/20 transition-colors cursor-default">
                                                    #{tag}
                                                    <button onClick={() => setHashtags(hashtags.filter(t => t !== tag))} className="hover:text-white transition-colors">
                                                        <X className="w-2.5 h-2.5" />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>

                            <Separator className="bg-transparent opacity-0" />

                            {/* Templates Section */}
                            <Collapsible
                                open={openSections.includes('templates')}
                                onOpenChange={() => toggleSection('templates')}
                                className="space-y-2"
                            >
                                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-none hover:bg-white/5 transition-colors group">
                                    <div className="flex items-center gap-2 font-medium text-sm text-foreground/90">
                                        <LayoutTemplate className="w-4 h-4 transition-colors" />
                                        Templates
                                    </div>
                                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", openSections.includes('templates') && "rotate-180")} />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="space-y-4 pt-1 pb-3 px-2">
                                    <div className="flex gap-2 mb-2">
                                        <Button
                                            onClick={onSaveTemplate}
                                            className="flex-1 h-9 text-xs bg-white/5 hover:bg-white/10 border-0 rounded-none text-foreground"
                                        >
                                            <Save className="w-3 h-3 mr-2" /> New Template
                                        </Button>
                                        {selectedTemplate && (
                                            <Button
                                                onClick={() => onOverwriteTemplate(selectedTemplate)}
                                                className="flex-1 h-9 text-xs bg-white/20 hover:bg-white/30 border-0 rounded-none text-white"
                                                title="Overwrite active template settings with current editor state"
                                            >
                                                <RefreshCw className="w-3 h-3 mr-2" /> Update Active
                                            </Button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {savedTemplates.length === 0 ? (
                                            <div className="text-center p-4 text-muted-foreground text-xs border-0 rounded-none">
                                                No saved templates found.
                                            </div>
                                        ) : (
                                            savedTemplates.map(template => (
                                                <div
                                                    key={template.id}
                                                    onClick={() => {
                                                        if (selectedTemplate === template.id) {
                                                            // Deselect if already selected
                                                            setSelectedTemplate('');
                                                        } else {
                                                            onLoadTemplate(template);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "group flex items-center justify-between p-3 rounded-none border-0 cursor-pointer transition-all duration-200 relative",
                                                        selectedTemplate === template.id
                                                            ? "bg-white/20"
                                                            : "bg-black/20 hover:bg-white/5"
                                                    )}
                                                >
                                                    <div className="flex-1 min-w-0 mr-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-medium text-xs text-white truncate">{template.name}</div>
                                                            {selectedTemplate === template.id && (
                                                                <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded-none flex items-center gap-1">
                                                                    <Check className="w-2 h-2" /> Active
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground truncate">{template.description || 'No description'}</div>
                                                    </div>

                                                    <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-6 w-6 rounded-none hover:bg-white/10 text-muted-foreground hover:text-white"
                                                            onClick={(e) => handleEditClick(e, template)}
                                                        >
                                                            <Pencil className="w-3 h-3" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-6 w-6 rounded-none hover:bg-white/10 text-muted-foreground hover:text-white"
                                                            onClick={(e) => handleDeleteClick(e, template.id)}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>

                            {/* Custom Edit Dialog */}
                            <AnimatePresence>
                                {isEditTemplateOpen && (
                                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsEditTemplateOpen(false)}>
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="bg-[#1a1a1a] rounded-lg shadow-xl max-w-md w-full border border-white/10 p-6 space-y-4"
                                        >
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-semibold text-white">Edit Template</h3>
                                                <Button variant="ghost" size="icon" onClick={() => setIsEditTemplateOpen(false)} className="h-6 w-6 rounded-none">
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="name">Name</Label>
                                                    <Input
                                                        id="name"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="bg-black/20 rounded-none border-0"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="description">Description</Label>
                                                    <Input
                                                        id="description"
                                                        value={editDescription}
                                                        onChange={(e) => setEditDescription(e.target.value)}
                                                        className="bg-black/20 rounded-none border-0"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex justify-end gap-2 pt-2">
                                                <Button variant="ghost" onClick={() => setIsEditTemplateOpen(false)} className="hover:bg-white/5 rounded-none">Cancel</Button>
                                                <Button onClick={handleSaveEdit} className="rounded-none bg-white text-black hover:bg-white/90">Save Changes</Button>
                                            </div>
                                        </motion.div>
                                    </div>
                                )}
                            </AnimatePresence>

                            {/* Custom Delete Alert Dialog */}
                            <AnimatePresence>
                                {isDeleteAlertOpen && (
                                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsDeleteAlertOpen(false)}>
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="bg-[#1a1a1a] rounded-lg shadow-xl max-w-md w-full border border-white/10 p-6 space-y-4"
                                        >
                                            <div className="space-y-2">
                                                <h3 className="text-lg font-semibold text-white">Are you sure?</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    This action cannot be undone. This will permanently delete the template.
                                                </p>
                                            </div>

                                            <div className="flex justify-end gap-2 pt-2">
                                                <Button variant="ghost" onClick={() => setIsDeleteAlertOpen(false)} className="hover:bg-white/5 rounded-none">Cancel</Button>
                                                <Button onClick={confirmDelete} className="bg-white text-black hover:bg-white/90 rounded-none">Delete</Button>
                                            </div>
                                        </motion.div>
                                    </div>
                                )}
                            </AnimatePresence>

                            <Separator className="bg-transparent opacity-0" />

                            {/* Visual Settings Section */}
                            <Collapsible
                                open={openSections.includes('visual')}
                                onOpenChange={() => toggleSection('visual')}
                                className="space-y-2"
                            >
                                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-none hover:bg-white/5 transition-colors group">
                                    <div className="flex items-center gap-2 font-medium text-sm text-foreground/90">
                                        <Palette className="w-4 h-4 transition-colors" />
                                        Visual & Audio
                                    </div>
                                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", openSections.includes('visual') && "rotate-180")} />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="space-y-4 pt-1 pb-3 px-2">
                                    <div className="space-y-4">


                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground ml-1">Aspect Ratio</Label>
                                            <Select value={aspectRatio} onValueChange={setAspectRatio}>
                                                <SelectTrigger className="bg-black/20 border-0 rounded-none h-9 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="9:16">9:16 (TikTok/Reels)</SelectItem>
                                                    <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                                                    <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                                                    <SelectItem value="1:1">1:1 (Square)</SelectItem>
                                                    <SelectItem value="4:5">4:5 (Portrait)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>

                            <Separator className="bg-transparent opacity-0" />

                            {/* Text Overlays Section */}
                            <Collapsible
                                open={openSections.includes('text')}
                                onOpenChange={() => toggleSection('text')}
                                className="space-y-2"
                            >
                                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-none hover:bg-white/5 transition-colors group">
                                    <div className="flex items-center gap-2 font-medium text-sm text-foreground/90">
                                        <Type className="w-4 h-4 transition-colors" />
                                        Text Overlays
                                    </div>
                                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", openSections.includes('text') && "rotate-180")} />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="space-y-4 pt-1 pb-3 px-2">
                                    <Button onClick={onAddTextOverlay} className="w-full h-9 text-xs bg-white/5 hover:bg-white/10 border-0 rounded-none text-foreground">
                                        <Plus className="w-3 h-3 mr-2" /> Add Text Overlay
                                    </Button>

                                    <div className="space-y-3">
                                        {textOverlays.map((overlay, index) => (
                                            <div key={overlay.id} className="p-3 rounded-none bg-black/20 border-0 space-y-3 hover:bg-white/5 transition-colors">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-medium text-muted-foreground">Overlay {index + 1}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-5 w-5 text-muted-foreground hover:text-white hover:bg-white/10 rounded-none"
                                                        onClick={() => onRemoveTextOverlay(overlay.id)}
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </Button>
                                                </div>

                                                <textarea
                                                    value={overlay.text}
                                                    onChange={(e) => onUpdateTextOverlay(overlay.id, { text: e.target.value })}
                                                    className="flex min-h-[60px] w-full rounded-none border-0 bg-black/40 px-3 py-2 text-xs font-medium placeholder:text-muted-foreground focus-visible:outline-none transition-all duration-300 backdrop-blur-sm hover:bg-black/30 resize-y"
                                                />

                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] text-muted-foreground">Size</Label>
                                                        <Slider
                                                            value={[overlay.fontSize]}
                                                            min={12}
                                                            max={100}
                                                            step={1}
                                                            onValueChange={([v]) => onUpdateTextOverlay(overlay.id, { fontSize: v })}
                                                            className="py-1"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] text-muted-foreground">Y Position</Label>
                                                        <Slider
                                                            value={[overlay.y]}
                                                            min={0}
                                                            max={100}
                                                            step={1}
                                                            onValueChange={([v]) => onUpdateTextOverlay(overlay.id, { y: v })}
                                                            className="py-1"
                                                        />
                                                    </div>
                                                    <div className="space-y-1 col-span-2">
                                                        <Label className="text-[10px] text-muted-foreground">Width: {overlay.width || 90}%</Label>
                                                        <Slider
                                                            value={[overlay.width || 90]}
                                                            min={20}
                                                            max={100}
                                                            step={1}
                                                            onValueChange={([v]) => onUpdateTextOverlay(overlay.id, { width: v })}
                                                            className="py-1"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <div className="relative w-7 h-7 rounded-none overflow-hidden">
                                                        <input
                                                            type="color"
                                                            value={overlay.color}
                                                            onChange={(e) => onUpdateTextOverlay(overlay.id, { color: e.target.value })}
                                                            className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer p-0 border-0"
                                                        />
                                                    </div>
                                                    <div className="flex-1 flex gap-1 bg-black/20 p-1 rounded-none">
                                                        <Button
                                                            variant={overlay.bold ? "secondary" : "ghost"}
                                                            size="sm"
                                                            className={cn("h-6 flex-1 text-[10px] rounded-none", overlay.bold && "bg-white/20 text-white")}
                                                            onClick={() => onUpdateTextOverlay(overlay.id, { bold: !overlay.bold })}
                                                        >
                                                            B
                                                        </Button>
                                                        <Button
                                                            variant={overlay.italic ? "secondary" : "ghost"}
                                                            size="sm"
                                                            className={cn("h-6 flex-1 text-[10px] rounded-none", overlay.italic && "bg-white/20 text-white")}
                                                            onClick={() => onUpdateTextOverlay(overlay.id, { italic: !overlay.italic })}
                                                        >
                                                            I
                                                        </Button>
                                                        <Button
                                                            variant={overlay.outline ? "secondary" : "ghost"}
                                                            size="sm"
                                                            className={cn("h-6 flex-1 text-[10px] rounded-none", overlay.outline && "bg-white/20 text-white")}
                                                            onClick={() => onUpdateTextOverlay(overlay.id, { outline: !overlay.outline })}
                                                        >
                                                            O
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>

                            <Separator className="bg-transparent opacity-0" />

                            {/* API & Integrations Section */}
                            <Collapsible
                                open={openSections.includes('api')}
                                onOpenChange={() => toggleSection('api')}
                                className="space-y-2"
                            >
                                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-none hover:bg-white/5 transition-colors group">
                                    <div className="flex items-center gap-2 font-medium text-sm text-foreground/90">
                                        <Key className="w-4 h-4 transition-colors" />
                                        API & Integrations
                                    </div>
                                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", openSections.includes('api') && "rotate-180")} />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="space-y-4 pt-1 pb-3 px-2">
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground ml-1">Postiz API Key</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="password"
                                                    value={apiKeys.postizApiKey}
                                                    onChange={(e) => setApiKeys({ ...apiKeys, postizApiKey: e.target.value })}
                                                    className="bg-black/20 rounded-none border-0 h-9"
                                                    placeholder="Enter Postiz API Key"
                                                />
                                                <Button
                                                    size="sm"
                                                    onClick={handleSaveUserData}
                                                    disabled={isSavingKey}
                                                    className="h-9 px-3 rounded-none bg-white text-black hover:bg-white/90"
                                                >
                                                    {isSavingKey ? 'Saving...' : 'Save'}
                                                </Button>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground ml-1">
                                                Required for background processing. Saved securely to your account.
                                            </p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground ml-1">Timezone</Label>
                                            <Select value={timezone} onValueChange={setTimezone}>
                                                <SelectTrigger className="bg-black/20 border-0 rounded-none h-9 text-xs">
                                                    <SelectValue placeholder="Select Timezone" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableTimezones.map(tz => (
                                                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-[10px] text-muted-foreground ml-1">
                                                Used for scheduling posts within the 9am - 10pm window.
                                            </p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground ml-1">TikTok Access Token</Label>
                                            <Input
                                                type="password"
                                                value={apiKeys.tiktokAccessToken}
                                                onChange={(e) => setApiKeys({ ...apiKeys, tiktokAccessToken: e.target.value })}
                                                className="bg-black/20 rounded-none border-0 h-9"
                                                placeholder="Enter TikTok Access Token"
                                            />
                                        </div>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        </div>
                    </ScrollArea>

                    {/* Footer Actions */}
                    <div className="p-4 bg-black/20 space-y-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                            <span>{selectedImagesCount} images selected</span>
                            <span>{aspectRatio}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Button onClick={onSaveSlideshow} variant="outline" className="h-10 border-0 rounded-none bg-white/5 hover:bg-white/10 text-foreground hover:text-white">
                                <Save className="w-4 h-4 mr-2" /> Save
                            </Button>

                            <Button onClick={onPostToTikTok} className="h-10 bg-white text-black hover:bg-white/90 rounded-none shadow-none font-bold">
                                <Send className="w-4 h-4 mr-2" /> Post
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

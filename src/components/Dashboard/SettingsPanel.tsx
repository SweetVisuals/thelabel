import React, { useState } from 'react';
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
    Plus,
    X,
    Play,
    Wand2,
    Palette,
    LayoutTemplate,
    Key
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

    // Data
    savedHashtags: string[];
    onAddHashtag: (tag: string) => void;
    selectedImagesCount: number;
    savedTemplates: SlideshowTemplate[];
    onLoadTemplate: (template: SlideshowTemplate) => void;
    onSaveTemplate: () => void;
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
    savedHashtags,
    onAddHashtag,
    selectedImagesCount,
    savedTemplates = [],
    onLoadTemplate,
    onSaveTemplate
}: SettingsPanelProps) {
    const [hashtagInput, setHashtagInput] = useState('');
    const [openSections, setOpenSections] = useState<string[]>(['general', 'templates', 'visual', 'text', 'api', 'export']);

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




    return (
        <div className="w-full h-full flex flex-col bg-black/40 backdrop-blur-xl border-l border-white/10 shadow-2xl">
            {/* Header */}
            <div className="p-5 border-b border-white/10 bg-white/5">
                <h2 className="text-lg font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    Editor Settings
                </h2>
                <p className="text-xs text-muted-foreground mt-1">Customize your slideshow</p>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 px-4 py-2">
                <div className="space-y-4 py-4">

                    {/* General Settings Section */}
                    <Collapsible
                        open={openSections.includes('general')}
                        onOpenChange={() => toggleSection('general')}
                        className="space-y-2"
                    >
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-white/5 transition-colors group">
                            <div className="flex items-center gap-2 font-medium text-sm text-foreground/90">
                                <Wand2 className="w-4 h-4 text-primary group-hover:text-primary/80 transition-colors" />
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
                                        className="bg-black/20 border-white/10 focus:border-primary/50 h-9"
                                        placeholder="My Awesome Slideshow"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground ml-1">Post Title (TikTok)</Label>
                                    <Input
                                        value={postTitle}
                                        onChange={(e) => setPostTitle(e.target.value)}
                                        className="bg-black/20 border-white/10 focus:border-primary/50 h-9"
                                        placeholder="Check this out!"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground ml-1">Caption</Label>
                                    <Input
                                        value={caption}
                                        onChange={(e) => setCaption(e.target.value)}
                                        className="bg-black/20 border-white/10 focus:border-primary/50 h-9"
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
                                        className="bg-black/20 border-white/10 h-8 text-xs"
                                        placeholder="Add tag..."
                                    />
                                    <Button size="icon" variant="secondary" className="h-8 w-8 bg-white/5 hover:bg-white/10 border border-white/10" onClick={() => {
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
                                        <span key={tag} className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-medium flex items-center gap-1 border border-primary/20 hover:bg-primary/20 transition-colors cursor-default">
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

                    <Separator className="bg-white/5" />

                    {/* Templates Section */}
                    <Collapsible
                        open={openSections.includes('templates')}
                        onOpenChange={() => toggleSection('templates')}
                        className="space-y-2"
                    >
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-white/5 transition-colors group">
                            <div className="flex items-center gap-2 font-medium text-sm text-foreground/90">
                                <LayoutTemplate className="w-4 h-4 text-primary group-hover:text-primary/80 transition-colors" />
                                Templates
                            </div>
                            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", openSections.includes('templates') && "rotate-180")} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 pt-1 pb-3 px-2">
                            <Button
                                onClick={onSaveTemplate}
                                className="w-full h-9 text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-foreground mb-2"
                            >
                                <Save className="w-3 h-3 mr-2" /> Save Current as Template
                            </Button>
                            <div className="grid grid-cols-2 gap-2">
                                {savedTemplates.length === 0 ? (
                                    <div className="col-span-2 text-center p-4 text-muted-foreground text-xs border border-dashed border-white/10 rounded-lg">
                                        No saved templates found.
                                    </div>
                                ) : (
                                    savedTemplates.map(template => (
                                        <div
                                            key={template.id}
                                            onClick={() => onLoadTemplate(template)}
                                            className={cn(
                                                "p-3 rounded-lg border cursor-pointer transition-all duration-200",
                                                selectedTemplate === template.id
                                                    ? "bg-primary/10 border-primary/50"
                                                    : "bg-black/20 border-white/10 hover:bg-white/5 hover:border-white/20"
                                            )}
                                        >
                                            <div className="font-medium text-xs text-white truncate">{template.name}</div>
                                            <div className="text-[10px] text-muted-foreground truncate">{template.description || 'No description'}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>

                    <Separator className="bg-white/5" />

                    {/* Visual Settings Section */}
                    <Collapsible
                        open={openSections.includes('visual')}
                        onOpenChange={() => toggleSection('visual')}
                        className="space-y-2"
                    >
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-white/5 transition-colors group">
                            <div className="flex items-center gap-2 font-medium text-sm text-foreground/90">
                                <Palette className="w-4 h-4 text-primary group-hover:text-primary/80 transition-colors" />
                                Visual & Audio
                            </div>
                            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", openSections.includes('visual') && "rotate-180")} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 pt-1 pb-3 px-2">
                            <div className="space-y-4">


                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground ml-1">Aspect Ratio</Label>
                                    <Select value={aspectRatio} onValueChange={setAspectRatio}>
                                        <SelectTrigger className="bg-black/20 border-white/10 h-9 text-xs">
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

                    <Separator className="bg-white/5" />

                    {/* Text Overlays Section */}
                    <Collapsible
                        open={openSections.includes('text')}
                        onOpenChange={() => toggleSection('text')}
                        className="space-y-2"
                    >
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-white/5 transition-colors group">
                            <div className="flex items-center gap-2 font-medium text-sm text-foreground/90">
                                <Type className="w-4 h-4 text-primary group-hover:text-primary/80 transition-colors" />
                                Text Overlays
                            </div>
                            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", openSections.includes('text') && "rotate-180")} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 pt-1 pb-3 px-2">
                            <Button onClick={onAddTextOverlay} className="w-full h-9 text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-foreground">
                                <Plus className="w-3 h-3 mr-2" /> Add Text Overlay
                            </Button>

                            <div className="space-y-3">
                                {textOverlays.map((overlay, index) => (
                                    <div key={overlay.id} className="p-3 rounded-lg bg-black/20 border border-white/10 space-y-3 hover:border-white/20 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-muted-foreground">Overlay {index + 1}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5 text-destructive hover:text-destructive/80 hover:bg-destructive/10 rounded-full"
                                                onClick={() => onRemoveTextOverlay(overlay.id)}
                                            >
                                                <X className="w-3 h-3" />
                                            </Button>
                                        </div>

                                        <Input
                                            value={overlay.text}
                                            onChange={(e) => onUpdateTextOverlay(overlay.id, { text: e.target.value })}
                                            className="bg-black/40 border-white/10 h-8 text-xs font-medium"
                                        />

                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">Size</Label>
                                                <Slider
                                                    value={[overlay.fontSize]}
                                                    min={12}
                                                    max={72}
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
                                        </div>

                                        <div className="flex gap-2">
                                            <div className="relative w-7 h-7 rounded-md overflow-hidden border border-white/10">
                                                <input
                                                    type="color"
                                                    value={overlay.color}
                                                    onChange={(e) => onUpdateTextOverlay(overlay.id, { color: e.target.value })}
                                                    className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer p-0 border-0"
                                                />
                                            </div>
                                            <div className="flex-1 flex gap-1 bg-black/20 p-0.5 rounded-md border border-white/5">
                                                <Button
                                                    variant={overlay.bold ? "secondary" : "ghost"}
                                                    size="sm"
                                                    className={cn("h-6 flex-1 text-[10px]", overlay.bold && "bg-white/10 text-white")}
                                                    onClick={() => onUpdateTextOverlay(overlay.id, { bold: !overlay.bold })}
                                                >
                                                    B
                                                </Button>
                                                <Button
                                                    variant={overlay.italic ? "secondary" : "ghost"}
                                                    size="sm"
                                                    className={cn("h-6 flex-1 text-[10px]", overlay.italic && "bg-white/10 text-white")}
                                                    onClick={() => onUpdateTextOverlay(overlay.id, { italic: !overlay.italic })}
                                                >
                                                    I
                                                </Button>
                                                <Button
                                                    variant={overlay.outline ? "secondary" : "ghost"}
                                                    size="sm"
                                                    className={cn("h-6 flex-1 text-[10px]", overlay.outline && "bg-white/10 text-white")}
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

                    <Separator className="bg-white/5" />

                    {/* API & Integrations Section */}
                    <Collapsible
                        open={openSections.includes('api')}
                        onOpenChange={() => toggleSection('api')}
                        className="space-y-2"
                    >
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-white/5 transition-colors group">
                            <div className="flex items-center gap-2 font-medium text-sm text-foreground/90">
                                <Key className="w-4 h-4 text-primary group-hover:text-primary/80 transition-colors" />
                                API & Integrations
                            </div>
                            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", openSections.includes('api') && "rotate-180")} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 pt-1 pb-3 px-2">
                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground ml-1">Postiz API Key</Label>
                                    <Input
                                        type="password"
                                        value={apiKeys.postizApiKey}
                                        onChange={(e) => setApiKeys({ ...apiKeys, postizApiKey: e.target.value })}
                                        className="bg-black/20 border-white/10 focus:border-primary/50 h-9"
                                        placeholder="Enter Postiz API Key"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground ml-1">TikTok Access Token</Label>
                                    <Input
                                        type="password"
                                        value={apiKeys.tiktokAccessToken}
                                        onChange={(e) => setApiKeys({ ...apiKeys, tiktokAccessToken: e.target.value })}
                                        className="bg-black/20 border-white/10 focus:border-primary/50 h-9"
                                        placeholder="Enter TikTok Access Token"
                                    />
                                </div>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                </div>
            </ScrollArea>

            {/* Footer Actions */}
            <div className="p-4 border-t border-white/10 bg-black/20 space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span>{selectedImagesCount} images selected</span>
                    <span>{aspectRatio}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Button onClick={onSaveSlideshow} variant="outline" className="h-10 border-white/10 hover:bg-white/5 hover:text-white">
                        <Save className="w-4 h-4 mr-2" /> Save
                    </Button>

                    <Button onClick={onPostToTikTok} className="h-10 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 text-white border-0 shadow-lg shadow-primary/20">
                        <Send className="w-4 h-4 mr-2" /> Post
                    </Button>
                </div>
            </div>
        </div>
    );
}

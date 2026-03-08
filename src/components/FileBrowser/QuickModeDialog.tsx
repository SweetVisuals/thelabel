import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Clock, FileText, Hash, Layout, Loader2, UploadCloud, X, Zap } from 'lucide-react';
import { slideshowService } from '@/lib/slideshowService';
import { SlideshowTemplate, UploadedImage, TikTokTextOverlay, ASPECT_RATIO_PRESETS } from '@/types';
import { cn } from '@/lib/utils';
import { imageService } from '@/lib/imageService';
import { useBulkPost } from '@/contexts/BulkPostContext';
import { toast } from 'sonner';

interface QuickModeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    folderId: string;
    folderName: string;
    accountId: string;
    userId: string;
}

export const QuickModeDialog: React.FC<QuickModeDialogProps> = ({ isOpen, onClose, folderId, folderName, accountId, userId }) => {
    const [templates, setTemplates] = useState<SlideshowTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [textReplacements, setTextReplacements] = useState<Record<string, string>>({});
    const [hashtags, setHashtags] = useState<string[]>([]);
    const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('9:16');
    const [customTitle, setCustomTitle] = useState<string>('');
    const [slideCountOverride, setSlideCountOverride] = useState<number>(1);
    const [scheduleDate, setScheduleDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [scheduleTime, setScheduleTime] = useState<string>(new Date().getHours().toString().padStart(2, '0') + ':00');
    const [postIntervalHours, setPostIntervalHours] = useState<number>(4);
    const [newHashtag, setNewHashtag] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isMinimized, setIsMinimized] = useState(false);

    const { startBulkPost } = useBulkPost();

    useEffect(() => {
        const load = async () => {
            console.log('🔍 QuickModeDialog: isOpen=', isOpen, 'userId=', userId);
            if (isOpen && userId) {
                console.log('🔍 QuickModeDialog: Loading templates for user', userId);
                await slideshowService.loadUserTemplates(userId);
                const loadedTemplates = slideshowService.getSavedTemplates(userId);
                console.log('🔍 QuickModeDialog: Templates loaded:', loadedTemplates.length);
                setTemplates(loadedTemplates);
            } else if (isOpen) {
                console.warn('⚠️ QuickModeDialog: isOpen but userId is missing!');
            }
        };
        load();
    }, [isOpen, userId]);

    useEffect(() => {
        if (selectedTemplate) {
            setHashtags(selectedTemplate.hashtags || []);
            setSelectedAspectRatio(selectedTemplate.aspectRatio || '9:16');
            setCustomTitle(selectedTemplate.name || '');
            setSlideCountOverride(selectedTemplate.slideCount || 1);

            // Pre-fill text replacements with the template's original text
            const initialReplacements: Record<string, string> = {};
            const uniqueTexts = Array.from(new Set(selectedTemplate.textOverlays?.map(o => o.text) || []));
            uniqueTexts.forEach(text => {
                if (text) initialReplacements[text] = text;
            });
            setTextReplacements(initialReplacements);

        } else {
            setHashtags([]);
            setSelectedAspectRatio('9:16');
            setCustomTitle('');
            setSlideCountOverride(1);
            setTextReplacements({});
        }
    }, [selectedTemplateId]);

    const handleAddHashtag = () => {
        if (!newHashtag.trim()) return;
        const tag = newHashtag.trim().startsWith('#') ? newHashtag.trim().toLowerCase() : `#${newHashtag.trim().toLowerCase()}`;
        if (!hashtags.includes(tag)) {
            setHashtags([...hashtags, tag]);
        }
        setNewHashtag('');
    };

    const handleRemoveHashtag = (tag: string) => {
        setHashtags(hashtags.filter(t => t !== tag));
    };

    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
    const uniqueOverlays = Array.from(new Set(selectedTemplate?.textOverlays?.map(o => o.text) || []));

    const handleTextReplacementChange = (originalText: string, newText: string) => {
        setTextReplacements(prev => ({
            ...prev,
            [originalText]: newText
        }));
    };

    const abortControllerRef = useRef<AbortController | null>(null);

    const handleCancel = () => {
        if (isProcessing) {
            abortControllerRef.current?.abort();
            setIsProcessing(false);
            setProgress(0);
            toast.error('Batch generation cancelled');
        } else {
            onClose();
        }
    };

    const handleStartQuickMode = async () => {
        if (!selectedTemplate) return;

        abortControllerRef.current = new AbortController();

        try {
            setIsProcessing(true);
            setProgress(10);

            // 1. Gather images from folder
            const allFolders = await imageService.loadFolders();
            const folder = allFolders.find(f => f.id === folderId);
            if (!folder || !folder.images || folder.images.length === 0) {
                toast.error('No images found in this folder');
                setIsProcessing(false);
                return;
            }
            setProgress(30);

            const images: UploadedImage[] = folder.images;

            // 2. Clone template and apply text replacements
            // If there are replacements, we clone the template and overwrite the text array
            let templateToUse = {
                ...selectedTemplate,
                hashtags: hashtags,
                aspectRatio: selectedAspectRatio
            };

            if (Object.keys(textReplacements).length > 0) {
                // Deep copy text overlays
                const newOverlays: TikTokTextOverlay[] = selectedTemplate.textOverlays.map(overlay => {
                    if (overlay.text && textReplacements[overlay.text]) {
                        return { ...overlay, text: textReplacements[overlay.text] };
                    }
                    return overlay;
                });

                templateToUse.textOverlays = newOverlays;
            }

            // 3. Save the customized template for future reuse directly before taking server capacity
            const newTemplateId = `template_${crypto.randomUUID()}`;
            const newTemplateTitle = customTitle || `${selectedTemplate.name} (Quick Batch)`;

            const newlySavedTemplate: SlideshowTemplate = {
                ...templateToUse,
                id: newTemplateId,
                user_id: userId, // CRITICAL: Fix for template not appearing for user
                name: newTemplateTitle,
                title: templateToUse.title || newTemplateTitle,
                slideCount: slideCountOverride || templateToUse.slideCount,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            await slideshowService.saveTemplate(newlySavedTemplate);

            // Dispatch event to update UI so template appears
            window.dispatchEvent(new CustomEvent('templatesUpdated'));

            // 4. Create bulk slideshows
            const result = await slideshowService.createBulkSlideshowsFromTemplate(
                templateToUse,
                images,
                userId,
                {
                    slidesPerSlideshow: slideCountOverride || templateToUse.slideCount,
                    customizations: {
                        title: customTitle,
                        hashtags: hashtags,
                        aspectRatio: selectedAspectRatio
                    },
                    signal: abortControllerRef.current?.signal
                },
                (p) => setProgress(30 + Math.floor(p * 0.6))
            );

            setProgress(90);

            if (!result.success || !result.slideshows) {
                throw new Error(result.error || 'Failed to create bulk slideshows');
            }

            // 5. Start batch posting
            const startTimeDate = new Date(`${scheduleDate}T${scheduleTime}:00`);

            await startBulkPost(
                result.slideshows,
                [accountId],
                'batch',
                {
                    intervalHours: postIntervalHours, // used to space interval batches
                    startTime: startTimeDate,
                    batchSize: 10,
                    postIntervalMinutes: Math.floor((postIntervalHours * 60) / 10) // this determines job staggering within a batch if applicable
                }
            );

            setProgress(100);
            toast.success('Batch generation complete! Template saved & posts scheduled.');
            setTimeout(() => onClose(), 1000);
        } catch (error) {
            console.error(error);
            toast.error('Quick Mode failed');
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className={cn(
            "absolute inset-x-0 bottom-0 z-50 flex flex-col pointer-events-none transition-all duration-300",
            isMinimized ? "h-14" : "h-full"
        )}>
            <div
                className={cn(
                    "w-full h-full bg-[#0a0a0a] flex flex-col pointer-events-auto",
                    "rounded-none",
                    isMinimized ? "shadow-[0_-5px_15px_rgba(0,0,0,0.5)] border-t border-white/10" : "animate-in slide-in-from-bottom duration-300"
                )}
            >
                {/* Header */}
                <div className={cn(
                    "p-4 border-b border-white/5 flex justify-between items-center bg-black/40",
                    isMinimized && "cursor-pointer hover:bg-black/60"
                )}
                    onClick={isMinimized ? () => setIsMinimized(false) : undefined}
                >
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-8 h-8 flex items-center justify-center rounded-none border transition-colors",
                            isProcessing ? "bg-primary/20 border-primary/50 text-primary" : "bg-white/5 border-white/10 text-white/40"
                        )}>
                            {isProcessing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Zap className="w-4 h-4" />
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                                    Quick Mode: {folderName}
                                </h3>
                                {isMinimized && isProcessing && (
                                    <span className="text-xs font-mono text-primary animate-pulse">{progress}%</span>
                                )}
                            </div>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">
                                {isProcessing ? 'Processing batch...' : 'Batch Post to TikTok Account'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {isProcessing && isMinimized && (
                            <div className="w-32 h-1 bg-white/5 overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        )}

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsMinimized(!isMinimized);
                            }}
                            className="hover:bg-white/5 text-white/40 hover:text-white rounded-none border-none p-2"
                        >
                            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            disabled={isProcessing}
                            className="hover:bg-white/5 text-white/40 hover:text-white rounded-none border-none p-2"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {!isMinimized && (
                    <>
                        {isProcessing && (
                            <div className="absolute top-[64px] inset-x-0 h-1 bg-white/5 z-50 overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        )}

                        <div className="flex flex-1 overflow-hidden min-h-0">
                            {/* Left side: Template Selection */}
                            <div className="w-1/4 border-r border-white/5 p-4 overflow-y-auto custom-scrollbar bg-black/20">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-4 block">Select Template</label>
                                <div className="space-y-1">
                                    {templates.map(template => (
                                        <div
                                            key={template.id}
                                            onClick={() => setSelectedTemplateId(template.id)}
                                            className={cn(
                                                "p-3 cursor-pointer transition-all rounded-none border-none",
                                                selectedTemplateId === template.id
                                                    ? "bg-primary/10 text-white"
                                                    : "hover:bg-white/5 text-white/60 hover:text-white"
                                            )}
                                        >
                                            <div className="font-medium text-sm truncate">{template.name}</div>
                                            <div className="text-[10px] opacity-40 mt-1">
                                                {template.slideCount} slides • {template.textOverlays.length} overlays
                                            </div>
                                        </div>
                                    ))}
                                    {templates.length === 0 && (
                                        <div className="text-center py-8 text-white/30 text-xs italic">
                                            No templates found
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right side: Customization */}
                            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-[#050505]">
                                <div className="max-w-3xl mx-auto space-y-10">
                                    {selectedTemplate ? (
                                        <>
                                            <div className="grid grid-cols-2 gap-8">
                                                {/* Base Info */}
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                                                        <FileText className="w-3 h-3" /> Template Title
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="w-full bg-white/5 border-none rounded-none px-4 py-3 text-sm text-white placeholder:text-white/20 focus:bg-white/10 outline-none transition-all"
                                                        placeholder="Enter custom title..."
                                                        value={customTitle}
                                                        onChange={(e) => setCustomTitle(e.target.value)}
                                                    />
                                                </div>

                                                {/* Slide Count */}
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                                                        <Layout className="w-3 h-3" /> Slides per post
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="10"
                                                        className="w-full bg-white/5 border-none rounded-none px-4 py-3 text-sm text-white focus:bg-white/10 outline-none transition-all"
                                                        value={slideCountOverride}
                                                        onChange={(e) => setSlideCountOverride(parseInt(e.target.value) || 1)}
                                                    />
                                                </div>
                                            </div>

                                            {/* Scheduling Section */}
                                            <div className="space-y-4 pt-10 border-t border-white/5">
                                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                                                    <Clock className="w-3 h-3" /> Batch schedule start
                                                </label>
                                                <div className="grid grid-cols-3 gap-4">
                                                    <input
                                                        type="date"
                                                        className="bg-white/5 border-none rounded-none px-4 py-3 text-sm text-white focus:bg-white/10 outline-none transition-all [color-scheme:dark]"
                                                        value={scheduleDate}
                                                        onChange={(e) => setScheduleDate(e.target.value)}
                                                    />
                                                    <input
                                                        type="time"
                                                        className="bg-white/5 border-none rounded-none px-4 py-3 text-sm text-white focus:bg-white/10 outline-none transition-all [color-scheme:dark]"
                                                        value={scheduleTime}
                                                        onChange={(e) => setScheduleTime(e.target.value)}
                                                    />
                                                    <div className="flex items-center gap-2 bg-white/5 px-4 focus-within:bg-white/10 transition-all">
                                                        <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest whitespace-nowrap">Interval (hrs)</span>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="168"
                                                            className="w-full bg-transparent border-none outline-none text-sm text-white text-right"
                                                            value={postIntervalHours}
                                                            onChange={(e) => setPostIntervalHours(parseInt(e.target.value) || 1)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Hashtag Management */}
                                            <div className="space-y-4 pt-10 border-t border-white/5">
                                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                                                    <Hash className="w-3 h-3" /> Social Hashtags
                                                </label>
                                                <div className="flex flex-wrap gap-1.5 p-4 bg-white/2 border-none rounded-none">
                                                    {hashtags.map((tag, idx) => (
                                                        <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-none text-xs text-white/70 hover:bg-white/10 transition-colors">
                                                            <span>{tag}</span>
                                                            <button
                                                                onClick={() => handleRemoveHashtag(tag)}
                                                                className="text-white/20 hover:text-red-400 mt-0.5"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {hashtags.length === 0 && (
                                                        <span className="text-xs text-white/20 italic">No hashtags configured</span>
                                                    )}
                                                </div>
                                                <div className="flex gap-1 pt-2">
                                                    <input
                                                        type="text"
                                                        className="flex-1 bg-white/5 border-none rounded-none px-4 py-3 text-sm text-white placeholder:text-white/20 focus:bg-white/10 outline-none transition-all"
                                                        placeholder="Add hashtag (e.g. #fyp)..."
                                                        value={newHashtag}
                                                        onChange={(e) => setNewHashtag(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleAddHashtag()}
                                                    />
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handleAddHashtag}
                                                        className="border-none bg-white/5 hover:bg-white/10 rounded-none text-[10px] font-bold px-6"
                                                    >
                                                        ADD
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Aspect Ratio Selection */}
                                            <div className="space-y-4 pt-10 border-t border-white/5">
                                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block">Output Aspect Ratio</label>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {ASPECT_RATIO_PRESETS.filter(p => p.ratio !== 'free').map((preset) => (
                                                        <button
                                                            key={preset.id}
                                                            onClick={() => setSelectedAspectRatio(preset.ratio)}
                                                            className={cn(
                                                                "flex flex-col items-center justify-center p-4 border transition-all rounded-none",
                                                                selectedAspectRatio === preset.ratio
                                                                    ? "bg-primary/10 border-primary text-white"
                                                                    : "bg-white/2 border-white/5 text-white/40 hover:bg-white/5 hover:border-white/10"
                                                            )}
                                                        >
                                                            <span className="text-lg mb-2">{preset.icon}</span>
                                                            <span className="text-[10px] font-bold uppercase tracking-wider">{preset.label}</span>
                                                            <span className="text-[9px] opacity-40 mt-1">{preset.ratio}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Text Replacement */}
                                            {uniqueOverlays.length > 0 && (
                                                <div className="space-y-6 pt-10 border-t border-white/5">
                                                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block">Text Dynamic Replacement</label>
                                                    <div className="space-y-8">
                                                        {uniqueOverlays.map((originalText, idx) => (
                                                            <div key={idx} className="space-y-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="h-px flex-1 bg-white/5" />
                                                                    <span className="text-[9px] text-white/20 uppercase tracking-widest font-bold">Replacement Selection {idx + 1}</span>
                                                                    <div className="h-px flex-1 bg-white/5" />
                                                                </div>
                                                                <div className="p-4 bg-white/2 border-none text-[11px] text-white/30 italic">
                                                                    Original: "{originalText}"
                                                                </div>
                                                                <textarea
                                                                    className="w-full bg-[#0a0a0a] border-none rounded-none px-5 py-4 text-sm text-white placeholder:text-white/10 focus:bg-[#111] outline-none transition-all min-h-[120px] resize-none custom-scrollbar"
                                                                    placeholder="Enter new text (supports multi-line)..."
                                                                    value={textReplacements[originalText] || ''}
                                                                    onChange={(e) => handleTextReplacementChange(originalText, e.target.value)}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-20">
                                            <Zap className="w-12 h-12 mb-4" />
                                            <p className="text-xs uppercase tracking-[0.2em]">Select a template to configure batch</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-white/5 bg-black flex justify-between items-center">
                            <div className="flex-1 max-w-xl">
                                {isProcessing && (
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-[10px] text-white/40 uppercase tracking-widest font-bold">
                                            <span>Processing Generation</span>
                                            <span>{progress}%</span>
                                        </div>
                                        <div className="w-full h-1 bg-white/5 rounded-none overflow-hidden">
                                            <div
                                                className="h-full bg-primary transition-all duration-300 shadow-[0_0_15px_rgba(var(--primary),0.6)]"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-6 ml-10">
                                <Button
                                    variant="ghost"
                                    onClick={handleCancel}
                                    className="rounded-none text-[10px] text-white/40 hover:text-white uppercase tracking-widest border-none px-4"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="bg-primary hover:bg-primary/90 text-white min-w-[200px] h-12 rounded-none text-xs font-black uppercase tracking-[0.15em] shadow-2xl shadow-primary/20"
                                    onClick={handleStartQuickMode}
                                    disabled={!selectedTemplateId || isProcessing}
                                >
                                    {isProcessing ? (
                                        <span className="flex items-center gap-2">
                                            <UploadCloud className="w-4 h-4 animate-bounce" /> Processing...
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            <Zap className="w-4 h-4 fill-white" /> Start Quick Batch
                                        </span>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

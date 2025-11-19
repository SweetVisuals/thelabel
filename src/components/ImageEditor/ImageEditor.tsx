import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Crop,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Type,
  Palette,
  Undo,
  Redo,
  Save,
  X,
  Sparkles,
  Wand2,
  Filter,
  Contrast,
  Sun,
  Droplet,
  Zap,
  Layers,
  Scissors,
  Move,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { UploadedImage, ASPECT_RATIO_PRESETS, AspectRatioPreset } from '@/types';
import { motion } from 'framer-motion';
import { ensureTikTokFontsLoaded, fontLoader } from '@/lib/fontUtils';

interface ImageEditorProps {
  image: UploadedImage;
  onSave: (editedImage: UploadedImage) => void;
  onCancel: () => void;
}

interface EditState {
  crop: { x: number; y: number; width: number; height: number } | null;
  aspectRatio: string; // e.g., "free", "1:1", "16:9"
  rotation: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  textOverlays: TextOverlay[];
}

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  outlineColor: string;
  outlineWidth: number;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({
  image,
  onSave,
  onCancel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [editState, setEditState] = useState<EditState>({
    crop: null,
    aspectRatio: 'free',
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    textOverlays: [],
  });

  const [selectedTool, setSelectedTool] = useState<'crop' | 'text' | 'adjust' | 'filters' | 'effects' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [appliedFilters, setAppliedFilters] = useState<string[]>([]);
  const [history, setHistory] = useState<EditState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Save initial state to history
  React.useEffect(() => {
    const initialState: EditState = {
      crop: null,
      aspectRatio: 'free',
      rotation: 0,
      flipHorizontal: false,
      flipVertical: false,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      textOverlays: [],
    };
    setHistory([initialState]);
    setHistoryIndex(0);
  }, []);

  const saveToHistory = (newState: EditState) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const previousState = history[historyIndex - 1];
      setEditState(previousState);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setEditState(nextState);
      setHistoryIndex(historyIndex + 1);
    }
  };

  const applyEdits = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = async function() {
      // Set canvas size
      canvas.width = img.width;
      canvas.height = img.height;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Save context for transformations
      ctx.save();

      // Apply transformations
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((editState.rotation * Math.PI) / 180);

      if (editState.flipHorizontal) ctx.scale(-1, 1);
      if (editState.flipVertical) ctx.scale(1, -1);

      ctx.translate(-canvas.width / 2, -canvas.height / 2);

      // Apply filters
      ctx.filter = `brightness(${editState.brightness}%) contrast(${editState.contrast}%) saturate(${editState.saturation}%)`;

      // Draw image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Apply crop if set
      if (editState.crop) {
        const { x, y, width, height } = editState.crop;
        const croppedImage = ctx.getImageData(x, y, width, height);
        canvas.width = width;
        canvas.height = height;
        ctx.putImageData(croppedImage, 0, 0);
      }

      // Ensure TikTok fonts are loaded before rendering text
      await ensureTikTokFontsLoaded();

      // Add text overlays
      for (let i = 0; i < editState.textOverlays.length; i++) {
        const overlay = editState.textOverlays[i];
        // Get the proper canvas font family with loaded TikTok fonts
        const canvasFontFamily = fontLoader.getCanvasFontFamily(overlay.fontFamily, overlay.fontWeight);

        ctx.font = overlay.fontWeight + ' ' + overlay.fontSize + 'px ' + canvasFontFamily;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Draw outline using stroke for clean outside outline
        if (overlay.outlineWidth > 0) {
          ctx.strokeStyle = overlay.outlineColor;
          ctx.lineWidth = overlay.outlineWidth;
          ctx.lineJoin = 'round';
          ctx.miterLimit = 2;
          ctx.strokeText(overlay.text, overlay.x, overlay.y);
        }

        // Draw the main text fill on top
        ctx.fillStyle = overlay.color;
        ctx.fillText(overlay.text, overlay.x, overlay.y);
      }

      ctx.restore();
    };
    img.src = image.preview;
  }, [editState, image.preview]);

  React.useEffect(() => {
    applyEdits();
  }, [applyEdits]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (selectedTool === 'crop') {
      setIsDragging(true);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setDragStart({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && selectedTool === 'crop') {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        let x = Math.min(dragStart.x, currentX);
        let y = Math.min(dragStart.y, currentY);
        let width = Math.abs(currentX - dragStart.x);
        let height = Math.abs(currentY - dragStart.y);

        // Apply aspect ratio constraint if not free
        if (editState.aspectRatio !== 'free') {
          const [ratioWidth, ratioHeight] = editState.aspectRatio.split(':').map(Number);
          const targetRatio = ratioWidth / ratioHeight;

          // Calculate the constrained dimensions
          const currentRatio = width / height;

          if (currentRatio > targetRatio) {
            // Too wide, constrain width based on height
            width = height * targetRatio;
            // Adjust x position to maintain dragging direction
            if (currentX < dragStart.x) {
              x = Math.max(0, dragStart.x - width);
            }
          } else {
            // Too tall, constrain height based on width
            height = width / targetRatio;
            // Adjust y position to maintain dragging direction
            if (currentY < dragStart.y) {
              y = Math.max(0, dragStart.y - height);
            }
          }

          // Ensure the crop area stays within canvas bounds
          if (x + width > rect.width) {
            width = rect.width - x;
            height = width / targetRatio;
          }
          if (y + height > rect.height) {
            height = rect.height - y;
            width = height * targetRatio;
          }
        }

        setEditState(prev => ({
          ...prev,
          crop: { x, y, width, height },
        }));
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const addTextOverlay = () => {
    const newText: TextOverlay = {
      id: Math.random().toString(36).substr(2, 9),
      text: 'Your Text Here',
      x: 50,
      y: 50,
      fontSize: 24,
      color: '#ffffff',
      fontFamily: 'TikTok Sans',
      fontWeight: '400',
      outlineColor: '#000000',
      outlineWidth: 4,
    };

    const newState = {
      ...editState,
      textOverlays: [...editState.textOverlays, newText],
    };
    setEditState(newState);
    saveToHistory(newState);
  };

  const updateTextOverlay = (id: string, updates: Partial<TextOverlay>) => {
    const newState = {
      ...editState,
      textOverlays: editState.textOverlays.map(overlay =>
        overlay.id === id ? { ...overlay, ...updates } : overlay
      ),
    };
    setEditState(newState);
    saveToHistory(newState);
  };

  const removeTextOverlay = (id: string) => {
    const newState = {
      ...editState,
      textOverlays: editState.textOverlays.filter(overlay => overlay.id !== id),
    };
    setEditState(newState);
    saveToHistory(newState);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.toBlob(async (blob) => {
        if (blob) {
          const editedFile = new File([blob], image.file.name, { type: image.file.type });

          // Upload edited image to FreeImage.host
          try {
            const { uploadToFreeImage } = await import('@/lib/freeimage');
            const freeImageResponse = await uploadToFreeImage(editedFile);

            const editedImage: UploadedImage = {
              ...image,
              file: editedFile,
              url: freeImageResponse.image.url,
              preview: freeImageResponse.image.url,
              permanentUrl: freeImageResponse.image.url,
              deleteUrl: freeImageResponse.image.delete_url,
              aspectRatio: editState.aspectRatio !== 'free' ? editState.aspectRatio : undefined,
            };
            onSave(editedImage);
          } catch (error) {
            console.error('Failed to upload edited image:', error);
            // Fallback to local URL if FreeImage.host upload fails
            const editedImage: UploadedImage = {
              ...image,
              file: editedFile,
              url: URL.createObjectURL(editedFile),
              preview: URL.createObjectURL(editedFile),
            };
            onSave(editedImage);
          }
        }
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Edit Image</h2>
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-gray-400 hover:text-white hover:bg-gray-800">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex">
          {/* Canvas Area */}
          <div className="flex-1 p-4">
            <div className="relative bg-gray-800 rounded-lg overflow-hidden">
              <canvas
                ref={canvasRef}
                className={cn(
                  "max-w-full max-h-96 cursor-crosshair",
                  selectedTool === 'crop' && "cursor-crosshair",
                  selectedTool === 'text' && "cursor-text"
                )}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              />

              {/* Crop overlay */}
              {editState.crop && selectedTool === 'crop' && (
                <div
                  className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20"
                  style={{
                    left: editState.crop.x,
                    top: editState.crop.y,
                    width: editState.crop.width,
                    height: editState.crop.height,
                  }}
                >
                  {/* Aspect ratio guides */}
                  {editState.aspectRatio !== 'free' && (
                    <>
                      {/* Corner guides */}
                      <div className="absolute top-0 left-0 w-2 h-2 border-l-2 border-t-2 border-blue-300" />
                      <div className="absolute top-0 right-0 w-2 h-2 border-r-2 border-t-2 border-blue-300" />
                      <div className="absolute bottom-0 left-0 w-2 h-2 border-l-2 border-b-2 border-blue-300" />
                      <div className="absolute bottom-0 right-0 w-2 h-2 border-r-2 border-b-2 border-blue-300" />

                      {/* Aspect ratio label */}
                      <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-1 py-0.5 rounded font-mono">
                        {editState.aspectRatio}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tools Panel */}
          <div className="w-80 border-l border-gray-700 p-4 space-y-4 bg-gray-800">
            {/* Aspect Ratio Controls */}
            {selectedTool === 'crop' && (
              <motion.div
                className="space-y-3"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <h4 className="font-semibold text-white">Aspect Ratio</h4>
                <div className="grid grid-cols-2 gap-2">
                  {ASPECT_RATIO_PRESETS.map((preset) => (
                    <Button
                      key={preset.id}
                      variant={editState.aspectRatio === preset.ratio ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEditState(prev => ({ ...prev, aspectRatio: preset.ratio }))}
                      className="flex flex-col items-center p-2 h-auto text-xs"
                      title={preset.description}
                    >
                      <span className="text-sm mb-1">{preset.icon}</span>
                      <span>{preset.label}</span>
                      <span className="text-[10px] opacity-70">{preset.ratio}</span>
                    </Button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Enhanced Tools */}
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="space-y-2">
                <h3 className="font-semibold text-white">Tools</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={selectedTool === 'crop' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTool(selectedTool === 'crop' ? null : 'crop')}
                    className="flex flex-col items-center p-3 h-auto"
                  >
                    <Scissors className="w-5 h-5 mb-1" />
                    <span className="text-xs">Crop</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={undo}
                    disabled={historyIndex <= 0}
                    className="flex flex-col items-center p-3 h-auto"
                  >
                    <Undo className="w-5 h-5 mb-1" />
                    <span className="text-xs">Undo</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={redo}
                    disabled={historyIndex >= history.length - 1}
                    className="flex flex-col items-center p-3 h-auto"
                  >
                    <Redo className="w-5 h-5 mb-1" />
                    <span className="text-xs">Redo</span>
                  </Button>

                  <Button
                    variant={selectedTool === 'text' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectedTool('text');
                      addTextOverlay();
                    }}
                    className="flex flex-col items-center p-3 h-auto"
                  >
                    <Type className="w-5 h-5 mb-1" />
                    <span className="text-xs">Text</span>
                  </Button>

                  <Button
                    variant={selectedTool === 'adjust' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTool('adjust')}
                    className="flex flex-col items-center p-3 h-auto"
                  >
                    <Palette className="w-5 h-5 mb-1" />
                    <span className="text-xs">Adjust</span>
                  </Button>

                  <Button
                    variant={selectedTool === 'filters' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTool('filters')}
                    className="flex flex-col items-center p-3 h-auto"
                  >
                    <Filter className="w-5 h-5 mb-1" />
                    <span className="text-xs">Filters</span>
                  </Button>

                  <Button
                    variant={selectedTool === 'effects' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTool('effects')}
                    className="flex flex-col items-center p-3 h-auto"
                  >
                    <Sparkles className="w-5 h-5 mb-1" />
                    <span className="text-xs">Effects</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setZoom(Math.min(zoom + 0.25, 3))}
                    className="flex flex-col items-center p-3 h-auto"
                  >
                    <ZoomIn className="w-5 h-5 mb-1" />
                    <span className="text-xs">Zoom In</span>
                  </Button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2">
                <h4 className="font-medium text-gray-300">Quick Actions</h4>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setEditState(prev => ({ ...prev, rotation: prev.rotation + 90 }))}>
                    <RotateCw className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditState(prev => ({ ...prev, flipHorizontal: !prev.flipHorizontal }))}>
                    <FlipHorizontal className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditState(prev => ({ ...prev, flipVertical: !prev.flipVertical }))}>
                    <FlipVertical className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setZoom(1)}>
                    <Move className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* Enhanced Adjustments */}
            {selectedTool === 'adjust' && (
              <motion.div
                className="space-y-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <h4 className="font-semibold text-white">Adjustments</h4>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium flex items-center">
                        <Sun className="w-4 h-4 mr-2 text-yellow-500" />
                        Brightness
                      </label>
                      <span className="text-xs text-gray-400">{editState.brightness}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={editState.brightness}
                      onChange={(e) => setEditState(prev => ({ ...prev, brightness: Number(e.target.value) }))}
                      className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium flex items-center">
                        <Contrast className="w-4 h-4 mr-2 text-blue-500" />
                        Contrast
                      </label>
                      <span className="text-xs text-gray-400">{editState.contrast}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={editState.contrast}
                      onChange={(e) => setEditState(prev => ({ ...prev, contrast: Number(e.target.value) }))}
                      className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium flex items-center">
                        <Droplet className="w-4 h-4 mr-2 text-purple-500" />
                        Saturation
                      </label>
                      <span className="text-xs text-gray-400">{editState.saturation}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={editState.saturation}
                      onChange={(e) => setEditState(prev => ({ ...prev, saturation: Number(e.target.value) }))}
                      className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Filters Panel */}
            {selectedTool === 'filters' && (
              <motion.div
                className="space-y-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <h4 className="font-semibold text-white">Filters</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: 'Vintage', icon: '🕰️' },
                    { name: 'B&W', icon: '⚫' },
                    { name: 'Sepia', icon: '🏜️' },
                    { name: 'Cool', icon: '❄️' },
                    { name: 'Warm', icon: '🔥' },
                    { name: 'Vivid', icon: '🌈' },
                    { name: 'Dramatic', icon: '🎭' },
                    { name: 'Soft', icon: '☁️' }
                  ].map((filter) => (
                    <Button
                      key={filter.name}
                      variant={appliedFilters.includes(filter.name) ? 'default' : 'outline'}
                      size="sm"
                      className="flex flex-col items-center p-3 h-auto"
                      onClick={() => {
                        setAppliedFilters(prev =>
                          prev.includes(filter.name)
                            ? prev.filter(f => f !== filter.name)
                            : [...prev, filter.name]
                        );
                      }}
                    >
                      <span className="text-lg mb-1">{filter.icon}</span>
                      <span className="text-xs">{filter.name}</span>
                    </Button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Effects Panel */}
            {selectedTool === 'effects' && (
              <motion.div
                className="space-y-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <h4 className="font-semibold text-white">Effects</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: 'Blur', icon: <Wand2 className="w-4 h-4" /> },
                    { name: 'Sharpen', icon: <Zap className="w-4 h-4" /> },
                    { name: 'Noise', icon: <Layers className="w-4 h-4" /> },
                    { name: 'Vignette', icon: <Filter className="w-4 h-4" /> },
                    { name: 'Glow', icon: <Sparkles className="w-4 h-4" /> },
                    { name: 'Emboss', icon: <Move className="w-4 h-4" /> }
                  ].map((effect) => (
                    <Button
                      key={effect.name}
                      variant="outline"
                      size="sm"
                      className="flex flex-col items-center p-3 h-auto"
                    >
                      <div className="mb-1">{effect.icon}</div>
                      <span className="text-xs">{effect.name}</span>
                    </Button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Text Overlays */}
            {editState.textOverlays.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-white">Text Overlays</h4>
                {editState.textOverlays.map(overlay => (
                  <div key={overlay.id} className="border border-gray-600 rounded p-2 space-y-2 bg-gray-700">
                    <input
                      type="text"
                      value={overlay.text}
                      onChange={(e) => updateTextOverlay(overlay.id, { text: e.target.value })}
                      className="w-full text-sm border border-gray-500 rounded px-2 py-1 bg-gray-800 text-white"
                    />
                    <div className="flex space-x-2">
                      <select
                        value={overlay.fontWeight}
                        onChange={(e) => updateTextOverlay(overlay.id, { fontWeight: e.target.value })}
                        className="w-16 text-sm border border-gray-500 rounded px-2 py-1 bg-gray-800 text-white"
                      >
                        <option value="400">Regular</option>
                        <option value="700">Bold</option>
                      </select>
                      <input
                        type="number"
                        value={overlay.fontSize}
                        onChange={(e) => updateTextOverlay(overlay.id, { fontSize: Number(e.target.value) })}
                        className="w-16 text-sm border border-gray-500 rounded px-2 py-1 bg-gray-800 text-white"
                        min="8"
                        max="72"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeTextOverlay(overlay.id)}
                        className="text-gray-300 hover:text-white hover:bg-gray-600"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-300">Fill Color</label>
                        <input
                          type="color"
                          value={overlay.color}
                          onChange={(e) => updateTextOverlay(overlay.id, { color: e.target.value })}
                          className="w-8 h-8 rounded border border-gray-500"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-300">Outline Color</label>
                        <input
                          type="color"
                          value={overlay.outlineColor}
                          onChange={(e) => updateTextOverlay(overlay.id, { outlineColor: e.target.value })}
                          className="w-8 h-8 rounded border border-gray-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-gray-300">Outline Width</label>
                          <span className="text-xs text-gray-400">{overlay.outlineWidth}px</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          value={overlay.outlineWidth}
                          onChange={(e) => updateTextOverlay(overlay.id, { outlineWidth: Number(e.target.value) })}
                          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Transform Tools */}
            <div className="space-y-2">
              <h4 className="font-medium">Transform</h4>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditState(prev => ({ ...prev, rotation: prev.rotation + 90 }))}
                >
                  <RotateCw className="w-4 h-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditState(prev => ({ ...prev, flipHorizontal: !prev.flipHorizontal }))}
                >
                  <FlipHorizontal className="w-4 h-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditState(prev => ({ ...prev, flipVertical: !prev.flipVertical }))}
                >
                  <FlipVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-2 p-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};
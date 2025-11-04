import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Crop, Settings } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { ASPECT_RATIO_PRESETS, AspectRatioPreset } from '@/types';
import { parseAspectRatio } from '@/lib/aspectRatio';

interface AspectRatioSelectorProps {
  selectedAspectRatio: string;
  onAspectRatioChange: (aspectRatio: string) => void;
  className?: string;
  disabled?: boolean;
  showPreview?: boolean;
}

export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({
  selectedAspectRatio,
  onAspectRatioChange,
  className,
  disabled = false,
  showPreview = true,
}) => {
  const [showPresets, setShowPresets] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedPreset = ASPECT_RATIO_PRESETS.find(p => p.ratio === selectedAspectRatio);

  const handlePresetSelect = (preset: AspectRatioPreset) => {
    console.log('🎯 Aspect ratio selected:', preset.ratio, preset.label);
    onAspectRatioChange(preset.ratio);
    setShowPresets(false);
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Only close if clicking outside both the container and dropdown
      if (showPresets && containerRef.current && dropdownRef.current) {
        const clickedOutsideContainer = !containerRef.current.contains(event.target as Node);
        const clickedOutsideDropdown = !dropdownRef.current.contains(event.target as Node);

        if (clickedOutsideContainer && clickedOutsideDropdown) {
          setShowPresets(false);
        }
      }
    };

    if (showPresets) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPresets]);

  // Calculate dropdown position
  const getDropdownPosition = () => {
    if (!buttonRef.current) return { top: 0, left: 0 };
    
    const rect = buttonRef.current.getBoundingClientRect();
    return {
      top: rect.bottom + window.scrollY,
      left: rect.right + window.scrollX - 280, // Align to right, subtract dropdown width
    };
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          console.log('🎯 AspectRatioSelector button clicked, disabled:', disabled);
          if (!disabled) {
            setShowPresets(!showPresets);
          }
        }}
        disabled={disabled}
        className={cn(
          "flex items-center space-x-2 px-3 py-2 h-8 text-sm border border-border rounded-lg transition-all duration-200",
          "bg-background hover:bg-accent text-foreground",
          disabled && "opacity-50 cursor-not-allowed",
          !disabled && "cursor-pointer"
        )}
      >
        <Crop className="w-4 h-4" />
        <span className="font-medium">
          {selectedPreset?.label || 'Aspect Ratio'}
        </span>
        <span className="text-xs text-muted-foreground">
          {selectedAspectRatio}
        </span>
      </button>

      {showPresets && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-background border border-border rounded-lg shadow-2xl p-3 min-w-[280px]"
          style={{
            pointerEvents: 'auto',
            zIndex: 99999,
            ...getDropdownPosition()
          }}
        >
          <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-border">
            <Settings className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Choose Aspect Ratio</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {ASPECT_RATIO_PRESETS.map((preset) => {
              const isSelected = selectedAspectRatio === preset.ratio;
              const aspectValue = preset.ratio === 'free' ? 0 : parseAspectRatio(preset.ratio);
              
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔘 Preset button clicked:', preset.label, preset.ratio, 'disabled:', disabled);
                    if (!disabled) {
                      handlePresetSelect(preset);
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center p-3 rounded-lg border-2 transition-all duration-200 hover:border-primary/50 cursor-pointer",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent hover:border-primary",
                    disabled && "opacity-50 cursor-not-allowed hover:border-border hover:bg-transparent"
                  )}
                  disabled={disabled}
                >
                  {/* Visual Preview */}
                  {showPreview && preset.ratio !== 'free' && (
                    <div className="mb-2">
                      <div
                        className="bg-muted-foreground/30 rounded border"
                        style={{
                          width: '32px',
                          height: `${32 / aspectValue}px`,
                          maxHeight: '24px',
                          minHeight: '16px'
                        }}
                      />
                    </div>
                  )}
                  
                  {preset.ratio === 'free' && (
                    <div className="mb-2 w-8 h-6 bg-muted-foreground/30 rounded border relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-4 h-px bg-muted-foreground transform rotate-45" />
                        <div className="absolute w-4 h-px bg-muted-foreground transform -rotate-45" />
                      </div>
                    </div>
                  )}
                  
                  <div className="text-center">
                    <div className="text-xs font-medium text-foreground">
                      {preset.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {preset.ratio}
                    </div>
                  </div>
                  
                  {isSelected && (
                    <div className="mt-1 text-xs text-primary font-medium">
                      ✓ Selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          
          <div className="mt-3 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              {selectedAspectRatio === 'free'
                ? 'Images will keep their original aspect ratios'
                : `All images will be cropped to ${selectedAspectRatio} ratio`
              }
            </p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
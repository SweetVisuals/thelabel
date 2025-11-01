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
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Calculate dropdown position when showing
  useEffect(() => {
    if (showPresets && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8, // 8px gap below button
        left: rect.left + window.scrollX
      });
    }
  }, [showPresets]);

  const selectedPreset = ASPECT_RATIO_PRESETS.find(p => p.ratio === selectedAspectRatio);

  const handlePresetSelect = (preset: AspectRatioPreset) => {
    onAspectRatioChange(preset.ratio);
    setShowPresets(false);
  };

  return (
    <div className={cn("relative", className)}>
      <Button
        ref={buttonRef}
        variant="outline"
        size="sm"
        onClick={() => setShowPresets(!showPresets)}
        disabled={disabled}
        className="flex items-center space-x-2"
      >
        <Crop className="w-4 h-4" />
        <span className="font-medium">
          {selectedPreset?.label || 'Aspect Ratio'}
        </span>
        <span className="text-xs text-muted-foreground">
          {selectedAspectRatio}
        </span>
      </Button>

      {showPresets && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[99999]"
            onClick={() => setShowPresets(false)}
          />
          
          {/* Preset Grid - positioned using calculated coordinates */}
          <div
            className="fixed bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[280px] z-[100000]"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
            }}
          >
            <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-gray-100">
              <Settings className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-medium text-gray-700">Choose Aspect Ratio</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {ASPECT_RATIO_PRESETS.map((preset) => {
                const isSelected = selectedAspectRatio === preset.ratio;
                const aspectValue = preset.ratio === 'free' ? 0 : parseAspectRatio(preset.ratio);
                
                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset)}
                    className={cn(
                      "flex flex-col items-center p-3 rounded-lg border-2 transition-all duration-200 hover:border-blue-300",
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    )}
                    disabled={disabled}
                  >
                    {/* Visual Preview */}
                    {showPreview && preset.ratio !== 'free' && (
                      <div className="mb-2">
                        <div
                          className="bg-gray-300 rounded border"
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
                      <div className="mb-2 w-8 h-6 bg-gray-300 rounded border relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-4 h-px bg-gray-500 transform rotate-45" />
                          <div className="absolute w-4 h-px bg-gray-500 transform -rotate-45" />
                        </div>
                      </div>
                    )}
                    
                    <div className="text-center">
                      <div className="text-xs font-medium text-gray-700">
                        {preset.label}
                      </div>
                      <div className="text-xs text-gray-500">
                        {preset.ratio}
                      </div>
                    </div>
                    
                    {isSelected && (
                      <div className="mt-1 text-xs text-blue-600 font-medium">
                        ✓ Selected
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            
            <div className="mt-3 pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center">
                {selectedAspectRatio === 'free'
                  ? 'Images will keep their original aspect ratios'
                  : `All images will be cropped to ${selectedAspectRatio} ratio`
                }
              </p>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};
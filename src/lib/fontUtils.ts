/**
 * Font loading utilities for canvas text rendering
 */

class FontLoader {
  private loadedFonts: Set<string> = new Set();
  private loadingPromises: Map<string, Promise<void>> = new Map();

  /**
   * Load TikTok fonts for canvas usage
   */
  async loadTikTokFonts(): Promise<void> {
    const fontsToLoad = [
      {
        name: 'TikTok Sans Regular',
        url: '/fonts/TikTokSans-Regular.ttf',
        weight: '400',
        style: 'normal'
      },
      {
        name: 'TikTok Sans Medium',
        url: '/fonts/TikTokSans-Medium.ttf',
        weight: '500',
        style: 'normal'
      },
      {
        name: 'TikTok Sans Bold',
        url: '/fonts/TikTokSans-Bold.ttf',
        weight: '700',
        style: 'normal'
      },
      {
        name: 'TikTok Sans SemiBold',
        url: '/fonts/TikTokSans-SemiBold.ttf',
        weight: '600',
        style: 'normal'
      }
    ];

    const loadPromises = fontsToLoad.map(font => this.loadFont(font.name, font.url, font.weight, font.style));

    try {
      await Promise.all(loadPromises);
      // Wait for fonts to be ready in the document
      await document.fonts.ready;
      console.log('✅ All TikTok fonts loaded successfully for canvas');
    } catch (error) {
      console.warn('⚠️ Some TikTok fonts failed to load:', error);
      // Continue even if some fonts fail - fallbacks will work
    }
  }

  /**
   * Load a single font using FontFace API
   */
  private async loadFont(fontName: string, url: string, weight: string = '400', style: string = 'normal'): Promise<void> {
    // Check if already loaded
    if (this.loadedFonts.has(fontName)) {
      return;
    }

    // Check if already loading
    if (this.loadingPromises.has(fontName)) {
      return this.loadingPromises.get(fontName);
    }

    const loadPromise = (async () => {
      try {
        const fontFace = new FontFace(fontName, `url(${url})`, {
          weight: weight as any,
          style: style as any,
          display: 'swap'
        });

        // Load the font
        const loadedFont = await fontFace.load();

        // Add to document fonts
        document.fonts.add(loadedFont);

        // Mark as loaded
        this.loadedFonts.add(fontName);

        console.log(`✅ Font loaded: ${fontName}`);
      } catch (error) {
        console.warn(`⚠️ Failed to load font ${fontName}:`, error);
        // Don't throw - allow fallbacks to work
      }
    })();

    this.loadingPromises.set(fontName, loadPromise);
    return loadPromise;
  }

  /**
   * Get the appropriate font family string for canvas
   */
  getCanvasFontFamily(fontFamily: string, fontWeight: string = '400'): string {
    // Map common font families to loaded TikTok fonts
    if (fontFamily.toLowerCase().includes('tiktok')) {
      switch (fontWeight) {
        case '700':
        case 'bold':
          return '"TikTok Sans Bold", "TikTok Sans SemiBold", Arial, sans-serif';
        case '600':
        case 'semibold':
          return '"TikTok Sans SemiBold", "TikTok Sans Bold", Arial, sans-serif';
        case '500':
        case 'medium':
          return '"TikTok Sans Medium", "TikTok Sans Regular", Arial, sans-serif';
        default:
          return '"TikTok Sans Regular", Arial, sans-serif';
      }
    }

    // For other fonts, return as-is with fallbacks
    return `"${fontFamily}", Arial, sans-serif`;
  }

  /**
   * Check if fonts are loaded
   */
  areFontsLoaded(): boolean {
    return this.loadedFonts.size > 0;
  }

  /**
   * Wait for a specific font to be available in canvas context
   */
  async waitForFontInCanvas(ctx: CanvasRenderingContext2D, fontFamily: string, timeout: number = 2000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        // Test if the font is available by measuring text
        ctx.font = `16px ${fontFamily}, Arial, sans-serif`;
        const metrics = ctx.measureText('Test');
        if (metrics.width > 0) {
          return true;
        }
      } catch (error) {
        // Continue trying
      }

      // Wait a bit before trying again
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return false;
  }
}

// Singleton instance
export const fontLoader = new FontLoader();

// Convenience function to ensure fonts are loaded
export async function ensureTikTokFontsLoaded(): Promise<void> {
  if (!fontLoader.areFontsLoaded()) {
    await fontLoader.loadTikTokFonts();
  }
}
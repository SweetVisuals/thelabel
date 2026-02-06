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
    // Instead of manually creating FontFace objects which creates a separate font instance,
    // we will force the browser to load the fonts defined in our CSS (@font-face in index.css).
    // This ensures consistency between the HTML preview and the Canvas.

    try {
      // Check if already loaded
      if (document.fonts.check('16px "TikTok Sans"')) {
        console.log('✅ TikTok Sans fonts already loaded');
        return;
      }

      console.log('⏳ Waiting for TikTok Sans fonts to load...');

      const promises = [
        document.fonts.load('16px "TikTok Sans"'),           // Regular 400
        document.fonts.load('500 16px "TikTok Sans"'),       // Medium 500
        document.fonts.load('600 16px "TikTok Sans"'),       // SemiBold 600
        document.fonts.load('bold 16px "TikTok Sans"')       // Bold 700
      ];

      await Promise.all(promises);

      console.log('✅ TikTok Sans fonts loaded via CSS');
    } catch (error) {
      console.warn('⚠️ Error waiting for TikTok fonts:', error);
    }
  }

  /**
   * Load a single font using FontFace API
   * @deprecated Using CSS loading instead
   */
  private async loadFont(fontName: string, url: string, weight: string = '400', style: string = 'normal'): Promise<void> {
    // No-op, we rely on CSS now
    return Promise.resolve();
  }

  /**
   * Get the appropriate font family string for canvas
   */
  getCanvasFontFamily(fontFamily: string, fontWeight: string = '400'): string {
    // Always return the generic family name defined in CSS
    if (fontFamily.toLowerCase().includes('tiktok')) {
      return '"TikTok Sans", Arial, sans-serif';
    }

    // For other fonts, return as-is
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
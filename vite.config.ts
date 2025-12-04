import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
// Force rebuild for Vercel
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      // Proxy Postiz API calls to handle CORS in development
      '/api/postiz-proxy': {
        target: 'https://api.postiz.com/public/v1',
        changeOrigin: true,
        secure: true,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
        // Handle both query parameter format and direct path format
        rewrite: (path) => {
          // If it contains query parameters like '/api/postiz-proxy?path=integrations'
          if (path.includes('path=')) {
            const url = new URL(`http://localhost${path}`);
            const pathParam = url.searchParams.get('path');

            // Reconstruct other query parameters
            const otherParams = new URLSearchParams();
            url.searchParams.forEach((value, key) => {
              if (key !== 'path') {
                otherParams.append(key, value);
              }
            });
            const queryString = otherParams.toString();

            return (pathParam || 'posts') + (queryString ? `?${queryString}` : '');
          }
          // If it's direct path like '/api/postiz-proxy/integrations'
          const cleanPath = path.replace(/^\/api\/postiz-proxy\/?/, '');
          return cleanPath || 'posts'; // Default to posts endpoint
        },
      },
    },
  },
});

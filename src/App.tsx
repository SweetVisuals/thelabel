import React from 'react';
import { AuthPage } from './components/Auth/AuthPage';
import { Dashboard } from './components/Dashboard/Dashboard';
import { useAuth } from './hooks/useAuth';
import { Toaster } from 'sonner';

import { ensureTikTokFontsLoaded } from '@/lib/fontUtils';
function App() {
  const { user, loading } = useAuth();
  // Load TikTok fonts on app startup
  React.useEffect(() => {
    ensureTikTokFontsLoaded().catch(console.warn);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {user ? <Dashboard /> : <AuthPage />}
      <Toaster />
    </>
  );
}

export default App;

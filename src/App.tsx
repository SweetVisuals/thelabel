import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthPage } from './components/Auth/AuthPage';
import { Dashboard } from './components/Dashboard/Dashboard';
import { CalendarPage } from './components/Calendar/CalendarPage';
import { useAuth } from './hooks/useAuth';
import { Toaster } from 'sonner';
import { BulkPostProvider } from './contexts/BulkPostContext';

import { ensureTikTokFontsLoaded } from '@/lib/fontUtils';
import { userService } from './lib/userService';
import { postizAPI } from './lib/postiz';

function App() {
  const { user, loading } = useAuth();
  // Load TikTok fonts on app startup
  React.useEffect(() => {
    ensureTikTokFontsLoaded().catch(console.warn);
  }, []);

  // Load user settings (API Key) from DB globally
  React.useEffect(() => {
    const loadUserSettings = async () => {
      if (user) {
        const apiKey = await userService.getPostizApiKey(user.id);
        if (apiKey) {
          postizAPI.setApiKey(apiKey);
        }
      }
    };
    loadUserSettings();
  }, [user]);

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
    <Router>
      <BulkPostProvider>
        <Routes>
          <Route path="/" element={
            user ? (
              <Dashboard />
            ) : (
              <AuthPage />
            )
          } />
          <Route path="/calendar" element={
            user ? (
              <CalendarPage />
            ) : (
              <AuthPage />
            )
          } />
        </Routes>
      </BulkPostProvider>
      <Toaster />
    </Router>
  );
}

export default App;

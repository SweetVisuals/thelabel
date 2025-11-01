import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wtsckulmgegamnovlrbf.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0c2NrdWxtZ2VnYW1ub3ZscmJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2ODIyODYsImV4cCI6MjA3NzI1ODI4Nn0.Vg7GovepSgB5SmKW35R4k8Dt08vicbNHy5LBHy6QzEc';

// Check if we're in demo mode (only when using actual placeholder values)
const isDemoMode = (supabaseUrl === 'your-supabase-url' || supabaseKey === 'your-supabase-anon-key' ||
                  supabaseUrl === 'https://your-project-id.supabase.co' || supabaseKey === 'your-anon-key');

// Force real Supabase mode if we have actual credentials
const useRealSupabase = !isDemoMode && supabaseUrl !== 'your-supabase-url' && supabaseKey !== 'your-supabase-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: {
      getItem: (key: string) => {
        if (typeof window !== 'undefined') {
          try {
            return window.localStorage.getItem(key);
          } catch (error) {
            console.error('Storage getItem error:', error);
            return null;
          }
        }
        return null;
      },
      setItem: (key: string, value: string) => {
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(key, value);
          } catch (error) {
            console.error('Storage setItem error:', error);
          }
        }
      },
      removeItem: (key: string) => {
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.removeItem(key);
          } catch (error) {
            console.error('Storage removeItem error:', error);
          }
        }
      },
    },
  },
});

// Prevent multiple client instances and auth listeners
let authSubscription: any = null;
let isInitialized = false;

// Demo users for testing
const demoUsers = [
  { email: 'user1@example.com', password: 'password123', id: 'demo-user-1' },
  { email: 'user2@example.com', password: 'password123', id: 'demo-user-2' }
];

export const authService = {
  async signUp(email: string, password: string) {
    if (isDemoMode) {
      // Check if demo user already exists
      const existingUser = demoUsers.find(u => u.email === email);
      if (existingUser) {
        return { data: null, error: { message: 'Demo user already exists' } };
      }
      
      // Create new demo user
      const newUser = { email, password, id: `demo-${Date.now()}` };
      demoUsers.push(newUser);
      
      // Store session
      const session = { user: { id: newUser.id, email: newUser.email } };
      localStorage.setItem('demo-session', JSON.stringify(session));
      
      return { data: { user: session.user }, error: null };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { data, error };
  },

  async signIn(email: string, password: string) {
    if (isDemoMode) {
      // Check if it's a demo user
      const demoUser = demoUsers.find(u => u.email === email && u.password === password);
      if (demoUser) {
        // Store session in localStorage
        const session = { user: { id: demoUser.id, email: demoUser.email } };
        localStorage.setItem('demo-session', JSON.stringify(session));
        return { data: { user: session.user }, error: null };
      } else {
        return { data: null, error: { message: 'Invalid demo credentials' } };
      }
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  async signOut() {
    if (isDemoMode) {
      // Clear demo session
      localStorage.removeItem('demo-session');
      return { error: null };
    }
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  async getCurrentUser() {
    if (isDemoMode) {
      // For demo mode, check if we have a stored demo session
      const demoSession = localStorage.getItem('demo-session');
      if (demoSession) {
        try {
          const session = JSON.parse(demoSession);
          return { user: session.user, error: null };
        } catch {
          localStorage.removeItem('demo-session');
        }
      }
      return { user: null, error: null };
    }
    
    // Always try to restore session first
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        return { user: null, error };
      }
      
      if (session?.user) {
        return { user: session.user, error: null };
      } else {
        return { user: null, error: null };
      }
    } catch (error) {
      return { user: null, error };
    }
  },

  onAuthStateChange(callback: (user: any) => void) {
    // Prevent multiple subscriptions
    if (authSubscription) {
      // Call callback with current session state
      authService.getCurrentUser().then(({ user }) => {
        callback(user);
      });
      return authSubscription;
    }
    
    if (isDemoMode) {
      // For demo mode, check for stored session immediately
      const demoSession = localStorage.getItem('demo-session');
      
      if (demoSession) {
        try {
          const session = JSON.parse(demoSession);
          callback(session.user);
        } catch {
          localStorage.removeItem('demo-session');
          callback(null);
        }
      } else {
        callback(null);
      }
      
      // Return a mock subscription for demo mode
      authSubscription = {
        data: {
          subscription: {
            unsubscribe: () => {
              authSubscription = null;
            }
          }
        }
      };
      return authSubscription;
    }
    
    // For real Supabase mode - use singleton pattern
    authSubscription = supabase.auth.onAuthStateChange(async (event, session) => {
      // Only handle meaningful events, ignore INITIAL_SESSION if we have a user
      if (event === 'SIGNED_OUT' && !session?.user) {
        // Clear any cached demo session if it exists
        localStorage.removeItem('demo-session');
      }
      
      callback(session?.user ?? null);
    });
    
    return authSubscription;
  }
};
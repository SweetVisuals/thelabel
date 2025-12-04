import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wtsckulmgegamnovlrbf.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0c2NrdWxtZ2VnYW1ub3ZscmJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2ODIyODYsImV4cCI6MjA3NzI1ODI4Nn0.Vg7GovepSgB5SmKW35R4k8Dt08vicbNHy5LBHy6QzEc';

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

// Prevent multiple auth listeners
let authSubscription: any = null;

export const authService = {
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { data, error };
  },

  async signIn(email: string, password: string) {
    console.log('📡 authService.signIn called with email:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log('📡 Supabase response - data:', data, 'error:', error);
    return { data, error };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  async getCurrentUser() {
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
      console.log('⚠️ Auth subscription already exists, reusing...');
      // Call callback with current session state
      authService.getCurrentUser().then(({ user }) => {
        callback(user);
      });
      return authSubscription;
    }

    console.log('🎧 Setting up new auth state listener...');
    // Set up auth state listener
    authSubscription = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🎧 Auth state change event:', event, 'session:', session);
      callback(session?.user ?? null);
    });

    return authSubscription;
  }
};

// Rate limit service for managing TikTok rate limit states
export const rateLimitService = {
  async setRateLimit(userId: string, platform: string = 'tiktok', durationMinutes: number = 60) {
    try {
      const rateLimitResetAt = new Date();
      rateLimitResetAt.setMinutes(rateLimitResetAt.getMinutes() + durationMinutes);

      const { error } = await supabase
        .from('rate_limits')
        .upsert({
          user_id: userId,
          platform,
          rate_limit_hit_at: new Date().toISOString(),
          rate_limit_reset_at: rateLimitResetAt.toISOString()
        });

      if (error) throw error;

      console.log(`✅ Rate limit set for user ${userId} on ${platform}, resets at ${rateLimitResetAt.toISOString()}`);
      return { success: true, resetAt: rateLimitResetAt };
    } catch (error) {
      console.error('❌ Failed to set rate limit:', error);
      return { success: false, error };
    }
  },

  async getRateLimit(userId: string, platform: string = 'tiktok') {
    try {
      const { data, error } = await supabase
        .from('rate_limits')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', platform)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error;
      }

      if (!data) {
        return { isLimited: false, resetAt: null, timeLeft: 0 };
      }

      const now = new Date();
      const resetAt = new Date(data.rate_limit_reset_at);
      const isLimited = now < resetAt;
      const timeLeft = isLimited ? resetAt.getTime() - now.getTime() : 0;

      return {
        isLimited,
        resetAt,
        timeLeft,
        hitAt: new Date(data.rate_limit_hit_at)
      };
    } catch (error) {
      console.error('❌ Failed to get rate limit:', error);
      return { isLimited: false, resetAt: null, timeLeft: 0, error };
    }
  },

  async clearRateLimit(userId: string, platform: string = 'tiktok') {
    try {
      const { error } = await supabase
        .from('rate_limits')
        .delete()
        .eq('user_id', userId)
        .eq('platform', platform);

      if (error) throw error;

      console.log(`✅ Rate limit cleared for user ${userId} on ${platform}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to clear rate limit:', error);
      return { success: false, error };
    }
  }
};
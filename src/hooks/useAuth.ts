import { useState, useEffect } from 'react';
import { authService } from '../lib/supabase';
import { AuthState } from '../types';

export const useAuth = (): AuthState & {
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
} => {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;
    let authInitialized = false;

    const initializeAuth = async () => {
      // Prevent multiple initializations
      if (authInitialized) {
        return;
      }
      authInitialized = true;



      try {
        // Add a small delay to allow Supabase to restore session
        await new Promise(resolve => setTimeout(resolve, 100));

        // First, check for existing session
        const { user, error } = await authService.getCurrentUser();


        if (mounted) {
          setState(prev => ({
            ...prev,
            user: user as any,
            loading: false,
            error: typeof error === 'object' && error !== null && 'message' in error ? (error as any).message : null,
          }));
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        if (mounted) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: 'Failed to check authentication',
          }));
        }
      }
    };

    initializeAuth();

    // Set up auth state listener (this will be singleton via authService)
    const { data: { subscription } } = authService.onAuthStateChange((user) => {
      console.log('🔔 Auth state changed, user:', user);
      if (mounted) {
        setState(prev => ({
          ...prev,
          user: user as any,
          loading: false,
          error: null,
        }));
      }
    });

    return () => {
      mounted = false;
      // Only unsubscribe if we're the last one (this is handled by the singleton pattern)
      if (subscription?.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('🔐 Sign in started...');
    setState(prev => ({ ...prev, loading: true, error: null }));
    const result = await authService.signIn(email, password);

    console.log('🔐 Sign in result:', result);
    console.log('🔐 Error:', result.error);
    console.log('🔐 Data:', result.data);
    console.log('🔐 User:', result.data?.user);

    // Immediately update user state on successful login
    // Supabase returns { data: { user, session }, error }
    if (!result.error && result.data?.user) {
      console.log('✅ Sign in successful, updating state with user:', result.data.user);
      setState(prev => ({ ...prev, user: result.data.user as any, loading: false, error: null }));
    } else {
      console.log('❌ Sign in failed or no user:', result.error?.message);
      setState(prev => ({ ...prev, loading: false, error: result.error?.message || null }));
    }

    return { error: result.error };
  };

  const signUp = async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    const { data, error } = await authService.signUp(email, password);

    // Immediately update user state on successful signup
    if (!error && data?.user) {
      setState(prev => ({ ...prev, user: data.user as any, loading: false, error: null }));
    } else {
      setState(prev => ({ ...prev, loading: false, error: error?.message || null }));
    }

    return { error };
  };

  const signOut = async () => {
    setState(prev => ({ ...prev, loading: true }));
    const { error } = await authService.signOut();
    setState(prev => ({
      ...prev,
      user: null,
      loading: false,
      error: error?.message || null
    }));
    return { error };
  };

  return {
    ...state,
    signIn,
    signUp,
    signOut,
  };
};
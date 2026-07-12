

import { createContext, useContext, useEffect, useCallback, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  must_change_password?: boolean;
}

interface UserRole {
  role: 'admin' | 'manager' | 'booking_agent';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRole: string | null;
  loading: boolean;
  mustChangePassword: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const authCheckId = useRef(0);
  // Track the currently-authenticated user so we can ignore benign auth events
  // (e.g. TOKEN_REFRESHED fired when the tab regains focus) that would
  // otherwise flip the app back into its loading state and remount everything.
  const currentUserIdRef = useRef<string | null>(null);

  const clearAuthState = useCallback(() => {
    currentUserIdRef.current = null;
    setSession(null);
    setUser(null);
    setProfile(null);
    setUserRole(null);
    setMustChangePassword(false);
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      console.log('[Auth] Profile fetch result:', { data, error });
      
      if (!error && data) {
        setProfile(data);
        setMustChangePassword(data?.must_change_password || false);
      } else if (error) {
        console.log('[Auth] Profile fetch error:', error);
      }
    } catch (error) {
      console.log('[Auth] Profile fetch exception:', error);
    }
  };

  const fetchUserRole = async (userId: string) => {
    try {
      console.log('[Auth] Fetching user role for:', userId);
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      
      console.log('[Auth] User role query result:', { data, error });
      
      if (error) {
        console.log('[Auth] Role fetch error:', error.message, error.code);
        setUserRole(null);
        return;
      }
      
      const role = data?.role || null;
      console.log('[Auth] Setting user role to:', role);
      setUserRole(role);
    } catch (error) {
      console.log('[Auth] Role fetch exception:', error);
      setUserRole(null);
    }
  };

  const validateSession = useCallback(async (candidateSession: Session | null, source: string) => {
    const checkId = ++authCheckId.current;

    if (!candidateSession) {
      clearAuthState();
      setLoading(false);
      return;
    }

    try {
      console.log('[Auth] Validating session from:', source);
      const { data: { user: verifiedUser }, error } = await supabase.auth.getUser();

      if (checkId !== authCheckId.current) return;

      if (error || !verifiedUser) {
        console.log('[Auth] Session validation failed:', error?.message ?? 'No verified user');
        clearAuthState();
        await supabase.auth.signOut({ scope: 'local' }).catch((signOutError) => {
          console.log('[Auth] Local sign-out after invalid session failed:', signOutError);
        });
        setLoading(false);
        return;
      }

      setSession(candidateSession);
      setUser(verifiedUser);
      currentUserIdRef.current = verifiedUser.id;
      await Promise.all([
        fetchUserProfile(verifiedUser.id),
        fetchUserRole(verifiedUser.id)
      ]);
      setLoading(false);
    } catch (error) {
      if (checkId !== authCheckId.current) return;
      console.log('[Auth] Session validation exception:', error);
      clearAuthState();
      setLoading(false);
    }
  }, [clearAuthState]);

  useEffect(() => {
    console.log('[Auth] Initializing auth listener and session check');
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth] onAuthStateChange event:', event, { hasSession: !!session, userId: session?.user?.id });

        if (!session?.user) {
          clearAuthState();
          setLoading(false);
          return;
        }

        // Token refreshes (fired when the tab regains focus/visibility) and
        // repeat events for the already-authenticated user must NOT re-trigger
        // the loading state or a full re-validation — doing so remounts the
        // whole app and destroys in-progress screens like the AI conversation.
        if (
          event === 'TOKEN_REFRESHED' ||
          (currentUserIdRef.current && currentUserIdRef.current === session.user.id)
        ) {
          // Keep the session token fresh in state, but don't disrupt the UI.
          setSession(session);
          return;
        }

        setLoading(true);
        // Defer Supabase calls with setTimeout to prevent auth callback deadlock.
        setTimeout(() => {
          validateSession(session, `auth event: ${event}`);
        }, 0);
      }
    );

    // Fallback to ensure we never hang on loading
    const fallbackTimeout = setTimeout(() => {
      console.log('[Auth] Fallback timeout triggered – forcing loading=false');
      setLoading(false);
    }, 5000);

    // Check for existing session
    const initializeAuth = async () => {
      try {
        console.log('[Auth] getSession start');
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[Auth] getSession result:', { hasSession: !!session, userId: session?.user?.id });
        await validateSession(session, 'initial load');
      } catch (error) {
        console.log('[Auth] getSession error:', error, '- forcing loading=false');
        clearAuthState();
        setLoading(false);
      }
    };
    
    initializeAuth();

    return () => {
      console.log('[Auth] Cleaning up auth listener');
      clearTimeout(fallbackTimeout);
      subscription.unsubscribe();
    };
  }, [clearAuthState, validateSession]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName,
        }
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    profile,
    userRole,
    loading,
    mustChangePassword,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


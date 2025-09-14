

import { createContext, useContext, useEffect, useState } from 'react';
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

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (!error && data) {
        setProfile(data);
        setMustChangePassword(data?.must_change_password || false);
      }
    } catch (error) {
      // Silent error handling for profile fetch
    }
  };

  const fetchUserRole = async (userId: string) => {
    try {
      console.log('[Auth] Fetching user role for:', userId);
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();
      
      console.log('[Auth] User role query result:', { data, error });
      
      if (error) {
        console.log('[Auth] Role fetch error:', error.message, error.code);
        if (error.code !== 'PGRST116') { // PGRST116 = no rows found
          setUserRole(null);
          return;
        }
      }
      
      const role = data?.role || null;
      console.log('[Auth] Setting user role to:', role);
      setUserRole(role);
    } catch (error) {
      console.log('[Auth] Role fetch exception:', error);
      setUserRole(null);
    }
  };

  useEffect(() => {
    console.log('[Auth] Initializing auth listener and session check');
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] onAuthStateChange event:', event, { hasSession: !!session, userId: session?.user?.id });
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user profile and role in parallel
          await Promise.all([
            fetchUserProfile(session.user.id),
            fetchUserRole(session.user.id)
          ]);
        } else {
          setProfile(null);
          setUserRole(null);
          setMustChangePassword(false);
        }
        
        setLoading(false);
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
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await Promise.all([
            fetchUserProfile(session.user.id),
            fetchUserRole(session.user.id)
          ]);
        }
        setLoading(false);
      } catch (error) {
        console.log('[Auth] getSession error:', error, '- forcing loading=false');
        setLoading(false);
      }
    };
    
    initializeAuth();

    return () => {
      console.log('[Auth] Cleaning up auth listener');
      clearTimeout(fallbackTimeout);
      subscription.unsubscribe();
    };
  }, []);

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


import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AuthResponse, AuthTokenResponsePassword, OAuthResponse, User, UserResponse } from "@supabase/supabase-js";
import { isAbortError } from "@/lib/utils";

// Extended user type that includes our custom profile fields
interface ExtendedUser extends User {
  displayName?: string;
  avatarUrl?: string;
  emailVerified?: boolean;
}

type UserRole = 'admin' | 'writer' | 'reader';
const VALID_ROLES: readonly UserRole[] = ['admin', 'writer', 'reader'] as const;

interface AuthContextType {
  user: ExtendedUser | null;
  role: UserRole | 'guest';
  isLoading: boolean;
  isAdmin: boolean;
  isWriter: boolean;
  isReader: boolean;
  isEmailVerified: boolean;
  isRecoveryMode: boolean;
  login: () => void;
  logout: () => void;
  signUp: (params: { email: string; password: string; displayName: string; metadata?: Record<string, unknown> }) => Promise<AuthResponse>;
  signIn: (email: string, password: string) => Promise<AuthTokenResponsePassword>;
  signInWithGoogle: () => Promise<OAuthResponse>;
  sendVerification: () => Promise<AuthResponse | void>;
  sendPasswordReset: (email: string) => Promise<{ data: object | null; error: Error | null }>;
  confirmPasswordReset: (newPassword: string) => Promise<UserResponse>;
  refreshUser: () => Promise<void>;
  enterRecoveryMode: () => void;
  exitRecoveryMode: (options?: { signOut?: boolean }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const RECOVERY_MODE_STORAGE_KEY = "rostory_recovery_mode";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [role, setRole] = useState<'admin' | 'writer' | 'reader' | 'guest'>('guest');
  const [isLoading, setIsLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(RECOVERY_MODE_STORAGE_KEY) === "1";
  });
  const mountedRef = React.useRef(true);
  const userRef = React.useRef<ExtendedUser | null>(null);
  // Abort controller ref to cancel stale profile/role fetches when a new auth event arrives
  const fetchControllerRef = React.useRef<AbortController | null>(null);
  // Tracks whether setIsLoading(false) was actually called (not just that a callback fired)
  const loadingResolvedRef = React.useRef(false);

  const resolveLoading = () => {
    loadingResolvedRef.current = true;
    setIsLoading(false);
  };

  const persistRecoveryMode = (enabled: boolean) => {
    setIsRecoveryMode(enabled);
    if (typeof window === "undefined") return;
    try {
      if (enabled) {
        window.sessionStorage.setItem(RECOVERY_MODE_STORAGE_KEY, "1");
      } else {
        window.sessionStorage.removeItem(RECOVERY_MODE_STORAGE_KEY);
      }
    } catch {
      // Ignore sessionStorage errors (private mode / browser policy)
    }
  };

  const enterRecoveryMode = () => {
    persistRecoveryMode(true);
  };

  const exitRecoveryMode = async (options?: { signOut?: boolean }) => {
    persistRecoveryMode(false);
    if (options?.signOut) {
      await supabase.auth.signOut();
    }
  };

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    mountedRef.current = true;
    loadingResolvedRef.current = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;

      // TOKEN_REFRESHED only renews the JWT — the user/role haven't changed.
      // Re-fetching on every token refresh causes transient DB errors that
      // silently downgrade role to 'reader'.
      if (event === 'TOKEN_REFRESHED') {
        if (!session?.user) return;
        // Still resolve loading if this is the first event we receive
        if (!loadingResolvedRef.current || !userRef.current) {
          // User is authenticated — just resolve with current state
          setUser(prev => prev ?? {
            ...session.user,
            displayName: session.user.user_metadata?.display_name || '',
            avatarUrl: session.user.user_metadata?.avatar_url || '',
            emailVerified: !!session.user.email_confirmed_at
          } as ExtendedUser);
          void handleUserAuthenticated(session.user);
          return;
        }

        setUser(prev => {
          const fallbackDisplayName =
            session.user.user_metadata?.display_name ||
            session.user.user_metadata?.full_name ||
            '';
          const fallbackAvatarUrl = session.user.user_metadata?.avatar_url || '';

          if (!prev) {
            return {
              ...session.user,
              displayName: fallbackDisplayName,
              avatarUrl: fallbackAvatarUrl,
              emailVerified: !!session.user.email_confirmed_at
            } as ExtendedUser;
          }

          return {
            ...prev,
            ...session.user,
            displayName: prev.displayName || fallbackDisplayName,
            avatarUrl: prev.avatarUrl || fallbackAvatarUrl,
            emailVerified: !!session.user.email_confirmed_at
          };
        });
        return;
      }

      if (session?.user) {
        void handleUserAuthenticated(session.user);
      } else {
        fetchControllerRef.current?.abort();
        fetchControllerRef.current = null;
        persistRecoveryMode(false);
        setUser(null);
        setRole('guest');
        resolveLoading();
      }
    });

    // Safety fallback: if loading hasn't resolved within 3s
    // (known Supabase bug where onAuthStateChange can hang intermittently),
    // try getSession() directly to unblock the UI.
    const fallbackTimer = setTimeout(async () => {
      if (loadingResolvedRef.current || !mountedRef.current) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (loadingResolvedRef.current || !mountedRef.current) return;
        if (session?.user) {
          await handleUserAuthenticated(session.user);
        } else {
          setUser(null);
          setRole('guest');
          resolveLoading();
        }
      } catch (error: any) {
        if (!mountedRef.current || loadingResolvedRef.current) return;
        if (!isAbortError(error)) {
          console.warn("Auth session fallback failed:", error);
        }
        // Let the hard timer handle total init stalls so we don't unblock
        // as guest while a real auth restore is still racing in the background.
      }
    }, 3000);

    // Hard safety: if nothing resolved after 10s AND no fetch is in progress,
    // force loading off. If a fetch IS active, its own 10s timeout handles it.
    const hardTimer = setTimeout(() => {
      if (!loadingResolvedRef.current && mountedRef.current && !fetchControllerRef.current) {
        resolveLoading();
      }
    }, 10000);

    return () => {
      mountedRef.current = false;
      clearTimeout(fallbackTimer);
      clearTimeout(hardTimer);
      fetchControllerRef.current?.abort();
      subscription.unsubscribe();
    };
  }, []);

  const handleUserAuthenticated = async (supabaseUser: User) => {
    if (!supabaseUser || !mountedRef.current) return;

    // Cancel any previous in-flight profile/role fetch
    fetchControllerRef.current?.abort();

    // Build fallback user from auth metadata (for immediate display name etc.)
    const fallbackUser: ExtendedUser = {
      ...supabaseUser,
      displayName: supabaseUser.user_metadata?.display_name || supabaseUser.user_metadata?.full_name || '',
      avatarUrl: supabaseUser.user_metadata?.avatar_url || '',
      emailVerified: !!supabaseUser.email_confirmed_at
    };

    // Set user immediately so components can show the user's name/avatar,
    // but KEEP isLoading true — the role hasn't been resolved yet.
    // Setting isLoading=false before the role is known causes the app to
    // briefly render with role='guest', which redirects admin users away from /admin.
    if (mountedRef.current) {
      setUser(fallbackUser);
    }

    // Fetch profile + role, then mark loading as complete
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      timeoutId = setTimeout(() => controller.abort(), 10000);

      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', supabaseUser.id).abortSignal(controller.signal).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', supabaseUser.id).abortSignal(controller.signal).maybeSingle()
      ]);

      // If this fetch was aborted (a newer event superseded it), don't apply stale results
      if (controller.signal.aborted || !mountedRef.current) return;

      // Log query errors so permission issues aren't silently swallowed
      if (profileRes?.error) {
        console.warn("Error fetching profile:", profileRes.error.message);
      }
      if (roleRes?.error) {
        console.warn("Error fetching user role:", roleRes.error.message);
      }

      const profile = profileRes?.data;
      const userRoleData = roleRes?.data;

      const extendedUser: ExtendedUser = {
        ...supabaseUser,
        displayName: profile?.display_name || fallbackUser.displayName,
        avatarUrl: profile?.avatar_url || fallbackUser.avatarUrl,
        emailVerified: !!supabaseUser.email_confirmed_at
      };

      setUser(extendedUser);

      if (userRoleData?.role) {
        // Got a valid role from the DB
        const fetchedRole = userRoleData.role as string;
        setRole(VALID_ROLES.includes(fetchedRole as UserRole) ? (fetchedRole as UserRole) : 'reader');
      } else if (roleRes?.error) {
        // Role query failed (RLS / transient error) — don't silently downgrade.
        // On initial load (no previous role), default to 'reader'.
        // On subsequent loads, keep current role to avoid intermittent downgrades.
        if (!loadingResolvedRef.current) {
          setRole('reader');
        }
      } else {
        // No role entry and no error — user simply has no role row → 'reader'
        setRole('reader');
      }
    } catch (error: any) {
      if (isAbortError(error)) {
        // If this was a self-timeout abort (not replaced by a newer call),
        // default role on initial load and let finally resolve loading.
        if (mountedRef.current && fetchControllerRef.current === controller) {
          if (!loadingResolvedRef.current) setRole('reader');
        }
        return;
      }
      console.error("Error fetching user profile/role:", error);
      if (mountedRef.current && !loadingResolvedRef.current) {
        setRole('reader');
      }
    } finally {
      // Always clean up the timeout timer
      if (timeoutId) clearTimeout(timeoutId);
      // Only mark loading complete if this fetch wasn't superseded by a newer call.
      // fetchControllerRef still points to OUR controller = we're the active call.
      if (mountedRef.current && fetchControllerRef.current === controller) {
        fetchControllerRef.current = null;
        resolveLoading();
      }
    }
  };

  const login = () => {
    window.location.href = "/auth";
  };

  const logout = () => {
    persistRecoveryMode(false);
    void supabase.auth.signOut();
  };

  const signUp = async (params: { email: string; password: string; displayName: string; metadata?: Record<string, unknown> }): Promise<AuthResponse> => {
    const { email, password, displayName, metadata } = params;
    const origin = window.location.origin;
    return supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: {
          display_name: displayName,
          ...metadata
        }
      }
    });
  };

  const signIn = (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password });

  const signInWithGoogle = () => {
    const origin = window.location.origin;
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origin}/auth/callback` }
    });
  };


  const sendVerification = async (): Promise<AuthResponse | void> => {
    // Resend the confirmation email for the current user
    if (user?.email) {
      const origin = window.location.origin;
      return supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: { emailRedirectTo: `${origin}/auth/callback` }
      });
    }
    return;
  };

  const sendPasswordReset = (email: string) => {
    const origin = window.location.origin;
    return supabase.auth.resetPasswordForEmail(email, {
      // Preserve intent so the callback can reliably route to the password reset UI
      // even if Supabase provides recovery metadata in the URL hash or omits `type`.
      redirectTo: `${origin}/auth/callback?flow=recovery`
    });
  };

  const confirmPasswordReset = (newPassword: string) => {
    // Supabase handles reset via the magic link session — user already has a valid session
    // from the callback redirect, so we just update the password directly
    return supabase.auth.updateUser({ password: newPassword });
  };

  const refreshUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await handleUserAuthenticated(authUser);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      role,
      isLoading,
      isAdmin: role === 'admin',
      isWriter: role === 'writer',
      isReader: role === 'reader',
      isEmailVerified: !!user?.emailVerified,
      isRecoveryMode,
      login,
      logout,
      signUp,
      signIn,
      signInWithGoogle,
      sendVerification,
      sendPasswordReset,
      confirmPasswordReset,
      refreshUser,
      enterRecoveryMode,
      exitRecoveryMode
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

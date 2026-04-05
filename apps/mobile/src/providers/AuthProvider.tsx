import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { authApi, ApiError } from '@/lib/api';
import type { Session } from '@supabase/supabase-js';

type AuthContextType = {
  session: Session | null;
  isLoading: boolean;
  /** True once internal user exists in our DB (not just Supabase). */
  isRegistered: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  isLoading: true,
  isRegistered: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);
  const segments = useSegments();
  const router = useRouter();
  const registerAttempted = useRef(false);

  // 1. Listen for Supabase session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setIsRegistered(false);
        registerAttempted.current = false;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Auto-register internal user after first session
  useEffect(() => {
    if (!session || registerAttempted.current) return;
    registerAttempted.current = true;

    (async () => {
      try {
        await authApi.register();
        setIsRegistered(true);
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          // Already registered — this is fine
          setIsRegistered(true);
        } else {
          // API unreachable or other error — try fetching profile instead
          try {
            await authApi.me();
            setIsRegistered(true);
          } catch {
            // Genuinely can't reach backend — user will see empty states
            // but can still browse the app. Registration will retry on next launch.
            console.warn('Could not register or verify user with backend');
            setIsRegistered(true); // allow navigation, features will fail gracefully
          }
        }
      }
    })();
  }, [session]);

  // 3. Route guard
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/onboarding');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, segments, isLoading]);

  return (
    <AuthContext.Provider value={{ session, isLoading, isRegistered }}>
      {children}
    </AuthContext.Provider>
  );
}

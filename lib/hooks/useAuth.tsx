import { neon } from '@/lib/utils/neon';
import { sessionStore } from '@/lib/utils/session-store';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as React from 'react';

WebBrowser.maybeCompleteAuthSession();

const STORAGE_KEY = 'step-squad.session';

export type Session = {
  access_token: string;
  refresh_token?: string;
  user: {
    id: string;
    email: string | null;
    user_metadata: {
      full_name?: string | null;
      avatar_url?: string | null;
      picture?: string | null;
    };
  };
};

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // 1. Restore persisted session from SecureStore on startup
    (async () => {
      try {
        const raw = await sessionStore.get(STORAGE_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as Session;
          if (stored?.user?.id) {
            setSession(stored);
          }
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
      } finally {
        // Also check if neon.auth has an active session
        try {
          const { data } = await (neon.auth as any).getSession?.();
          if (data?.session) {
            const s: Session = {
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              user: {
                id: data.session.user?.id,
                email: data.session.user?.email ?? null,
                user_metadata: data.session.user?.user_metadata ?? {},
              },
            };
            setSession(s);
            await sessionStore.set(STORAGE_KEY, JSON.stringify(s));
          }
        } catch {
          // ignore
        }
        setLoading(false);
      }
    })();

    // 2. Listen for auth changes
    let unsubscribe = () => {};
    try {
      const listener = (neon.auth as any).onAuthStateChange?.(async (_event: string, nextSession: any) => {
        if (nextSession) {
          const s: Session = {
            access_token: nextSession.access_token,
            refresh_token: nextSession.refresh_token,
            user: {
              id: nextSession.user?.id,
              email: nextSession.user?.email ?? null,
              user_metadata: nextSession.user?.user_metadata ?? {},
            },
          };
          setSession(s);
          await sessionStore.set(STORAGE_KEY, JSON.stringify(s));
        } else {
          setSession(null);
          await sessionStore.remove(STORAGE_KEY);
        }
        setLoading(false);
      });
      if (listener?.data?.subscription?.unsubscribe) {
        unsubscribe = () => listener.data.subscription.unsubscribe();
      }
    } catch {
      // ignore
    }

    return () => unsubscribe();
  }, []);

  const signOut = React.useCallback(async () => {
    try {
      await (neon.auth as any).signOut?.();
    } catch (e) {
      console.error('Sign out error:', e);
    }
    setSession(null);
    await sessionStore.remove(STORAGE_KEY);
  }, []);

  const signInWithGoogle = React.useCallback(async () => {
    const redirectTo = Linking.createURL('/');

    try {
      const { data, error } = await (neon.auth as any).signInWithOAuth?.({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (res.type === 'success') {
          setLoading(true);
          const { url } = res;

          const params = url.split('#')[1] || url.split('?')[1];
          if (params) {
            const queryParams: Record<string, string> = {};
            params.split('&').forEach((part) => {
              const [key, value] = part.split('=');
              queryParams[key] = decodeURIComponent(value || '');
            });

            const code = queryParams.code;
            if (code) {
              await (neon.auth as any).exchangeCodeForSession?.(code);
            }

            const { data: sessionData, error: sessionError } = await (neon.auth as any).getSession?.({ forceFetch: true });
            if (sessionError) throw sessionError;
            if (sessionData?.session) {
              const s: Session = {
                access_token: sessionData.session.access_token,
                refresh_token: sessionData.session.refresh_token,
                user: {
                  id: sessionData.session.user?.id,
                  email: sessionData.session.user?.email ?? null,
                  user_metadata: sessionData.session.user?.user_metadata ?? {},
                },
              };
              setSession(s);
              await sessionStore.set(STORAGE_KEY, JSON.stringify(s));
              return;
            }
          }
        }
      }
    } catch (e) {
      console.error('Google Sign In Error:', e);
    } finally {
      const { data } = await (neon.auth as any).getSession?.().catch(() => ({ data: null }));
      if (!data?.session) {
        setLoading(false);
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, signOut, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

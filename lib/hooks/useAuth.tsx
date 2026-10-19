import { api, API_URL, qs, setAuthToken, setUnauthorizedHandler } from '@/lib/utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as React from 'react';

WebBrowser.maybeCompleteAuthSession();

const STORAGE_KEY = 'step-squad.session';

export type Session = {
  access_token: string;
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

type MeResponse = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

const toSession = (access_token: string, me: MeResponse): Session => ({
  access_token,
  user: {
    id: me.id,
    email: me.email,
    user_metadata: { full_name: me.full_name, avatar_url: me.avatar_url, picture: me.avatar_url },
  },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Keeps the API client's token and persisted copy in sync with state.
  const applySession = React.useCallback(async (next: Session | null) => {
    setAuthToken(next?.access_token ?? null);
    setSessionState((prev) =>
      prev && next && JSON.stringify(prev) === JSON.stringify(next) ? prev : next
    );
    if (next) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  React.useEffect(() => {
    setUnauthorizedHandler(() => {
      applySession(null);
    });

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const stored = JSON.parse(raw) as Session;

        // Use the stored session right away (works offline), then refresh the user in the background.
        setAuthToken(stored.access_token);
        setSessionState(stored);
        api
          .get<MeResponse>('/me')
          .then((me) => {
            // Only apply if the user hasn't signed out or changed session in the meantime
            setSessionState((current) => {
              if (current?.access_token === stored.access_token) {
                const refreshed = toSession(stored.access_token, me);
                AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(refreshed)).catch(console.error);
                return refreshed;
              }
              return current;
            });
          })
          .catch(() => {
            // 401s are handled by the unauthorized handler; other errors keep the cached session.
          });
      } catch (e) {
        console.error('Failed to restore session:', e);
      } finally {
        setLoading(false);
      }
    })();

    return () => setUnauthorizedHandler(null);
  }, [applySession]);

  const signOut = React.useCallback(async () => {
    await applySession(null);
  }, [applySession]);

  const signInWithGoogle = React.useCallback(async () => {
    if (!API_URL) {
      console.error('EXPO_PUBLIC_API_URL is not configured');
      return;
    }
    const redirectTo = Linking.createURL('/');

    try {
      const startUrl = `${API_URL}/auth/google/start?${qs({ redirect_uri: redirectTo })}`;
      const res = await WebBrowser.openAuthSessionAsync(startUrl, redirectTo);
      if (res.type !== 'success') return;

      setLoading(true);
      const params = new URLSearchParams(res.url.split('#')[1] ?? '');
      const error = params.get('error');
      if (error) throw new Error(`Sign in failed: ${error}`);

      const accessToken = params.get('access_token');
      if (!accessToken) throw new Error('Sign in did not return an access token');

      const me = await api.get<MeResponse>('/me', accessToken);
      await applySession(toSession(accessToken, me));
    } catch (e) {
      console.error('Google Sign In Error:', e);
    } finally {
      setLoading(false);
    }
  }, [applySession]);

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

import 'react-native-url-polyfill/auto';
import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';
import { sessionStore } from './session-store';

const NEON_AUTH_URL = process.env.EXPO_PUBLIC_NEON_AUTH_URL ?? '';
const NEON_DATA_API_URL = process.env.EXPO_PUBLIC_NEON_DATA_API_URL ?? '';

/**
 * Neon client combining Neon Auth (Better Auth) and Neon Data API (PostgREST).
 * Provides the same PostgREST interface (.from, .auth) directly from Expo without a server.
 */
export const neon = createClient({
  auth: {
    url: NEON_AUTH_URL,
    adapter: SupabaseAuthAdapter(),
  },
  dataApi: {
    url: NEON_DATA_API_URL,
  },
});

export { sessionStore };

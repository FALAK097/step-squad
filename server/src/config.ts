export type Config = {
  /** Secret used to sign session tokens (HS256) and OAuth state. */
  sessionSecret: string;
  /** Public base URL of this API, e.g. https://step-squad-api.vercel.app (no trailing slash). */
  publicUrl: string;
  googleClientId: string;
  googleClientSecret: string;
  /** App deep-link prefixes the OAuth flow may redirect back to. */
  allowedRedirectPrefixes: string[];
  /** Browser origins allowed via CORS (only needed for the web build). */
  corsOrigins: string[];
  sessionTtlSeconds: number;
};

const list = (value: string | undefined, fallback: string[]) =>
  value
    ? value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    : fallback;

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required environment variable ${key}`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const sessionSecret = required(env, 'SESSION_SECRET');
  if (sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters');
  }
  return {
    sessionSecret,
    publicUrl: required(env, 'PUBLIC_URL').replace(/\/+$/, ''),
    googleClientId: required(env, 'GOOGLE_CLIENT_ID'),
    googleClientSecret: required(env, 'GOOGLE_CLIENT_SECRET'),
    // step-squad:// = standalone/dev-client builds, exp:// = Expo Go.
    allowedRedirectPrefixes: list(env.APP_REDIRECT_PREFIXES, ['step-squad://', 'exp://']),
    corsOrigins: list(env.CORS_ORIGINS, []),
    sessionTtlSeconds: Number(env.SESSION_TTL_SECONDS) || 60 * 60 * 24 * 30,
  };
}

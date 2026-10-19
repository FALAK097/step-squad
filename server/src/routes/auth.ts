import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Config } from '../config';
import type { Query } from '../db';
import type { GoogleOAuth, GoogleProfile } from '../google';
import { signSession, signState, verifyState } from '../session';

const NONCE_COOKIE = 'oauth_nonce';

type UserRow = { id: string };

async function upsertGoogleUser(query: Query, g: GoogleProfile): Promise<UserRow> {
  // 1. Returning Google user.
  let [user] = await query<UserRow>(
    `UPDATE users SET email = $2, full_name = $3, avatar_url = $4 WHERE google_sub = $1 RETURNING id`,
    [g.sub, g.email, g.name, g.picture]
  );

  // 2. Otherwise link by verified email (this is how users imported from Supabase keep their ids),
  //    or create a new user.
  if (!user) {
    [user] = await query<UserRow>(
      `INSERT INTO users (google_sub, email, full_name, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE
         SET google_sub = EXCLUDED.google_sub,
             full_name = EXCLUDED.full_name,
             avatar_url = EXCLUDED.avatar_url
       RETURNING id`,
      [g.sub, g.email, g.name, g.picture]
    );
  }

  await query(
    `INSERT INTO profiles (id, display_name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
    [user.id, g.name]
  );
  return user;
}

export function authRoutes(deps: { config: Config; query: Query; google: GoogleOAuth }) {
  const { config, query, google } = deps;
  const app = new Hono();
  const callbackUrl = `${config.publicUrl}/auth/google/callback`;
  const secure = config.publicUrl.startsWith('https://');

  const isAllowedRedirect = (uri: string) =>
    config.allowedRedirectPrefixes.some((prefix) => uri.startsWith(prefix));

  // The app opens this URL in an in-app browser, then waits for the deep link redirect.
  app.get('/google/start', async (c) => {
    const redirectUri = c.req.query('redirect_uri') ?? '';
    if (!isAllowedRedirect(redirectUri)) return c.text('Invalid redirect_uri', 400);

    const nonce = randomUUID();
    const state = await signState(config, { ru: redirectUri, n: nonce });
    setCookie(c, NONCE_COOKIE, nonce, {
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/auth',
      maxAge: 600,
    });
    return c.redirect(google.authorizationUrl({ state, redirectUri: callbackUrl }), 302);
  });

  app.get('/google/callback', async (c) => {
    let ru: string;
    try {
      const state = await verifyState(config, c.req.query('state') ?? '');
      if (!isAllowedRedirect(state.ru) || getCookie(c, NONCE_COOKIE) !== state.n) {
        return c.text('Invalid OAuth state', 400);
      }
      ru = state.ru;
    } catch {
      return c.text('Invalid or expired OAuth state', 400);
    }
    deleteCookie(c, NONCE_COOKIE, { path: '/auth' });

    const backToApp = (params: Record<string, string>) =>
      c.redirect(`${ru}#${new URLSearchParams(params)}`, 302);

    const code = c.req.query('code');
    if (!code) return backToApp({ error: c.req.query('error') ?? 'access_denied' });

    try {
      const profile = await google.exchangeCode(code, callbackUrl);
      const user = await upsertGoogleUser(query, profile);
      const token = await signSession(config, user.id);
      return backToApp({ access_token: token, expires_in: String(config.sessionTtlSeconds) });
    } catch (err) {
      console.error('Google sign-in failed:', err);
      return backToApp({ error: 'sign_in_failed' });
    }
  });

  return app;
}

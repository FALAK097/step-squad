import { createRemoteJWKSet, jwtVerify } from 'jose';

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
};

/** Abstraction over Google OAuth so tests can run without network access. */
export interface GoogleOAuth {
  authorizationUrl(params: { state: string; redirectUri: string }): string;
  exchangeCode(code: string, redirectUri: string): Promise<GoogleProfile>;
}

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export function createGoogleOAuth(clientId: string, clientSecret: string): GoogleOAuth {
  return {
    authorizationUrl({ state, redirectUri }) {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        prompt: 'select_account',
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    },

    async exchangeCode(code, redirectUri) {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
      const { id_token } = (await res.json()) as { id_token?: string };
      if (!id_token) throw new Error('Google response did not include an id_token');

      const { payload } = await jwtVerify(id_token, JWKS, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: clientId,
      });
      if (!payload.sub || typeof payload.email !== 'string') {
        throw new Error('Google id_token is missing sub/email');
      }
      if (payload.email_verified !== true) throw new Error('Google email is not verified');

      return {
        sub: payload.sub,
        email: payload.email,
        name: typeof payload.name === 'string' ? payload.name : null,
        picture: typeof payload.picture === 'string' ? payload.picture : null,
      };
    },
  };
}

import { SignJWT, jwtVerify } from 'jose';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Config } from './config';

export type AppEnv = { Variables: { userId: string } };

const key = (secret: string) => new TextEncoder().encode(secret);

export function signSession(config: Config, userId: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setAudience('session')
    .setExpirationTime(`${config.sessionTtlSeconds}s`)
    .sign(key(config.sessionSecret));
}

export function signState(config: Config, claims: { ru: string; n: string }) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience('oauth-state')
    .setExpirationTime('10m')
    .sign(key(config.sessionSecret));
}

export async function verifyState(config: Config, token: string) {
  const { payload } = await jwtVerify(token, key(config.sessionSecret), {
    algorithms: ['HS256'],
    audience: 'oauth-state',
  });
  return payload as { ru: string; n: string };
}

export const requireAuth =
  (config: Config): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const header = c.req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new HTTPException(401, { message: 'Missing bearer token' });
    try {
      const { payload } = await jwtVerify(token, key(config.sessionSecret), {
        algorithms: ['HS256'],
        audience: 'session',
      });
      if (!payload.sub) throw new Error('no sub');
      c.set('userId', payload.sub);
    } catch {
      throw new HTTPException(401, { message: 'Invalid or expired session' });
    }
    await next();
  };

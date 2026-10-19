import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import type { Config } from './config';
import type { Query } from './db';
import type { GoogleOAuth } from './google';
import { apiRoutes } from './routes/api';
import { authRoutes } from './routes/auth';

export type AppDeps = { config: Config; query: Query; google: GoogleOAuth };

export function createApp(deps: AppDeps) {
  const app = new Hono();

  if (deps.config.corsOrigins.length > 0) {
    app.use('*', cors({ origin: deps.config.corsOrigins }));
  }

  app.get('/health', (c) => c.json({ ok: true }));
  app.route('/auth', authRoutes(deps));
  app.route('/', apiRoutes(deps));

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: 'Internal server error' }, 500);
  });
  app.notFound((c) => c.json({ error: 'Not found' }, 404));

  return app;
}

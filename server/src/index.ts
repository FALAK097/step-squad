import { createApp } from './app';
import { loadConfig } from './config';
import { createNeonQuery } from './db';
import { createGoogleOAuth } from './google';

const config = loadConfig();
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Missing required environment variable DATABASE_URL');

// Vercel (zero-config Hono) and `tsx src/dev.ts` both use this app.
export default createApp({
  config,
  query: createNeonQuery(databaseUrl),
  google: createGoogleOAuth(config.googleClientId, config.googleClientSecret),
});

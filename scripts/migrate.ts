/**
 * Applies the database schema to Neon Postgres.
 *
 * Usage:
 *   DATABASE_URL="postgres://..." pnpm db:migrate
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const envDatabaseUrl = process.env.DATABASE_URL;
if (!envDatabaseUrl) {
  console.error('Error: DATABASE_URL must be set in the environment');
  process.exit(1);
}
const databaseUrl: string = envDatabaseUrl;

async function run() {
  const schemaFile = path.resolve(__dirname, '../db/schema.sql');
  const sql = fs.readFileSync(schemaFile, 'utf8');

  const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to Neon database. Applying schema...');

  try {
    await client.query(sql);
    console.log('✅ Schema and RLS policies applied successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();

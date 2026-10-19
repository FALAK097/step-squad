import { neon } from '@neondatabase/serverless';

/** Runs one parameterised SQL statement and returns the resulting rows. */
export type Query = <R = Record<string, any>>(text: string, params?: unknown[]) => Promise<R[]>;

/**
 * Neon serverless driver over HTTP. Each call is a single statement, which is
 * atomic on its own (multi-step writes are expressed as CTEs).
 */
export function createNeonQuery(databaseUrl: string): Query {
  const sql = neon(databaseUrl);
  return (text, params = []) => sql.query(text, params as any[]) as Promise<any[]>;
}

export const isUniqueViolation = (err: unknown) =>
  typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';

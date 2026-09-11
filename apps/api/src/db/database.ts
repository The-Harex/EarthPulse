import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { DatabaseSchema } from './types.js';

export function createDatabase(databaseUrl: string, ssl = false) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  return new Kysely<DatabaseSchema>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: databaseUrl, ...(ssl ? { ssl: { rejectUnauthorized: false } } : {}) }),
    }),
  });
}

export type EarthPulseDatabase = ReturnType<typeof createDatabase>;


import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const globalForPg = globalThis as unknown as { ntpcsPool?: Pool };

export const pool =
  globalForPg.ntpcsPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPg.ntpcsPool = pool;
}

export const db = drizzle(pool, { schema });
export type Database = typeof db;

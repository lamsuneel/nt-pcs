import { Pool } from 'pg';

const globalForPg = globalThis as unknown as { printAssurePool?: Pool };

export const pool =
  globalForPg.printAssurePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPg.printAssurePool = pool;
}

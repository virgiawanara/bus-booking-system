import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type DB = ReturnType<typeof drizzle<typeof schema>>;

// Prod/dev: koneksi tunggal per proses.
let _db: DB | null = null;
export function getDb(): DB {
  if (!_db) {
    _db = drizzle(postgres(process.env.DATABASE_URL!), { schema });
  }
  return _db;
}

// Test: database terpisah.
export function createDb(url: string): DB {
  return drizzle(postgres(url), { schema });
}

export { schema };

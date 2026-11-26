import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { DATABASE_URL_ADMIN } from 'astro:env/server';
import * as schema from './schema';

// Conexión del panel con el rol vitalis_admin. Solo se importa desde src/admin, src/actions/admin
// y src/pages/admin (lo vigila ESLint): las páginas públicas usan vitalis_app y no pueden tocar estas tablas.
const pool = new pg.Pool({
  connectionString: DATABASE_URL_ADMIN,
  enableChannelBinding: new URL(DATABASE_URL_ADMIN).searchParams.get('channel_binding') === 'require',
  max: 3,
  idleTimeoutMillis: 5_000,
  connectionTimeoutMillis: 10_000,
});

export const dbAdmin = drizzle({ client: pool, schema });
export type TxAdmin = Parameters<Parameters<typeof dbAdmin.transaction>[0]>[0];

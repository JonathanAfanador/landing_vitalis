import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { DATABASE_URL } from 'astro:env/server';
import * as schema from './schema';

// Un pool pequeño por instancia: en Vercel cada función tiene el suyo y el pooler de Neon reparte.
// Neon pide `channel_binding=require` en la cadena; `pg` no lo lee de ahí, así que se activa a mano.
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  enableChannelBinding: new URL(DATABASE_URL).searchParams.get('channel_binding') === 'require',
  max: 3,
  idleTimeoutMillis: 5_000,
  connectionTimeoutMillis: 10_000,
});

export const db = drizzle({ client: pool, schema });
export type Db = typeof db;

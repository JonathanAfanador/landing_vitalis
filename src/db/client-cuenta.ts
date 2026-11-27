import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { DATABASE_URL_CUENTA } from 'astro:env/server';
import * as schema from './schema';

// Conexión del portal de clientes con el rol vitalis_cuenta. Solo se importa desde src/cuenta (lo vigila
// ESLint). Las tablas tienen RLS: sin una cuenta fijada en la transacción, este rol no ve ninguna fila.
const pool = new pg.Pool({
  connectionString: DATABASE_URL_CUENTA,
  enableChannelBinding: new URL(DATABASE_URL_CUENTA).searchParams.get('channel_binding') === 'require',
  max: 3,
  idleTimeoutMillis: 5_000,
  connectionTimeoutMillis: 10_000,
});

const dbCuenta = drizzle({ client: pool, schema });
export type TxCuenta = Parameters<Parameters<typeof dbCuenta.transaction>[0]>[0];

// Única forma de consultar como cliente: fija su id solo para esta transacción (set_config local) y las
// políticas RLS de la base filtran todo lo demás.
export const comoCuenta = <T>(usuarioId: number, consulta: (tx: TxCuenta) => Promise<T>) =>
  dbCuenta.transaction(async (tx) => {
    await tx.execute(sql`select set_config('vitalis.usuario_id', ${String(usuarioId)}, true)`);
    return consulta(tx);
  });

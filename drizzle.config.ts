import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile();
} catch {
  // Sin .env: se usan las variables del entorno (por ejemplo, en CI).
}

// Las migraciones usan la conexión directa con el rol dueño, nunca la de la app.
const url = process.env.DATABASE_URL_MIGRACIONES;
if (!url) throw new Error('Falta DATABASE_URL_MIGRACIONES en el entorno (.env)');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  schemaFilter: ['vitalis'],
  dbCredentials: { url },
  migrations: { table: 'migraciones' },
  strict: true,
  verbose: true,
});

# Base de datos: conectar Neon

La web usa PostgreSQL en Neon con Drizzle ORM. Las tablas viven en el schema `vitalis` y las migraciones están versionadas en `drizzle/`.

| Archivo | Qué hay |
| :-- | :-- |
| `src/db/schema.ts` | Tablas, enums, relaciones, CHECKs e índices |
| `drizzle/0000_catalogo_y_pedidos.sql` | Crea el schema y las tablas (generada desde `schema.ts`) |
| `drizzle/0001_rol_app_y_datos_base.sql` | Crea el rol `vitalis_app` con permisos mínimos y carga especies y categorías |
| `scripts/seed-demo.ts` | Medicamentos de ejemplo `[DEMO]`, solo para desarrollo |

## Dos usuarios, dos cadenas

| Variable | Usuario | Conexión | Para qué |
| :-- | :-- | :-- | :-- |
| `DATABASE_URL_MIGRACIONES` | `neondb_owner` | Directa (sin `-pooler`) | Crear y actualizar tablas. Solo en tu PC |
| `DATABASE_URL` | `vitalis_app` | Con pooling (`-pooler`) | La web. En tu PC y en Vercel |

`vitalis_app` solo puede leer el catálogo, crear pedidos y descontar stock. No puede borrar nada ni cambiar tablas, así que un fallo en la web no puede dañar la base de datos.

## Paso a paso (una sola vez)

En tu PC, en la carpeta del proyecto, con `.env` ya creado.

1. **Instala las dependencias**:

   ```bash
   pnpm install
   ```

2. **Pon la cadena directa** (la de `neondb_owner` sin `-pooler`) en `.env`:

   ```bash
   DATABASE_URL_MIGRACIONES="postgresql://neondb_owner:<contraseña>@ep-...us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
   ```

3. **Crea las tablas**:

   ```bash
   pnpm db:migrate
   ```

4. **Dale contraseña al usuario de la web.** Genera una contraseña segura:

   ```bash
   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
   ```

   Y en Neon > **SQL Editor** (rama `production`, base `neondb`), ejecuta con esa contraseña:

   ```sql
   ALTER ROLE vitalis_app WITH LOGIN PASSWORD 'la-contraseña-generada';
   ```

   No crees `vitalis_app` desde el panel de Roles de Neon: los roles creados ahí reciben permisos de administrador.

5. **Arma `DATABASE_URL`**: copia la cadena **con pooling** y cambia usuario y contraseña:

   ```bash
   DATABASE_URL="postgresql://vitalis_app:la-contraseña-generada@ep-...-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
   ```

6. **Genera la sal del límite de envíos** y ponla en `.env` como `IP_HASH_SALT`:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

7. **Prueba**:

   ```bash
   pnpm dev
   ```

   Abre `http://localhost:4321/tienda`. Si no hay medicamentos verás "Estamos preparando el catálogo": es correcto, la base está vacía.

## Datos de ejemplo (opcional)

No los cargues en `production`. Crea una rama en Neon (**Branches > New branch**, por ejemplo `desarrollo`), copia su cadena directa en `DATABASE_URL_MIGRACIONES` y ejecuta:

```bash
pnpm db:seed:demo
```

Carga 8 medicamentos con el prefijo `[DEMO]`. La rama tiene su propio usuario `vitalis_app` (las ramas copian roles y datos), así que `DATABASE_URL` también debe apuntar a la rama.

## En Vercel

En **Settings > Environment Variables** añade `DATABASE_URL` (la de `vitalis_app` con pooling) e `IP_HASH_SALT`. `DATABASE_URL_MIGRACIONES` **no** va en Vercel: las migraciones se corren desde tu PC.

## Cambiar el esquema más adelante

1. Edita `src/db/schema.ts`.
2. `pnpm db:generate` crea la migración en `drizzle/`.
3. Revisa el SQL generado.
4. `pnpm db:migrate`.
5. Si la tabla es nueva, dale permisos a `vitalis_app` en una migración propia (`pnpm drizzle-kit generate --custom`).

## Reglas que cumple el código

- El total del pedido se calcula siempre en el servidor con los precios de la base de datos.
- Crear un pedido es una sola transacción: bloquea los medicamentos (`FOR UPDATE`, en orden de id para evitar interbloqueos), valida stock y fórmula, guarda el pedido y sus líneas y descuenta stock. Dos compras simultáneas de la última unidad: una se crea y la otra recibe "ya no hay stock".
- `vitalis_app` tiene `statement_timeout` de 5 s e `idle_in_transaction_session_timeout` de 10 s.
- La tienda pagina por cursor `(nombre, id)` con un índice parcial sobre los activos.
- La CDN de Vercel guarda la tienda 60 s. El pedido recalcula precio y stock, así que esa diferencia nunca se cobra.

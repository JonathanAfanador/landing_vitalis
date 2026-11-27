# Base de datos: conectar Neon

La web usa PostgreSQL en Neon con Drizzle ORM. Las tablas viven en el schema `vitalis` y las migraciones están versionadas en `drizzle/`.

| Archivo | Qué hay |
| :-- | :-- |
| `src/db/schema.ts` | Tablas, enums, relaciones, CHECKs e índices |
| `drizzle/0000_catalogo_y_pedidos.sql` | Crea el schema y las tablas (generada desde `schema.ts`) |
| `drizzle/0001_rol_app_y_datos_base.sql` | Crea el rol `vitalis_app` con permisos mínimos y carga especies y categorías |
| `drizzle/0002_panel_usuarios_roles_auditoria.sql` | Tablas del panel: roles, permisos, rol_permiso, usuarios, sesiones y auditoría |
| `drizzle/0003_rol_admin_triggers_y_roles_base.sql` | Rol `vitalis_admin`, triggers de protección, roles base y endurece `vitalis_app` |
| `drizzle/0004_solo_tienda_y_estado_pagado.sql` | Pedidos sin dirección ni municipio y estados pendiente → confirmado → pagado → entregado / cancelado |
| `drizzle/0005_permisos_panel_catalogo_y_pedidos.sql` | Permisos de `vitalis_admin` para medicamentos, categorías y pedidos |
| `drizzle/0006_citas.sql` | Solicitudes de cita: tabla `solicitudes_cita` con sus estados y franjas |
| `drizzle/0007_permisos_citas.sql` | Permisos de `vitalis_app` (crear solicitudes) y `vitalis_admin` (ver, cambiar estado y notas) sobre las citas |
| `drizzle/0008_eliminacion_y_exportacion.sql` | Eliminación lógica de pedidos y citas (quién y cuándo) y eventos de auditoría de eliminar, restaurar y descargar |
| `drizzle/0009_permisos_eliminacion.sql` | `vitalis_admin` solo puede marcar o desmarcar la eliminación; nunca borra filas |
| `drizzle/0010_portal_clientes.sql` | Celular y autorización de datos en las cuentas, y `usuario_id` en pedidos y citas para ligarlos a la cuenta del cliente |
| `drizzle/0011_rol_cuenta_y_rls.sql` | Rol `vitalis_cuenta`, RLS en usuarios, pedidos, líneas y citas, y la función que anonimiza una cuenta eliminada por su titular |
| `drizzle/0012_solicitud_eliminacion.sql` | Fecha de la solicitud de eliminación de una cuenta de cliente |
| `drizzle/0013_permisos_solicitud_eliminacion.sql` | El portal ya no cambia citas; el cliente solo marca o retira su solicitud de eliminación |
| `drizzle/0014_codigo_recuperacion.sql` | Código de recuperación de contraseña de los clientes (solo su scrypt) y su fecha |
| `drizzle/0015_permisos_codigo_recuperacion.sql` | Solo el núcleo de sesiones maneja el código; el portal ve únicamente la fecha. La supresión lo borra |
| `scripts/sincronizar-permisos.ts` | Copia el catálogo de permisos del código a la base (corre solo con `pnpm db:migrate`) |
| `scripts/crear-superadmin.ts` | Crea el primer superadmin |
| `scripts/seed-demo.ts` | Medicamentos de ejemplo `[DEMO]`, solo para desarrollo |

## Cuatro usuarios, cuatro cadenas

| Variable | Usuario | Conexión | Para qué |
| :-- | :-- | :-- | :-- |
| `DATABASE_URL_MIGRACIONES` | `neondb_owner` | Directa (sin `-pooler`) | Crear y actualizar tablas. Solo en tu PC |
| `DATABASE_URL` | `vitalis_app` | Con pooling (`-pooler`) | La web pública. En tu PC y en Vercel |
| `DATABASE_URL_ADMIN` | `vitalis_admin` | Con pooling (`-pooler`) | El panel `/admin`, el login y las sesiones. En tu PC y en Vercel |
| `DATABASE_URL_CUENTA` | `vitalis_cuenta` | Con pooling (`-pooler`) | El portal de clientes `/cuenta`. En tu PC y en Vercel |

- `vitalis_app` solo puede leer el catálogo, crear pedidos y solicitudes de cita, y descontar stock. No puede borrar nada, ni ver usuarios, sesiones o auditoría, ni leer los datos personales de los pedidos y las citas.
- `vitalis_admin` gestiona usuarios, roles y sesiones. La auditoría solo la puede insertar y leer, nunca editar ni borrar.
- `vitalis_cuenta` solo ve las filas del cliente con sesión: RLS (seguridad por fila) en la base filtra todo lo demás, aunque una consulta tenga un error. Sin cliente fijado, no ve nada.

## Paso a paso (una sola vez)

En tu PC, en la carpeta del proyecto, con `.env` ya creado.

1. **Instala las dependencias**:

   ```bash
   pnpm install
   ```

2. **Pon la cadena directa** (la de `neondb_owner` sin `-pooler`) en `.env`:

   ```bash
   DATABASE_URL_MIGRACIONES="postgresql://neondb_owner:<contraseña>@ep-...us-east-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require"
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
   DATABASE_URL="postgresql://vitalis_app:la-contraseña-generada@ep-...-pooler.us-east-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require"
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

## Fase 4A: panel, roles y superadmin

En tu PC, después de bajar los cambios de `dev_jonathan`:

1. **Instala dependencias y migra.** Crea las tablas nuevas, el rol `vitalis_admin` y los roles base, y sincroniza los permisos:

   ```bash
   pnpm install
   ```

   ```bash
   pnpm db:migrate
   ```

   Debe terminar con "Permisos sincronizados: 4 en el catálogo".

2. **Dale contraseña al usuario del panel.** Genera otra contraseña (distinta de la de `vitalis_app`):

   ```bash
   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
   ```

   Y en Neon > **SQL Editor** ejecuta:

   ```sql
   ALTER ROLE vitalis_admin WITH LOGIN PASSWORD 'la-contraseña-generada';
   ```

   Igual que con `vitalis_app`: no lo crees desde el panel de Roles de Neon.

3. **Añade al `.env`** la cadena del panel (la de pooling, con `vitalis_admin` y su contraseña) y el correo del superadmin:

   ```bash
   DATABASE_URL_ADMIN="postgresql://vitalis_admin:la-contraseña-generada@ep-...-pooler.us-east-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require"
   SUPERADMIN_EMAIL="tu-correo@ejemplo.com"
   ```

4. **Crea el superadmin.** Te pedirá una contraseña temporal dos veces (no se ve al escribir; mínimo 12 caracteres):

   ```bash
   pnpm db:crear-superadmin
   ```

5. **Entra** en `http://localhost:4321/admin/login` con `pnpm dev`. Te pedirá cambiar la contraseña antes de continuar.

6. **En Vercel**, añade `DATABASE_URL_ADMIN` en Settings > Environment Variables. `SUPERADMIN_EMAIL` no hace falta allí.

### Comprobar que todo quedó bien (opcional)

En el SQL Editor de Neon:

```sql
-- Deben salir superadmin, admin y usuario (es_sistema = true)
SELECT slug, es_sistema FROM vitalis.roles ORDER BY id;
-- Debe haber exactamente un superadmin activo
SELECT u.email, u.activo FROM vitalis.usuarios u JOIN vitalis.roles r ON r.id = u.rol_id WHERE r.slug = 'superadmin';
```

### Si te quedas sin acceso

Si olvidas la contraseña del superadmin, pon su correo en `SUPERADMIN_EMAIL` y vuelve a ejecutar:

```bash
pnpm db:crear-superadmin
```

Restablece la contraseña (pidiéndola por consola), cierra sus sesiones y obliga a cambiarla al entrar. Funciona porque usa las credenciales de dueño de la base, que solo tienes tú. Para no depender de una sola cuenta, crea un segundo superadmin desde el panel.

## Fase 4B: medicamentos, categorías y pedidos en el panel

No hay variables nuevas. Solo:

```bash
git pull
```

```bash
pnpm install
```

```bash
pnpm db:migrate
```

Debe terminar con "Permisos sincronizados: 13 en el catálogo" y listar los 9 permisos nuevos. El rol Administrador los recibe automáticamente; los roles que hayas creado no se tocan.

Si la migración se detiene con "Hay pedidos en estado enviado", es que algún pedido quedó en ese estado (que ya no existe): pásalo a entregado desde el SQL Editor y vuelve a ejecutar `pnpm db:migrate`.

```sql
UPDATE vitalis.pedidos SET estado = 'entregado' WHERE estado::text = 'enviado';
```

## Datos de ejemplo (opcional)

No los cargues en `production`. Crea una rama en Neon (**Branches > New branch**, por ejemplo `desarrollo`), copia su cadena directa en `DATABASE_URL_MIGRACIONES` y ejecuta:

```bash
pnpm db:seed:demo
```

Carga 8 medicamentos con el prefijo `[DEMO]`. La rama tiene su propio usuario `vitalis_app` (las ramas copian roles y datos), así que `DATABASE_URL` también debe apuntar a la rama.

## En Vercel

En **Settings > Environment Variables** añade `DATABASE_URL` (la de `vitalis_app` con pooling), `DATABASE_URL_ADMIN` (la de `vitalis_admin` con pooling) e `IP_HASH_SALT`. `DATABASE_URL_MIGRACIONES` y `SUPERADMIN_EMAIL` **no** van en Vercel: las migraciones y el superadmin se hacen desde tu PC.

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

## Fase 4D: portal de clientes

En tu PC, después de bajar los cambios de `dev_jonathan`:

1. **Migra.** Crea el rol `vitalis_cuenta`, activa RLS y sincroniza los permisos nuevos:

   ```bash
   pnpm db:migrate
   ```

   Debe decir "Nuevos: cuenta:ver_pedidos, …, clientes:ver, clientes:gestionar".

2. **Dale contraseña al usuario del portal.** Genera otra contraseña (distinta de las anteriores):

   ```bash
   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
   ```

   Y en Neon > **SQL Editor** ejecuta:

   ```sql
   ALTER ROLE vitalis_cuenta WITH LOGIN PASSWORD 'la-contraseña-generada';
   ```

   Igual que con los otros: no lo crees desde el panel de Roles de Neon.

3. **Añade al `.env`** la cadena del portal (la de pooling, con `vitalis_cuenta` y su contraseña):

   ```bash
   DATABASE_URL_CUENTA="postgresql://vitalis_cuenta:la-contraseña-generada@ep-...-pooler.us-east-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require"
   ```

   Sin esta variable la web no arranca (Astro la exige).

4. **En Vercel**, añade también `DATABASE_URL_CUENTA` en Settings > Environment Variables.

### Comprobar que RLS funciona (opcional)

En el SQL Editor de Neon, como el rol del portal y sin cliente fijado, no debe ver ninguna fila:

```sql
SET ROLE vitalis_cuenta;
SELECT count(*) FROM vitalis.pedidos;  -- 0
RESET ROLE;
```

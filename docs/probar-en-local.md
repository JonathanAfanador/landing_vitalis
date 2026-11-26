# Probar la web en tu PC (Windows)

Guía paso a paso para ver la página y el panel en tu computador. Los comandos van en **PowerShell** o en la terminal de VS Code, uno a la vez.

## 1. Instalar lo necesario (una sola vez)

1. **Node.js 22 o superior:**

   ```bash
   winget install OpenJS.NodeJS.LTS
   ```

2. **Git**, si no lo tienes:

   ```bash
   winget install Git.Git
   ```

3. **Cierra y vuelve a abrir la terminal** para que reconozca los programas nuevos.

4. **pnpm**, el gestor de paquetes del proyecto:

   ```bash
   npm install -g pnpm
   ```

5. Comprueba que todo responde con un número de versión:

   ```bash
   node -v
   ```

   ```bash
   pnpm -v
   ```

## 2. Bajar el proyecto

Si **no** tienes el proyecto en tu PC:

```bash
git clone https://github.com/JonathanAfanador/landing_vitalis.git
```

```bash
cd landing_vitalis
```

```bash
git checkout dev_jonathan
```

Si **ya** lo tienes, entra en la carpeta y trae los últimos cambios:

```bash
git checkout dev_jonathan
```

```bash
git pull
```

Instala las dependencias:

```bash
pnpm install
```

## 3. El archivo `.env`

Va en la raíz del proyecto, la misma carpeta donde está `package.json`. Copia `.env.example` como guía. Al final debe tener estas 5 variables:

| Variable | Qué va |
| :-- | :-- |
| `DATABASE_URL_MIGRACIONES` | La cadena de Neon **sin pooling** (usuario `neondb_owner`) |
| `DATABASE_URL` | La cadena **con pooling** pero con el usuario `vitalis_app` y su contraseña (paso 4) |
| `DATABASE_URL_ADMIN` | La cadena **con pooling** con el usuario `vitalis_admin` y su contraseña (paso 4) |
| `IP_HASH_SALT` | Un texto aleatorio (paso 4) |
| `SUPERADMIN_EMAIL` | Tu correo para entrar al panel |

Para empezar basta con `DATABASE_URL_MIGRACIONES`; las demás se completan en el paso 4.

## 4. Preparar la base de datos en Neon (una sola vez)

1. **Crea las tablas:**

   ```bash
   pnpm db:migrate
   ```

   Debe terminar con "Permisos sincronizados: 4 en el catálogo".

2. **Genera tres textos aleatorios:** dos contraseñas y la sal. Ejecuta este comando tres veces y guarda cada resultado:

   ```bash
   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
   ```

3. **Dale contraseña a los dos usuarios de la web.** En Neon, abre **SQL Editor** y ejecuta, cambiando cada contraseña por una de las generadas:

   ```sql
   ALTER ROLE vitalis_app WITH LOGIN PASSWORD 'contraseña-1';
   ALTER ROLE vitalis_admin WITH LOGIN PASSWORD 'contraseña-2';
   ```

4. **Completa el `.env`.** Toma tu cadena **con pooling** (la que tiene `-pooler`), cambia `neondb_owner` por el usuario y pon su contraseña:

   ```bash
   DATABASE_URL="postgresql://vitalis_app:contraseña-1@ep-...-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
   DATABASE_URL_ADMIN="postgresql://vitalis_admin:contraseña-2@ep-...-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
   IP_HASH_SALT="el-tercer-texto"
   SUPERADMIN_EMAIL="tu-correo@ejemplo.com"
   ```

5. **Carga medicamentos de ejemplo** para ver la tienda con productos (todos llevan `[DEMO]`):

   ```bash
   pnpm db:seed:demo
   ```

6. **Crea tu usuario superadmin.** Te pedirá una contraseña temporal dos veces. No se ve al escribir, es normal. Mínimo 12 caracteres:

   ```bash
   pnpm db:crear-superadmin
   ```

Como la web todavía no está publicada, probar en tu base de Neon no tiene riesgo. Antes de publicar limpiaremos los datos `[DEMO]` y los pedidos de prueba.

## 5. Abrir la web

```bash
pnpm dev
```

Abre **http://localhost:4321** en Chrome o Edge. Deja la terminal abierta mientras pruebas. Para apagarla: `Ctrl + C`.

Qué probar:

| Dirección | Qué es |
| :-- | :-- |
| `http://localhost:4321` | La portada con el recorrido por la clínica (baja con el scroll) |
| `http://localhost:4321/tienda` | La tienda: filtros, fichas y "Agregar" |
| `http://localhost:4321/pedido` | Tu pedido: cantidades, datos y envío |
| `http://localhost:4321/admin/login` | El panel: entra con tu correo y la contraseña temporal; te pedirá cambiarla |

En el panel puedes crear un rol (Roles > Nuevo rol), crear un usuario con ese rol (Usuarios) y entrar con él en otra ventana de incógnito para ver qué puede hacer.

**Normal en modo desarrollo:**
- Recuadros azules **"Pendiente: …"**: marcan los datos que faltan (dirección, WhatsApp, horario…). En la web publicada no aparecen.
- Una barra pequeña de Astro abajo en el centro: es la barra de desarrollo y tampoco sale publicada.
- La primera carga de cada página tarda unos segundos.

## 6. Las siguientes veces

```bash
git pull
```

```bash
pnpm install
```

```bash
pnpm db:migrate
```

```bash
pnpm dev
```

`pnpm install` y `pnpm db:migrate` solo hacen algo si hubo cambios; si no, terminan enseguida.

## Si algo falla

| Mensaje | Qué hacer |
| :-- | :-- |
| `pnpm` o `node` "no se reconoce" | Cierra y abre la terminal. Si sigue, reinstala el paso 1 |
| `Falta DATABASE_URL_MIGRACIONES` | El `.env` no está en la raíz del proyecto o el nombre de la variable está mal escrito |
| `password authentication failed for user "vitalis_app"` | La contraseña del `.env` no coincide con la del `ALTER ROLE`. Repite el paso 4.3 |
| `role "vitalis_app" does not exist` | Falta `pnpm db:migrate` |
| `Port 4321 is in use` | Ya hay otra terminal con `pnpm dev` abierta; ciérrala |
| La tienda dice "No pudimos cargar el catálogo" | Revisa `DATABASE_URL` (usuario `vitalis_app` y cadena **con** `-pooler`) |
| El login del panel no deja entrar | Revisa `DATABASE_URL_ADMIN`. Tras 5 intentos fallidos la cuenta se bloquea 15 minutos |

Si te sale otro error, copia el mensaje (**sin contraseñas ni cadenas de conexión**) y pégalo en el chat.

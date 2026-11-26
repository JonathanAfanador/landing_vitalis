// Crea el primer superadmin o recupera su acceso. Uso: pnpm db:crear-superadmin
// Lee SUPERADMIN_EMAIL del .env y pide la contraseña por consola (sin mostrarla). La contraseña no se
// guarda en ningún archivo ni log, y hay que cambiarla en el siguiente ingreso.
// - Sin superadmin activo: lo crea.
// - Con un superadmin activo con ese correo: restablece su contraseña y cierra sus sesiones.
// - Con un superadmin activo con otro correo: no hace nada (los demás usuarios se crean en el panel).
// Exige las credenciales de dueño de la base (DATABASE_URL_MIGRACIONES), así que no abre ningún acceso nuevo.
import { createInterface } from 'node:readline';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '../src/db/schema';
import { hashClave, validarClaveNueva } from '../src/lib/clave';

const url = process.env.DATABASE_URL_MIGRACIONES;
const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
if (!url) throw new Error('Falta DATABASE_URL_MIGRACIONES en el entorno (.env)');
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
  throw new Error('Falta SUPERADMIN_EMAIL (válido) en el .env');

// En una terminal no se muestra lo que se escribe; si llega por tubería (pruebas), se lee tal cual.
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
const salida = rl as unknown as { _writeToOutput: (texto: string) => void };
const escribir = salida._writeToOutput.bind(rl);
let ocultar = false;
salida._writeToOutput = (texto) => escribir(ocultar ? '' : texto);
const lineas = rl[Symbol.asyncIterator]();

async function preguntarOculto(pregunta: string) {
  process.stdout.write(pregunta);
  ocultar = true;
  const { value } = await lineas.next();
  ocultar = false;
  process.stdout.write('\n');
  return String(value ?? '');
}

const pool = new pg.Pool({ connectionString: url, max: 1 });
const db = drizzle({ client: pool, schema });

try {
  const [rol] = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(eq(schema.roles.slug, 'superadmin'));
  if (!rol) throw new Error('No existe el rol superadmin. Ejecuta primero pnpm db:migrate.');

  const activos = await db
    .select({ id: schema.usuarios.id, email: schema.usuarios.email })
    .from(schema.usuarios)
    .where(and(eq(schema.usuarios.rolId, rol.id), eq(schema.usuarios.activo, true)));
  const mismo = activos.find((u) => u.email.toLowerCase() === email);

  if (activos.length && !mismo) {
    console.log('Ya hay un superadmin activo con otro correo. Para crear más usuarios, usa el panel.');
    console.log('Si perdiste el acceso, pon ese correo en SUPERADMIN_EMAIL y vuelve a ejecutar este script.');
  } else {
    // Sin superadmin: se crea. Si ya existe con este correo: se restablece su contraseña (recuperación de acceso).
    console.log(mismo ? `Restableciendo la contraseña de ${email}` : `Creando el superadmin ${email}`);
    const clave = await preguntarOculto('Contraseña temporal (mínimo 12 caracteres): ');
    const problema = validarClaveNueva(clave, email);
    if (problema) throw new Error(problema);
    if ((await preguntarOculto('Repítela: ')) !== clave) throw new Error('Las contraseñas no coinciden.');
    const claveHash = await hashClave(clave);

    await db.transaction(async (tx) => {
      if (mismo) {
        await tx
          .update(schema.usuarios)
          .set({ claveHash, debeCambiarClave: true })
          .where(eq(schema.usuarios.id, mismo.id));
        await tx.delete(schema.sesiones).where(eq(schema.sesiones.usuarioId, mismo.id));
        await tx.insert(schema.auditoria).values({
          actorId: null,
          evento: 'clave_restablecida',
          entidad: 'usuario',
          entidadId: String(mismo.id),
          detalle: { origen: 'script' },
        });
        return;
      }
      const [usuario] = await tx
        .insert(schema.usuarios)
        .values({ nombre: 'Superadministrador', email, claveHash, rolId: rol.id, debeCambiarClave: true })
        .returning({ id: schema.usuarios.id });
      if (!usuario) throw new Error('No se pudo crear el usuario');
      await tx.insert(schema.auditoria).values({
        actorId: null,
        evento: 'usuario_creado',
        entidad: 'usuario',
        entidadId: String(usuario.id),
        detalle: { rol: 'superadmin', origen: 'script' },
      });
    });
    console.log('Listo. Ingresa en /admin/login: te pedirá cambiar la contraseña.');
  }
} finally {
  rl.close();
  await pool.end();
}

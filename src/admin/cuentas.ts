import { and, count, eq, gt, sql } from 'drizzle-orm';
import { dbAdmin } from '../db/client-admin';
import { auditoria, roles, usuarios } from '../db/schema';
import { hashClave, verificarClave } from '../lib/clave';

// Identidad de las cuentas de clientes (registro, contraseña y supresión). Usa la conexión del panel porque
// toca usuarios, sesiones y auditoría, igual que el login. Los datos del portal se leen con vitalis_cuenta.

export class CorreoEnUso extends Error {}

// Correo que deja la supresión de una cuenta (función eliminar_cuenta_cliente). Esa cuenta ya no se reactiva.
export const esCuentaEliminada = (email: string) => email.endsWith('@cuentas.invalid');

const esCorreoRepetido = (error: unknown) =>
  error instanceof Error &&
  'cause' in error &&
  (error.cause as { constraint?: string } | undefined)?.constraint === 'usuarios_email_unique';

// El rol siempre es "usuario", venga lo que venga del formulario.
export async function crearCuentaCliente(datos: {
  nombre: string;
  email: string;
  telefono: string;
  clave: string;
}) {
  const [rol] = await dbAdmin.select({ id: roles.id }).from(roles).where(eq(roles.slug, 'usuario'));
  if (!rol) throw new Error('No existe el rol usuario');
  try {
    const [fila] = await dbAdmin
      .insert(usuarios)
      .values({
        nombre: datos.nombre,
        email: datos.email.trim().toLowerCase(),
        telefono: datos.telefono,
        claveHash: await hashClave(datos.clave),
        rolId: rol.id,
        debeCambiarClave: false,
        aceptaDatosEn: new Date(),
      })
      .returning({ id: usuarios.id });
    if (!fila) throw new Error('No se pudo crear la cuenta');
    return fila.id;
  } catch (error) {
    if (esCorreoRepetido(error)) throw new CorreoEnUso();
    throw error;
  }
}

// Cuentas creadas desde la misma IP en la última hora (sale de la auditoría, sin tabla extra).
export async function cuentasRecientesPorIp(ipHash: string) {
  const [fila] = await dbAdmin
    .select({ total: count() })
    .from(auditoria)
    .where(
      and(
        eq(auditoria.evento, 'cuenta_creada'),
        eq(auditoria.ipHash, ipHash),
        gt(auditoria.createdAt, sql`now() - interval '1 hour'`),
      ),
    );
  return fila?.total ?? 0;
}

export async function claveCorrecta(usuarioId: number, clave: string) {
  const [fila] = await dbAdmin
    .select({ claveHash: usuarios.claveHash })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId));
  return Boolean(fila) && (await verificarClave(clave, fila?.claveHash ?? '')).valida;
}

// Derecho de supresión: lo hace una función de la base con permisos de dueño (ver la migración 0011).
export const eliminarCuentaCliente = (usuarioId: number) =>
  dbAdmin.execute(sql`select vitalis.eliminar_cuenta_cliente(${usuarioId})`);

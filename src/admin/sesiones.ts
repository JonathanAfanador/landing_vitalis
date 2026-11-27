import { createHash, randomBytes } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { and, eq, gt, sql } from 'drizzle-orm';
import { dbAdmin } from '../db/client-admin';
import { permisos, rolPermiso, roles, sesiones, usuarios } from '../db/schema';
import type { UsuarioSesion } from './autorizacion';

export const COOKIE_SESION = '__Host-vitalis_sesion';
const DURACION_MS = 12 * 60 * 60 * 1000; // expiración absoluta
const INACTIVIDAD = '2 hours'; // sin uso durante este tiempo, la sesión deja de valer
const REFRESCO_MS = 15 * 60 * 1000; // el último uso se actualiza como mucho cada 15 min

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function crearSesion(usuarioId: number, cookies: AstroCookies) {
  const token = randomBytes(32).toString('base64url');
  const expiraEn = new Date(Date.now() + DURACION_MS);
  await dbAdmin.insert(sesiones).values({ tokenHash: hashToken(token), usuarioId, expiraEn });
  cookies.set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires: expiraEn,
  });
}

// Lee la sesión y los permisos del rol en una sola consulta: un cambio de permisos surte efecto
// en la siguiente petición, sin cerrar sesión.
export async function validarSesion(token: string): Promise<UsuarioSesion | null> {
  const tokenHash = hashToken(token);
  const [fila] = await dbAdmin
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      telefono: usuarios.telefono,
      debeCambiarClave: usuarios.debeCambiarClave,
      rolId: roles.id,
      rolSlug: roles.slug,
      rolNombre: roles.nombre,
      ultimoUso: sesiones.ultimoUso,
      permisos: sql<
        string[]
      >`coalesce(array_agg(${permisos.codigo}) filter (where ${permisos.codigo} is not null), '{}')`,
    })
    .from(sesiones)
    .innerJoin(usuarios, eq(usuarios.id, sesiones.usuarioId))
    .innerJoin(roles, eq(roles.id, usuarios.rolId))
    .leftJoin(rolPermiso, eq(rolPermiso.rolId, roles.id))
    .leftJoin(permisos, eq(permisos.id, rolPermiso.permisoId))
    .where(
      and(
        eq(sesiones.tokenHash, tokenHash),
        gt(sesiones.expiraEn, sql`now()`),
        gt(sesiones.ultimoUso, sql`now() - ${INACTIVIDAD}::interval`),
        eq(usuarios.activo, true),
      ),
    )
    .groupBy(usuarios.id, roles.id, sesiones.tokenHash);

  if (!fila) return null;
  if (Date.now() - fila.ultimoUso.getTime() > REFRESCO_MS) {
    await dbAdmin.update(sesiones).set({ ultimoUso: new Date() }).where(eq(sesiones.tokenHash, tokenHash));
  }
  return {
    id: fila.id,
    nombre: fila.nombre,
    email: fila.email,
    telefono: fila.telefono,
    debeCambiarClave: fila.debeCambiarClave,
    rolId: fila.rolId,
    rolSlug: fila.rolSlug,
    rolNombre: fila.rolNombre,
    esSuperadmin: fila.rolSlug === 'superadmin',
    permisos: new Set(fila.permisos),
  };
}

export async function cerrarSesion(token: string | undefined, cookies: AstroCookies) {
  if (token) await dbAdmin.delete(sesiones).where(eq(sesiones.tokenHash, hashToken(token)));
  cookies.delete(COOKIE_SESION, { path: '/' });
}

// Al cambiar la contraseña, desactivar a alguien o cambiarle el rol: fuera todas sus sesiones.
export const cerrarTodasLasSesiones = (usuarioId: number) =>
  dbAdmin.delete(sesiones).where(eq(sesiones.usuarioId, usuarioId));

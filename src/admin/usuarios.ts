import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import { dbAdmin } from '../db/client-admin';
import { roles, usuarios } from '../db/schema';
import { rolParaAsignar } from './roles';

// Usuarios del panel (sin las cuentas de clientes, que tendrán su propio listado en el portal).
export const listarUsuariosPanel = () =>
  dbAdmin
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      activo: usuarios.activo,
      debeCambiarClave: usuarios.debeCambiarClave,
      ultimoAcceso: usuarios.ultimoAcceso,
      rolId: roles.id,
      rolSlug: roles.slug,
      rolNombre: roles.nombre,
    })
    .from(usuarios)
    .innerJoin(roles, eq(roles.id, usuarios.rolId))
    .where(ne(roles.slug, 'usuario'))
    .orderBy(sql`${usuarios.activo} desc`, asc(usuarios.nombre));

export type UsuarioListado = Awaited<ReturnType<typeof listarUsuariosPanel>>[number];

export async function obtenerObjetivo(id: number) {
  const [fila] = await dbAdmin
    .select({ id: usuarios.id, email: usuarios.email, activo: usuarios.activo, rolId: usuarios.rolId })
    .from(usuarios)
    .where(eq(usuarios.id, id));
  if (!fila) return null;
  const rol = await rolParaAsignar(fila.rolId);
  return rol && { ...fila, rol };
}

export async function contarSuperadminsActivos() {
  const [fila] = await dbAdmin
    .select({ total: count() })
    .from(usuarios)
    .innerJoin(roles, eq(roles.id, usuarios.rolId))
    .where(and(eq(roles.slug, 'superadmin'), eq(usuarios.activo, true)));
  return fila?.total ?? 0;
}

export async function buscarParaLogin(email: string) {
  const [fila] = await dbAdmin
    .select({ id: usuarios.id, claveHash: usuarios.claveHash, activo: usuarios.activo })
    .from(usuarios)
    .where(sql`lower(${usuarios.email}) = ${email.trim().toLowerCase()}`);
  return fila ?? null;
}

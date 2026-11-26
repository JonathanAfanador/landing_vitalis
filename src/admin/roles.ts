import { randomBytes } from 'node:crypto';
import { asc, count, eq, inArray, sql } from 'drizzle-orm';
import { dbAdmin, type TxAdmin } from '../db/client-admin';
import { permisos, rolPermiso, roles, usuarios } from '../db/schema';
import type { RolParaAsignar } from './autorizacion';

// Con JOIN, Drizzle califica cada columna con su tabla. En una subconsulta correlacionada sobre una sola
// tabla no lo hace ("rol_id" = "id" apunta a la tabla equivocada), así que aquí se agrega con JOIN y GROUP BY.
const columnasRol = {
  id: roles.id,
  slug: roles.slug,
  nombre: roles.nombre,
  descripcion: roles.descripcion,
  esSistema: roles.esSistema,
  permisos: sql<
    string[]
  >`coalesce(array_agg(distinct ${permisos.codigo} order by ${permisos.codigo}) filter (where ${permisos.codigo} is not null), '{}')`,
};

export const listarRoles = () =>
  dbAdmin
    .select({ ...columnasRol, usuarios: sql<number>`count(distinct ${usuarios.id})::int` })
    .from(roles)
    .leftJoin(rolPermiso, eq(rolPermiso.rolId, roles.id))
    .leftJoin(permisos, eq(permisos.id, rolPermiso.permisoId))
    .leftJoin(usuarios, eq(usuarios.rolId, roles.id))
    .groupBy(roles.id)
    .orderBy(sql`${roles.esSistema} desc`, asc(roles.nombre));

export type RolListado = Awaited<ReturnType<typeof listarRoles>>[number];

export async function obtenerRol(id: number) {
  const [rol] = await dbAdmin
    .select(columnasRol)
    .from(roles)
    .leftJoin(rolPermiso, eq(rolPermiso.rolId, roles.id))
    .leftJoin(permisos, eq(permisos.id, rolPermiso.permisoId))
    .where(eq(roles.id, id))
    .groupBy(roles.id);
  return rol ?? null;
}

export async function rolParaAsignar(id: number): Promise<RolParaAsignar | null> {
  const rol = await obtenerRol(id);
  return rol && { id: rol.id, slug: rol.slug, permisos: rol.permisos };
}

export async function contarUsuariosDelRol(rolId: number) {
  const [fila] = await dbAdmin.select({ total: count() }).from(usuarios).where(eq(usuarios.rolId, rolId));
  return fila?.total ?? 0;
}

const slugificar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'rol';

// Reemplaza los permisos del rol por `codigos` y devuelve qué se añadió y qué se quitó (para la auditoría).
export async function fijarPermisos(tx: TxAdmin, rolId: number, codigos: readonly string[]) {
  const actuales = await tx
    .select({ codigo: permisos.codigo })
    .from(rolPermiso)
    .innerJoin(permisos, eq(permisos.id, rolPermiso.permisoId))
    .where(eq(rolPermiso.rolId, rolId));
  const antes = new Set(actuales.map((p) => p.codigo));
  const despues = new Set(codigos);
  const anadidos = [...despues].filter((c) => !antes.has(c));
  const quitados = [...antes].filter((c) => !despues.has(c));

  if (quitados.length) {
    const ids = tx.select({ id: permisos.id }).from(permisos).where(inArray(permisos.codigo, quitados));
    await tx
      .delete(rolPermiso)
      .where(sql`${rolPermiso.rolId} = ${rolId} and ${rolPermiso.permisoId} in (${ids})`);
  }
  if (anadidos.length) {
    const filas = await tx
      .select({ id: permisos.id })
      .from(permisos)
      .where(inArray(permisos.codigo, anadidos));
    await tx.insert(rolPermiso).values(filas.map((p) => ({ rolId, permisoId: p.id })));
  }
  return { anadidos, quitados };
}

export async function crearRol(tx: TxAdmin, datos: { nombre: string; descripcion: string | null }) {
  const base = slugificar(datos.nombre);
  for (const slug of [base, `${base}-${randomBytes(3).toString('hex')}`]) {
    const [rol] = await tx
      .insert(roles)
      .values({ slug, nombre: datos.nombre, descripcion: datos.descripcion })
      .onConflictDoNothing({ target: roles.slug })
      .returning({ id: roles.id, slug: roles.slug });
    if (rol) return rol;
  }
  throw new Error('No se pudo generar un identificador único para el rol');
}

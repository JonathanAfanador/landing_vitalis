import { and, count, desc, eq, ilike, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { dbAdmin } from '../db/client-admin';
import { pedidos, roles, solicitudesCita, usuarios } from '../db/schema';
import { generarClaveTemporal, hashClave } from '../lib/clave';
import { eliminarCuentaCliente } from './cuentas';
import { cerrarTodasLasSesiones } from './sesiones';
import { desplazamiento, POR_PAGINA } from './paginacion';

// Cuentas de clientes del portal, para que la clínica restablezca contraseñas o desactive cuentas.
// Búsqueda por nombre, correo o celular; las más recientes primero.
export async function listarClientesPanel(filtros: { q: string; pagina: number; solicitudes: boolean }) {
  const patron = filtros.q ? `%${filtros.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const donde = and(
    eq(roles.slug, 'usuario'),
    filtros.solicitudes ? isNotNull(usuarios.eliminacionSolicitadaEn) : undefined,
    patron
      ? or(ilike(usuarios.nombre, patron), ilike(usuarios.email, patron), ilike(usuarios.telefono, patron))
      : undefined,
  );
  const [filas, [conteo]] = await Promise.all([
    dbAdmin
      .select({
        id: usuarios.id,
        nombre: usuarios.nombre,
        email: usuarios.email,
        telefono: usuarios.telefono,
        activo: usuarios.activo,
        debeCambiarClave: usuarios.debeCambiarClave,
        eliminacionSolicitadaEn: usuarios.eliminacionSolicitadaEn,
        desde: usuarios.createdAt,
        ultimoAcceso: usuarios.ultimoAcceso,
        pedidos: sql<number>`(select count(*)::int from ${pedidos} where ${pedidos.usuarioId} = ${usuarios.id})`,
        citas: sql<number>`(select count(*)::int from ${solicitudesCita} where ${solicitudesCita.usuarioId} = ${usuarios.id})`,
      })
      .from(usuarios)
      .innerJoin(roles, eq(roles.id, usuarios.rolId))
      .where(donde)
      .orderBy(desc(usuarios.createdAt), desc(usuarios.id))
      .limit(POR_PAGINA)
      .offset(desplazamiento(filtros.pagina)),
    dbAdmin
      .select({ total: count() })
      .from(usuarios)
      .innerJoin(roles, eq(roles.id, usuarios.rolId))
      .where(donde),
  ]);
  return { clientes: filas, total: conteo?.total ?? 0 };
}

// Solo filas de clientes que su titular no eliminó: el UPDATE nunca alcanza al personal del panel.
const esClienteVigente = (id: number) =>
  and(
    eq(usuarios.id, id),
    inArray(usuarios.rolId, dbAdmin.select({ id: roles.id }).from(roles).where(eq(roles.slug, 'usuario'))),
    sql`${usuarios.email} not like '%@cuentas.invalid'`,
  );

// Contraseña temporal que la clínica entrega por WhatsApp; el cliente debe cambiarla al ingresar.
export async function restablecerClaveCliente(id: number) {
  const claveTemporal = generarClaveTemporal();
  const [fila] = await dbAdmin
    .update(usuarios)
    .set({ claveHash: await hashClave(claveTemporal), debeCambiarClave: true })
    .where(and(esClienteVigente(id), eq(usuarios.activo, true)))
    .returning({ email: usuarios.email });
  if (!fila) return null;
  await cerrarTodasLasSesiones(id);
  return { email: fila.email, claveTemporal };
}

export async function cambiarEstadoCliente(id: number, activo: boolean) {
  const [fila] = await dbAdmin
    .update(usuarios)
    .set({ activo })
    .where(esClienteVigente(id))
    .returning({ id: usuarios.id });
  if (fila && !activo) await cerrarTodasLasSesiones(id);
  return Boolean(fila);
}

export const contarSolicitudesEliminacion = async () => {
  const [fila] = await dbAdmin
    .select({ total: count() })
    .from(usuarios)
    .where(isNotNull(usuarios.eliminacionSolicitadaEn));
  return fila?.total ?? 0;
};

// Atiende la supresión (Ley 1581). No se hace con pedidos en curso: se perdería el contacto para entregarlos
// o devolver el dinero; primero se entregan o se cancelan.
export async function eliminarCuentaDesdePanel(
  id: number,
): Promise<'ok' | 'no-es-cliente' | 'pedidos-en-curso'> {
  const [cliente] = await dbAdmin.select({ id: usuarios.id }).from(usuarios).where(esClienteVigente(id));
  if (!cliente) return 'no-es-cliente';
  const [enCurso] = await dbAdmin
    .select({ total: count() })
    .from(pedidos)
    .where(and(eq(pedidos.usuarioId, id), inArray(pedidos.estado, ['pendiente', 'confirmado', 'pagado'])));
  if ((enCurso?.total ?? 0) > 0) return 'pedidos-en-curso';
  await eliminarCuentaCliente(id);
  return 'ok';
}

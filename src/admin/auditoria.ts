import { count, desc, eq } from 'drizzle-orm';
import { dbAdmin, type TxAdmin } from '../db/client-admin';
import { auditoria, usuarios, type EventoAuditoria } from '../db/schema';
import { desplazamiento, POR_PAGINA } from './paginacion';

type Registro = {
  actorId: number | null;
  evento: EventoAuditoria;
  entidad?: string | undefined;
  entidadId?: string | number | undefined;
  ipHash?: string | undefined;
  sujetoHash?: string | undefined;
  // Solo IDs y valores antes/después; nunca nombres, teléfonos ni direcciones de clientes.
  detalle?: Record<string, unknown> | undefined;
};

export async function registrar(registro: Registro, tx: TxAdmin | typeof dbAdmin = dbAdmin) {
  await tx.insert(auditoria).values({
    actorId: registro.actorId,
    evento: registro.evento,
    entidad: registro.entidad ?? null,
    entidadId: registro.entidadId === undefined ? null : String(registro.entidadId),
    ipHash: registro.ipHash ?? null,
    sujetoHash: registro.sujetoHash ?? null,
    detalle: registro.detalle ?? null,
  });
}

// Más reciente primero, 25 por página como el resto del panel.

export async function listarAuditoria(filtros: { evento?: EventoAuditoria | undefined; pagina: number }) {
  const donde = filtros.evento ? eq(auditoria.evento, filtros.evento) : undefined;
  const [registros, [conteo]] = await Promise.all([
    dbAdmin
      .select({
        id: auditoria.id,
        fecha: auditoria.createdAt,
        evento: auditoria.evento,
        entidad: auditoria.entidad,
        entidadId: auditoria.entidadId,
        detalle: auditoria.detalle,
        actor: usuarios.nombre,
      })
      .from(auditoria)
      .leftJoin(usuarios, eq(usuarios.id, auditoria.actorId))
      .where(donde)
      .orderBy(desc(auditoria.createdAt), desc(auditoria.id))
      .limit(POR_PAGINA)
      .offset(desplazamiento(filtros.pagina)),
    dbAdmin.select({ total: count() }).from(auditoria).where(donde),
  ]);
  return { registros, total: conteo?.total ?? 0 };
}

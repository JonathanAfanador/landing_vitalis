import { and, desc, eq, sql } from 'drizzle-orm';
import { dbAdmin, type TxAdmin } from '../db/client-admin';
import { auditoria, usuarios, type EventoAuditoria } from '../db/schema';

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

type CursorAuditoria = { fecha: string; id: number };
const leerCursor = (valor: string | null): CursorAuditoria | null => {
  if (!valor) return null;
  try {
    const [fecha, id] = JSON.parse(Buffer.from(valor, 'base64url').toString()) as unknown[];
    return typeof fecha === 'string' && Number.isInteger(id) ? { fecha, id: id as number } : null;
  } catch {
    return null;
  }
};

// Más reciente primero, paginado por cursor (created_at, id).
export async function listarAuditoria(
  filtros: { evento?: EventoAuditoria | undefined; cursor: string | null },
  limite = 50,
) {
  const cursor = leerCursor(filtros.cursor);
  const filas = await dbAdmin
    .select({
      id: auditoria.id,
      fecha: auditoria.createdAt,
      // Con microsegundos: Date los trunca a milisegundos y el cursor saltaría registros.
      fechaExacta: sql<string>`${auditoria.createdAt}::text`,
      evento: auditoria.evento,
      entidad: auditoria.entidad,
      entidadId: auditoria.entidadId,
      detalle: auditoria.detalle,
      actor: usuarios.nombre,
    })
    .from(auditoria)
    .leftJoin(usuarios, eq(usuarios.id, auditoria.actorId))
    .where(
      and(
        filtros.evento ? eq(auditoria.evento, filtros.evento) : undefined,
        cursor
          ? sql`(${auditoria.createdAt}, ${auditoria.id}) < (${cursor.fecha}::timestamptz, ${cursor.id}::bigint)`
          : undefined,
      ),
    )
    .orderBy(desc(auditoria.createdAt), desc(auditoria.id))
    .limit(limite + 1);

  const hayMas = filas.length > limite;
  const pagina = hayMas ? filas.slice(0, limite) : filas;
  const ultimo = pagina.at(-1);
  return {
    registros: pagina,
    siguienteCursor:
      hayMas && ultimo
        ? Buffer.from(JSON.stringify([ultimo.fechaExacta, ultimo.id])).toString('base64url')
        : null,
  };
}

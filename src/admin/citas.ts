import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { dbAdmin } from '../db/client-admin';
import { especies, solicitudesCita } from '../db/schema';
import { origenesCita, type EstadoCita } from '../lib/estados';
import { leerCursorFecha, paginar } from './cursor';

// Más recientes primero, paginado por cursor (created_at, id). El listado solo muestra tutor, mascota y
// preferencia; el celular y el motivo quedan para el detalle.
export async function listarCitasPanel(
  filtros: { estado: EstadoCita | null; cursor: string | null },
  limite = 30,
) {
  const cursor = leerCursorFecha(filtros.cursor);
  const filas = await dbAdmin
    .select({
      id: solicitudesCita.id,
      codigo: solicitudesCita.codigo,
      fecha: solicitudesCita.createdAt,
      fechaExacta: sql<string>`${solicitudesCita.createdAt}::text`,
      tutor: solicitudesCita.nombreTutor,
      mascota: solicitudesCita.nombreMascota,
      fechaPreferida: solicitudesCita.fechaPreferida,
      franja: solicitudesCita.franja,
      estado: solicitudesCita.estado,
    })
    .from(solicitudesCita)
    .where(
      and(
        filtros.estado ? eq(solicitudesCita.estado, filtros.estado) : undefined,
        cursor
          ? sql`(${solicitudesCita.createdAt}, ${solicitudesCita.id}) < (${cursor.fecha}::timestamptz, ${cursor.id}::bigint)`
          : undefined,
      ),
    )
    .orderBy(desc(solicitudesCita.createdAt), desc(solicitudesCita.id))
    .limit(limite + 1);
  const { pagina, siguienteCursor } = paginar(filas, limite);
  return { citas: pagina, siguienteCursor };
}

export async function obtenerCitaPanel(id: number) {
  const [cita] = await dbAdmin
    .select({
      id: solicitudesCita.id,
      codigo: solicitudesCita.codigo,
      createdAt: solicitudesCita.createdAt,
      nombreTutor: solicitudesCita.nombreTutor,
      telefono: solicitudesCita.telefono,
      especie: especies.slug,
      nombreMascota: solicitudesCita.nombreMascota,
      motivo: solicitudesCita.motivo,
      fechaPreferida: solicitudesCita.fechaPreferida,
      franja: solicitudesCita.franja,
      estado: solicitudesCita.estado,
      notasInternas: solicitudesCita.notasInternas,
    })
    .from(solicitudesCita)
    .innerJoin(especies, eq(especies.id, solicitudesCita.especieId))
    .where(eq(solicitudesCita.id, id));
  return cita ?? null;
}

export const contarCitasPorAgendar = async () => {
  const [fila] = await dbAdmin
    .select({ total: sql<number>`count(*)::int` })
    .from(solicitudesCita)
    .where(eq(solicitudesCita.estado, 'solicitada'));
  return fila?.total ?? 0;
};

// Cambia el estado solo si la cita sigue en un estado de origen válido (dos clics o dos personas a la vez
// no aplican el cambio dos veces).
export async function cambiarEstadoCita(id: number, hacia: EstadoCita) {
  const [cambiada] = await dbAdmin
    .update(solicitudesCita)
    .set({ estado: hacia })
    .where(and(eq(solicitudesCita.id, id), inArray(solicitudesCita.estado, origenesCita(hacia))))
    .returning({ id: solicitudesCita.id });
  return Boolean(cambiada);
}

export async function guardarNotasCita(id: number, notas: string | null) {
  const [guardada] = await dbAdmin
    .update(solicitudesCita)
    .set({ notasInternas: notas })
    .where(eq(solicitudesCita.id, id))
    .returning({ id: solicitudesCita.id });
  return Boolean(guardada);
}

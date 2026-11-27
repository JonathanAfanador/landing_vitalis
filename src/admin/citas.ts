import { and, count, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { dbAdmin } from '../db/client-admin';
import { especies, solicitudesCita, usuarios } from '../db/schema';
import { ESTADOS_CITA, origenesCita, type EstadoCita } from '../lib/estados';
import { desplazamiento, POR_PAGINA } from './paginacion';
import { MAX_FILAS_EXPORTACION } from './exportar';

export type FiltroCitas = EstadoCita | 'eliminadas' | null;

// ?estado= de la URL. "eliminadas" solo vale para quien puede eliminar (el superadmin).
export const leerFiltroCitas = (valor: string | null, veEliminadas: boolean): FiltroCitas =>
  valor === 'eliminadas' && veEliminadas ? 'eliminadas' : (ESTADOS_CITA.find((e) => e === valor) ?? null);

// Las eliminadas solo aparecen en su propio filtro (lo ve el superadmin); el resto nunca las incluye.
const filtroCitas = (filtro: FiltroCitas) =>
  filtro === 'eliminadas'
    ? isNotNull(solicitudesCita.eliminadaEn)
    : and(isNull(solicitudesCita.eliminadaEn), filtro ? eq(solicitudesCita.estado, filtro) : undefined);

// Más recientes primero. El listado solo muestra tutor, mascota y preferencia; el celular y el motivo
// quedan para el detalle y la descarga.
export async function listarCitasPanel(filtros: { estado: FiltroCitas; pagina: number }) {
  const donde = filtroCitas(filtros.estado);
  const [filas, [conteo]] = await Promise.all([
    dbAdmin
      .select({
        id: solicitudesCita.id,
        codigo: solicitudesCita.codigo,
        fecha: solicitudesCita.createdAt,
        tutor: solicitudesCita.nombreTutor,
        mascota: solicitudesCita.nombreMascota,
        fechaPreferida: solicitudesCita.fechaPreferida,
        franja: solicitudesCita.franja,
        estado: solicitudesCita.estado,
      })
      .from(solicitudesCita)
      .where(donde)
      .orderBy(desc(solicitudesCita.createdAt), desc(solicitudesCita.id))
      .limit(POR_PAGINA)
      .offset(desplazamiento(filtros.pagina)),
    dbAdmin.select({ total: count() }).from(solicitudesCita).where(donde),
  ]);
  return { citas: filas, total: conteo?.total ?? 0 };
}

export const citasParaExportar = (filtro: FiltroCitas) =>
  dbAdmin
    .select({
      codigo: solicitudesCita.codigo,
      fecha: solicitudesCita.createdAt,
      estado: solicitudesCita.estado,
      tutor: solicitudesCita.nombreTutor,
      telefono: solicitudesCita.telefono,
      especie: especies.slug,
      mascota: solicitudesCita.nombreMascota,
      motivo: solicitudesCita.motivo,
      fechaPreferida: solicitudesCita.fechaPreferida,
      franja: solicitudesCita.franja,
      notas: solicitudesCita.notasInternas,
    })
    .from(solicitudesCita)
    .innerJoin(especies, eq(especies.id, solicitudesCita.especieId))
    .where(filtroCitas(filtro))
    .orderBy(desc(solicitudesCita.createdAt), desc(solicitudesCita.id))
    .limit(MAX_FILAS_EXPORTACION);

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
      eliminadaEn: solicitudesCita.eliminadaEn,
      eliminadaPorNombre: usuarios.nombre,
    })
    .from(solicitudesCita)
    .innerJoin(especies, eq(especies.id, solicitudesCita.especieId))
    .leftJoin(usuarios, eq(usuarios.id, solicitudesCita.eliminadaPor))
    .where(eq(solicitudesCita.id, id));
  return cita ?? null;
}

export const contarCitasPorAgendar = async () => {
  const [fila] = await dbAdmin
    .select({ total: sql<number>`count(*)::int` })
    .from(solicitudesCita)
    .where(and(eq(solicitudesCita.estado, 'solicitada'), isNull(solicitudesCita.eliminadaEn)));
  return fila?.total ?? 0;
};

// Cambia el estado solo si la cita sigue en un estado de origen válido (dos clics o dos personas a la vez
// no aplican el cambio dos veces).
export async function cambiarEstadoCita(id: number, hacia: EstadoCita) {
  const [cambiada] = await dbAdmin
    .update(solicitudesCita)
    .set({ estado: hacia })
    .where(
      and(
        eq(solicitudesCita.id, id),
        inArray(solicitudesCita.estado, origenesCita(hacia)),
        isNull(solicitudesCita.eliminadaEn),
      ),
    )
    .returning({ id: solicitudesCita.id });
  return Boolean(cambiada);
}

export async function guardarNotasCita(id: number, notas: string | null) {
  const [guardada] = await dbAdmin
    .update(solicitudesCita)
    .set({ notasInternas: notas })
    .where(and(eq(solicitudesCita.id, id), isNull(solicitudesCita.eliminadaEn)))
    .returning({ id: solicitudesCita.id });
  return Boolean(guardada);
}

// Cualquier cita se puede eliminar (también las de spam sin atender); los datos se conservan.
export async function eliminarCita(id: number, actorId: number) {
  const [fila] = await dbAdmin
    .update(solicitudesCita)
    .set({ eliminadaEn: new Date(), eliminadaPor: actorId })
    .where(and(eq(solicitudesCita.id, id), isNull(solicitudesCita.eliminadaEn)))
    .returning({ id: solicitudesCita.id });
  return Boolean(fila);
}

export async function restaurarCita(id: number) {
  const [fila] = await dbAdmin
    .update(solicitudesCita)
    .set({ eliminadaEn: null, eliminadaPor: null })
    .where(and(eq(solicitudesCita.id, id), isNotNull(solicitudesCita.eliminadaEn)))
    .returning({ id: solicitudesCita.id });
  return Boolean(fila);
}

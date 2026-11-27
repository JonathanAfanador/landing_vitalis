import { and, count, eq, gt, sql } from 'drizzle-orm';
import { db } from '../client';
import { especies, solicitudesCita } from '../schema';
import { nombreEspecie } from '../../lib/formato';
import { generarCodigo } from '../../lib/pedido';
import type { DatosCita } from '../../lib/validacion';

export async function citasRecientes(ipHash: string, minutos = 10) {
  const [fila] = await db
    .select({ total: count() })
    .from(solicitudesCita)
    .where(
      and(
        eq(solicitudesCita.ipHash, ipHash),
        gt(solicitudesCita.createdAt, sql`now() - make_interval(mins => ${minutos})`),
      ),
    );
  return fila?.total ?? 0;
}

const esCodigoRepetido = (error: unknown) =>
  error instanceof Error &&
  'cause' in error &&
  (error.cause as { constraint?: string } | undefined)?.constraint === 'solicitudes_cita_codigo_unique';

// Guarda la solicitud y devuelve lo que necesita el mensaje de WhatsApp. Si la especie no existe, null.
export async function crearCita(datos: DatosCita, ipHash: string) {
  const [especie] = await db
    .select({ id: especies.id })
    .from(especies)
    .where(eq(especies.slug, datos.especie));
  if (!especie) return null;

  // Un código repetido es casi imposible (32^6 combinaciones), pero si pasa se reintenta.
  for (let intento = 1; ; intento++) {
    try {
      const [cita] = await db
        .insert(solicitudesCita)
        .values({
          codigo: generarCodigo('CIT'),
          nombreTutor: datos.nombre,
          telefono: datos.telefono,
          especieId: especie.id,
          nombreMascota: datos.mascota,
          motivo: datos.motivo,
          fechaPreferida: datos.fecha ?? null,
          franja: datos.franja ?? null,
          aceptaTratamientoDatos: datos.aceptaDatos,
          ipHash,
        })
        .returning({ codigo: solicitudesCita.codigo });
      if (!cita) throw new Error('No se pudo guardar la solicitud de cita');
      return {
        codigo: cita.codigo,
        nombre: datos.nombre,
        telefono: datos.telefono,
        mascota: datos.mascota,
        especie: nombreEspecie(datos.especie).toLowerCase(),
        motivo: datos.motivo,
        fecha: datos.fecha ?? null,
        franja: datos.franja ?? null,
      };
    } catch (error) {
      if (intento < 3 && esCodigoRepetido(error)) continue;
      throw error;
    }
  }
}

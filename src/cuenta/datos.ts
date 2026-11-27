import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { comoCuenta } from '../db/client-cuenta';
import { especies, medicamentos, pedidoItems, pedidos, solicitudesCita, usuarios } from '../db/schema';
import { origenesCita } from '../lib/estados';

// Datos del portal de clientes. Todo pasa por comoCuenta(): las políticas RLS de la base solo devuelven filas
// de esa cuenta. El WHERE por usuario_id se repite aquí a propósito: dos barreras en lugar de una.

const MAX_RECIENTES = 50;

export const miPerfil = (usuarioId: number) =>
  comoCuenta(usuarioId, async (tx) => {
    const [fila] = await tx
      .select({
        nombre: usuarios.nombre,
        email: usuarios.email,
        telefono: usuarios.telefono,
        desde: usuarios.createdAt,
      })
      .from(usuarios)
      .where(eq(usuarios.id, usuarioId));
    return fila ?? null;
  });

export const actualizarMiPerfil = (usuarioId: number, datos: { nombre: string; telefono: string }) =>
  comoCuenta(usuarioId, async (tx) => {
    const [fila] = await tx
      .update(usuarios)
      .set({ nombre: datos.nombre, telefono: datos.telefono })
      .where(eq(usuarios.id, usuarioId))
      .returning({ id: usuarios.id });
    return Boolean(fila);
  });

export const misPedidos = (usuarioId: number) =>
  comoCuenta(usuarioId, async (tx) => {
    const lista = await tx
      .select({
        id: pedidos.id,
        codigo: pedidos.codigo,
        fecha: pedidos.createdAt,
        estado: pedidos.estado,
        totalCop: pedidos.totalCop,
      })
      .from(pedidos)
      .where(eq(pedidos.usuarioId, usuarioId))
      .orderBy(desc(pedidos.createdAt), desc(pedidos.id))
      .limit(MAX_RECIENTES);
    if (!lista.length) return [];

    const lineas = await tx
      .select({ pedidoId: pedidoItems.pedidoId, cantidad: pedidoItems.cantidad, nombre: medicamentos.nombre })
      .from(pedidoItems)
      .innerJoin(medicamentos, eq(medicamentos.id, pedidoItems.medicamentoId))
      .where(
        inArray(
          pedidoItems.pedidoId,
          lista.map((p) => p.id),
        ),
      )
      .orderBy(medicamentos.nombre);
    return lista.map((p) => ({ ...p, lineas: lineas.filter((l) => l.pedidoId === p.id) }));
  });

export const misCitas = (usuarioId: number) =>
  comoCuenta(usuarioId, (tx) =>
    tx
      .select({
        id: solicitudesCita.id,
        codigo: solicitudesCita.codigo,
        fecha: solicitudesCita.createdAt,
        mascota: solicitudesCita.nombreMascota,
        especie: especies.slug,
        motivo: solicitudesCita.motivo,
        fechaPreferida: solicitudesCita.fechaPreferida,
        franja: solicitudesCita.franja,
        estado: solicitudesCita.estado,
      })
      .from(solicitudesCita)
      .innerJoin(especies, eq(especies.id, solicitudesCita.especieId))
      .where(eq(solicitudesCita.usuarioId, usuarioId))
      .orderBy(desc(solicitudesCita.createdAt), desc(solicitudesCita.id))
      .limit(MAX_RECIENTES),
  );

// Solo si sigue por agendar o agendada. La política de la base además exige que el estado nuevo sea "cancelada".
export const cancelarMiCita = (usuarioId: number, citaId: number) =>
  comoCuenta(usuarioId, async (tx) => {
    const [fila] = await tx
      .update(solicitudesCita)
      .set({ estado: 'cancelada' })
      .where(
        and(
          eq(solicitudesCita.id, citaId),
          eq(solicitudesCita.usuarioId, usuarioId),
          inArray(solicitudesCita.estado, origenesCita('cancelada')),
        ),
      )
      .returning({ id: solicitudesCita.id });
    return Boolean(fila);
  });

// Pedidos que la clínica aún está atendiendo: mientras existan, la cuenta no se elimina (se perdería el
// contacto para entregarlos o devolver el dinero).
export const pedidosEnCurso = (usuarioId: number) =>
  comoCuenta(usuarioId, async (tx) => {
    const [fila] = await tx
      .select({ total: count() })
      .from(pedidos)
      .where(
        and(eq(pedidos.usuarioId, usuarioId), inArray(pedidos.estado, ['pendiente', 'confirmado', 'pagado'])),
      );
    return fila?.total ?? 0;
  });

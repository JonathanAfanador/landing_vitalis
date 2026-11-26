import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { dbAdmin } from '../db/client-admin';
import { medicamentos, pedidoItems, pedidos } from '../db/schema';
import { origenesPedido, type EstadoPedido } from '../lib/estados';

type Cursor = { fecha: string; id: number };
const leerCursor = (valor: string | null): Cursor | null => {
  if (!valor) return null;
  try {
    const [fecha, id] = JSON.parse(Buffer.from(valor, 'base64url').toString()) as unknown[];
    return typeof fecha === 'string' && Number.isInteger(id) ? { fecha, id: id as number } : null;
  } catch {
    return null;
  }
};

// Más recientes primero, paginado por cursor (created_at, id). El listado solo muestra el nombre del
// cliente; teléfono y correo quedan para el detalle.
export async function listarPedidosPanel(
  filtros: { estado: EstadoPedido | null; cursor: string | null },
  limite = 30,
) {
  const cursor = leerCursor(filtros.cursor);
  const filas = await dbAdmin
    .select({
      id: pedidos.id,
      codigo: pedidos.codigo,
      fecha: pedidos.createdAt,
      fechaExacta: sql<string>`${pedidos.createdAt}::text`,
      cliente: pedidos.nombreCliente,
      totalCop: pedidos.totalCop,
      estado: pedidos.estado,
    })
    .from(pedidos)
    .where(
      and(
        filtros.estado ? eq(pedidos.estado, filtros.estado) : undefined,
        cursor
          ? sql`(${pedidos.createdAt}, ${pedidos.id}) < (${cursor.fecha}::timestamptz, ${cursor.id}::bigint)`
          : undefined,
      ),
    )
    .orderBy(desc(pedidos.createdAt), desc(pedidos.id))
    .limit(limite + 1);
  const hayMas = filas.length > limite;
  const pagina = hayMas ? filas.slice(0, limite) : filas;
  const ultimo = pagina.at(-1);
  return {
    pedidos: pagina,
    siguienteCursor:
      hayMas && ultimo
        ? Buffer.from(JSON.stringify([ultimo.fechaExacta, ultimo.id])).toString('base64url')
        : null,
  };
}

export async function obtenerPedidoPanel(id: number) {
  const [pedido] = await dbAdmin.select().from(pedidos).where(eq(pedidos.id, id));
  if (!pedido) return null;
  const lineas = await dbAdmin
    .select({
      nombre: medicamentos.nombre,
      cantidad: pedidoItems.cantidad,
      precioUnitarioCop: pedidoItems.precioUnitarioCop,
      requiereFormula: medicamentos.requiereFormula,
    })
    .from(pedidoItems)
    .innerJoin(medicamentos, eq(medicamentos.id, pedidoItems.medicamentoId))
    .where(eq(pedidoItems.pedidoId, id))
    .orderBy(medicamentos.nombre);
  return { ...pedido, lineas };
}

export const contarPedidosPendientes = async () => {
  const [fila] = await dbAdmin
    .select({ total: sql<number>`count(*)::int` })
    .from(pedidos)
    .where(eq(pedidos.estado, 'pendiente'));
  return fila?.total ?? 0;
};

// Cambia el estado solo si el pedido sigue en un estado de origen válido. Cancelar devuelve el stock en
// la misma transacción y solo cuando el UPDATE afectó la fila: cancelar dos veces (o dos personas a la vez)
// nunca devuelve el stock dos veces, porque la segunda ya no encuentra el pedido en un estado cancelable.
export async function cambiarEstadoPedido(id: number, hacia: EstadoPedido) {
  return dbAdmin.transaction(async (tx) => {
    const [cambiado] = await tx
      .update(pedidos)
      .set({ estado: hacia })
      .where(and(eq(pedidos.id, id), inArray(pedidos.estado, origenesPedido(hacia))))
      .returning({ id: pedidos.id });
    if (!cambiado) return false;

    if (hacia === 'cancelado') {
      await tx.execute(sql`
        update ${medicamentos}
        set stock = ${medicamentos.stock} + ${pedidoItems.cantidad}, updated_at = now()
        from ${pedidoItems}
        where ${pedidoItems.pedidoId} = ${id} and ${medicamentos.id} = ${pedidoItems.medicamentoId}
      `);
    }
    return true;
  });
}

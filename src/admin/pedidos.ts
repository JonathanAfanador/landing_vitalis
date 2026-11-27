import { and, count, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { dbAdmin } from '../db/client-admin';
import { medicamentos, pedidoItems, pedidos, usuarios } from '../db/schema';
import { ESTADOS_PEDIDO, origenesPedido, type EstadoPedido } from '../lib/estados';
import { MAX_FILAS_EXPORTACION } from './exportar';
import { desplazamiento, POR_PAGINA } from './paginacion';

export type FiltroPedidos = EstadoPedido | 'eliminados' | null;

// ?estado= de la URL. "eliminados" solo vale para quien puede eliminar (el superadmin).
export const leerFiltroPedidos = (valor: string | null, veEliminados: boolean): FiltroPedidos =>
  valor === 'eliminados' && veEliminados ? 'eliminados' : (ESTADOS_PEDIDO.find((e) => e === valor) ?? null);

// Los eliminados solo aparecen en su propio filtro (lo ve el superadmin); el resto nunca los incluye.
const filtroPedidos = (filtro: FiltroPedidos) =>
  filtro === 'eliminados'
    ? isNotNull(pedidos.eliminadoEn)
    : and(isNull(pedidos.eliminadoEn), filtro ? eq(pedidos.estado, filtro) : undefined);

// Más recientes primero. El listado solo muestra el nombre del cliente; teléfono y correo quedan para el
// detalle y la descarga.
export async function listarPedidosPanel(filtros: { estado: FiltroPedidos; pagina: number }) {
  const donde = filtroPedidos(filtros.estado);
  const [filas, [conteo]] = await Promise.all([
    dbAdmin
      .select({
        id: pedidos.id,
        codigo: pedidos.codigo,
        fecha: pedidos.createdAt,
        cliente: pedidos.nombreCliente,
        totalCop: pedidos.totalCop,
        estado: pedidos.estado,
      })
      .from(pedidos)
      .where(donde)
      .orderBy(desc(pedidos.createdAt), desc(pedidos.id))
      .limit(POR_PAGINA)
      .offset(desplazamiento(filtros.pagina)),
    dbAdmin.select({ total: count() }).from(pedidos).where(donde),
  ]);
  return { pedidos: filas, total: conteo?.total ?? 0 };
}

// Todo lo que lleva el Excel, con el mismo filtro del listado.
export const pedidosParaExportar = (filtro: FiltroPedidos) =>
  dbAdmin
    .select({
      codigo: pedidos.codigo,
      fecha: pedidos.createdAt,
      estado: pedidos.estado,
      cliente: pedidos.nombreCliente,
      telefono: pedidos.telefono,
      email: pedidos.email,
      totalCop: pedidos.totalCop,
      medicamentos: sql<string>`coalesce(string_agg(${pedidoItems.cantidad} || ' × ' || ${medicamentos.nombre}, '; ' order by ${medicamentos.nombre}), '')`,
      declaraFormula: pedidos.declaraFormula,
      notas: pedidos.notas,
    })
    .from(pedidos)
    .leftJoin(pedidoItems, eq(pedidoItems.pedidoId, pedidos.id))
    .leftJoin(medicamentos, eq(medicamentos.id, pedidoItems.medicamentoId))
    .where(filtroPedidos(filtro))
    .groupBy(pedidos.id)
    .orderBy(desc(pedidos.createdAt), desc(pedidos.id))
    .limit(MAX_FILAS_EXPORTACION);

export async function obtenerPedidoPanel(id: number) {
  const [fila] = await dbAdmin
    .select({ pedido: pedidos, eliminadoPorNombre: usuarios.nombre })
    .from(pedidos)
    .leftJoin(usuarios, eq(usuarios.id, pedidos.eliminadoPor))
    .where(eq(pedidos.id, id));
  if (!fila) return null;
  const pedido = { ...fila.pedido, eliminadoPorNombre: fila.eliminadoPorNombre };
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
    .where(and(eq(pedidos.estado, 'pendiente'), isNull(pedidos.eliminadoEn)));
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
      .where(
        and(eq(pedidos.id, id), inArray(pedidos.estado, origenesPedido(hacia)), isNull(pedidos.eliminadoEn)),
      )
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

// Solo se eliminan pedidos cerrados: uno pendiente, confirmado o pagado aún tiene stock reservado o dinero
// de por medio. Así eliminar nunca descuadra el inventario.
export const ESTADOS_ELIMINABLES_PEDIDO = ['entregado', 'cancelado'] as const satisfies EstadoPedido[];

export async function eliminarPedido(id: number, actorId: number) {
  const [fila] = await dbAdmin
    .update(pedidos)
    .set({ eliminadoEn: new Date(), eliminadoPor: actorId })
    .where(
      and(
        eq(pedidos.id, id),
        isNull(pedidos.eliminadoEn),
        inArray(pedidos.estado, ESTADOS_ELIMINABLES_PEDIDO),
      ),
    )
    .returning({ id: pedidos.id });
  return Boolean(fila);
}

export async function restaurarPedido(id: number) {
  const [fila] = await dbAdmin
    .update(pedidos)
    .set({ eliminadoEn: null, eliminadoPor: null })
    .where(and(eq(pedidos.id, id), isNotNull(pedidos.eliminadoEn)))
    .returning({ id: pedidos.id });
  return Boolean(fila);
}

import { and, asc, count, eq, gt, inArray, sql } from 'drizzle-orm';
import { db } from '../client';
import { medicamentos, pedidoItems, pedidos } from '../schema';
import { calcularPedido, generarCodigo, type Problema } from '../../lib/pedido';
import type { DatosPedido } from '../../lib/validacion';

export class PedidoRechazado extends Error {
  constructor(
    readonly motivo: 'problemas' | 'falta-formula',
    readonly problemas: Problema[] = [],
  ) {
    super(motivo);
  }
}

export async function pedidosRecientes(ipHash: string, minutos = 10) {
  const [fila] = await db
    .select({ total: count() })
    .from(pedidos)
    .where(
      and(eq(pedidos.ipHash, ipHash), gt(pedidos.createdAt, sql`now() - make_interval(mins => ${minutos})`)),
    );
  return fila?.total ?? 0;
}

const esCodigoRepetido = (error: unknown) =>
  error instanceof Error &&
  'cause' in error &&
  (error.cause as { code?: string; constraint?: string } | undefined)?.constraint === 'pedidos_codigo_unique';

// Crea el pedido en una sola transacción corta: bloquea los medicamentos (en orden de id, para no
// provocar interbloqueos), recalcula con los precios de la base de datos, guarda y descuenta stock.
async function intentarPedido(datos: DatosPedido, ipHash: string, usuarioId: number | null) {
  return db.transaction(async (tx) => {
    const filas = await tx
      .select({
        id: medicamentos.id,
        slug: medicamentos.slug,
        nombre: medicamentos.nombre,
        precioCop: medicamentos.precioCop,
        stock: medicamentos.stock,
        requiereFormula: medicamentos.requiereFormula,
        activo: medicamentos.activo,
      })
      .from(medicamentos)
      .where(
        inArray(
          medicamentos.slug,
          datos.items.map((i) => i.slug),
        ),
      )
      .orderBy(asc(medicamentos.id))
      .for('update');

    const calculo = calcularPedido(datos.items, filas);
    if (calculo.problemas.length) throw new PedidoRechazado('problemas', calculo.problemas);
    if (calculo.requiereFormula && !datos.declaraFormula) throw new PedidoRechazado('falta-formula');

    const [pedido] = await tx
      .insert(pedidos)
      .values({
        codigo: generarCodigo(),
        nombreCliente: datos.nombre,
        telefono: datos.telefono,
        email: datos.email,
        notas: datos.notas,
        totalCop: calculo.totalCop,
        declaraFormula: datos.declaraFormula,
        aceptaTratamientoDatos: datos.aceptaDatos,
        ipHash,
        usuarioId,
      })
      .returning({ id: pedidos.id, codigo: pedidos.codigo });
    if (!pedido) throw new Error('No se pudo guardar el pedido');

    await tx.insert(pedidoItems).values(
      calculo.lineas.map((l) => ({
        pedidoId: pedido.id,
        medicamentoId: l.medicamentoId,
        cantidad: l.cantidad,
        precioUnitarioCop: l.precioUnitarioCop,
      })),
    );

    for (const linea of calculo.lineas) {
      await tx
        .update(medicamentos)
        .set({ stock: sql`${medicamentos.stock} - ${linea.cantidad}` })
        .where(eq(medicamentos.id, linea.medicamentoId));
    }

    return {
      codigo: pedido.codigo,
      totalCop: calculo.totalCop,
      lineas: calculo.lineas.map(({ nombre, cantidad }) => ({ nombre, cantidad })),
    };
  });
}

export async function crearPedido(datos: DatosPedido, ipHash: string, usuarioId: number | null = null) {
  // Un código repetido es casi imposible (32^6 combinaciones), pero si pasa se reintenta.
  for (let intento = 1; ; intento++) {
    try {
      return await intentarPedido(datos, ipHash, usuarioId);
    } catch (error) {
      if (intento < 3 && esCodigoRepetido(error)) continue;
      throw error;
    }
  }
}

import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { medicamentosParaPedido } from '../db/queries/medicamentos';
import { crearPedido, PedidoRechazado, pedidosRecientes } from '../db/queries/pedidos';
import { hashIp } from '../lib/ip';
import { calcularPedido } from '../lib/pedido';
import { carritoSchema, pedidoSchema } from '../lib/validacion';

const MAX_PEDIDOS_POR_IP = 5;

export const server = {
  carrito: {
    // Precios y stock al día para lo que hay en el carrito del navegador.
    resumen: defineAction({
      input: z.object({ items: carritoSchema }),
      handler: async ({ items }) => {
        const filas = await medicamentosParaPedido(items.map((i) => i.slug));
        return calcularPedido(items, filas);
      },
    }),
  },

  pedidos: {
    crear: defineAction({
      input: pedidoSchema,
      handler: async (datos, context) => {
        if (datos.sitioWeb)
          throw new ActionError({ code: 'BAD_REQUEST', message: 'No se pudo enviar el pedido.' });

        const ipHash = hashIp(context.clientAddress);
        if ((await pedidosRecientes(ipHash)) >= MAX_PEDIDOS_POR_IP) {
          throw new ActionError({
            code: 'TOO_MANY_REQUESTS',
            message: 'Hiciste varios pedidos seguidos. Espera unos minutos o escríbenos por WhatsApp.',
          });
        }

        try {
          return await crearPedido(datos, ipHash);
        } catch (error) {
          if (!(error instanceof PedidoRechazado)) throw error;
          throw new ActionError({
            code: 'CONFLICT',
            message:
              error.motivo === 'falta-formula'
                ? 'Tu pedido incluye medicamentos con fórmula médica veterinaria. Confirma que la tienes.'
                : 'Algunos medicamentos ya no están disponibles en la cantidad que pediste. Revisa tu pedido.',
          });
        }
      },
    }),
  },
};

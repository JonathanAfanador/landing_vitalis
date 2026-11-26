import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { registrar } from '../../admin/auditoria';
import { requerirPermiso } from '../../admin/guard';
import { cambiarEstadoPedido } from '../../admin/pedidos';
import { protegerErrores } from '../../lib/acciones';
import { ESTADOS_PEDIDO } from '../../lib/estados';

export const pedidosAdmin = {
  // Cancelar exige pedidos:cancelar (devuelve stock); avanzar exige pedidos:cambiar_estado.
  cambiarEstado: defineAction({
    accept: 'form',
    input: z.object({ pedidoId: z.coerce.number().int().positive(), estado: z.enum(ESTADOS_PEDIDO) }),
    handler: protegerErrores(async ({ pedidoId, estado }, ctx) => {
      const actor = requerirPermiso(
        ctx.locals.usuario,
        estado === 'cancelado' ? 'pedidos:cancelar' : 'pedidos:cambiar_estado',
      );
      if (!(await cambiarEstadoPedido(pedidoId, estado))) {
        throw new ActionError({
          code: 'CONFLICT',
          message:
            'El pedido ya no está en un estado que permita ese cambio. Recarga para ver su estado actual.',
        });
      }
      await registrar({
        actorId: actor.id,
        evento: 'pedido_estado_cambiado',
        entidad: 'pedido',
        entidadId: pedidoId,
        detalle: { a: estado },
      });
      return { ok: true };
    }),
  }),
};

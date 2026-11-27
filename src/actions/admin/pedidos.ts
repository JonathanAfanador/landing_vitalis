import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { registrar } from '../../admin/auditoria';
import { requerirPermiso } from '../../admin/guard';
import { cambiarEstadoPedido, eliminarPedido, restaurarPedido } from '../../admin/pedidos';
import { ELIMINAR_REGISTROS } from '../../admin/permisos';
import { protegerErrores } from '../../lib/acciones';
import { ESTADOS_PEDIDO } from '../../lib/estados';

const pedidoId = z.coerce.number().int().positive();

export const pedidosAdmin = {
  // Cancelar exige pedidos:cancelar (devuelve stock); avanzar exige pedidos:cambiar_estado.
  cambiarEstado: defineAction({
    accept: 'form',
    input: z.object({ pedidoId, estado: z.enum(ESTADOS_PEDIDO) }),
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

  // Solo el superadmin y solo pedidos entregados o cancelados (sin stock reservado). Los datos se conservan.
  eliminar: defineAction({
    accept: 'form',
    input: z.object({ pedidoId }),
    handler: protegerErrores(async ({ pedidoId }, ctx) => {
      const actor = requerirPermiso(ctx.locals.usuario, ELIMINAR_REGISTROS);
      if (!(await eliminarPedido(pedidoId, actor.id))) {
        throw new ActionError({
          code: 'CONFLICT',
          message: 'Solo se eliminan pedidos entregados o cancelados que no estén ya eliminados.',
        });
      }
      await registrar({
        actorId: actor.id,
        evento: 'pedido_eliminado',
        entidad: 'pedido',
        entidadId: pedidoId,
      });
      return { ok: true };
    }),
  }),

  restaurar: defineAction({
    accept: 'form',
    input: z.object({ pedidoId }),
    handler: protegerErrores(async ({ pedidoId }, ctx) => {
      const actor = requerirPermiso(ctx.locals.usuario, ELIMINAR_REGISTROS);
      if (!(await restaurarPedido(pedidoId))) {
        throw new ActionError({ code: 'CONFLICT', message: 'Ese pedido no está eliminado.' });
      }
      await registrar({
        actorId: actor.id,
        evento: 'pedido_restaurado',
        entidad: 'pedido',
        entidadId: pedidoId,
      });
      return { ok: true };
    }),
  }),
};

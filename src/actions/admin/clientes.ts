import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { registrar } from '../../admin/auditoria';
import { cambiarEstadoCliente, restablecerClaveCliente } from '../../admin/clientes';
import { requerirPermiso } from '../../admin/guard';
import { protegerErrores } from '../../lib/acciones';

const usuarioId = z.coerce.number().int().positive();
const NO_ES_CLIENTE = 'Esa cuenta no es de un cliente o fue eliminada por su titular.';

export const clientesAdmin = {
  restablecerClave: defineAction({
    accept: 'form',
    input: z.object({ usuarioId }),
    handler: protegerErrores(async ({ usuarioId }, ctx) => {
      const actor = requerirPermiso(ctx.locals.usuario, 'clientes:gestionar');
      const resultado = await restablecerClaveCliente(usuarioId);
      if (!resultado) throw new ActionError({ code: 'CONFLICT', message: NO_ES_CLIENTE });
      await registrar({
        actorId: actor.id,
        evento: 'clave_restablecida',
        entidad: 'usuario',
        entidadId: usuarioId,
      });
      return resultado;
    }),
  }),

  cambiarEstado: defineAction({
    accept: 'form',
    input: z.object({ usuarioId, activo: z.enum(['si', 'no']).transform((v) => v === 'si') }),
    handler: protegerErrores(async ({ usuarioId, activo }, ctx) => {
      const actor = requerirPermiso(ctx.locals.usuario, 'clientes:gestionar');
      if (!(await cambiarEstadoCliente(usuarioId, activo))) {
        throw new ActionError({ code: 'CONFLICT', message: NO_ES_CLIENTE });
      }
      await registrar({
        actorId: actor.id,
        evento: activo ? 'usuario_reactivado' : 'usuario_desactivado',
        entidad: 'usuario',
        entidadId: usuarioId,
      });
      return { ok: true };
    }),
  }),
};

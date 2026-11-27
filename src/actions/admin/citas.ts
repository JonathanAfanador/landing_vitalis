import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { registrar } from '../../admin/auditoria';
import { cambiarEstadoCita, guardarNotasCita } from '../../admin/citas';
import { requerirPermiso } from '../../admin/guard';
import { protegerErrores } from '../../lib/acciones';
import { ESTADOS_CITA } from '../../lib/estados';

const citaId = z.coerce.number().int().positive();

export const citasAdmin = {
  cambiarEstado: defineAction({
    accept: 'form',
    input: z.object({ citaId, estado: z.enum(ESTADOS_CITA) }),
    handler: protegerErrores(async ({ citaId, estado }, ctx) => {
      const actor = requerirPermiso(ctx.locals.usuario, 'citas:gestionar');
      if (!(await cambiarEstadoCita(citaId, estado))) {
        throw new ActionError({
          code: 'CONFLICT',
          message:
            'La cita ya no está en un estado que permita ese cambio. Recarga para ver su estado actual.',
        });
      }
      await registrar({
        actorId: actor.id,
        evento: 'cita_estado_cambiado',
        entidad: 'cita',
        entidadId: citaId,
        detalle: { a: estado },
      });
      return { ok: true };
    }),
  }),

  // Notas de la clínica, por ejemplo el día y la hora acordados por WhatsApp. No van a la auditoría:
  // pueden tener datos de salud de la mascota o del tutor.
  guardarNotas: defineAction({
    accept: 'form',
    input: z.object({
      citaId,
      notas: z.string().trim().max(1000, 'Las notas pueden tener hasta 1.000 caracteres.').nullish(),
    }),
    handler: protegerErrores(async ({ citaId, notas }, ctx) => {
      requerirPermiso(ctx.locals.usuario, 'citas:gestionar');
      if (!(await guardarNotasCita(citaId, notas || null))) {
        throw new ActionError({ code: 'NOT_FOUND', message: 'Esa cita ya no existe.' });
      }
      return { ok: true };
    }),
  }),
};

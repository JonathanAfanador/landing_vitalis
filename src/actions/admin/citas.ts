import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { registrar } from '../../admin/auditoria';
import { cambiarEstadoCita, eliminarCita, guardarNotasCita, restaurarCita } from '../../admin/citas';
import { requerirPermiso } from '../../admin/guard';
import { ELIMINAR_REGISTROS } from '../../admin/permisos';
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

  // Solo el superadmin. Es lógico: la cita sale de listados y descargas, pero los datos se conservan.
  eliminar: defineAction({
    accept: 'form',
    input: z.object({ citaId }),
    handler: protegerErrores(async ({ citaId }, ctx) => {
      const actor = requerirPermiso(ctx.locals.usuario, ELIMINAR_REGISTROS);
      if (!(await eliminarCita(citaId, actor.id))) {
        throw new ActionError({ code: 'CONFLICT', message: 'Esa cita ya estaba eliminada o no existe.' });
      }
      await registrar({ actorId: actor.id, evento: 'cita_eliminada', entidad: 'cita', entidadId: citaId });
      return { ok: true };
    }),
  }),

  restaurar: defineAction({
    accept: 'form',
    input: z.object({ citaId }),
    handler: protegerErrores(async ({ citaId }, ctx) => {
      const actor = requerirPermiso(ctx.locals.usuario, ELIMINAR_REGISTROS);
      if (!(await restaurarCita(citaId))) {
        throw new ActionError({ code: 'CONFLICT', message: 'Esa cita no está eliminada.' });
      }
      await registrar({ actorId: actor.id, evento: 'cita_restaurada', entidad: 'cita', entidadId: citaId });
      return { ok: true };
    }),
  }),
};

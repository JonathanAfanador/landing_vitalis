import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { protegerErrores } from '../../lib/acciones';
import { eq } from 'drizzle-orm';
import { registrar } from '../../admin/auditoria';
import {
  dejaSinSuperadmin,
  puedeAsignarRol,
  puedeGestionarUsuario,
  type Resultado,
} from '../../admin/autorizacion';
import { esViolacionUnica, pistaDeTrigger } from '../../admin/errores-db';
import { requerirPermiso } from '../../admin/guard';
import { rolParaAsignar } from '../../admin/roles';
import { cerrarTodasLasSesiones } from '../../admin/sesiones';
import { contarSuperadminsActivos, obtenerObjetivo } from '../../admin/usuarios';
import { dbAdmin } from '../../db/client-admin';
import { usuarios } from '../../db/schema';
import { generarClaveTemporal, hashClave } from '../../lib/clave';

const id = z.coerce.number().int().positive();

const exigir = (resultado: Resultado) => {
  if (!resultado.ok) throw new ActionError({ code: 'FORBIDDEN', message: resultado.motivo });
};

const ULTIMO_SUPERADMIN = 'Debe quedar al menos un superadmin activo.';

// Si el código no lo detectó (por ejemplo, dos cambios a la vez), el trigger de la base lo frena.
const traducirError = (error: unknown): never => {
  if (pistaDeTrigger(error) === 'ultimo_superadmin')
    throw new ActionError({ code: 'CONFLICT', message: ULTIMO_SUPERADMIN });
  throw error;
};

async function cargarObjetivo(usuarioId: number) {
  const objetivo = await obtenerObjetivo(usuarioId);
  if (!objetivo) throw new ActionError({ code: 'NOT_FOUND', message: 'El usuario no existe.' });
  return objetivo;
}

export const usuariosAdmin = {
  crear: defineAction({
    accept: 'form',
    input: z.object({
      nombre: z.string().trim().min(2, 'Escribe el nombre.').max(80),
      email: z.string().trim().toLowerCase().max(120).pipe(z.email('Revisa el correo.')),
      rolId: id,
    }),
    handler: protegerErrores(async ({ nombre, email, rolId }, ctx) => {
      const actor = requerirPermiso(ctx.locals.usuario, 'usuarios:gestionar');
      const destino = await rolParaAsignar(rolId);
      if (!destino) throw new ActionError({ code: 'BAD_REQUEST', message: 'El rol no existe.' });
      exigir(puedeAsignarRol(actor, destino));

      const claveTemporal = generarClaveTemporal();
      try {
        const [nuevo] = await dbAdmin
          .insert(usuarios)
          .values({ nombre, email, rolId, claveHash: await hashClave(claveTemporal), debeCambiarClave: true })
          .returning({ id: usuarios.id });
        if (!nuevo) throw new Error('No se pudo crear el usuario');
        await registrar({
          actorId: actor.id,
          evento: 'usuario_creado',
          entidad: 'usuario',
          entidadId: nuevo.id,
          detalle: { rol: destino.slug },
        });
      } catch (error) {
        if (esViolacionUnica(error, 'usuarios_email_unique')) {
          throw new ActionError({ code: 'CONFLICT', message: 'Ya existe un usuario con ese correo.' });
        }
        throw error;
      }
      // Se muestra una sola vez a quien lo creó; el usuario debe cambiarla al ingresar.
      return { email, claveTemporal };
    }),
  }),

  cambiarRol: defineAction({
    accept: 'form',
    input: z.object({ usuarioId: id, rolId: id }),
    handler: protegerErrores(async ({ usuarioId, rolId }, ctx) => {
      const actor = requerirPermiso(ctx.locals.usuario, 'usuarios:asignar_roles');
      const [objetivo, destino] = await Promise.all([cargarObjetivo(usuarioId), rolParaAsignar(rolId)]);
      if (!destino) throw new ActionError({ code: 'BAD_REQUEST', message: 'El rol no existe.' });
      exigir(puedeAsignarRol(actor, destino, objetivo));
      if (
        dejaSinSuperadmin(
          { rolSlug: objetivo.rol.slug, activo: objetivo.activo },
          { rolSlug: destino.slug },
          await contarSuperadminsActivos(),
        )
      ) {
        throw new ActionError({ code: 'CONFLICT', message: ULTIMO_SUPERADMIN });
      }

      await dbAdmin.update(usuarios).set({ rolId }).where(eq(usuarios.id, usuarioId)).catch(traducirError);
      // Sin cerrar sesión: los permisos se leen en cada petición, así que el cambio ya rige en la siguiente página.
      await registrar({
        actorId: actor.id,
        evento: 'rol_asignado',
        entidad: 'usuario',
        entidadId: usuarioId,
        detalle: { de: objetivo.rol.slug, a: destino.slug },
      });
      return { ok: true };
    }),
  }),

  cambiarEstado: defineAction({
    accept: 'form',
    input: z.object({ usuarioId: id, activo: z.enum(['si', 'no']).transform((v) => v === 'si') }),
    handler: protegerErrores(async ({ usuarioId, activo }, ctx) => {
      const actor = requerirPermiso(ctx.locals.usuario, 'usuarios:gestionar');
      const objetivo = await cargarObjetivo(usuarioId);
      exigir(puedeGestionarUsuario(actor, objetivo, activo ? 'reactivar' : 'desactivar'));
      if (
        !activo &&
        dejaSinSuperadmin(
          { rolSlug: objetivo.rol.slug, activo: objetivo.activo },
          { activo: false },
          await contarSuperadminsActivos(),
        )
      ) {
        throw new ActionError({ code: 'CONFLICT', message: ULTIMO_SUPERADMIN });
      }

      await dbAdmin.update(usuarios).set({ activo }).where(eq(usuarios.id, usuarioId)).catch(traducirError);
      if (!activo) await cerrarTodasLasSesiones(usuarioId);
      await registrar({
        actorId: actor.id,
        evento: activo ? 'usuario_reactivado' : 'usuario_desactivado',
        entidad: 'usuario',
        entidadId: usuarioId,
      });
      return { ok: true };
    }),
  }),

  restablecerClave: defineAction({
    accept: 'form',
    input: z.object({ usuarioId: id }),
    handler: protegerErrores(async ({ usuarioId }, ctx) => {
      const actor = requerirPermiso(ctx.locals.usuario, 'usuarios:gestionar');
      const objetivo = await cargarObjetivo(usuarioId);
      exigir(puedeGestionarUsuario(actor, objetivo, 'restablecer'));

      const claveTemporal = generarClaveTemporal();
      await dbAdmin
        .update(usuarios)
        .set({ claveHash: await hashClave(claveTemporal), debeCambiarClave: true })
        .where(eq(usuarios.id, usuarioId));
      await cerrarTodasLasSesiones(usuarioId);
      await registrar({
        actorId: actor.id,
        evento: 'clave_restablecida',
        entidad: 'usuario',
        entidadId: usuarioId,
      });
      return { email: objetivo.email, claveTemporal };
    }),
  }),
};

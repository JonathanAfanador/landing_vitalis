import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { protegerErrores } from '../../lib/acciones';
import { eq } from 'drizzle-orm';
import { registrar } from '../../admin/auditoria';
import { normalizarPermisos } from '../../admin/autorizacion';
import { esViolacionUnica, pistaDeTrigger } from '../../admin/errores-db';
import { requerirPermiso } from '../../admin/guard';
import { GESTIONAR_ROLES } from '../../admin/permisos';
import { contarUsuariosDelRol, crearRol, fijarPermisos, obtenerRol } from '../../admin/roles';
import { dbAdmin } from '../../db/client-admin';
import { roles } from '../../db/schema';

const id = z.coerce.number().int().positive();

// Astro decide cómo leer cada campo del formulario mirando el esquema: `.default()` u `.optional()` deben ir
// por fuera para que reconozca la lista de permisos (getAll) y los campos vacíos. Sin ningún permiso
// marcado llega []; con uno solo, también una lista.
const datosRol = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre del rol.').max(60),
  descripcion: z.string().trim().max(300).optional(),
  permisos: z.array(z.string().max(60)).max(100).default([]),
});

const NOMBRE_REPETIDO = new ActionError({ code: 'CONFLICT', message: 'Ya existe un rol con ese nombre.' });

async function cargarEditable(rolId: number) {
  const rol = await obtenerRol(rolId);
  if (!rol) throw new ActionError({ code: 'NOT_FOUND', message: 'El rol no existe.' });
  if (rol.slug === 'superadmin') {
    throw new ActionError({ code: 'FORBIDDEN', message: 'El rol superadmin no se puede modificar.' });
  }
  return rol;
}

// Solo el superadmin gestiona roles: `roles:gestionar` no se puede asignar a ningún rol.
export const rolesAdmin = {
  crear: defineAction({
    accept: 'form',
    input: datosRol,
    handler: protegerErrores(async (datos, ctx) => {
      const actor = requerirPermiso(ctx.locals.usuario, GESTIONAR_ROLES);
      const codigos = normalizarPermisos(datos.permisos);
      try {
        const rol = await dbAdmin.transaction(async (tx) => {
          const nuevo = await crearRol(tx, { nombre: datos.nombre, descripcion: datos.descripcion || null });
          await fijarPermisos(tx, nuevo.id, codigos);
          await registrar(
            {
              actorId: actor.id,
              evento: 'rol_creado',
              entidad: 'rol',
              entidadId: nuevo.id,
              detalle: { permisos: codigos },
            },
            tx,
          );
          return nuevo;
        });
        return { id: rol.id };
      } catch (error) {
        if (esViolacionUnica(error, 'roles_nombre_unique')) throw NOMBRE_REPETIDO;
        throw error;
      }
    }),
  }),

  editar: defineAction({
    accept: 'form',
    input: datosRol.extend({ rolId: id }),
    handler: protegerErrores(async ({ rolId, ...datos }, ctx) => {
      const actor = requerirPermiso(ctx.locals.usuario, GESTIONAR_ROLES);
      const rol = await cargarEditable(rolId);
      const codigos = normalizarPermisos(datos.permisos);
      try {
        await dbAdmin.transaction(async (tx) => {
          // En los roles de sistema (admin, usuario) solo cambian la descripción y los permisos.
          await tx
            .update(roles)
            .set({
              nombre: rol.esSistema ? rol.nombre : datos.nombre,
              descripcion: datos.descripcion || null,
            })
            .where(eq(roles.id, rolId));
          const cambios = await fijarPermisos(tx, rolId, codigos);
          await registrar({ actorId: actor.id, evento: 'rol_editado', entidad: 'rol', entidadId: rolId }, tx);
          if (cambios.anadidos.length || cambios.quitados.length) {
            await registrar(
              {
                actorId: actor.id,
                evento: 'permisos_rol_cambiados',
                entidad: 'rol',
                entidadId: rolId,
                detalle: cambios,
              },
              tx,
            );
          }
        });
      } catch (error) {
        if (esViolacionUnica(error, 'roles_nombre_unique')) throw NOMBRE_REPETIDO;
        throw error;
      }
      return { id: rolId };
    }),
  }),

  duplicar: defineAction({
    accept: 'form',
    input: z.object({ rolId: id }),
    handler: protegerErrores(async ({ rolId }, ctx) => {
      const actor = requerirPermiso(ctx.locals.usuario, GESTIONAR_ROLES);
      const original = await cargarEditable(rolId);
      const nombre = `Copia de ${original.nombre}`.slice(0, 60);
      try {
        const rol = await dbAdmin.transaction(async (tx) => {
          const nuevo = await crearRol(tx, { nombre, descripcion: original.descripcion });
          await fijarPermisos(tx, nuevo.id, original.permisos);
          await registrar(
            {
              actorId: actor.id,
              evento: 'rol_creado',
              entidad: 'rol',
              entidadId: nuevo.id,
              detalle: { duplicadoDe: rolId, permisos: original.permisos },
            },
            tx,
          );
          return nuevo;
        });
        return { id: rol.id };
      } catch (error) {
        if (esViolacionUnica(error, 'roles_nombre_unique')) {
          throw new ActionError({
            code: 'CONFLICT',
            message: `Ya existe "${nombre}". Renómbralo antes de duplicar otra vez.`,
          });
        }
        throw error;
      }
    }),
  }),

  eliminar: defineAction({
    accept: 'form',
    input: z.object({ rolId: id }),
    handler: protegerErrores(async ({ rolId }, ctx) => {
      const actor = requerirPermiso(ctx.locals.usuario, GESTIONAR_ROLES);
      const rol = await cargarEditable(rolId);
      if (rol.esSistema)
        throw new ActionError({ code: 'FORBIDDEN', message: 'Los roles de sistema no se pueden eliminar.' });
      const asignados = await contarUsuariosDelRol(rolId);
      if (asignados) {
        throw new ActionError({
          code: 'CONFLICT',
          message: `Hay ${asignados} ${asignados === 1 ? 'usuario' : 'usuarios'} con este rol. Asígnales otro antes de eliminarlo.`,
        });
      }
      try {
        await dbAdmin.transaction(async (tx) => {
          await tx.delete(roles).where(eq(roles.id, rolId));
          await registrar(
            {
              actorId: actor.id,
              evento: 'rol_eliminado',
              entidad: 'rol',
              entidadId: rolId,
              detalle: { slug: rol.slug },
            },
            tx,
          );
        });
      } catch (error) {
        // Entre la comprobación y el borrado alguien asignó el rol: la FK RESTRICT lo frena.
        if (
          pistaDeTrigger(error) ||
          (error instanceof Error && (error.cause as { code?: string })?.code === '23503')
        ) {
          throw new ActionError({ code: 'CONFLICT', message: 'El rol ya tiene usuarios asignados.' });
        }
        throw error;
      }
      return { ok: true };
    }),
  }),
};

import { ActionError, defineAction, type ActionAPIContext } from 'astro:actions';
import { z } from 'astro/zod';
import { registrar } from '../admin/auditoria';
import { can, esCliente, type UsuarioSesion } from '../admin/autorizacion';
import {
  claveCorrecta,
  CorreoEnUso,
  crearCuentaCliente,
  cuentasRecientesPorIp,
  eliminarCuentaCliente,
} from '../admin/cuentas';
import { cambiarClavePropia, intentarLogin } from '../admin/login';
import type { CodigoPermiso } from '../admin/permisos';
import { COOKIE_SESION, cerrarSesion, crearSesion } from '../admin/sesiones';
import { actualizarMiPerfil, cancelarMiCita, pedidosEnCurso } from '../cuenta/datos';
import { protegerErrores } from '../lib/acciones';
import { CLAVE_MAX, validarClaveNueva } from '../lib/clave';
import { hashIp } from '../lib/ip';
import { datosPerfilSchema, datosRegistroSchema, destinoSeguro } from '../lib/validacion';

const MAX_CUENTAS_POR_IP = 5;
const clave = (mensaje: string) => z.string({ error: mensaje }).min(1, mensaje).max(CLAVE_MAX);

// Cada Action del portal exige sesión de cliente y su permiso. Lo propio lo garantiza además RLS en la base.
function requerirCliente(usuario: UsuarioSesion | null, permiso: CodigoPermiso): UsuarioSesion {
  if (!usuario)
    throw new ActionError({ code: 'UNAUTHORIZED', message: 'Tu sesión terminó. Vuelve a ingresar.' });
  if (!esCliente(usuario) || !can(usuario, permiso)) {
    throw new ActionError({ code: 'FORBIDDEN', message: 'Tu cuenta no permite hacer esto.' });
  }
  return usuario;
}

export const cuenta = {
  registrar: defineAction({
    accept: 'form',
    input: datosRegistroSchema,
    handler: protegerErrores(async (datos, ctx) => {
      if (datos.sitioWeb)
        throw new ActionError({ code: 'BAD_REQUEST', message: 'No se pudo crear la cuenta.' });
      const problema =
        validarClaveNueva(datos.clave, datos.email) ??
        (datos.clave !== datos.confirmacion ? 'Las contraseñas no coinciden.' : null);
      if (problema) throw new ActionError({ code: 'BAD_REQUEST', message: problema });

      const ipHash = hashIp(ctx.clientAddress);
      if ((await cuentasRecientesPorIp(ipHash)) >= MAX_CUENTAS_POR_IP) {
        throw new ActionError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Se crearon varias cuentas desde esta conexión. Inténtalo más tarde.',
        });
      }

      try {
        const id = await crearCuentaCliente(datos);
        await crearSesion(id, ctx.cookies);
        await registrar({ actorId: id, evento: 'cuenta_creada', entidad: 'usuario', entidadId: id, ipHash });
        return { destino: destinoSeguro(datos.volver) };
      } catch (error) {
        if (!(error instanceof CorreoEnUso)) throw error;
        throw new ActionError({
          code: 'CONFLICT',
          message:
            'Ese correo ya tiene una cuenta. Ingresa con él; si olvidaste la contraseña, escríbenos por WhatsApp.',
        });
      }
    }),
  }),

  ingresar: defineAction({
    accept: 'form',
    input: z.object({
      email: z.string().trim().min(1, 'Escribe tu correo.').max(120),
      clave: clave('Escribe tu contraseña.'),
      volver: z.string().max(200).nullish(),
    }),
    handler: protegerErrores(async ({ email, clave, volver }, ctx) => {
      if (!(await intentarLogin(email, clave, ctx.clientAddress, ctx.cookies))) {
        throw new ActionError({ code: 'UNAUTHORIZED', message: 'Correo o contraseña incorrectos.' });
      }
      return { destino: destinoSeguro(volver) };
    }),
  }),

  salir: defineAction({
    accept: 'form',
    handler: protegerErrores(async (_: unknown, ctx: ActionAPIContext) => {
      const usuario = ctx.locals.usuario;
      await cerrarSesion(ctx.cookies.get(COOKIE_SESION)?.value, ctx.cookies);
      if (usuario)
        await registrar({ actorId: usuario.id, evento: 'logout', ipHash: hashIp(ctx.clientAddress) });
      return { ok: true };
    }),
  }),

  actualizarPerfil: defineAction({
    accept: 'form',
    input: datosPerfilSchema,
    handler: protegerErrores(async (datos, ctx) => {
      const usuario = requerirCliente(ctx.locals.usuario, 'cuenta:editar_perfil');
      if (!(await actualizarMiPerfil(usuario.id, datos))) {
        throw new ActionError({ code: 'NOT_FOUND', message: 'No encontramos tu cuenta.' });
      }
      return { ok: true };
    }),
  }),

  cambiarClave: defineAction({
    accept: 'form',
    input: z.object({
      actual: clave('Escribe tu contraseña actual.'),
      nueva: z.string().max(CLAVE_MAX),
      confirmacion: z.string().max(CLAVE_MAX),
    }),
    handler: protegerErrores(async (claves, ctx) => {
      const usuario = requerirCliente(ctx.locals.usuario, 'cuenta:editar_perfil');
      const problema = await cambiarClavePropia(usuario, claves, ctx.cookies);
      if (problema) throw new ActionError({ code: 'BAD_REQUEST', message: problema });
      return { ok: true };
    }),
  }),

  cancelarCita: defineAction({
    accept: 'form',
    input: z.object({ citaId: z.coerce.number().int().positive() }),
    handler: protegerErrores(async ({ citaId }, ctx) => {
      const usuario = requerirCliente(ctx.locals.usuario, 'cuenta:cancelar_cita');
      if (!(await cancelarMiCita(usuario.id, citaId))) {
        throw new ActionError({
          code: 'CONFLICT',
          message: 'Esa cita ya no se puede cancelar. Recarga para ver su estado.',
        });
      }
      await registrar({
        actorId: usuario.id,
        evento: 'cita_estado_cambiado',
        entidad: 'cita',
        entidadId: citaId,
        detalle: { a: 'cancelada', por: 'cliente' },
      });
      return { ok: true };
    }),
  }),

  // Derecho de supresión (Ley 1581): pide la contraseña y que no haya pedidos en curso.
  eliminar: defineAction({
    accept: 'form',
    input: z.object({
      clave: clave('Escribe tu contraseña para confirmar.'),
      entiendo: z.boolean().refine((v) => v, 'Marca la casilla para confirmar.'),
    }),
    handler: protegerErrores(async ({ clave }, ctx) => {
      const usuario = requerirCliente(ctx.locals.usuario, 'cuenta:eliminar');
      if (!(await claveCorrecta(usuario.id, clave))) {
        throw new ActionError({ code: 'BAD_REQUEST', message: 'La contraseña no es correcta.' });
      }
      if ((await pedidosEnCurso(usuario.id)) > 0) {
        throw new ActionError({
          code: 'CONFLICT',
          message:
            'Tienes pedidos en curso. Cuando los recojas, o si la clínica los cancela, podrás eliminar tu cuenta.',
        });
      }
      await eliminarCuentaCliente(usuario.id);
      ctx.cookies.delete(COOKIE_SESION, { path: '/' });
      await registrar({
        actorId: usuario.id,
        evento: 'cuenta_eliminada',
        entidad: 'usuario',
        entidadId: usuario.id,
      });
      return { ok: true };
    }),
  }),
};

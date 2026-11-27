import { ActionError, defineAction, type ActionAPIContext } from 'astro:actions';
import { z } from 'astro/zod';
import { protegerErrores } from '../../lib/acciones';
import { registrar } from '../../admin/auditoria';
import { cambiarClavePropia, intentarLogin } from '../../admin/login';
import { COOKIE_SESION, cerrarSesion } from '../../admin/sesiones';
import { CLAVE_MAX } from '../../lib/clave';
import { hashIp } from '../../lib/ip';

export const auth = {
  ingresar: defineAction({
    accept: 'form',
    input: z.object({
      email: z.string().trim().min(1, 'Escribe tu correo.').max(120),
      clave: z.string().min(1, 'Escribe tu contraseña.').max(CLAVE_MAX),
    }),
    handler: protegerErrores(async ({ email, clave }, ctx) => {
      if (!(await intentarLogin(email, clave, ctx.clientAddress, ctx.cookies))) {
        throw new ActionError({ code: 'UNAUTHORIZED', message: 'Correo o contraseña incorrectos.' });
      }
      return { ok: true };
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

  cambiarClave: defineAction({
    accept: 'form',
    input: z.object({
      actual: z.string().min(1, 'Escribe tu contraseña actual.').max(CLAVE_MAX),
      nueva: z.string().max(CLAVE_MAX),
      confirmacion: z.string().max(CLAVE_MAX),
    }),
    handler: protegerErrores(async (claves, ctx) => {
      const usuario = ctx.locals.usuario;
      if (!usuario)
        throw new ActionError({ code: 'UNAUTHORIZED', message: 'Tu sesión terminó. Vuelve a ingresar.' });
      const problema = await cambiarClavePropia(usuario, claves, ctx.cookies);
      if (problema) throw new ActionError({ code: 'BAD_REQUEST', message: problema });
      return { ok: true };
    }),
  }),
};

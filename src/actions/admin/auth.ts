import { ActionError, defineAction, type ActionAPIContext } from 'astro:actions';
import { z } from 'astro/zod';
import { protegerErrores } from '../../lib/acciones';
import { eq } from 'drizzle-orm';
import { registrar } from '../../admin/auditoria';
import { intentarLogin } from '../../admin/login';
import { COOKIE_SESION, cerrarSesion, cerrarTodasLasSesiones, crearSesion } from '../../admin/sesiones';
import { dbAdmin } from '../../db/client-admin';
import { usuarios } from '../../db/schema';
import { CLAVE_MAX, hashClave, validarClaveNueva, verificarClave } from '../../lib/clave';
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
    handler: protegerErrores(async ({ actual, nueva, confirmacion }, ctx) => {
      const usuario = ctx.locals.usuario;
      if (!usuario)
        throw new ActionError({ code: 'UNAUTHORIZED', message: 'Tu sesión terminó. Vuelve a ingresar.' });

      const problema =
        validarClaveNueva(nueva, usuario.email) ??
        (nueva !== confirmacion ? 'Las contraseñas nuevas no coinciden.' : null) ??
        (nueva === actual ? 'La contraseña nueva debe ser distinta de la actual.' : null);
      if (problema) throw new ActionError({ code: 'BAD_REQUEST', message: problema });

      const [fila] = await dbAdmin
        .select({ claveHash: usuarios.claveHash })
        .from(usuarios)
        .where(eq(usuarios.id, usuario.id));
      if (!fila || !(await verificarClave(actual, fila.claveHash)).valida) {
        throw new ActionError({ code: 'BAD_REQUEST', message: 'La contraseña actual no es correcta.' });
      }

      await dbAdmin
        .update(usuarios)
        .set({ claveHash: await hashClave(nueva), debeCambiarClave: false })
        .where(eq(usuarios.id, usuario.id));
      // Fuera cualquier otra sesión abierta con la contraseña anterior; esta se renueva.
      await cerrarTodasLasSesiones(usuario.id);
      await crearSesion(usuario.id, ctx.cookies);
      await registrar({
        actorId: usuario.id,
        evento: 'clave_cambiada',
        entidad: 'usuario',
        entidadId: usuario.id,
      });
      return { ok: true };
    }),
  }),
};

import { ActionError, defineAction } from 'astro:actions';
import { auth } from './admin/auth';
import { catalogoAdmin } from './admin/catalogo';
import { pedidosAdmin } from './admin/pedidos';
import { rolesAdmin } from './admin/roles';
import { usuariosAdmin } from './admin/usuarios';
import { z } from 'astro/zod';
import { protegerErrores } from '../lib/acciones';
import { medicamentosParaPedido } from '../db/queries/medicamentos';
import { crearPedido, PedidoRechazado, pedidosRecientes } from '../db/queries/pedidos';
import { cantidadDe, fijarCantidad, MAX_CANTIDAD, totalUnidades } from '../lib/carrito';
import { guardarCarrito, leerCarrito, vaciarCarrito } from '../lib/carrito-cookies';
import { hashIp } from '../lib/ip';
import { datosPedidoSchema, SLUG } from '../lib/validacion';

const MAX_PEDIDOS_POR_IP = 5;
const slug = z.string().max(140).regex(SLUG);
const cantidad = (minimo: number) => z.coerce.number().int().min(minimo).max(MAX_CANTIDAD);

export const server = {
  // Panel: cada Action exige sesión y permiso en el servidor (src/admin/guard.ts).
  admin: { auth, usuarios: usuariosAdmin, roles: rolesAdmin, ...catalogoAdmin, pedidos: pedidosAdmin },

  // El carrito vive en una cookie HttpOnly. Son formularios: funcionan también sin JavaScript.
  carrito: {
    agregar: defineAction({
      accept: 'form',
      input: z.object({ slug, cantidad: cantidad(1).default(1) }),
      handler: protegerErrores(async (entrada, ctx) => {
        const [medicamento] = await medicamentosParaPedido([entrada.slug]);
        if (!medicamento?.activo) {
          throw new ActionError({ code: 'NOT_FOUND', message: 'Ese medicamento ya no está disponible.' });
        }
        if (medicamento.stock < 1)
          throw new ActionError({ code: 'CONFLICT', message: `${medicamento.nombre} está agotado.` });
        const items = leerCarrito(ctx.cookies);
        const pedida = cantidadDe(items, entrada.slug) + entrada.cantidad;
        // Nunca más de lo que hay: el pedido vuelve a comprobarlo, pero así se avisa desde ya.
        const nueva = Math.min(pedida, medicamento.stock);
        const actualizados = fijarCantidad(items, entrada.slug, nueva);
        guardarCarrito(ctx.cookies, actualizados);
        return {
          nombre: medicamento.nombre,
          unidades: totalUnidades(actualizados),
          limitadoPorStock: nueva < pedida,
        };
      }),
    }),

    // Fija la cantidad de un medicamento del carrito; 0 lo quita.
    cambiar: defineAction({
      accept: 'form',
      input: z.object({ slug, cantidad: cantidad(0) }),
      handler: protegerErrores(async (entrada, ctx) => {
        const actualizados = fijarCantidad(leerCarrito(ctx.cookies), entrada.slug, entrada.cantidad);
        guardarCarrito(ctx.cookies, actualizados);
        return { unidades: totalUnidades(actualizados) };
      }),
    }),
  },

  pedidos: {
    crear: defineAction({
      accept: 'form',
      input: datosPedidoSchema,
      handler: protegerErrores(async (datos, ctx) => {
        if (datos.sitioWeb)
          throw new ActionError({ code: 'BAD_REQUEST', message: 'No se pudo enviar el pedido.' });
        const items = leerCarrito(ctx.cookies);
        if (!items.length) throw new ActionError({ code: 'BAD_REQUEST', message: 'Tu pedido está vacío.' });

        const ipHash = hashIp(ctx.clientAddress);
        if ((await pedidosRecientes(ipHash)) >= MAX_PEDIDOS_POR_IP) {
          throw new ActionError({
            code: 'TOO_MANY_REQUESTS',
            message: 'Hiciste varios pedidos seguidos. Espera unos minutos o escríbenos por WhatsApp.',
          });
        }

        try {
          const pedido = await crearPedido(
            {
              nombre: datos.nombre,
              telefono: datos.telefono,
              email: datos.email ?? null,
              notas: datos.notas || null,
              declaraFormula: datos.declaraFormula,
              aceptaDatos: datos.aceptaDatos,
              items,
            },
            ipHash,
          );
          vaciarCarrito(ctx.cookies);
          return pedido;
        } catch (error) {
          if (!(error instanceof PedidoRechazado)) throw error;
          throw new ActionError({
            code: 'CONFLICT',
            message:
              error.motivo === 'falta-formula'
                ? 'Tu pedido incluye medicamentos con fórmula médica veterinaria. Confirma que la tienes.'
                : 'Algunos medicamentos ya no están disponibles en la cantidad que pediste. Revisa tu pedido.',
          });
        }
      }),
    }),
  },
};

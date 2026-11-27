import { ActionError, defineAction } from 'astro:actions';
import { auth } from './admin/auth';
import { catalogoAdmin } from './admin/catalogo';
import { citasAdmin } from './admin/citas';
import { clientesAdmin } from './admin/clientes';
import { pedidosAdmin } from './admin/pedidos';
import { rolesAdmin } from './admin/roles';
import { usuariosAdmin } from './admin/usuarios';
import { esCliente } from '../admin/autorizacion';
import { cuenta } from './cuenta';
import { z } from 'astro/zod';
import { protegerErrores } from '../lib/acciones';
import { citasRecientes, crearCita } from '../db/queries/citas';
import { medicamentosParaPedido } from '../db/queries/medicamentos';
import { crearPedido, PedidoRechazado, pedidosRecientes } from '../db/queries/pedidos';
import { cantidadDe, fijarCantidad, MAX_CANTIDAD, totalUnidades } from '../lib/carrito';
import { guardarCarrito, leerCarrito, vaciarCarrito } from '../lib/carrito-cookies';
import { hashIp } from '../lib/ip';
import { datosCitaSchema, datosPedidoSchema, SLUG } from '../lib/validacion';

const MAX_PEDIDOS_POR_IP = 5;
const MAX_CITAS_POR_IP = 3;
// La cuenta a la que se liga un pedido o una cita: solo clientes; el personal de la clínica no.
const cuentaDe = (usuario: App.Locals['usuario']) => (usuario && esCliente(usuario) ? usuario.id : null);
const slug = z.string().max(140).regex(SLUG);
const cantidad = (minimo: number) => z.coerce.number().int().min(minimo).max(MAX_CANTIDAD);

export const server = {
  // Panel: cada Action exige sesión y permiso en el servidor (src/admin/guard.ts).
  admin: {
    auth,
    usuarios: usuariosAdmin,
    roles: rolesAdmin,
    ...catalogoAdmin,
    pedidos: pedidosAdmin,
    citas: citasAdmin,
    clientes: clientesAdmin,
  },

  // Portal de clientes (/cuenta).
  cuenta,

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
        // Pedir exige cuenta de cliente: así cada pedido queda con un cliente identificado y su historial.
        const usuario = ctx.locals.usuario;
        if (!usuario || !esCliente(usuario)) {
          throw new ActionError({
            code: 'UNAUTHORIZED',
            message: 'Ingresa o crea tu cuenta para enviar el pedido.',
          });
        }
        if (!usuario.telefono) {
          throw new ActionError({
            code: 'BAD_REQUEST',
            message: 'Agrega tu celular en Mi perfil para que podamos confirmarte el pedido.',
          });
        }
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
              nombre: usuario.nombre,
              telefono: usuario.telefono,
              email: usuario.email,
              notas: datos.notas || null,
              declaraFormula: datos.declaraFormula,
              // La autorización de datos la dio al crear la cuenta (queda la fecha en usuarios).
              aceptaDatos: true,
              items,
            },
            ipHash,
            usuario.id,
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

  // La solicitud queda guardada para el panel y el tutor la envía por WhatsApp, donde se acuerda el horario.
  citas: {
    solicitar: defineAction({
      accept: 'form',
      input: datosCitaSchema,
      handler: protegerErrores(async (datos, ctx) => {
        if (datos.sitioWeb)
          throw new ActionError({ code: 'BAD_REQUEST', message: 'No se pudo enviar la solicitud.' });

        const ipHash = hashIp(ctx.clientAddress);
        if ((await citasRecientes(ipHash)) >= MAX_CITAS_POR_IP) {
          throw new ActionError({
            code: 'TOO_MANY_REQUESTS',
            message: 'Enviaste varias solicitudes seguidas. Espera unos minutos o escríbenos por WhatsApp.',
          });
        }

        const cita = await crearCita(datos, ipHash, cuentaDe(ctx.locals.usuario));
        if (!cita) {
          throw new ActionError({ code: 'BAD_REQUEST', message: 'Elige qué tipo de mascota es.' });
        }
        return cita;
      }),
    }),
  },
};

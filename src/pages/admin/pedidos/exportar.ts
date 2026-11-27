import type { APIRoute } from 'astro';
import { registrar } from '../../../admin/auditoria';
import { can } from '../../../admin/autorizacion';
import { respuestaExcel, textoFechaHora } from '../../../admin/exportar';
import { leerFiltroPedidos, pedidosParaExportar } from '../../../admin/pedidos';
import { ELIMINAR_REGISTROS } from '../../../admin/permisos';
import { NOMBRE_ESTADO_PEDIDO } from '../../../lib/estados';

export const prerender = false;

// Descarga en Excel del listado de pedidos con el filtro de la página. Son datos personales (Ley 1581):
// exige su propio permiso y cada descarga queda en la auditoría.
export const GET: APIRoute = async ({ locals, url }) => {
  const usuario = locals.usuario;
  if (!usuario || !can(usuario, 'pedidos:exportar')) return new Response('No autorizado', { status: 403 });

  const filtro = leerFiltroPedidos(url.searchParams.get('estado'), can(usuario, ELIMINAR_REGISTROS));
  const pedidos = await pedidosParaExportar(filtro);
  await registrar({
    actorId: usuario.id,
    evento: 'pedidos_exportados',
    entidad: 'pedido',
    detalle: { filtro: filtro ?? 'todos', filas: pedidos.length },
  });

  return respuestaExcel(
    'pedidos',
    [
      { titulo: 'Código', ancho: 14 },
      { titulo: 'Fecha', ancho: 18 },
      { titulo: 'Estado', ancho: 12 },
      { titulo: 'Cliente', ancho: 24 },
      { titulo: 'Celular', ancho: 14 },
      { titulo: 'Correo', ancho: 26 },
      { titulo: 'Total (COP)', ancho: 13, pesos: true },
      { titulo: 'Medicamentos', ancho: 50 },
      { titulo: 'Tiene fórmula', ancho: 13 },
      { titulo: 'Notas', ancho: 40 },
    ],
    pedidos.map((p) => [
      p.codigo,
      textoFechaHora(p.fecha),
      NOMBRE_ESTADO_PEDIDO[p.estado],
      p.cliente,
      p.telefono,
      p.email,
      p.totalCop,
      p.medicamentos,
      p.declaraFormula ? 'Sí' : 'No',
      p.notas,
    ]),
  );
};

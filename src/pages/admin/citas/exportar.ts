import type { APIRoute } from 'astro';
import { registrar } from '../../../admin/auditoria';
import { can } from '../../../admin/autorizacion';
import { citasParaExportar, leerFiltroCitas } from '../../../admin/citas';
import { respuestaExcel, textoFechaHora } from '../../../admin/exportar';
import { ELIMINAR_REGISTROS } from '../../../admin/permisos';
import { NOMBRE_ESTADO_CITA } from '../../../lib/estados';
import { nombreEspecie } from '../../../lib/formato';
import { preferenciaCita } from '../../../lib/whatsapp';

export const prerender = false;

const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

// Descarga en Excel del listado de citas con el filtro de la página. Son datos personales (Ley 1581):
// exige su propio permiso y cada descarga queda en la auditoría.
export const GET: APIRoute = async ({ locals, url }) => {
  const usuario = locals.usuario;
  if (!usuario || !can(usuario, 'citas:exportar')) return new Response('No autorizado', { status: 403 });

  const filtro = leerFiltroCitas(url.searchParams.get('estado'), can(usuario, ELIMINAR_REGISTROS));
  const citas = await citasParaExportar(filtro);
  await registrar({
    actorId: usuario.id,
    evento: 'citas_exportadas',
    entidad: 'cita',
    detalle: { filtro: filtro ?? 'todas', filas: citas.length },
  });

  return respuestaExcel(
    'citas',
    [
      { titulo: 'Código', ancho: 14 },
      { titulo: 'Recibida', ancho: 18 },
      { titulo: 'Estado', ancho: 13 },
      { titulo: 'Tutor', ancho: 24 },
      { titulo: 'Celular', ancho: 14 },
      { titulo: 'Tipo de mascota', ancho: 15 },
      { titulo: 'Mascota', ancho: 16 },
      { titulo: 'Motivo', ancho: 48 },
      { titulo: 'Prefiere', ancho: 34 },
      { titulo: 'Notas internas', ancho: 48 },
    ],
    citas.map((c) => [
      c.codigo,
      textoFechaHora(c.fecha),
      NOMBRE_ESTADO_CITA[c.estado],
      c.tutor,
      c.telefono,
      nombreEspecie(c.especie),
      c.mascota,
      c.motivo,
      mayuscula(preferenciaCita(c.fechaPreferida, c.franja)),
      c.notas,
    ]),
  );
};

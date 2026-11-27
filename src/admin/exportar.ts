import { crearXlsx, type Celda, type Columna } from '../lib/xlsx';

// Tope de filas por descarga: suficiente para años de una clínica y evita agotar la función del servidor.
export const MAX_FILAS_EXPORTACION = 10_000;

// 26/11/2026, 8:49 p. m.
const fechaHora = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Bogota',
});
export const textoFechaHora = (fecha: Date) => fechaHora.format(fecha);

const hoyEnBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

// Descarga privada: nunca en caché y con la fecha en el nombre, p. ej. citas-vitalis-2026-11-27.xlsx.
export function respuestaExcel(base: string, columnas: Columna[], filas: Celda[][]) {
  const archivo = crearXlsx(base.charAt(0).toUpperCase() + base.slice(1), columnas, filas);
  return new Response(new Uint8Array(archivo), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${base}-vitalis-${hoyEnBogota()}.xlsx"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

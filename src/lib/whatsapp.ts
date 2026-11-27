import { formatoCOP, formatoFecha } from './formato';

// Sirve en el servidor y en el navegador: no importa el archivo de contenido, el número llega como parámetro.
export const enlaceWhatsApp = (numero: string | null, mensaje: string) =>
  numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}` : null;

type Resumen = {
  codigo: string;
  totalCop: number;
  lineas: { nombre: string; cantidad: number }[];
};

export const mensajePedido = ({ codigo, totalCop, lineas }: Resumen) =>
  [
    `Hola, acabo de hacer el pedido ${codigo} en la web de Vitalis:`,
    ...lineas.map((l) => `• ${l.cantidad} × ${l.nombre}`),
    `Total: ${formatoCOP(totalCop)}`,
    'Quedo pendiente de la confirmación.',
  ].join('\n');

type ResumenCita = {
  codigo: string;
  mascota: string;
  especie: string;
  motivo: string;
  fecha: string | null;
  franja: 'manana' | 'tarde' | null;
};

const NOMBRE_FRANJA = { manana: 'en la mañana', tarde: 'en la tarde' } as const;

export const preferenciaCita = (fecha: string | null, franja: ResumenCita['franja']) =>
  [fecha && formatoFecha(fecha), franja && NOMBRE_FRANJA[franja]].filter(Boolean).join(', ') ||
  'Sin preferencia';

export const mensajeCita = ({ codigo, mascota, especie, motivo, fecha, franja }: ResumenCita) =>
  [
    `Hola, acabo de solicitar la cita ${codigo} en la web de Vitalis.`,
    `Mascota: ${mascota} (${especie})`,
    `Motivo: ${motivo}`,
    `Preferencia: ${preferenciaCita(fecha, franja)}`,
    'Quedo pendiente para acordar el horario.',
  ].join('\n');

import { formatoCOP, formatoFecha, formatoTelefono } from './formato';

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
  nombre: string;
  telefono: string;
  mascota: string;
  motivo: string;
  fecha: string | null;
  franja: 'manana' | 'tarde' | null;
};

const NOMBRE_FRANJA = { manana: 'en la mañana', tarde: 'en la tarde' } as const;

// Para el panel: "miércoles, 2 de diciembre, en la tarde" o "Sin preferencia".
export const preferenciaCita = (fecha: string | null, franja: ResumenCita['franja']) =>
  [fecha && formatoFecha(fecha), franja && NOMBRE_FRANJA[franja]].filter(Boolean).join(', ') ||
  'Sin preferencia';

// Lo escribe el tutor, en primera persona: la web no reserva nada, solo le deja el mensaje listo para pedir
// la cita. El código va al final para que la clínica encuentre la solicitud en el panel.
export const mensajeCita = (c: ResumenCita) => {
  const cuando = [c.fecha && `el ${formatoFecha(c.fecha)}`, c.franja && NOMBRE_FRANJA[c.franja]]
    .filter(Boolean)
    .join(', ');
  return [
    `Hola, soy ${c.nombre}, mi número es ${formatoTelefono(c.telefono)}.`,
    `Mi mascota se llama ${c.mascota}. Lo que le pasa: ${c.motivo}`,
    ...(cuando ? [`Si es posible, me queda mejor ${cuando}.`] : []),
    'Deseo agendar una cita de valoración.',
    `(Código de la web: ${c.codigo})`,
  ].join('\n');
};

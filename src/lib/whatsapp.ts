import { formatoCOP } from './formato';

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

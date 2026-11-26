import { z } from 'astro/zod';
import { normalizarTelefono } from './formato';

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Celular (3XX) o fijo nacional (60X), 10 dígitos.
const TELEFONO = /^(3\d{9}|60\d{8})$/;

// Datos del formulario de pedido. Los medicamentos no vienen del formulario: salen de la cookie del carrito.
// Astro entrega los campos vacíos como null/undefined, por eso los opcionales usan .nullish() por fuera y
// los obligatorios llevan su mensaje para cuando no llegan.
const requerido = (mensaje: string) => z.string({ error: mensaje }).trim();

export const datosPedidoSchema = z.object({
  nombre: requerido('Escribe tu nombre.')
    .min(2, 'Escribe tu nombre.')
    .max(80, 'El nombre es demasiado largo.'),
  telefono: z
    .string({ error: 'Escribe tu teléfono.' })
    .transform(normalizarTelefono)
    .pipe(
      z.string().regex(TELEFONO, 'Escribe un número colombiano de 10 dígitos, por ejemplo 300 123 4567.'),
    ),
  email: z.email('Revisa el correo, parece incompleto.').max(120).nullish(),
  notas: z.string().trim().max(500, 'Las notas pueden tener hasta 500 caracteres.').nullish(),
  declaraFormula: z.boolean().default(false),
  aceptaDatos: z.boolean().refine((v) => v, 'Necesitamos tu autorización para tratar tus datos.'),
  // Campo trampa: las personas no lo ven; si llega con texto, es un bot.
  sitioWeb: z.string().max(0).optional(),
});

export type ItemCarrito = { slug: string; cantidad: number };
export type DatosFormularioPedido = z.output<typeof datosPedidoSchema>;
export type DatosPedido = Omit<DatosFormularioPedido, 'email' | 'notas' | 'sitioWeb'> & {
  email: string | null;
  notas: string | null;
  items: ItemCarrito[];
};

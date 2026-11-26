import { z } from 'astro/zod';
import { normalizarTelefono } from './formato';

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Celular (3XX) o fijo nacional (60X), 10 dígitos.
const TELEFONO = /^(3\d{9}|60\d{8})$/;

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const itemCarritoSchema = z.object({
  slug: z.string().max(140).regex(SLUG),
  cantidad: z.number().int().min(1).max(99),
});

export const carritoSchema = z
  .array(itemCarritoSchema)
  .min(1, 'Tu pedido está vacío.')
  .max(30, 'Un pedido puede tener hasta 30 medicamentos distintos.')
  .refine((items) => new Set(items.map((i) => i.slug)).size === items.length, 'Hay medicamentos repetidos.');

export const pedidoSchema = z.object({
  nombre: z.string().trim().min(2, 'Escribe tu nombre.').max(80, 'El nombre es demasiado largo.'),
  telefono: z
    .string()
    .transform(normalizarTelefono)
    .pipe(
      z.string().regex(TELEFONO, 'Escribe un número colombiano de 10 dígitos, por ejemplo 300 123 4567.'),
    ),
  email: z
    .union([z.literal(''), z.email('Revisa el correo, parece incompleto.')])
    .optional()
    .transform((v) => v || null),
  direccion: z.string().trim().min(5, 'Escribe la dirección de entrega.').max(160),
  municipio: z.string().trim().min(2, 'Escribe el municipio.').max(60),
  notas: textoOpcional(500),
  declaraFormula: z.boolean().default(false),
  aceptaDatos: z.literal(true, { error: 'Necesitamos tu autorización para tratar tus datos.' }),
  // Campo trampa: las personas no lo ven; si llega con texto, es un bot.
  sitioWeb: z.string().max(0).optional(),
  items: carritoSchema,
});

export type ItemCarrito = z.infer<typeof itemCarritoSchema>;
export type DatosPedido = z.output<typeof pedidoSchema>;

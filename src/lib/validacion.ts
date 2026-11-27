import { z } from 'astro/zod';
import { normalizarTelefono } from './formato';

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Celular (3XX) o fijo nacional (60X), 10 dígitos.
const TELEFONO = /^(3\d{9}|60\d{8})$/;

// Campos de los formularios. Astro entrega los campos vacíos como null/undefined, por eso los opcionales usan
// .nullish() por fuera y los obligatorios llevan su mensaje para cuando no llegan.
const requerido = (mensaje: string) => z.string({ error: mensaje }).trim();

const nombre = requerido('Escribe tu nombre.')
  .min(2, 'Escribe tu nombre.')
  .max(80, 'El nombre es demasiado largo.');
const telefono = z
  .string({ error: 'Escribe tu teléfono.' })
  .transform(normalizarTelefono)
  .pipe(z.string().regex(TELEFONO, 'Escribe un número colombiano de 10 dígitos, por ejemplo 300 123 4567.'));
const aceptaDatos = z.boolean().refine((v) => v, 'Necesitamos tu autorización para tratar tus datos.');
// Campo trampa: las personas no lo ven; si llega con texto, es un bot.
const sitioWeb = z.string().max(0).optional();

// Formulario de pedido. Pedir exige cuenta: nombre, celular y correo salen de ella, y los medicamentos de la
// cookie del carrito. Aquí solo llegan las notas y la declaración de fórmula.
export const datosPedidoSchema = z.object({
  notas: z.string().trim().max(500, 'Las notas pueden tener hasta 500 caracteres.').nullish(),
  declaraFormula: z.boolean().default(false),
});

// Fecha preferida para la cita: desde mañana y hasta 60 días, contados en la hora de Colombia.
const DIAS_MAXIMOS_CITA = 60;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const hoyEnBogota = (ahora: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(ahora);
const sumarDias = (fecha: string, dias: number) => {
  const [a, m, d] = fecha.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
};
// Descarta fechas que no existen (2026-02-30) aunque tengan el formato correcto.
const esFechaReal = (fecha: string) => FECHA.test(fecha) && sumarDias(fecha, 0) === fecha;

export const rangoFechaCita = (ahora = new Date()) => {
  const hoy = hoyEnBogota(ahora);
  return { min: sumarDias(hoy, 1), max: sumarDias(hoy, DIAS_MAXIMOS_CITA) };
};

export const FRANJAS_CITA = ['manana', 'tarde'] as const;

// Formulario de cita. El horario real lo acuerda la clínica por WhatsApp: fecha y franja son solo la
// preferencia del tutor y pueden quedar vacías. No se pide correo: con el celular basta.
export const datosCitaSchema = z.object({
  nombre,
  telefono,
  especie: z
    .string({ error: 'Elige qué tipo de mascota es.' })
    .max(40)
    .regex(SLUG, 'Elige qué tipo de mascota es.'),
  mascota: requerido('Escribe el nombre de tu mascota.')
    .min(1, 'Escribe el nombre de tu mascota.')
    .max(60, 'El nombre es demasiado largo.'),
  motivo: requerido('Cuéntanos brevemente qué le pasa.')
    .min(5, 'Cuéntanos un poco más, por ejemplo: cojea de la pata trasera.')
    .max(500, 'El motivo puede tener hasta 500 caracteres.'),
  fecha: z
    .string()
    .refine(esFechaReal, 'Elige una fecha válida.')
    .refine((f) => {
      const { min, max } = rangoFechaCita();
      return f >= min && f <= max;
    }, `Elige una fecha desde mañana y hasta ${DIAS_MAXIMOS_CITA} días.`)
    .nullish(),
  franja: z.enum(FRANJAS_CITA).nullish(),
  aceptaDatos,
  sitioWeb,
});

export type DatosCita = z.output<typeof datosCitaSchema>;

// Cuenta de cliente (portal). La contraseña se valida aparte con validarClaveNueva (src/lib/clave.ts).
const CLAVE_MAX = 128;
export const datosPerfilSchema = z.object({ nombre, telefono });

export const datosRegistroSchema = datosPerfilSchema.extend({
  email: z.email('Revisa el correo, parece incompleto.').max(120, 'El correo es demasiado largo.'),
  clave: z.string({ error: 'Escribe una contraseña.' }).max(CLAVE_MAX),
  confirmacion: z.string({ error: 'Repite la contraseña.' }).max(CLAVE_MAX),
  aceptaDatos,
  sitioWeb,
  volver: z.string().max(200).nullish(),
});

// Adónde volver después de ingresar o registrarse: solo rutas de este sitio (nada de //otro-sitio.com).
export const destinoSeguro = (valor: string | null | undefined, porDefecto = '/cuenta') =>
  valor && /^\/(?![/\\])[\w\-/?=&%.]*$/.test(valor) ? valor : porDefecto;

export type ItemCarrito = { slug: string; cantidad: number };
// Lo que se guarda: datos de la cuenta + lo del formulario + el carrito.
export type DatosPedido = {
  nombre: string;
  telefono: string;
  email: string | null;
  notas: string | null;
  declaraFormula: boolean;
  aceptaDatos: boolean;
  items: ItemCarrito[];
};

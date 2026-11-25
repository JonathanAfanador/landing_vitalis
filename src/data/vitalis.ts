// Todo el contenido de la web. Vitalis es un negocio real: lo que no está verificado vale `null`
// y se muestra con <Pending> solo en desarrollo. Nunca inventes datos aquí.

export const negocio = {
  nombre: 'Vitalis Centro Veterinario',
  nombreCorto: 'Vitalis',
  ciudad: 'Girardot',
  departamento: 'Cundinamarca',
  pais: 'CO',
  servicios: ['Ortopedia', 'Neurocirugía', 'Rehabilitación'],
  especialidad: 'Médico veterinario especializado en procedimientos de ortopedia',
  direccion: null as string | null,
  coordenadas: null as { lat: number; lng: number } | null,
  mapa: null as string | null,
  horario: null as string | null,
  urgencias: null as string | null,
};

export const contacto = {
  whatsapp: null as string | null, // Solo dígitos con indicativo, p. ej. 573001234567
  telefono: null as string | null,
  correo: null as string | null,
  instagram: null as string | null,
  facebook: null as string | null,
};

export const doctor = {
  nombre: null as string | null,
  formacion: null as string | null,
  tarjetaProfesional: null as string | null,
};

export const cta = {
  principal: { texto: 'Pedir medicamentos', href: '/tienda' },
  secundario: { texto: 'Agendar valoración', href: '#valoracion' },
};

export const navegacion = [
  { texto: 'Servicios', href: '#servicios' },
  { texto: 'Medicamentos', href: '#medicamentos' },
  { texto: 'Ubicación', href: '#ubicacion' },
  { texto: 'Preguntas', href: '#preguntas' },
];

export type Parada = {
  id: string;
  clip: number;
  // Alto de la parada en svh: marca cuánto scroll dura su clip.
  alto: number;
  etiqueta: string;
  titulo: string;
  texto: string;
  alt: string;
};

export const recorrido: Parada[] = [
  {
    id: 'bienvenida',
    clip: 1,
    alto: 260,
    etiqueta: 'Centro veterinario en Girardot',
    titulo: 'Cuidamos cómo se mueve tu mascota',
    texto:
      'Especialistas en ortopedia, neurocirugía y rehabilitación. Pide sus medicamentos veterinarios y te confirmamos por WhatsApp.',
    alt: 'Recepción de Vitalis con el letrero iluminado del perro y el gato, flores sobre el mostrador y un afiche de bienvenida',
  },
  {
    id: 'cuidado',
    clip: 2,
    alto: 170,
    etiqueta: 'Medicamentos veterinarios',
    titulo: 'Cuidado en cada detalle',
    texto:
      'Medicamentos veterinarios con precio y disponibilidad a la vista, y orientación antes de confirmar tu pedido.',
    alt: 'Estanterías blancas iluminadas con luz cálida, figuras doradas y plantas',
  },
  {
    id: 'ortopedia',
    clip: 3,
    alto: 230,
    etiqueta: 'Ortopedia, neurocirugía y rehabilitación',
    titulo: 'Volver a caminar, a correr, a jugar',
    texto: 'Todo en un mismo lugar, con un médico veterinario especializado en procedimientos de ortopedia.',
    alt: 'Estanterías con modelos de huesos y de columna, libros de ortopedia y diplomas enmarcados',
  },
];

export const pruebaHero = 'Te atiende un médico veterinario especializado en ortopedia.';

export const tagline = ['Cada paso de tu mascota importa.', 'Por eso la cuidamos desde el hueso.'];

export const servicios = [
  {
    icono: 'bone',
    titulo: 'Ortopedia',
    texto:
      'La especialidad que cuida huesos, articulaciones y ligamentos, para que tu mascota vuelva a apoyar sin dolor.',
  },
  {
    icono: 'brain',
    titulo: 'Neurocirugía',
    texto:
      'Cirugía de la columna y del sistema nervioso para pacientes que pierden fuerza, equilibrio o movilidad.',
  },
  {
    icono: 'person-simple-walk',
    titulo: 'Rehabilitación',
    texto:
      'Acompañamiento después de una lesión o una cirugía para recuperar movilidad y fuerza paso a paso.',
  },
];

export const procedimientos = null as string[] | null;

export const procesoOrtopedia = [
  {
    titulo: 'Valoración',
    texto: 'El doctor revisa a tu mascota y te explica el diagnóstico y las opciones.',
  },
  { titulo: 'Cirugía', texto: 'Si hace falta, se programa el procedimiento y te decimos cómo prepararla.' },
  {
    titulo: 'Rehabilitación',
    texto: 'La acompañamos en la recuperación para que vuelva a moverse con confianza.',
  },
];

// Categorías y especies iniciales de la tienda. En la Fase 3 salen de la base de datos.
export const categorias = [
  { slug: 'antiparasitarios', nombre: 'Antiparasitarios', icono: 'bug' },
  { slug: 'antibioticos', nombre: 'Antibióticos', icono: 'pill' },
  { slug: 'antiinflamatorios', nombre: 'Antiinflamatorios', icono: 'thermometer-simple' },
  { slug: 'analgesicos', nombre: 'Analgésicos', icono: 'first-aid' },
  { slug: 'dermatologicos', nombre: 'Dermatológicos', icono: 'drop' },
  { slug: 'articulares', nombre: 'Articulares', icono: 'bone' },
];

export const especies = [
  { slug: 'perro', nombre: 'Perros', icono: 'dog' },
  { slug: 'gato', nombre: 'Gatos', icono: 'cat' },
];

export const comoPedir = [
  { titulo: 'Busca', texto: 'Encuentra el medicamento por nombre, especie o categoría.' },
  { titulo: 'Agrégalo y deja tus datos', texto: 'Elige la cantidad y escribe a dónde lo llevamos.' },
  {
    titulo: 'Confirmamos por WhatsApp',
    texto: 'Te escribimos para confirmar disponibilidad, pago y entrega.',
  },
];

export const beneficios = [
  {
    icono: 'stethoscope',
    titulo: 'Un especialista en ortopedia',
    texto: 'Quien opera es un médico veterinario especializado en procedimientos de ortopedia.',
  },
  {
    icono: 'path',
    titulo: 'Del diagnóstico a la rehabilitación',
    texto: 'Ortopedia, neurocirugía y rehabilitación en un mismo centro, sin ir de un lugar a otro.',
  },
  {
    icono: 'chat-circle-text',
    titulo: 'Pides en minutos',
    texto: 'Buscas por especie o categoría, ves precio y disponibilidad y confirmas por WhatsApp.',
  },
  {
    icono: 'shield-check',
    titulo: 'Sabes qué le das',
    texto:
      'Cada medicamento muestra principio activo, presentación, laboratorio y registro ICA, y te avisamos si necesita fórmula médica veterinaria.',
  },
];

export const testimonios = null as { nombre: string; mascota: string; texto: string }[] | null;

export type Pregunta = { pregunta: string; respuesta: string | null };

// Las preguntas con respuesta `null` solo se ven en desarrollo y no entran en el JSON-LD.
export const preguntas: Pregunta[] = [
  {
    pregunta: '¿Necesito fórmula médica para comprar un medicamento?',
    respuesta:
      'Algunos sí. El catálogo marca cuáles. Para esos te pediremos la fórmula médica veterinaria por WhatsApp antes de confirmar el pedido.',
  },
  {
    pregunta: '¿Los medicamentos son originales?',
    respuesta: 'Cada ficha muestra el laboratorio y el registro ICA del producto.',
  },
  { pregunta: '¿Cómo pago mi pedido?', respuesta: null },
  { pregunta: '¿Hacen domicilios?', respuesta: null },
  {
    pregunta: '¿Qué animales atienden?',
    respuesta: 'Perros y gatos.',
  },
  {
    pregunta: '¿Qué es la neurocirugía veterinaria?',
    respuesta:
      'Es la cirugía que trata problemas de la columna y del sistema nervioso, por ejemplo cuando una mascota pierde fuerza o movilidad en las patas.',
  },
  {
    pregunta: '¿Cómo preparo a mi mascota para una cirugía?',
    respuesta:
      'El doctor te da las indicaciones en la valoración, como el ayuno y los exámenes previos que necesite.',
  },
  {
    pregunta: '¿Cuánto dura la recuperación de una cirugía ortopédica?',
    respuesta:
      'Depende del procedimiento y de cada paciente. En la valoración te explicamos el tiempo estimado y el plan de rehabilitación.',
  },
  { pregunta: '¿Atienden urgencias?', respuesta: null },
  { pregunta: '¿Dónde están y en qué horario atienden?', respuesta: null },
];

export const seo = {
  titulo: 'Veterinaria en Girardot: ortopedia y medicamentos · Vitalis',
  descripcion:
    'Centro veterinario en Girardot especializado en ortopedia, neurocirugía y rehabilitación. Pide medicamentos veterinarios y confírmalos por WhatsApp.',
};

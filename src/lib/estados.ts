// Máquinas de estado. El servidor siempre actualiza con `WHERE estado IN (origenes)`: si el estado cambió
// entre que se cargó la página y se pulsó el botón, el cambio no se aplica (y no se repite nada).

export const ESTADOS_PEDIDO = ['pendiente', 'confirmado', 'pagado', 'entregado', 'cancelado'] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

// Solo recogida en la clínica. Un pedido pagado ya no se cancela desde el panel (devoluciones: pendiente).
const TRANSICIONES_PEDIDO: Record<EstadoPedido, readonly EstadoPedido[]> = {
  pendiente: ['confirmado', 'cancelado'],
  confirmado: ['pagado', 'cancelado'],
  pagado: ['entregado'],
  entregado: [],
  cancelado: [],
};

export const siguientesPedido = (estado: EstadoPedido) => TRANSICIONES_PEDIDO[estado];

export const puedePasarPedido = (desde: EstadoPedido, hacia: EstadoPedido) =>
  TRANSICIONES_PEDIDO[desde].includes(hacia);

// Estados desde los que se puede llegar a `hacia` (para el WHERE del UPDATE).
export const origenesPedido = (hacia: EstadoPedido) =>
  ESTADOS_PEDIDO.filter((desde) => TRANSICIONES_PEDIDO[desde].includes(hacia));

export const NOMBRE_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  pagado: 'Pagado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export const ESTADOS_CITA = ['solicitada', 'confirmada', 'atendida', 'no_asistio', 'cancelada'] as const;
export type EstadoCita = (typeof ESTADOS_CITA)[number];

// El horario se acuerda por WhatsApp; "confirmada" significa que ya tiene fecha y hora con el tutor.
const TRANSICIONES_CITA: Record<EstadoCita, readonly EstadoCita[]> = {
  solicitada: ['confirmada', 'cancelada'],
  confirmada: ['atendida', 'no_asistio', 'cancelada'],
  atendida: [],
  no_asistio: [],
  cancelada: [],
};

export const siguientesCita = (estado: EstadoCita) => TRANSICIONES_CITA[estado];

export const puedePasarCita = (desde: EstadoCita, hacia: EstadoCita) =>
  TRANSICIONES_CITA[desde].includes(hacia);

export const origenesCita = (hacia: EstadoCita) =>
  ESTADOS_CITA.filter((desde) => TRANSICIONES_CITA[desde].includes(hacia));

export const NOMBRE_ESTADO_CITA: Record<EstadoCita, string> = {
  solicitada: 'Por agendar',
  confirmada: 'Agendada',
  atendida: 'Atendida',
  no_asistio: 'No asistió',
  cancelada: 'Cancelada',
};

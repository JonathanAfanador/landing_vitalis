// Catálogo de permisos: la fuente de verdad. Cada permiso corresponde a una comprobación real en el código.
// `pnpm db:migrate` lo sincroniza con la tabla `permisos` (scripts/sincronizar-permisos.ts).

type DefPermiso = {
  modulo: keyof typeof MODULOS;
  nombre: string;
  descripcion: string;
  // Expone datos personales de clientes o usuarios (Ley 1581): el editor de roles lo señala.
  datosPersonales?: boolean;
  // Permisos que necesita para tener sentido; marcarlo los marca a ellos.
  requiere?: readonly string[];
  // Roles que lo reciben solo cuando el permiso se crea por primera vez. Después decide el superadmin.
  porDefecto?: readonly ('admin' | 'usuario')[];
};

export const MODULOS = {
  medicamentos: 'Medicamentos',
  categorias: 'Categorías',
  pedidos: 'Pedidos',
  citas: 'Citas',
  usuarios: 'Usuarios',
  auditoria: 'Auditoría',
} as const;

const ADMIN = ['admin'] as const;

export const PERMISOS = {
  'medicamentos:ver': {
    modulo: 'medicamentos',
    nombre: 'Ver medicamentos',
    descripcion: 'Ver el catálogo completo en el panel, incluidos los medicamentos inactivos.',
    porDefecto: ADMIN,
  },
  'medicamentos:crear': {
    modulo: 'medicamentos',
    nombre: 'Crear medicamentos',
    descripcion: 'Agregar medicamentos nuevos al catálogo con su stock inicial.',
    requiere: ['medicamentos:ver'],
    porDefecto: ADMIN,
  },
  'medicamentos:editar': {
    modulo: 'medicamentos',
    nombre: 'Editar medicamentos',
    descripcion: 'Cambiar datos, precio, especies y categoría, y activar o desactivar medicamentos.',
    requiere: ['medicamentos:ver'],
    porDefecto: ADMIN,
  },
  'medicamentos:ajustar_stock': {
    modulo: 'medicamentos',
    nombre: 'Ajustar stock',
    descripcion: 'Cambiar las unidades disponibles indicando el motivo. Queda en la auditoría.',
    requiere: ['medicamentos:ver'],
    porDefecto: ADMIN,
  },
  'medicamentos:eliminar': {
    modulo: 'medicamentos',
    nombre: 'Eliminar medicamentos',
    descripcion:
      'Borrar medicamentos creados por error que nunca estuvieron en un pedido. Los demás solo se desactivan.',
    requiere: ['medicamentos:ver'],
    porDefecto: ADMIN,
  },
  'categorias:gestionar': {
    modulo: 'categorias',
    nombre: 'Gestionar categorías',
    descripcion: 'Crear y renombrar categorías, y borrar las que no tienen medicamentos.',
    porDefecto: ADMIN,
  },
  'pedidos:ver': {
    modulo: 'pedidos',
    nombre: 'Ver pedidos',
    descripcion: 'Ver los pedidos con el nombre, teléfono y correo del cliente.',
    datosPersonales: true,
    porDefecto: ADMIN,
  },
  'pedidos:cambiar_estado': {
    modulo: 'pedidos',
    nombre: 'Avanzar pedidos',
    descripcion: 'Marcar pedidos como confirmados, pagados o entregados.',
    requiere: ['pedidos:ver'],
    porDefecto: ADMIN,
  },
  'pedidos:cancelar': {
    modulo: 'pedidos',
    nombre: 'Cancelar pedidos',
    descripcion: 'Cancelar pedidos pendientes o confirmados. El stock vuelve al catálogo.',
    requiere: ['pedidos:ver'],
    porDefecto: ADMIN,
  },
  'citas:ver': {
    modulo: 'citas',
    nombre: 'Ver citas',
    descripcion: 'Ver las solicitudes de cita con el nombre y celular del tutor y el motivo de la consulta.',
    datosPersonales: true,
    porDefecto: ADMIN,
  },
  'citas:gestionar': {
    modulo: 'citas',
    nombre: 'Gestionar citas',
    descripcion:
      'Marcar citas como agendadas, atendidas, no asistió o canceladas, y escribir notas internas.',
    requiere: ['citas:ver'],
    porDefecto: ADMIN,
  },
  'usuarios:ver': {
    modulo: 'usuarios',
    nombre: 'Ver usuarios',
    descripcion: 'Ver la lista de usuarios del panel con su nombre, correo y rol.',
    datosPersonales: true,
  },
  'usuarios:gestionar': {
    modulo: 'usuarios',
    nombre: 'Gestionar usuarios',
    descripcion: 'Crear usuarios, desactivarlos, reactivarlos y restablecer sus contraseñas.',
    requiere: ['usuarios:ver'],
  },
  'usuarios:asignar_roles': {
    modulo: 'usuarios',
    nombre: 'Asignar roles',
    descripcion:
      'Cambiar el rol de otros usuarios, solo a roles con permisos que también tiene quien asigna.',
    requiere: ['usuarios:ver'],
  },
  'auditoria:ver': {
    modulo: 'auditoria',
    nombre: 'Ver auditoría',
    descripcion: 'Ver el registro de actividad del panel: inicios de sesión, cambios de roles y operaciones.',
  },
} as const satisfies Record<string, DefPermiso>;

export type CodigoPermiso = keyof typeof PERMISOS;

// Capacidad exclusiva del superadmin. No está en el catálogo asignable ni en la base de datos:
// ningún rol puede recibirla, así que solo la concede el bypass de `can()`.
export const GESTIONAR_ROLES = 'roles:gestionar';
export type Capacidad = CodigoPermiso | typeof GESTIONAR_ROLES;

export const esCodigoPermiso = (codigo: string): codigo is CodigoPermiso => Object.hasOwn(PERMISOS, codigo);

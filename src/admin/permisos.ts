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
  usuarios: 'Usuarios',
  auditoria: 'Auditoría',
} as const;

export const PERMISOS = {
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

import { PERMISOS, esCodigoPermiso, esPermisoDePanel, type Capacidad, type CodigoPermiso } from './permisos';

export type UsuarioSesion = {
  id: number;
  nombre: string;
  email: string;
  rolId: number;
  rolSlug: string;
  rolNombre: string;
  telefono: string | null;
  esSuperadmin: boolean;
  permisos: ReadonlySet<string>;
  debeCambiarClave: boolean;
};

export type RolParaAsignar = { id: number; slug: string; permisos: readonly string[] };
export type Resultado = { ok: true } | { ok: false; motivo: string };

const OK: Resultado = { ok: true };
const NO = (motivo: string): Resultado => ({ ok: false, motivo });

// Única puerta de autorización del sitio. El bypass del superadmin vive aquí y en ningún otro lugar.
export function can(usuario: UsuarioSesion | null | undefined, capacidad: Capacidad): boolean {
  if (!usuario) return false;
  if (usuario.esSuperadmin) return true;
  // Las exclusivas del superadmin no están en el catálogo: un rol nunca las tiene.
  return esCodigoPermiso(capacidad) && usuario.permisos.has(capacidad);
}

const tieneTodos = (usuario: UsuarioSesion, codigos: readonly string[]) =>
  codigos.every((c) => esCodigoPermiso(c) && can(usuario, c));

// Acceso al panel: superadmin o al menos un permiso del panel (los de "Mi cuenta" no cuentan).
// Las cuentas de clientes nunca entran, aunque alguien les asigne permisos del panel por error.
export const puedeEntrarAlPanel = (usuario: UsuarioSesion) =>
  usuario.rolSlug !== 'usuario' && (usuario.esSuperadmin || [...usuario.permisos].some(esPermisoDePanel));

export const esCliente = (usuario: UsuarioSesion | null | undefined) => usuario?.rolSlug === 'usuario';

// Normaliza los permisos de un rol: descarta códigos desconocidos y añade sus dependencias.
export function normalizarPermisos(codigos: readonly string[]): CodigoPermiso[] {
  const resultado = new Set<CodigoPermiso>();
  const agregar = (codigo: string) => {
    if (!esCodigoPermiso(codigo) || resultado.has(codigo)) return;
    resultado.add(codigo);
    const { requiere } = PERMISOS[codigo] as { requiere?: readonly string[] | undefined };
    requiere?.forEach(agregar);
  };
  codigos.forEach(agregar);
  return [...resultado].sort();
}

// Anti-escalada al asignar un rol o al crear un usuario con ese rol.
export function puedeAsignarRol(
  actor: UsuarioSesion,
  destino: RolParaAsignar,
  objetivo?: { id: number; rol: RolParaAsignar },
): Resultado {
  // Cambiar el rol de alguien exige `usuarios:asignar_roles`; al crear un usuario lo exige la Action (`usuarios:gestionar`).
  if (objetivo && !can(actor, 'usuarios:asignar_roles')) return NO('No tienes permiso para asignar roles.');
  if (objetivo && objetivo.id === actor.id) return NO('No puedes cambiar tu propio rol.');
  if (destino.slug === 'usuario')
    return NO('Las cuentas de clientes se crean desde el portal, no desde el panel.');
  if (!actor.esSuperadmin) {
    if (destino.slug === 'superadmin' || objetivo?.rol.slug === 'superadmin') {
      return NO('Solo un superadmin puede asignar o quitar el rol de superadmin.');
    }
    if (!tieneTodos(actor, destino.permisos))
      return NO('No puedes asignar un rol con permisos que no tienes.');
    if (objetivo && !tieneTodos(actor, objetivo.rol.permisos)) {
      return NO('No puedes cambiar el rol de alguien con permisos que no tienes.');
    }
  }
  return OK;
}

// Desactivar, reactivar o restablecer la contraseña de otro usuario.
export function puedeGestionarUsuario(
  actor: UsuarioSesion,
  objetivo: { id: number; rol: RolParaAsignar },
  accion: 'desactivar' | 'reactivar' | 'restablecer',
): Resultado {
  if (!can(actor, 'usuarios:gestionar')) return NO('No tienes permiso para gestionar usuarios.');
  if (objetivo.id === actor.id) {
    return NO(
      accion === 'restablecer' ? 'Cambia tu contraseña desde tu perfil.' : 'No puedes desactivarte a ti.',
    );
  }
  if (
    !actor.esSuperadmin &&
    (objetivo.rol.slug === 'superadmin' || !tieneTodos(actor, objetivo.rol.permisos))
  ) {
    return NO('No puedes gestionar a alguien con permisos que no tienes.');
  }
  return OK;
}

// Último superadmin activo: el código lo comprueba para dar un mensaje claro; el trigger de la base lo garantiza.
export function dejaSinSuperadmin(
  objetivo: { rolSlug: string; activo: boolean },
  cambio: { rolSlug?: string; activo?: boolean },
  superadminsActivos: number,
) {
  const loEs = objetivo.rolSlug === 'superadmin' && objetivo.activo;
  const dejaDeSerlo = (cambio.rolSlug ?? objetivo.rolSlug) !== 'superadmin' || cambio.activo === false;
  return loEs && dejaDeSerlo && superadminsActivos <= 1;
}

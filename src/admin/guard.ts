import type { AstroGlobal } from 'astro';
import { ActionError } from 'astro:actions';
import { can, type UsuarioSesion } from './autorizacion';
import type { Capacidad } from './permisos';

// En cada Action del panel: sin sesión, 401; sin el permiso, 403. Ocultar botones es solo comodidad.
export function requerirPermiso(usuario: UsuarioSesion | null, capacidad: Capacidad): UsuarioSesion {
  if (!usuario)
    throw new ActionError({ code: 'UNAUTHORIZED', message: 'Tu sesión terminó. Vuelve a ingresar.' });
  if (!can(usuario, capacidad)) {
    throw new ActionError({ code: 'FORBIDDEN', message: 'No tienes permiso para hacer esto.' });
  }
  return usuario;
}

// En cada página del panel. El middleware ya garantiza la sesión; aquí se exige el permiso concreto.
export function permisoDePagina(Astro: AstroGlobal, capacidad: Capacidad) {
  const usuario = Astro.locals.usuario;
  if (!usuario || !can(usuario, capacidad)) {
    Astro.response.status = 403;
    return null;
  }
  return usuario;
}

import { describe, expect, it } from 'vitest';
import {
  can,
  dejaSinSuperadmin,
  normalizarPermisos,
  puedeAsignarRol,
  puedeEntrarAlPanel,
  puedeGestionarUsuario,
  type UsuarioSesion,
} from '../../src/admin/autorizacion';
import { ELIMINAR_REGISTROS, GESTIONAR_ROLES } from '../../src/admin/permisos';

const usuario = (permisos: string[], extra: Partial<UsuarioSesion> = {}): UsuarioSesion => ({
  id: 10,
  nombre: 'Prueba',
  email: 'prueba@vitalis.test',
  rolId: 5,
  rolSlug: 'personalizado',
  rolNombre: 'Personalizado',
  esSuperadmin: false,
  permisos: new Set(permisos),
  debeCambiarClave: false,
  ...extra,
});
const superadmin = usuario([], { id: 1, rolSlug: 'superadmin', esSuperadmin: true });
const rol = (slug: string, permisos: string[], id = 99) => ({ id, slug, permisos });

describe('can', () => {
  it('niega todo sin sesión', () => {
    expect(can(null, 'usuarios:ver')).toBe(false);
    expect(can(undefined, 'auditoria:ver')).toBe(false);
  });

  it('concede solo los permisos del rol', () => {
    const u = usuario(['usuarios:ver']);
    expect(can(u, 'usuarios:ver')).toBe(true);
    expect(can(u, 'usuarios:gestionar')).toBe(false);
  });

  it('el superadmin lo puede todo, incluida la gestión de roles', () => {
    expect(can(superadmin, 'auditoria:ver')).toBe(true);
    expect(can(superadmin, GESTIONAR_ROLES)).toBe(true);
  });

  it('nadie más gestiona roles, aunque tenga el código en sus permisos', () => {
    expect(can(usuario([GESTIONAR_ROLES, 'usuarios:ver']), GESTIONAR_ROLES)).toBe(false);
  });

  it('solo el superadmin elimina pedidos y citas, aunque otro tenga todos los demás permisos', () => {
    expect(can(superadmin, ELIMINAR_REGISTROS)).toBe(true);
    const casiTodo = usuario([ELIMINAR_REGISTROS, 'pedidos:ver', 'pedidos:cancelar', 'citas:gestionar']);
    expect(can(casiTodo, ELIMINAR_REGISTROS)).toBe(false);
  });

  it('descargar en Excel es un permiso aparte de ver', () => {
    expect(can(usuario(['citas:ver']), 'citas:exportar')).toBe(false);
    expect(can(usuario(['pedidos:ver', 'pedidos:exportar']), 'pedidos:exportar')).toBe(true);
  });
});

describe('normalizarPermisos', () => {
  it('añade las dependencias y descarta códigos inventados', () => {
    expect(normalizarPermisos(['usuarios:gestionar', 'inventado:todo', GESTIONAR_ROLES])).toEqual([
      'usuarios:gestionar',
      'usuarios:ver',
    ]);
  });
});

describe('puedeEntrarAlPanel', () => {
  it('exige al menos un permiso del panel', () => {
    expect(puedeEntrarAlPanel(usuario([]))).toBe(false);
    expect(puedeEntrarAlPanel(usuario(['auditoria:ver']))).toBe(true);
    expect(puedeEntrarAlPanel(superadmin)).toBe(true);
  });
});

describe('puedeAsignarRol (anti-escalada)', () => {
  const gestor = usuario(['usuarios:ver', 'usuarios:gestionar', 'usuarios:asignar_roles']);

  it('permite asignar un rol con permisos que el actor tiene', () => {
    expect(
      puedeAsignarRol(gestor, rol('lector', ['usuarios:ver']), { id: 20, rol: rol('otro', []) }).ok,
    ).toBe(true);
  });

  it('impide asignar un rol con permisos que el actor no tiene', () => {
    const r = puedeAsignarRol(gestor, rol('auditor', ['auditoria:ver']), { id: 20, rol: rol('otro', []) });
    expect(r.ok).toBe(false);
  });

  it('impide cambiar el propio rol', () => {
    expect(
      puedeAsignarRol(gestor, rol('lector', ['usuarios:ver']), { id: gestor.id, rol: rol('x', []) }).ok,
    ).toBe(false);
    expect(
      puedeAsignarRol(superadmin, rol('admin', []), { id: superadmin.id, rol: rol('superadmin', []) }).ok,
    ).toBe(false);
  });

  it('solo un superadmin asigna o quita el rol superadmin', () => {
    expect(puedeAsignarRol(gestor, rol('superadmin', []), { id: 20, rol: rol('otro', []) }).ok).toBe(false);
    expect(
      puedeAsignarRol(gestor, rol('lector', ['usuarios:ver']), { id: 20, rol: rol('superadmin', []) }).ok,
    ).toBe(false);
    expect(puedeAsignarRol(superadmin, rol('superadmin', []), { id: 20, rol: rol('otro', []) }).ok).toBe(
      true,
    );
  });

  it('no deja degradar a alguien con más permisos que el actor', () => {
    const r = puedeAsignarRol(gestor, rol('lector', ['usuarios:ver']), {
      id: 20,
      rol: rol('auditor', ['auditoria:ver']),
    });
    expect(r.ok).toBe(false);
  });

  it('cambiar el rol de alguien exige usuarios:asignar_roles', () => {
    const sinAsignar = usuario(['usuarios:ver', 'usuarios:gestionar']);
    expect(
      puedeAsignarRol(sinAsignar, rol('lector', ['usuarios:ver']), { id: 20, rol: rol('otro', []) }).ok,
    ).toBe(false);
    // Crear un usuario (sin objetivo) lo controla la Action con usuarios:gestionar.
    expect(puedeAsignarRol(sinAsignar, rol('lector', ['usuarios:ver'])).ok).toBe(true);
  });

  it('las cuentas de cliente no se crean desde el panel', () => {
    expect(puedeAsignarRol(superadmin, rol('usuario', [])).ok).toBe(false);
  });
});

describe('puedeGestionarUsuario', () => {
  const gestor = usuario(['usuarios:ver', 'usuarios:gestionar']);

  it('nadie se desactiva a sí mismo', () => {
    expect(puedeGestionarUsuario(gestor, { id: gestor.id, rol: rol('x', []) }, 'desactivar').ok).toBe(false);
  });

  it('no se gestiona a quien tiene más permisos ni a un superadmin', () => {
    expect(
      puedeGestionarUsuario(gestor, { id: 20, rol: rol('auditor', ['auditoria:ver']) }, 'restablecer').ok,
    ).toBe(false);
    expect(puedeGestionarUsuario(gestor, { id: 20, rol: rol('superadmin', []) }, 'desactivar').ok).toBe(
      false,
    );
    expect(
      puedeGestionarUsuario(gestor, { id: 20, rol: rol('lector', ['usuarios:ver']) }, 'desactivar').ok,
    ).toBe(true);
  });
});

describe('dejaSinSuperadmin', () => {
  it('detecta cuando se desactiva o degrada al último superadmin', () => {
    expect(dejaSinSuperadmin({ rolSlug: 'superadmin', activo: true }, { activo: false }, 1)).toBe(true);
    expect(dejaSinSuperadmin({ rolSlug: 'superadmin', activo: true }, { rolSlug: 'admin' }, 1)).toBe(true);
  });

  it('lo permite si quedan otros superadmins o si el usuario no lo era', () => {
    expect(dejaSinSuperadmin({ rolSlug: 'superadmin', activo: true }, { activo: false }, 2)).toBe(false);
    expect(dejaSinSuperadmin({ rolSlug: 'admin', activo: true }, { activo: false }, 1)).toBe(false);
    expect(dejaSinSuperadmin({ rolSlug: 'superadmin', activo: true }, { rolSlug: 'superadmin' }, 1)).toBe(
      false,
    );
  });
});

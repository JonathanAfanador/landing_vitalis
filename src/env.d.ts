declare namespace App {
  interface Locals {
    // Usuario con sesión válida en el panel; null si no hay sesión o en rutas públicas.
    usuario: import('./admin/autorizacion').UsuarioSesion | null;
  }
}

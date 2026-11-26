import { defineMiddleware } from 'astro:middleware';
import { puedeEntrarAlPanel } from './admin/autorizacion';
import { COOKIE_SESION, validarSesion } from './admin/sesiones';

const LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);
const RUTAS_SIN_SESION = new Set(['/admin/login']);
const SIN_PERMISO = '/admin/sin-permiso';
const CAMBIAR_CLAVE = '/admin/cambiar-clave';
// Actions del panel que se pueden llamar sin sesión.
const ACTIONS_SIN_SESION = new Set(['admin.auth.ingresar', 'admin.auth.salir']);

export const onRequest = defineMiddleware(async (ctx, next) => {
  ctx.locals.usuario = null;
  if (ctx.isPrerendered) return next();

  const { pathname } = ctx.url;

  // Toda escritura (formularios y Actions) debe venir del propio sitio. Se suma a SameSite y a que
  // las Actions JSON exigen un content-type que otro sitio no puede enviar sin CORS.
  if (!LECTURA.has(ctx.request.method) && ctx.request.headers.get('origin') !== ctx.url.origin) {
    return new Response('Origen no permitido', { status: 403 });
  }

  const esPanel = pathname === '/admin' || pathname.startsWith('/admin/');
  // Una Action llega por /_actions/<nombre> (JSON) o como ?_action=<nombre> en un formulario a cualquier página.
  const accion = pathname.startsWith('/_actions/')
    ? pathname.slice('/_actions/'.length)
    : ctx.url.searchParams.get('_action');
  const esActionPanel = accion?.startsWith('admin.') ?? false;
  if (!esPanel && !esActionPanel) return next();

  const token = ctx.cookies.get(COOKIE_SESION)?.value;
  const usuario = token ? await validarSesion(token) : null;
  ctx.locals.usuario = usuario;

  // Sin sesión, las Actions del panel responden 401 antes de validar nada (no revelan sus campos).
  if (esActionPanel && !usuario && !ACTIONS_SIN_SESION.has(accion ?? '')) {
    return Response.json({ type: 'AstroActionError', code: 'UNAUTHORIZED', status: 401 }, { status: 401 });
  }

  if (esPanel && !RUTAS_SIN_SESION.has(pathname)) {
    if (!usuario) return ctx.redirect('/admin/login');
    // Primero la contraseña temporal: hasta cambiarla, solo existe esa página. Va antes que el control de
    // acceso para que un usuario sin permisos de panel no rebote entre "cambiar contraseña" y "sin acceso".
    if (usuario.debeCambiarClave) {
      if (pathname !== CAMBIAR_CLAVE) return ctx.redirect(CAMBIAR_CLAVE);
    } else if (!puedeEntrarAlPanel(usuario) && pathname !== SIN_PERMISO && pathname !== CAMBIAR_CLAVE) {
      return ctx.rewrite(SIN_PERMISO);
    }
  }

  const respuesta = await next();
  // El panel nunca entra en ninguna caché ni en buscadores.
  respuesta.headers.set('Cache-Control', 'no-store');
  respuesta.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return respuesta;
});

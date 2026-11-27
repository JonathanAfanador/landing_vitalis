import { defineMiddleware } from 'astro:middleware';
import { esCliente, puedeEntrarAlPanel } from './admin/autorizacion';
import { COOKIE_SESION, validarSesion } from './admin/sesiones';

const LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);
const SIN_PERMISO = '/admin/sin-permiso';
const CAMBIAR_CLAVE = '/admin/cambiar-clave';
const PERFIL_CUENTA = '/cuenta/perfil';
// Páginas de panel y portal que se ven sin sesión.
const RUTAS_SIN_SESION = new Set([
  '/admin/login',
  '/cuenta/ingresar',
  '/cuenta/registro',
  '/cuenta/recuperar',
]);
// Actions que se pueden llamar sin sesión.
const ACTIONS_SIN_SESION = new Set([
  'admin.auth.ingresar',
  'admin.auth.salir',
  'cuenta.registrar',
  'cuenta.ingresar',
  'cuenta.recuperar',
  'cuenta.salir',
]);
// Páginas y Actions públicas que, si hay sesión de cliente, se prellenan y guardan en su cuenta.
const RUTAS_CON_CUENTA = new Set(['/pedido', '/cita']);
const ACTIONS_CON_CUENTA = new Set(['pedidos.crear', 'citas.solicitar']);

const esRuta = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

export const onRequest = defineMiddleware(async (ctx, next) => {
  ctx.locals.usuario = null;
  if (ctx.isPrerendered) return next();

  const { pathname } = ctx.url;

  // Toda escritura (formularios y Actions) debe venir del propio sitio. Se suma a SameSite y a que
  // las Actions JSON exigen un content-type que otro sitio no puede enviar sin CORS.
  if (!LECTURA.has(ctx.request.method) && ctx.request.headers.get('origin') !== ctx.url.origin) {
    return new Response('Origen no permitido', { status: 403 });
  }

  const esPanel = esRuta(pathname, '/admin');
  const esCuenta = esRuta(pathname, '/cuenta');
  // Una Action llega por /_actions/<nombre> (JSON) o como ?_action=<nombre> en un formulario a cualquier página.
  const accion = pathname.startsWith('/_actions/')
    ? pathname.slice('/_actions/'.length)
    : ctx.url.searchParams.get('_action');
  const accionPrivada = Boolean(accion?.startsWith('admin.') || accion?.startsWith('cuenta.'));
  const leeCuenta = RUTAS_CON_CUENTA.has(pathname) || ACTIONS_CON_CUENTA.has(accion ?? '');
  // El resto del sitio (portada, tienda) no consulta sesiones: sigue siendo cacheable y rápido.
  if (!esPanel && !esCuenta && !accionPrivada && !leeCuenta) return next();

  const token = ctx.cookies.get(COOKIE_SESION)?.value;
  const usuario = token ? await validarSesion(token) : null;
  ctx.locals.usuario = usuario;

  // Sin sesión, las Actions privadas responden 401 antes de validar nada (no revelan sus campos).
  if (accionPrivada && !usuario && !ACTIONS_SIN_SESION.has(accion ?? '')) {
    return Response.json({ type: 'AstroActionError', code: 'UNAUTHORIZED', status: 401 }, { status: 401 });
  }

  if (esPanel && !RUTAS_SIN_SESION.has(pathname)) {
    if (!usuario) return ctx.redirect('/admin/login');
    // Un cliente que llega al panel va a su cuenta: el panel no es para él.
    if (esCliente(usuario)) return ctx.redirect('/cuenta');
    // Primero la contraseña temporal: hasta cambiarla, solo existe esa página. Va antes que el control de
    // acceso para que un usuario sin permisos de panel no rebote entre "cambiar contraseña" y "sin acceso".
    if (usuario.debeCambiarClave) {
      if (pathname !== CAMBIAR_CLAVE) return ctx.redirect(CAMBIAR_CLAVE);
    } else if (!puedeEntrarAlPanel(usuario) && pathname !== SIN_PERMISO && pathname !== CAMBIAR_CLAVE) {
      return ctx.rewrite(SIN_PERMISO);
    }
  }

  if (esCuenta && !RUTAS_SIN_SESION.has(pathname)) {
    if (!usuario) return ctx.redirect(`/cuenta/ingresar?volver=${encodeURIComponent(pathname)}`);
    // Contraseña temporal (la clínica la restableció): hasta cambiarla, solo el perfil.
    if (esCliente(usuario) && usuario.debeCambiarClave && pathname !== PERFIL_CUENTA) {
      return ctx.redirect(PERFIL_CUENTA);
    }
  }

  const respuesta = await next();
  if (esPanel || esCuenta || accionPrivada) {
    // Panel y portal nunca entran en ninguna caché ni en buscadores.
    respuesta.headers.set('Cache-Control', 'no-store');
    respuesta.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return respuesta;
});

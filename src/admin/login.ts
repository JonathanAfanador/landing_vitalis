import type { AstroCookies } from 'astro';
import { and, count, eq, gt, sql } from 'drizzle-orm';
import { dbAdmin } from '../db/client-admin';
import { auditoria, roles, usuarios } from '../db/schema';
import {
  generarCodigoRecuperacion,
  HASH_FALSO,
  hashClave,
  normalizarCodigoRecuperacion,
  validarClaveNueva,
  verificarClave,
} from '../lib/clave';
import { hashCorreo, hashIp } from '../lib/ip';
import { registrar } from './auditoria';
import type { UsuarioSesion } from './autorizacion';
import { cerrarTodasLasSesiones, crearSesion } from './sesiones';
import { buscarParaLogin } from './usuarios';

export const MAX_FALLOS_CUENTA = 5;
export const MAX_FALLOS_IP = 20;
const VENTANA = '15 minutes';

// 0, 0, 0, 1, 2 y 4 segundos según los fallos recientes de la cuenta. Más allá, la cuenta está bloqueada.
export const retrasoMs = (fallos: number) => (fallos < 3 ? 0 : Math.min(4000, 1000 * 2 ** (fallos - 3)));

const contarFallos = async (
  columna: typeof auditoria.sujetoHash | typeof auditoria.ipHash,
  valor: string,
  evento: 'login_fallido' | 'recuperacion_fallida' = 'login_fallido',
) => {
  const [fila] = await dbAdmin
    .select({ total: count() })
    .from(auditoria)
    .where(
      and(
        eq(auditoria.evento, evento),
        eq(columna, valor),
        gt(auditoria.createdAt, sql`now() - ${VENTANA}::interval`),
      ),
    );
  return fila?.total ?? 0;
};

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Devuelve `true` si inició sesión. Cualquier fallo responde igual y tarda lo mismo: no revela
// si el correo existe, si la cuenta está desactivada o si está bloqueada.
export async function intentarLogin(email: string, clave: string, ip: string, cookies: AstroCookies) {
  const sujetoHash = hashCorreo(email);
  const ipHash = hashIp(ip);
  const [fallosCuenta, fallosIp] = await Promise.all([
    contarFallos(auditoria.sujetoHash, sujetoHash),
    contarFallos(auditoria.ipHash, ipHash),
  ]);
  const bloqueado = fallosCuenta >= MAX_FALLOS_CUENTA || fallosIp >= MAX_FALLOS_IP;
  await esperar(retrasoMs(fallosCuenta));

  const usuario = await buscarParaLogin(email);
  // Siempre se calcula un scrypt, exista o no la cuenta: misma duración en los dos casos.
  const { valida, rehacer } = await verificarClave(clave, usuario?.claveHash ?? HASH_FALSO);

  if (bloqueado || !usuario || !usuario.activo || !valida) {
    await registrar({
      actorId: usuario?.id ?? null,
      evento: 'login_fallido',
      ipHash,
      sujetoHash,
      detalle: bloqueado ? { bloqueado: true } : undefined,
    });
    return false;
  }

  await dbAdmin
    .update(usuarios)
    .set({ ultimoAcceso: new Date(), ...(rehacer ? { claveHash: await hashClave(clave) } : {}) })
    .where(eq(usuarios.id, usuario.id));
  await crearSesion(usuario.id, cookies);
  await registrar({ actorId: usuario.id, evento: 'login_ok', ipHash, sujetoHash });
  return true;
}

// Cambio de la propia contraseña (panel y portal). Devuelve el problema para mostrarlo, o null si se cambió.
// Cierra las demás sesiones abiertas con la contraseña anterior y renueva la actual.
export async function cambiarClavePropia(
  usuario: UsuarioSesion,
  claves: { actual: string; nueva: string; confirmacion: string },
  cookies: AstroCookies,
) {
  const { actual, nueva, confirmacion } = claves;
  const problema =
    validarClaveNueva(nueva, usuario.email) ??
    (nueva !== confirmacion ? 'Las contraseñas nuevas no coinciden.' : null) ??
    (nueva === actual ? 'La contraseña nueva debe ser distinta de la actual.' : null);
  if (problema) return problema;

  const [fila] = await dbAdmin
    .select({ claveHash: usuarios.claveHash })
    .from(usuarios)
    .where(eq(usuarios.id, usuario.id));
  if (!fila || !(await verificarClave(actual, fila.claveHash)).valida) {
    return 'La contraseña actual no es correcta.';
  }

  await dbAdmin
    .update(usuarios)
    .set({ claveHash: await hashClave(nueva), debeCambiarClave: false })
    .where(eq(usuarios.id, usuario.id));
  await cerrarTodasLasSesiones(usuario.id);
  await crearSesion(usuario.id, cookies);
  await registrar({
    actorId: usuario.id,
    evento: 'clave_cambiada',
    entidad: 'usuario',
    entidadId: usuario.id,
  });
  return null;
}

const CODIGO_INCORRECTO =
  'Correo o código incorrectos. Si no tienes el código, escríbenos por WhatsApp y te ayudamos.';

// "Olvidé mi contraseña" sin correo: correo + código de recuperación + contraseña nueva. Mismas defensas que el
// login (límite por correo y por IP, retraso creciente, misma respuesta y un solo scrypt exista o no la cuenta).
// Si sale bien, el código se reemplaza (sirve una sola vez), se cierran las demás sesiones y se inicia una.
export async function recuperarConCodigo(
  datos: { email: string; codigo: string; nueva: string; confirmacion: string },
  ip: string,
  cookies: AstroCookies,
): Promise<{ ok: true; codigo: string } | { ok: false; motivo: string }> {
  const problema =
    validarClaveNueva(datos.nueva, datos.email) ??
    (datos.nueva !== datos.confirmacion ? 'Las contraseñas nuevas no coinciden.' : null);
  if (problema) return { ok: false, motivo: problema };

  const sujetoHash = hashCorreo(datos.email);
  const ipHash = hashIp(ip);
  const [fallosCuenta, fallosIp] = await Promise.all([
    contarFallos(auditoria.sujetoHash, sujetoHash, 'recuperacion_fallida'),
    contarFallos(auditoria.ipHash, ipHash, 'recuperacion_fallida'),
  ]);
  const bloqueado = fallosCuenta >= MAX_FALLOS_CUENTA || fallosIp >= MAX_FALLOS_IP;
  await esperar(retrasoMs(fallosCuenta));

  const [cuenta] = await dbAdmin
    .select({
      id: usuarios.id,
      activo: usuarios.activo,
      rol: roles.slug,
      codigoHash: usuarios.codigoRecuperacionHash,
    })
    .from(usuarios)
    .innerJoin(roles, eq(roles.id, usuarios.rolId))
    .where(sql`lower(${usuarios.email}) = ${datos.email.trim().toLowerCase()}`);
  const { valida } = await verificarClave(
    normalizarCodigoRecuperacion(datos.codigo),
    cuenta?.codigoHash ?? HASH_FALSO,
  );

  // Solo cuentas de clientes: el personal del panel recupera su acceso con el superadmin.
  if (bloqueado || !cuenta || !cuenta.activo || cuenta.rol !== 'usuario' || !valida) {
    await registrar({
      actorId: cuenta?.id ?? null,
      evento: 'recuperacion_fallida',
      ipHash,
      sujetoHash,
      detalle: bloqueado ? { bloqueado: true } : undefined,
    });
    return { ok: false, motivo: CODIGO_INCORRECTO };
  }

  const codigo = generarCodigoRecuperacion();
  await dbAdmin
    .update(usuarios)
    .set({
      claveHash: await hashClave(datos.nueva),
      debeCambiarClave: false,
      codigoRecuperacionHash: await hashClave(codigo),
      codigoRecuperacionEn: new Date(),
    })
    .where(eq(usuarios.id, cuenta.id));
  await cerrarTodasLasSesiones(cuenta.id);
  await crearSesion(cuenta.id, cookies);
  await registrar({
    actorId: cuenta.id,
    evento: 'clave_recuperada',
    entidad: 'usuario',
    entidadId: cuenta.id,
    ipHash,
  });
  return { ok: true, codigo };
}

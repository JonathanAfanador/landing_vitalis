import type { AstroCookies } from 'astro';
import { and, count, eq, gt, sql } from 'drizzle-orm';
import { dbAdmin } from '../db/client-admin';
import { auditoria, usuarios } from '../db/schema';
import { HASH_FALSO, hashClave, verificarClave } from '../lib/clave';
import { hashCorreo, hashIp } from '../lib/ip';
import { registrar } from './auditoria';
import { crearSesion } from './sesiones';
import { buscarParaLogin } from './usuarios';

export const MAX_FALLOS_CUENTA = 5;
export const MAX_FALLOS_IP = 20;
const VENTANA = '15 minutes';

// 0, 0, 0, 1, 2 y 4 segundos según los fallos recientes de la cuenta. Más allá, la cuenta está bloqueada.
export const retrasoMs = (fallos: number) => (fallos < 3 ? 0 : Math.min(4000, 1000 * 2 ** (fallos - 3)));

const contarFallos = async (
  columna: typeof auditoria.sujetoHash | typeof auditoria.ipHash,
  valor: string,
) => {
  const [fila] = await dbAdmin
    .select({ total: count() })
    .from(auditoria)
    .where(
      and(
        eq(auditoria.evento, 'login_fallido'),
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

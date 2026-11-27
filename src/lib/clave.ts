import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// scrypt con los parámetros que recomienda OWASP: N = 2^17, r = 8, p = 1 (unos 128 MiB por hash).
// Se guarda como scrypt$logN$r$p$sal$hash: si se suben los parámetros, el hash se rehace al iniciar sesión.
const ACTUAL = { logN: 17, r: 8, p: 1 };
const LARGO_CLAVE = 64;
const LARGO_SAL = 16;
export const CLAVE_MIN = 12;
export const CLAVE_MAX = 128;

const derivar = (clave: string, sal: Buffer, { logN, r, p }: typeof ACTUAL) =>
  new Promise<Buffer>((resolve, reject) => {
    const opciones: ScryptOptions = { N: 2 ** logN, r, p, maxmem: 256 * 1024 * 1024 };
    scrypt(clave.normalize('NFKC'), sal, LARGO_CLAVE, opciones, (error, derivada) =>
      error ? reject(error) : resolve(derivada),
    );
  });

export async function hashClave(clave: string) {
  const sal = randomBytes(LARGO_SAL);
  const hash = await derivar(clave, sal, ACTUAL);
  const { logN, r, p } = ACTUAL;
  return ['scrypt', logN, r, p, sal.toString('base64url'), hash.toString('base64url')].join('$');
}

export async function verificarClave(clave: string, guardado: string) {
  const [algoritmo, logN, r, p, sal, hash] = guardado.split('$');
  if (algoritmo !== 'scrypt' || !sal || !hash) return { valida: false, rehacer: false };
  const params = { logN: Number(logN), r: Number(r), p: Number(p) };
  const esperado = Buffer.from(hash, 'base64url');
  const calculado = await derivar(clave, Buffer.from(sal, 'base64url'), params);
  const valida = esperado.length === calculado.length && timingSafeEqual(esperado, calculado);
  const rehacer = valida && (params.logN !== ACTUAL.logN || params.r !== ACTUAL.r || params.p !== ACTUAL.p);
  return { valida, rehacer };
}

// Hash de una clave aleatoria que se descartó al generarlo: si el correo no existe, se verifica contra él
// para que la respuesta tarde lo mismo (un solo scrypt). Es constante para no calcularlo en la primera
// petición, que tardaría el doble y delataría que el correo no existe.
export const HASH_FALSO =
  'scrypt$17$8$1$MBKjwdigUr-c8HBzSX0VzA$FS1B41qwEFNU1Ke2RrVIl72WNwBSgcKVGuf4vse4ikgcQfF6ee47-TApKpsqwKbIzrYqXrNEnMhex1cffAA2sQ';

export function validarClaveNueva(clave: string, email: string): string | null {
  if (clave.length < CLAVE_MIN) return `La contraseña debe tener al menos ${CLAVE_MIN} caracteres.`;
  if (clave.length > CLAVE_MAX) return `La contraseña puede tener hasta ${CLAVE_MAX} caracteres.`;
  if (clave.trim().toLowerCase() === email.trim().toLowerCase())
    return 'La contraseña no puede ser tu correo.';
  if (new Set(clave).size < 4) return 'La contraseña es demasiado repetitiva.';
  return null;
}

// Contraseña temporal para usuarios nuevos o restablecidos: se muestra una vez y obliga a cambiarla.
export const generarClaveTemporal = () => randomBytes(12).toString('base64url');

// Código de recuperación de contraseña (sin servicio de correo): 16 caracteres sin I, O, 0 ni 1, en grupos de 4
// para copiarlo a mano, p. ej. K7QM-3HXP-9WTR-B2NA. 32 símbolos = 5 bits cada uno: 80 bits de azar (y 256 es
// múltiplo de 32, así que el módulo no sesga). Se guarda con scrypt, como la contraseña.
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generarCodigoRecuperacion() {
  const simbolos = Array.from(randomBytes(16), (b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join('');
  return simbolos.match(/.{4}/g)?.join('-') ?? simbolos;
}

// Lo que escribe la persona, al formato guardado: mayúsculas y guiones cada 4, sin importar cómo lo separó.
export const normalizarCodigoRecuperacion = (codigo: string) =>
  codigo
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/(.{4})(?=.)/g, '$1-');

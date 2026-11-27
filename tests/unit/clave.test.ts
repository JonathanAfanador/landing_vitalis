import { describe, expect, it } from 'vitest';
import {
  generarClaveTemporal,
  generarCodigoRecuperacion,
  hashClave,
  normalizarCodigoRecuperacion,
  validarClaveNueva,
  verificarClave,
} from '../../src/lib/clave';

describe('hashClave y verificarClave', () => {
  it('verifica la contraseña correcta y rechaza las demás', async () => {
    const hash = await hashClave('una frase larga y segura');
    expect(hash).toMatch(/^scrypt\$17\$8\$1\$[\w-]+\$[\w-]+$/);
    expect(await verificarClave('una frase larga y segura', hash)).toEqual({ valida: true, rehacer: false });
    expect((await verificarClave('una frase larga y segurA', hash)).valida).toBe(false);
  });

  it('usa una sal distinta cada vez', async () => {
    expect(await hashClave('misma clave 123')).not.toBe(await hashClave('misma clave 123'));
  });

  it('pide rehacer el hash si los parámetros quedaron viejos', async () => {
    const actual = await hashClave('clave con parámetros viejos');
    // Mismo hash recalculado con N = 2^14 para simular un hash antiguo.
    const { scryptSync } = await import('node:crypto');
    const sal = actual.split('$')[4] ?? '';
    const viejo = [
      'scrypt',
      14,
      8,
      1,
      sal,
      scryptSync('clave con parámetros viejos', Buffer.from(sal, 'base64url'), 64, { N: 2 ** 14 }).toString(
        'base64url',
      ),
    ].join('$');
    expect(await verificarClave('clave con parámetros viejos', viejo)).toEqual({
      valida: true,
      rehacer: true,
    });
  });

  it('rechaza formatos desconocidos', async () => {
    expect((await verificarClave('x', 'bcrypt$algo')).valida).toBe(false);
  });
});

describe('validarClaveNueva', () => {
  it('aplica la política de contraseñas', () => {
    expect(validarClaveNueva('corta', 'a@b.co')).toMatch(/12 caracteres/);
    expect(validarClaveNueva('x'.repeat(129), 'a@b.co')).toMatch(/128/);
    expect(validarClaveNueva('persona@vitalis.co', 'persona@vitalis.co')).toMatch(/correo/);
    expect(validarClaveNueva('aaaaaaaaaaaaaa', 'a@b.co')).toMatch(/repetitiva/);
    expect(validarClaveNueva('la perra Luna come a las 7', 'a@b.co')).toBeNull();
  });

  it('las contraseñas temporales cumplen la política', () => {
    for (let i = 0; i < 20; i++) expect(validarClaveNueva(generarClaveTemporal(), 'a@b.co')).toBeNull();
  });
});

describe('código de recuperación', () => {
  it('tiene 16 símbolos sin I, O, 0 ni 1, en grupos de 4', () => {
    for (let i = 0; i < 100; i++) {
      expect(generarCodigoRecuperacion()).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/);
    }
  });

  it('acepta el código escrito en minúsculas, con espacios o sin guiones', () => {
    const codigo = 'K7QM-3HXP-9WTR-B2NA';
    for (const escrito of [
      'k7qm-3hxp-9wtr-b2na',
      'K7QM 3HXP 9WTR B2NA',
      'K7QM3HXP9WTRB2NA',
      ' k7qm3hxp-9wtrb2na ',
    ]) {
      expect(normalizarCodigoRecuperacion(escrito)).toBe(codigo);
    }
  });

  it('se verifica con scrypt como una contraseña', async () => {
    const codigo = generarCodigoRecuperacion();
    const hash = await hashClave(codigo);
    expect((await verificarClave(normalizarCodigoRecuperacion(codigo.toLowerCase()), hash)).valida).toBe(
      true,
    );
    expect((await verificarClave(generarCodigoRecuperacion(), hash)).valida).toBe(false);
  });
});

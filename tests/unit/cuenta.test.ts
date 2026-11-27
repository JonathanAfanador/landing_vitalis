import { describe, expect, it } from 'vitest';
import { datosPerfilSchema, datosRegistroSchema, destinoSeguro } from '../../src/lib/validacion';

describe('destinoSeguro (a dónde volver tras ingresar)', () => {
  it.each(['/pedido', '/cita', '/cuenta/perfil', '/tienda?especie=gato'])(
    'acepta la ruta interna %s',
    (ruta) => {
      expect(destinoSeguro(ruta)).toBe(ruta);
    },
  );

  it.each([
    '//otro-sitio.com',
    '/\\otro-sitio.com',
    'https://otro-sitio.com',
    'javascript:alert(1)',
    'pedido',
    '/cita#x',
    '',
    null,
    undefined,
  ])('descarta %s y vuelve a /cuenta', (valor) => {
    expect(destinoSeguro(valor)).toBe('/cuenta');
  });
});

describe('datosRegistroSchema', () => {
  const valido = {
    nombre: 'Laura Gómez',
    email: 'laura@correo.co',
    telefono: '310 555 1234',
    clave: 'una frase larga y segura',
    confirmacion: 'una frase larga y segura',
    aceptaDatos: true,
  };

  it('acepta un registro válido y normaliza el celular', () => {
    expect(datosRegistroSchema.parse(valido).telefono).toBe('3105551234');
  });

  it('no deja elegir el rol ni otros campos: se ignoran', () => {
    const r = datosRegistroSchema.parse({ ...valido, rolId: 1, rol: 'superadmin' });
    expect(r).not.toHaveProperty('rolId');
    expect(r).not.toHaveProperty('rol');
  });

  it('exige la autorización de datos, un correo válido y un celular colombiano', () => {
    expect(datosRegistroSchema.safeParse({ ...valido, aceptaDatos: false }).success).toBe(false);
    expect(datosRegistroSchema.safeParse({ ...valido, email: 'laura@' }).success).toBe(false);
    expect(datosRegistroSchema.safeParse({ ...valido, telefono: '12345' }).success).toBe(false);
  });

  it('el perfil solo cambia nombre y celular', () => {
    expect(Object.keys(datosPerfilSchema.shape).sort()).toEqual(['nombre', 'telefono']);
  });
});

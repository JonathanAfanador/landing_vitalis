import { describe, expect, it } from 'vitest';
import { datosPedidoSchema, datosPerfilSchema } from '../../src/lib/validacion';

// Así llegan los datos de un formulario a la Action: los campos vacíos como undefined o null.
describe('datosPedidoSchema (pedir exige cuenta)', () => {
  it('solo trae notas y la declaración de fórmula: los datos personales salen de la cuenta', () => {
    expect(Object.keys(datosPedidoSchema.shape).sort()).toEqual(['declaraFormula', 'notas']);
    const r = datosPedidoSchema.parse({ nombre: 'Intruso', telefono: '3000000000', notas: 'Gracias' });
    expect(r).toEqual({ notas: 'Gracias', declaraFormula: false });
  });

  it('las notas son opcionales y tienen tope', () => {
    expect(datosPedidoSchema.safeParse({ notas: null }).success).toBe(true);
    expect(datosPedidoSchema.safeParse({ notas: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('nombre y celular (perfil y registro)', () => {
  const valido = { nombre: 'Laura Gómez', telefono: '+57 310 555 1234' };

  it('normaliza el celular con indicativo y espacios', () => {
    expect(datosPerfilSchema.parse(valido).telefono).toBe('3105551234');
  });

  it('rechaza teléfonos que no son colombianos', () => {
    expect(datosPerfilSchema.safeParse({ ...valido, telefono: '12345' }).success).toBe(false);
    expect(datosPerfilSchema.safeParse({ ...valido, telefono: '2001234567' }).success).toBe(false);
  });

  it('da un mensaje claro cuando falta el nombre', () => {
    const r = datosPerfilSchema.safeParse({ ...valido, nombre: null });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('Escribe tu nombre.');
  });
});

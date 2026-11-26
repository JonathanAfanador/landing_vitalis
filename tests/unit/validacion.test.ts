import { describe, expect, it } from 'vitest';
import { datosPedidoSchema } from '../../src/lib/validacion';

// Así llegan los datos de un formulario a la Action: los campos vacíos como undefined.
const valido = {
  nombre: 'Laura Gómez',
  telefono: '+57 310 555 1234',
  declaraFormula: false,
  aceptaDatos: true,
};

describe('datosPedidoSchema', () => {
  it('acepta un pedido válido y normaliza el teléfono', () => {
    const r = datosPedidoSchema.parse(valido);
    expect(r.telefono).toBe('3105551234');
    expect(r.email).toBeUndefined();
  });

  it('exige la autorización de la Ley 1581', () => {
    expect(datosPedidoSchema.safeParse({ ...valido, aceptaDatos: false }).success).toBe(false);
  });

  it('rechaza teléfonos que no son colombianos', () => {
    expect(datosPedidoSchema.safeParse({ ...valido, telefono: '12345' }).success).toBe(false);
    expect(datosPedidoSchema.safeParse({ ...valido, telefono: '2001234567' }).success).toBe(false);
  });

  it('da un mensaje claro cuando falta un campo obligatorio', () => {
    const r = datosPedidoSchema.safeParse({ ...valido, nombre: null });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('Escribe tu nombre.');
  });

  it('valida el correo solo si se escribe', () => {
    expect(datosPedidoSchema.safeParse({ ...valido, email: null }).success).toBe(true);
    expect(datosPedidoSchema.safeParse({ ...valido, email: 'laura@correo' }).success).toBe(false);
  });

  it('rechaza el envío si el campo trampa trae texto', () => {
    expect(datosPedidoSchema.safeParse({ ...valido, sitioWeb: 'http://spam' }).success).toBe(false);
  });
});

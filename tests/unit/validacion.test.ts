import { describe, expect, it } from 'vitest';
import { pedidoSchema } from '../../src/lib/validacion';

const valido = {
  nombre: 'Laura Gómez',
  telefono: '+57 310 555 1234',
  email: '',
  direccion: 'Calle 19 # 10-25',
  municipio: 'Girardot',
  notas: '',
  declaraFormula: false,
  aceptaDatos: true,
  sitioWeb: '',
  items: [{ slug: 'antipulgas', cantidad: 2 }],
};

describe('pedidoSchema', () => {
  it('acepta un pedido válido y normaliza los datos', () => {
    const r = pedidoSchema.parse(valido);
    expect(r.telefono).toBe('3105551234');
    expect(r.email).toBeNull();
    expect(r.notas).toBeNull();
  });

  it('exige la autorización de la Ley 1581', () => {
    expect(pedidoSchema.safeParse({ ...valido, aceptaDatos: false }).success).toBe(false);
  });

  it('rechaza teléfonos que no son colombianos', () => {
    expect(pedidoSchema.safeParse({ ...valido, telefono: '12345' }).success).toBe(false);
    expect(pedidoSchema.safeParse({ ...valido, telefono: '2001234567' }).success).toBe(false);
  });

  it('rechaza carritos vacíos, repetidos o con cantidades fuera de rango', () => {
    expect(pedidoSchema.safeParse({ ...valido, items: [] }).success).toBe(false);
    expect(
      pedidoSchema.safeParse({
        ...valido,
        items: [
          { slug: 'antipulgas', cantidad: 1 },
          { slug: 'antipulgas', cantidad: 1 },
        ],
      }).success,
    ).toBe(false);
    expect(
      pedidoSchema.safeParse({ ...valido, items: [{ slug: 'antipulgas', cantidad: 100 }] }).success,
    ).toBe(false);
  });

  it('rechaza slugs con caracteres raros', () => {
    expect(
      pedidoSchema.safeParse({ ...valido, items: [{ slug: "x'; drop table", cantidad: 1 }] }).success,
    ).toBe(false);
  });

  it('rechaza el envío si el campo trampa trae texto', () => {
    expect(pedidoSchema.safeParse({ ...valido, sitioWeb: 'http://spam' }).success).toBe(false);
  });
});

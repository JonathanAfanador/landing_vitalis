import { describe, expect, it } from 'vitest';
import { formatoCOP, normalizarTelefono } from '../../src/lib/formato';
import { mensajePedido, enlaceWhatsApp } from '../../src/lib/whatsapp';

describe('formatoCOP', () => {
  it('formatea pesos colombianos sin decimales', () => {
    expect(formatoCOP(45_900).replace(/\s/g, ' ')).toBe('$ 45.900');
    expect(formatoCOP(1_250_000).replace(/\s/g, ' ')).toBe('$ 1.250.000');
  });
});

describe('normalizarTelefono', () => {
  it.each([
    ['300 123 4567', '3001234567'],
    ['+57 300-123-4567', '3001234567'],
    ['(601) 234 5678', '6012345678'],
  ])('%s → %s', (entrada, salida) => expect(normalizarTelefono(entrada)).toBe(salida));
});

describe('WhatsApp', () => {
  it('no genera enlace sin número', () => {
    expect(enlaceWhatsApp(null, 'Hola')).toBeNull();
  });

  it('codifica el mensaje del pedido', () => {
    const mensaje = mensajePedido({
      codigo: 'VIT-7K3Q9M',
      totalCop: 77_800,
      lineas: [{ nombre: 'Antipulgas', cantidad: 2 }],
    });
    expect(mensaje).toContain('VIT-7K3Q9M');
    expect(mensaje).toContain('2 × Antipulgas');
    expect(enlaceWhatsApp('573001234567', mensaje)).toMatch(/^https:\/\/wa\.me\/573001234567\?text=Hola%2C/);
  });
});

import { describe, expect, it } from 'vitest';
import { calcularPedido, generarCodigo, type MedicamentoParaPedido } from '../../src/lib/pedido';

const base: MedicamentoParaPedido = {
  id: 1,
  slug: 'antipulgas',
  nombre: 'Antipulgas',
  precioCop: 38_900,
  stock: 5,
  requiereFormula: false,
  activo: true,
};
const antibiotico: MedicamentoParaPedido = {
  ...base,
  id: 2,
  slug: 'antibiotico',
  nombre: 'Antibiótico',
  precioCop: 52_300,
  requiereFormula: true,
};

describe('calcularPedido', () => {
  it('usa los precios de la base de datos y suma el total', () => {
    const r = calcularPedido(
      [
        { slug: 'antipulgas', cantidad: 2 },
        { slug: 'antibiotico', cantidad: 1 },
      ],
      [base, antibiotico],
    );
    expect(r.totalCop).toBe(38_900 * 2 + 52_300);
    expect(r.lineas.map((l) => l.subtotalCop)).toEqual([77_800, 52_300]);
    expect(r.problemas).toEqual([]);
  });

  it('marca si algún medicamento requiere fórmula', () => {
    expect(calcularPedido([{ slug: 'antipulgas', cantidad: 1 }], [base]).requiereFormula).toBe(false);
    expect(calcularPedido([{ slug: 'antibiotico', cantidad: 1 }], [antibiotico]).requiereFormula).toBe(true);
  });

  it('avisa cuando no hay stock suficiente', () => {
    const r = calcularPedido([{ slug: 'antipulgas', cantidad: 6 }], [base]);
    expect(r.problemas).toEqual([{ slug: 'antipulgas', motivo: 'sin-stock', disponible: 5 }]);
  });

  it('avisa cuando el medicamento no existe o está inactivo', () => {
    const r = calcularPedido(
      [
        { slug: 'no-existe', cantidad: 1 },
        { slug: 'antipulgas', cantidad: 1 },
      ],
      [{ ...base, activo: false }],
    );
    expect(r.problemas.map((p) => p.motivo)).toEqual(['no-disponible', 'no-disponible']);
    expect(r.lineas).toEqual([]);
    expect(r.totalCop).toBe(0);
  });
});

describe('generarCodigo', () => {
  it('cumple el formato que exige la base de datos', () => {
    for (let i = 0; i < 200; i++) expect(generarCodigo()).toMatch(/^VIT-[A-Z2-9]{6}$/);
  });

  it('no usa caracteres que se confunden al dictarlos', () => {
    const aleatorio = Array.from({ length: 200 }, () => generarCodigo().slice(4)).join('');
    expect(aleatorio).not.toMatch(/[IO01]/);
  });
});

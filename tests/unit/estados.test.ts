import { describe, expect, it } from 'vitest';
import { origenesPedido, puedePasarPedido, siguientesPedido } from '../../src/lib/estados';

describe('máquina de estados del pedido', () => {
  it('sigue el camino pendiente → confirmado → pagado → entregado', () => {
    expect(puedePasarPedido('pendiente', 'confirmado')).toBe(true);
    expect(puedePasarPedido('confirmado', 'pagado')).toBe(true);
    expect(puedePasarPedido('pagado', 'entregado')).toBe(true);
  });

  it('no permite saltarse pasos ni volver atrás', () => {
    expect(puedePasarPedido('pendiente', 'pagado')).toBe(false);
    expect(puedePasarPedido('pendiente', 'entregado')).toBe(false);
    expect(puedePasarPedido('confirmado', 'entregado')).toBe(false);
    expect(puedePasarPedido('pagado', 'confirmado')).toBe(false);
  });

  it('solo se cancela desde pendiente o confirmado', () => {
    expect(origenesPedido('cancelado')).toEqual(['pendiente', 'confirmado']);
    expect(puedePasarPedido('pagado', 'cancelado')).toBe(false);
    expect(puedePasarPedido('cancelado', 'cancelado')).toBe(false);
  });

  it('entregado y cancelado son estados finales', () => {
    expect(siguientesPedido('entregado')).toEqual([]);
    expect(siguientesPedido('cancelado')).toEqual([]);
  });
});

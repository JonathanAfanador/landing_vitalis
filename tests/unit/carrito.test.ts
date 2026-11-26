import { describe, expect, it } from 'vitest';
import {
  codificarCarrito,
  decodificarCarrito,
  fijarCantidad,
  MAX_ITEMS,
  totalUnidades,
} from '../../src/lib/carrito';

describe('cookie del carrito', () => {
  it('codifica y decodifica sin perder nada', () => {
    const items = [
      { slug: 'antipulgas', cantidad: 2 },
      { slug: 'condroprotector-articular', cantidad: 1 },
    ];
    expect(codificarCarrito(items)).toBe('antipulgas.2|condroprotector-articular.1');
    expect(decodificarCarrito(codificarCarrito(items))).toEqual(items);
  });

  it('descarta lo que no cumple el formato (cookie editada a mano)', () => {
    expect(decodificarCarrito("antipulgas.2|<script>.1|x'or 1.3|bueno.0|otro.100|ok.abc|valido.5")).toEqual([
      { slug: 'antipulgas', cantidad: 2 },
      { slug: 'valido', cantidad: 5 },
    ]);
    expect(decodificarCarrito(undefined)).toEqual([]);
    expect(decodificarCarrito('')).toEqual([]);
  });

  it(`no acepta más de ${MAX_ITEMS} medicamentos distintos`, () => {
    const enorme = Array.from({ length: 50 }, (_, i) => `m${i}.1`).join('|');
    expect(decodificarCarrito(enorme)).toHaveLength(MAX_ITEMS);
  });
});

describe('fijarCantidad', () => {
  const base = [{ slug: 'a', cantidad: 1 }];

  it('agrega, cambia y quita respetando el orden', () => {
    const conB = fijarCantidad(base, 'b', 3);
    expect(conB).toEqual([
      { slug: 'a', cantidad: 1 },
      { slug: 'b', cantidad: 3 },
    ]);
    expect(fijarCantidad(conB, 'a', 4)[0]).toEqual({ slug: 'a', cantidad: 4 });
    expect(fijarCantidad(conB, 'a', 0)).toEqual([{ slug: 'b', cantidad: 3 }]);
    expect(totalUnidades(conB)).toBe(4);
  });

  it('limita la cantidad a 99 y nunca deja negativos', () => {
    expect(fijarCantidad(base, 'a', 500)[0]?.cantidad).toBe(99);
    expect(fijarCantidad(base, 'a', -3)).toEqual([]);
  });
});

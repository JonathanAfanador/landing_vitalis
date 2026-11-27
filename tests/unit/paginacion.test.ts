import { describe, expect, it } from 'vitest';
import { desplazamiento, leerPagina, paginasVisibles, totalPaginas } from '../../src/admin/paginacion';

describe('paginación del panel', () => {
  it('lee la página de la URL y descarta valores raros', () => {
    expect(leerPagina('3')).toBe(3);
    for (const raro of [null, '', '0', '-2', '1.5', 'abc', '9999999']) expect(leerPagina(raro)).toBe(1);
  });

  it('calcula el desplazamiento y el total de páginas', () => {
    expect(desplazamiento(1)).toBe(0);
    expect(desplazamiento(3, 50)).toBe(100);
    expect(totalPaginas(0)).toBe(1);
    expect(totalPaginas(25)).toBe(1);
    expect(totalPaginas(26)).toBe(2);
    expect(totalPaginas(132, 50)).toBe(3);
  });

  it('muestra la primera, la última y las vecinas, con "…" en los saltos', () => {
    expect(paginasVisibles(1, 1)).toEqual([1]);
    expect(paginasVisibles(1, 5)).toEqual([1, 2, null, 5]);
    expect(paginasVisibles(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    // Si el salto es de una sola página, se muestra el número en vez de "…".
    expect(paginasVisibles(3, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(paginasVisibles(10, 10)).toEqual([1, null, 9, 10]);
  });
});

// Paginación de los listados del panel por número de página (?pagina=2). Los volúmenes de una clínica son
// pequeños, así que LIMIT/OFFSET con un conteo total es suficiente y permite mostrar "Página 2 de 6".
export const POR_PAGINA = 25;

export const leerPagina = (valor: string | null) => {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 && n <= 100_000 ? n : 1;
};

export const desplazamiento = (pagina: number, porPagina = POR_PAGINA) => (pagina - 1) * porPagina;

export const totalPaginas = (total: number, porPagina = POR_PAGINA) =>
  Math.max(1, Math.ceil(total / porPagina));

// Números a mostrar: la primera, la última y las vecinas de la actual; null es un "…".
export function paginasVisibles(actual: number, total: number): (number | null)[] {
  const visibles = [...new Set([1, actual - 1, actual, actual + 1, total])]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
  return visibles.flatMap((n, i) => {
    const anterior = visibles[i - 1];
    if (anterior === undefined || n - anterior === 1) return [n];
    return n - anterior === 2 ? [anterior + 1, n] : [null, n];
  });
}

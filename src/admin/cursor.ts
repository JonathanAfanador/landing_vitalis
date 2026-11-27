// Cursor de los listados del panel que van del más reciente al más antiguo: (created_at, id) en base64url.
// La fecha viaja como texto con microsegundos; con Date se truncaría y el cursor saltaría filas.
export type CursorFecha = { fecha: string; id: number };

export const leerCursorFecha = (valor: string | null): CursorFecha | null => {
  if (!valor) return null;
  try {
    const [fecha, id] = JSON.parse(Buffer.from(valor, 'base64url').toString()) as unknown[];
    return typeof fecha === 'string' && Number.isInteger(id) ? { fecha, id: id as number } : null;
  } catch {
    return null;
  }
};

// Recibe limite + 1 filas: si sobra una, hay página siguiente y el cursor apunta a la última mostrada.
export function paginar<T extends { fechaExacta: string; id: number }>(filas: T[], limite: number) {
  const pagina = filas.length > limite ? filas.slice(0, limite) : filas;
  const ultimo = pagina.at(-1);
  return {
    pagina,
    siguienteCursor:
      filas.length > limite && ultimo
        ? Buffer.from(JSON.stringify([ultimo.fechaExacta, ultimo.id])).toString('base64url')
        : null,
  };
}

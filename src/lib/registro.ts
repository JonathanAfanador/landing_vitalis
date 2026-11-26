// Único punto de registro de errores del servidor. En Vercel, lo que se escribe en la salida de error
// aparece en Logs, que es donde se diagnostican los fallos en producción. Se escribe en JSON (una línea por
// evento) para poder filtrarlo, y nunca se registran datos personales: solo el contexto y el error técnico.
export function registrarError(contexto: string, error: unknown) {
  const detalle =
    error instanceof Error ? { mensaje: error.message, pila: error.stack } : { mensaje: String(error) };
  console.error(JSON.stringify({ nivel: 'error', contexto, fecha: new Date().toISOString(), ...detalle }));
}

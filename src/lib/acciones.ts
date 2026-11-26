import { ActionError } from 'astro:actions';

// Astro devuelve el mensaje de cualquier error inesperado tal cual, también en producción. Con Drizzle ese
// mensaje trae el SQL y sus parámetros (datos personales incluidos). Este envoltorio lo registra en el
// servidor y responde con un mensaje genérico. Los ActionError propios pasan sin cambios.
export const protegerErrores =
  <Args extends unknown[], R>(handler: (...args: Args) => Promise<R>) =>
  async (...args: Args): Promise<R> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ActionError) throw error;
      console.error('[action] error inesperado', error);
      throw new ActionError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'No pudimos completar la operación. Inténtalo de nuevo en unos segundos.',
      });
    }
  };

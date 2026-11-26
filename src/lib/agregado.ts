import type { AstroGlobal } from 'astro';
import { actions } from 'astro:actions';

// Resultado de "Agregar al pedido" cuando llega sin JavaScript (formulario normal). Si salió bien, se redirige
// a la misma página con ?agregado=1 (así recargar no reenvía el formulario). El aviso es un texto fijo: nada
// de lo que se muestra sale de la URL, que la CDN guarda en caché.
export function resultadoAgregar(Astro: AstroGlobal) {
  const resultado = Astro.getActionResult(actions.carrito.agregar);
  if (resultado?.data) {
    const destino = new URL(Astro.url);
    destino.searchParams.delete('_action');
    destino.searchParams.set('agregado', '1');
    return { redireccion: destino.pathname + destino.search, mensaje: null, error: null };
  }
  return {
    redireccion: null,
    mensaje: Astro.url.searchParams.has('agregado') ? 'Agregamos el medicamento a tu pedido.' : null,
    error: resultado?.error?.message ?? null,
  };
}

// Solo las respuestas GET se guardan en la CDN; las de un formulario (POST) nunca.
export const cachearEnCdn = (Astro: AstroGlobal) => {
  if (Astro.request.method === 'GET') {
    Astro.response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  }
};

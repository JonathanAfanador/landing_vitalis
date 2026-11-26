import type { AstroCookies } from 'astro';
import { codificarCarrito, decodificarCarrito, totalUnidades } from './carrito';
import type { ItemCarrito } from './validacion';

// El carrito va en una cookie HttpOnly: el navegador no la puede leer ni modificar con JavaScript.
const COOKIE_CARRITO = 'vitalis_carrito';
// Solo el número de unidades, para el contador de la bolsa. Se lee en el navegador porque las páginas de la
// tienda se guardan en la caché de la CDN y no pueden llevar datos de cada persona en el HTML.
export const COOKIE_UNIDADES = 'vitalis_carrito_n';
const DURACION = 60 * 60 * 24 * 30; // 30 días

export const leerCarrito = (cookies: AstroCookies) => decodificarCarrito(cookies.get(COOKIE_CARRITO)?.value);

export function guardarCarrito(cookies: AstroCookies, items: ItemCarrito[]) {
  if (!items.length) return vaciarCarrito(cookies);
  const comunes = { path: '/', sameSite: 'lax', secure: true, maxAge: DURACION } as const;
  cookies.set(COOKIE_CARRITO, codificarCarrito(items), { ...comunes, httpOnly: true });
  cookies.set(COOKIE_UNIDADES, String(totalUnidades(items)), comunes);
}

export function vaciarCarrito(cookies: AstroCookies) {
  cookies.delete(COOKIE_CARRITO, { path: '/' });
  cookies.delete(COOKIE_UNIDADES, { path: '/' });
}

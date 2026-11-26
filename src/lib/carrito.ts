import { SLUG, type ItemCarrito } from './validacion';

// El carrito viaja en una cookie con el formato `slug.cantidad|slug.cantidad`. Solo guarda qué y cuánto:
// precio y stock siempre se leen de la base de datos. Quien edite la cookie solo cambia su propio carrito,
// y todo lo que no cumpla el formato se descarta al leerla.
export const MAX_ITEMS = 30;
export const MAX_CANTIDAD = 99;

export function decodificarCarrito(valor: string | undefined): ItemCarrito[] {
  if (!valor) return [];
  const items = new Map<string, number>();
  for (const parte of valor.split('|').slice(0, MAX_ITEMS)) {
    const [slug, texto] = parte.split('.');
    const cantidad = Number(texto);
    if (!slug || !SLUG.test(slug) || slug.length > 140) continue;
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_CANTIDAD) continue;
    items.set(slug, cantidad);
  }
  return [...items].map(([slug, cantidad]) => ({ slug, cantidad }));
}

export const codificarCarrito = (items: ItemCarrito[]) =>
  items.map(({ slug, cantidad }) => `${slug}.${cantidad}`).join('|');

// Fija la cantidad de un medicamento (0 lo quita). Respeta el orden en que se agregaron.
export function fijarCantidad(items: ItemCarrito[], slug: string, cantidad: number): ItemCarrito[] {
  const nueva = Math.min(Math.max(0, Math.trunc(cantidad)), MAX_CANTIDAD);
  const existe = items.some((i) => i.slug === slug);
  if (!nueva) return items.filter((i) => i.slug !== slug);
  if (existe) return items.map((i) => (i.slug === slug ? { slug, cantidad: nueva } : i));
  return items.length >= MAX_ITEMS ? items : [...items, { slug, cantidad: nueva }];
}

export const cantidadDe = (items: ItemCarrito[], slug: string) =>
  items.find((i) => i.slug === slug)?.cantidad ?? 0;

export const totalUnidades = (items: ItemCarrito[]) => items.reduce((n, i) => n + i.cantidad, 0);

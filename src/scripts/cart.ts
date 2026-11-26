import type { ItemCarrito } from '../lib/validacion';

// El carrito solo guarda slug y cantidad: precios y stock siempre se piden al servidor.
const CLAVE = 'vitalis:carrito';
const EVENTO = 'carrito:cambio';
const MAX_CANTIDAD = 99;

export function leerCarrito(): ItemCarrito[] {
  try {
    const datos: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
    return Array.isArray(datos)
      ? datos.filter(
          (i): i is ItemCarrito =>
            typeof i?.slug === 'string' && Number.isInteger(i?.cantidad) && i.cantidad > 0,
        )
      : [];
  } catch {
    return [];
  }
}

function guardar(items: ItemCarrito[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(items));
  } catch {
    // Sin almacenamiento (modo privado estricto): el carrito vive solo en esta página.
  }
  document.dispatchEvent(new CustomEvent(EVENTO, { detail: items }));
}

export function cambiarCantidad(slug: string, cantidad: number) {
  const items = leerCarrito().filter((i) => i.slug !== slug || cantidad > 0);
  const item = items.find((i) => i.slug === slug);
  const nueva = Math.min(cantidad, MAX_CANTIDAD);
  if (item) item.cantidad = nueva;
  else if (cantidad > 0) items.push({ slug, cantidad: nueva });
  guardar(items);
}

export function agregar(slug: string, cantidad = 1) {
  const actual = leerCarrito().find((i) => i.slug === slug)?.cantidad ?? 0;
  cambiarCantidad(slug, actual + cantidad);
}

export const vaciarCarrito = () => guardar([]);

export const totalUnidades = (items = leerCarrito()) => items.reduce((n, i) => n + i.cantidad, 0);

export function alCambiar(callback: (items: ItemCarrito[]) => void) {
  document.addEventListener(EVENTO, (e) => callback((e as CustomEvent<ItemCarrito[]>).detail));
  // Otra pestaña cambió el carrito.
  window.addEventListener('storage', (e) => {
    if (e.key === CLAVE) callback(leerCarrito());
  });
}

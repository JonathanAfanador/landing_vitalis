import type { ItemCarrito } from './validacion';

export type MedicamentoParaPedido = {
  id: number;
  slug: string;
  nombre: string;
  precioCop: number;
  stock: number;
  requiereFormula: boolean;
  activo: boolean;
};

export type LineaPedido = {
  medicamentoId: number;
  slug: string;
  nombre: string;
  cantidad: number;
  precioUnitarioCop: number;
  subtotalCop: number;
  requiereFormula: boolean;
  stock: number;
};

export type Problema =
  { slug: string; motivo: 'no-disponible' } | { slug: string; motivo: 'sin-stock'; disponible: number };

// Cruza el carrito con los precios y el stock de la base de datos. El precio del navegador nunca se usa.
export function calcularPedido(items: ItemCarrito[], medicamentos: MedicamentoParaPedido[]) {
  const porSlug = new Map(medicamentos.map((m) => [m.slug, m]));
  const lineas: LineaPedido[] = [];
  const problemas: Problema[] = [];

  for (const { slug, cantidad } of items) {
    const m = porSlug.get(slug);
    if (!m || !m.activo) {
      problemas.push({ slug, motivo: 'no-disponible' });
      continue;
    }
    if (cantidad > m.stock) problemas.push({ slug, motivo: 'sin-stock', disponible: m.stock });
    lineas.push({
      medicamentoId: m.id,
      slug,
      nombre: m.nombre,
      cantidad,
      precioUnitarioCop: m.precioCop,
      subtotalCop: m.precioCop * cantidad,
      requiereFormula: m.requiereFormula,
      stock: m.stock,
    });
  }

  return {
    lineas,
    problemas,
    totalCop: lineas.reduce((total, l) => total + l.subtotalCop, 0),
    requiereFormula: lineas.some((l) => l.requiereFormula),
  };
}

// VIT-7K3Q9M: sin I, O, 0 ni 1 para que se pueda dictar por teléfono sin confusiones.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generarCodigo() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `VIT-${Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('')}`;
}

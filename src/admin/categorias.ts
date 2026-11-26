import { randomBytes } from 'node:crypto';
import { asc, eq, sql } from 'drizzle-orm';
import { dbAdmin, type TxAdmin } from '../db/client-admin';
import { categorias, medicamentos } from '../db/schema';

export const listarCategoriasPanel = () =>
  dbAdmin
    .select({
      id: categorias.id,
      nombre: categorias.nombre,
      slug: categorias.slug,
      medicamentos: sql<number>`count(${medicamentos.id})::int`,
    })
    .from(categorias)
    .leftJoin(medicamentos, eq(medicamentos.categoriaId, categorias.id))
    .groupBy(categorias.id)
    .orderBy(asc(categorias.nombre));

const slugificar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'categoria';

// El slug (usado en los filtros de la tienda) se fija al crearla y no cambia al renombrar.
export async function crearCategoria(tx: TxAdmin, nombre: string) {
  const base = slugificar(nombre);
  for (const slug of [base, `${base}-${randomBytes(3).toString('hex')}`]) {
    const [nueva] = await tx
      .insert(categorias)
      .values({ nombre, slug })
      .onConflictDoNothing({ target: categorias.slug })
      .returning({ id: categorias.id });
    if (nueva) return nueva;
  }
  throw new Error('No se pudo generar un identificador único para la categoría');
}

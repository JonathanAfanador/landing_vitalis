import { and, asc, eq, exists, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '../client';
import { categorias, especies, medicamentoEspecie, medicamentos } from '../schema';

export type FiltrosTienda = {
  especie?: string | undefined;
  categoria?: string | undefined;
  q?: string | undefined;
  cursor?: string | undefined;
};

type Cursor = { nombre: string; id: number };

// Paginación por cursor (nombre, id): igual de rápida en la página 1 que en la 50.
const codificarCursor = (c: Cursor) => Buffer.from(JSON.stringify([c.nombre, c.id])).toString('base64url');

const leerCursor = (valor: string | undefined): Cursor | null => {
  if (!valor) return null;
  try {
    const [nombre, id] = JSON.parse(Buffer.from(valor, 'base64url').toString()) as unknown[];
    return typeof nombre === 'string' && Number.isInteger(id) ? { nombre, id: id as number } : null;
  } catch {
    return null;
  }
};

const escaparLike = (texto: string) => texto.replace(/[\\%_]/g, (c) => `\\${c}`);

// Solo se usa en consultas con JOIN: así Drizzle califica las columnas y la subconsulta se correlaciona bien.
const especiesDelMedicamento = sql<string[]>`coalesce((
  select array_agg(${especies.slug} order by ${especies.slug})
  from ${medicamentoEspecie}
  join ${especies} on ${especies.id} = ${medicamentoEspecie.especieId}
  where ${medicamentoEspecie.medicamentoId} = ${medicamentos.id}
), '{}')`;

const columnasTarjeta = {
  id: medicamentos.id,
  slug: medicamentos.slug,
  nombre: medicamentos.nombre,
  principioActivo: medicamentos.principioActivo,
  presentacion: medicamentos.presentacion,
  precioCop: medicamentos.precioCop,
  stock: medicamentos.stock,
  requiereFormula: medicamentos.requiereFormula,
  imagen: medicamentos.imagen,
  categoria: categorias.nombre,
  categoriaSlug: categorias.slug,
  especies: especiesDelMedicamento,
};

export async function listarMedicamentos(filtros: FiltrosTienda, limite = 24) {
  const cursor = leerCursor(filtros.cursor);
  const q = filtros.q?.trim().slice(0, 60);
  const patron = q ? `%${escaparLike(q)}%` : null;

  const filas = await db
    .select(columnasTarjeta)
    .from(medicamentos)
    .innerJoin(categorias, eq(categorias.id, medicamentos.categoriaId))
    .where(
      and(
        eq(medicamentos.activo, true),
        filtros.categoria ? eq(categorias.slug, filtros.categoria) : undefined,
        filtros.especie
          ? exists(
              db
                .select({ uno: sql`1` })
                .from(medicamentoEspecie)
                .innerJoin(especies, eq(especies.id, medicamentoEspecie.especieId))
                .where(
                  and(
                    eq(medicamentoEspecie.medicamentoId, medicamentos.id),
                    eq(especies.slug, filtros.especie),
                  ),
                ),
            )
          : undefined,
        patron
          ? or(ilike(medicamentos.nombre, patron), ilike(medicamentos.principioActivo, patron))
          : undefined,
        cursor
          ? sql`(${medicamentos.nombre}, ${medicamentos.id}) > (${cursor.nombre}::text, ${cursor.id}::bigint)`
          : undefined,
      ),
    )
    .orderBy(asc(medicamentos.nombre), asc(medicamentos.id))
    .limit(limite + 1);

  const hayMas = filas.length > limite;
  const pagina = hayMas ? filas.slice(0, limite) : filas;
  const ultimo = pagina.at(-1);
  return {
    medicamentos: pagina,
    siguienteCursor: hayMas && ultimo ? codificarCursor(ultimo) : null,
  };
}

export async function obtenerMedicamento(slug: string) {
  const [fila] = await db
    .select({
      ...columnasTarjeta,
      laboratorio: medicamentos.laboratorio,
      registroIca: medicamentos.registroIca,
    })
    .from(medicamentos)
    .innerJoin(categorias, eq(categorias.id, medicamentos.categoriaId))
    .where(and(eq(medicamentos.slug, slug), eq(medicamentos.activo, true)))
    .limit(1);
  return fila ?? null;
}

export async function medicamentosParaPedido(slugs: string[]) {
  if (!slugs.length) return [];
  return db
    .select({
      id: medicamentos.id,
      slug: medicamentos.slug,
      nombre: medicamentos.nombre,
      precioCop: medicamentos.precioCop,
      stock: medicamentos.stock,
      requiereFormula: medicamentos.requiereFormula,
      activo: medicamentos.activo,
    })
    .from(medicamentos)
    .where(inArray(medicamentos.slug, slugs));
}

export const listarCategorias = () =>
  db
    .select({ slug: categorias.slug, nombre: categorias.nombre })
    .from(categorias)
    .orderBy(asc(categorias.nombre));

export const listarEspecies = () =>
  db.select({ slug: especies.slug, nombre: especies.nombre }).from(especies).orderBy(asc(especies.nombre));

export type TarjetaMedicamento = Awaited<ReturnType<typeof listarMedicamentos>>['medicamentos'][number];
export type FichaMedicamento = NonNullable<Awaited<ReturnType<typeof obtenerMedicamento>>>;

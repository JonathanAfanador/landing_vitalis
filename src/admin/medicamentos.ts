import { randomBytes } from 'node:crypto';
import { and, asc, count, eq, ilike, or, sql } from 'drizzle-orm';
import { dbAdmin, type TxAdmin } from '../db/client-admin';
import { categorias, especies, medicamentoEspecie, medicamentos, pedidoItems } from '../db/schema';
import { desplazamiento, POR_PAGINA } from './paginacion';

export type DatosMedicamento = {
  nombre: string;
  principioActivo: string;
  presentacion: string;
  laboratorio: string;
  registroIca: string | null;
  requiereFormula: boolean;
  precioCop: number;
  categoriaId: number;
  especies: number[];
};

// Listado del panel: incluye inactivos, con búsqueda, filtros y paginación por número de página.
export async function listarMedicamentosPanel(filtros: {
  q: string;
  categoriaId: number | null;
  estado: 'activos' | 'inactivos' | 'todos';
  pagina: number;
}) {
  const patron = filtros.q ? `%${filtros.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const donde = and(
    filtros.estado === 'todos' ? undefined : eq(medicamentos.activo, filtros.estado === 'activos'),
    filtros.categoriaId ? eq(medicamentos.categoriaId, filtros.categoriaId) : undefined,
    patron ? or(ilike(medicamentos.nombre, patron), ilike(medicamentos.principioActivo, patron)) : undefined,
  );
  const [filas, [conteo]] = await Promise.all([
    dbAdmin
      .select({
        id: medicamentos.id,
        nombre: medicamentos.nombre,
        slug: medicamentos.slug,
        presentacion: medicamentos.presentacion,
        precioCop: medicamentos.precioCop,
        stock: medicamentos.stock,
        activo: medicamentos.activo,
        requiereFormula: medicamentos.requiereFormula,
        categoria: categorias.nombre,
      })
      .from(medicamentos)
      .innerJoin(categorias, eq(categorias.id, medicamentos.categoriaId))
      .where(donde)
      .orderBy(asc(medicamentos.nombre), asc(medicamentos.id))
      .limit(POR_PAGINA)
      .offset(desplazamiento(filtros.pagina)),
    dbAdmin.select({ total: count() }).from(medicamentos).where(donde),
  ]);
  return { medicamentos: filas, total: conteo?.total ?? 0 };
}

export async function obtenerMedicamentoPanel(id: number) {
  const [fila] = await dbAdmin
    .select({
      id: medicamentos.id,
      nombre: medicamentos.nombre,
      slug: medicamentos.slug,
      principioActivo: medicamentos.principioActivo,
      presentacion: medicamentos.presentacion,
      laboratorio: medicamentos.laboratorio,
      registroIca: medicamentos.registroIca,
      requiereFormula: medicamentos.requiereFormula,
      precioCop: medicamentos.precioCop,
      stock: medicamentos.stock,
      activo: medicamentos.activo,
      categoriaId: medicamentos.categoriaId,
      especies: sql<
        number[]
      >`coalesce(array_agg(${medicamentoEspecie.especieId}) filter (where ${medicamentoEspecie.especieId} is not null), '{}')`,
    })
    .from(medicamentos)
    .leftJoin(medicamentoEspecie, eq(medicamentoEspecie.medicamentoId, medicamentos.id))
    .where(eq(medicamentos.id, id))
    .groupBy(medicamentos.id);
  return fila ? { ...fila, especies: fila.especies.map(Number) } : null;
}

export type MedicamentoPanel = NonNullable<Awaited<ReturnType<typeof obtenerMedicamentoPanel>>>;

export const listarEspeciesPanel = () =>
  dbAdmin.select({ id: especies.id, nombre: especies.nombre }).from(especies).orderBy(asc(especies.nombre));

const slugificar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100) || 'medicamento';

async function fijarEspecies(tx: TxAdmin, medicamentoId: number, ids: number[]) {
  await tx.delete(medicamentoEspecie).where(eq(medicamentoEspecie.medicamentoId, medicamentoId));
  if (ids.length)
    await tx.insert(medicamentoEspecie).values(ids.map((especieId) => ({ medicamentoId, especieId })));
}

// El slug sale del nombre y la presentación y no cambia después (lo usan los enlaces de la tienda).
export async function crearMedicamento(tx: TxAdmin, datos: DatosMedicamento & { stock: number }) {
  const base = slugificar(`${datos.nombre} ${datos.presentacion}`);
  const { especies: idsEspecies, ...columnas } = datos;
  for (const slug of [base, `${base}-${randomBytes(3).toString('hex')}`]) {
    const [nuevo] = await tx
      .insert(medicamentos)
      .values({ ...columnas, slug, activo: true })
      .onConflictDoNothing({ target: medicamentos.slug })
      .returning({ id: medicamentos.id, slug: medicamentos.slug });
    if (nuevo) {
      await fijarEspecies(tx, nuevo.id, idsEspecies);
      return nuevo;
    }
  }
  throw new Error('No se pudo generar un identificador único para el medicamento');
}

export async function actualizarMedicamento(
  tx: TxAdmin,
  id: number,
  datos: DatosMedicamento & { activo: boolean },
) {
  const { especies: idsEspecies, ...columnas } = datos;
  await tx.update(medicamentos).set(columnas).where(eq(medicamentos.id, id));
  await fijarEspecies(tx, id, idsEspecies);
}

// Devuelve el stock anterior para la auditoría. Bloquea la fila para no pisar un pedido que se esté creando.
export async function ajustarStock(tx: TxAdmin, id: number, nuevo: number) {
  const [actual] = await tx
    .select({ stock: medicamentos.stock })
    .from(medicamentos)
    .where(eq(medicamentos.id, id))
    .for('update');
  if (!actual) return null;
  await tx.update(medicamentos).set({ stock: nuevo }).where(eq(medicamentos.id, id));
  return actual.stock;
}

export async function vecesEnPedidos(id: number) {
  const [fila] = await dbAdmin
    .select({ total: count() })
    .from(pedidoItems)
    .where(eq(pedidoItems.medicamentoId, id));
  return fila?.total ?? 0;
}

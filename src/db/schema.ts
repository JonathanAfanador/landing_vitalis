import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// Todo vive en el schema `vitalis`: separado de lo que cree el proveedor y con permisos propios.
export const vitalis = pgSchema('vitalis');

const id = () => bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity();
const creado = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const actualizado = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const SLUG = sql.raw(`'^[a-z0-9]+(-[a-z0-9]+)*$'`);

export const estadoPedido = vitalis.enum('estado_pedido', [
  'pendiente',
  'confirmado',
  'enviado',
  'entregado',
  'cancelado',
]);

export const especies = vitalis.table(
  'especies',
  {
    id: id(),
    nombre: text('nombre').notNull().unique(),
    slug: text('slug').notNull().unique(),
  },
  (t) => [check('especies_slug_formato', sql`${t.slug} ~ ${SLUG}`)],
);

export const categorias = vitalis.table(
  'categorias',
  {
    id: id(),
    nombre: text('nombre').notNull().unique(),
    slug: text('slug').notNull().unique(),
  },
  (t) => [check('categorias_slug_formato', sql`${t.slug} ~ ${SLUG}`)],
);

export const medicamentos = vitalis.table(
  'medicamentos',
  {
    id: id(),
    nombre: text('nombre').notNull(),
    slug: text('slug').notNull().unique(),
    principioActivo: text('principio_activo').notNull(),
    presentacion: text('presentacion').notNull(),
    laboratorio: text('laboratorio').notNull(),
    registroIca: text('registro_ica'),
    requiereFormula: boolean('requiere_formula').notNull().default(false),
    precioCop: integer('precio_cop').notNull(),
    stock: integer('stock').notNull().default(0),
    activo: boolean('activo').notNull().default(true),
    imagen: text('imagen'),
    categoriaId: bigint('categoria_id', { mode: 'number' })
      .notNull()
      .references(() => categorias.id, { onDelete: 'restrict' }),
    createdAt: creado(),
    updatedAt: actualizado(),
  },
  (t) => [
    check('medicamentos_slug_formato', sql`${t.slug} ~ ${SLUG}`),
    check('medicamentos_nombre_largo', sql`char_length(${t.nombre}) between 2 and 120`),
    check('medicamentos_precio_positivo', sql`${t.precioCop} > 0`),
    check('medicamentos_stock_no_negativo', sql`${t.stock} >= 0`),
    index('medicamentos_categoria_id_idx').on(t.categoriaId),
    // La tienda lista activos ordenados por nombre y pagina por (nombre, id).
    index('medicamentos_activos_nombre_idx')
      .on(t.nombre, t.id)
      .where(sql`${t.activo}`),
  ],
);

export const medicamentoEspecie = vitalis.table(
  'medicamento_especie',
  {
    medicamentoId: bigint('medicamento_id', { mode: 'number' })
      .notNull()
      .references(() => medicamentos.id, { onDelete: 'cascade' }),
    especieId: bigint('especie_id', { mode: 'number' })
      .notNull()
      .references(() => especies.id, { onDelete: 'restrict' }),
  },
  (t) => [
    primaryKey({ columns: [t.medicamentoId, t.especieId] }),
    index('medicamento_especie_especie_id_idx').on(t.especieId),
  ],
);

export const pedidos = vitalis.table(
  'pedidos',
  {
    id: id(),
    codigo: text('codigo').notNull().unique(),
    nombreCliente: text('nombre_cliente').notNull(),
    telefono: text('telefono').notNull(),
    email: text('email'),
    direccion: text('direccion').notNull(),
    municipio: text('municipio').notNull(),
    estado: estadoPedido('estado').notNull().default('pendiente'),
    totalCop: integer('total_cop').notNull(),
    notas: text('notas'),
    declaraFormula: boolean('declara_formula').notNull().default(false),
    aceptaTratamientoDatos: boolean('acepta_tratamiento_datos').notNull(),
    ipHash: text('ip_hash').notNull(),
    createdAt: creado(),
    updatedAt: actualizado(),
  },
  (t) => [
    check('pedidos_codigo_formato', sql`${t.codigo} ~ '^VIT-[A-Z2-9]{6}$'`),
    check('pedidos_telefono_formato', sql`${t.telefono} ~ '^[0-9]{10}$'`),
    check('pedidos_total_no_negativo', sql`${t.totalCop} >= 0`),
    check('pedidos_acepta_datos', sql`${t.aceptaTratamientoDatos}`),
    check('pedidos_nombre_largo', sql`char_length(${t.nombreCliente}) between 2 and 80`),
    check('pedidos_notas_largo', sql`char_length(${t.notas}) <= 500`),
    index('pedidos_estado_created_at_idx').on(t.estado, t.createdAt.desc()),
    index('pedidos_ip_hash_created_at_idx').on(t.ipHash, t.createdAt),
  ],
);

export const pedidoItems = vitalis.table(
  'pedido_items',
  {
    pedidoId: bigint('pedido_id', { mode: 'number' })
      .notNull()
      .references(() => pedidos.id, { onDelete: 'cascade' }),
    medicamentoId: bigint('medicamento_id', { mode: 'number' })
      .notNull()
      .references(() => medicamentos.id, { onDelete: 'restrict' }),
    cantidad: integer('cantidad').notNull(),
    precioUnitarioCop: integer('precio_unitario_cop').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.pedidoId, t.medicamentoId] }),
    check('pedido_items_cantidad', sql`${t.cantidad} between 1 and 99`),
    check('pedido_items_precio_positivo', sql`${t.precioUnitarioCop} > 0`),
    index('pedido_items_medicamento_id_idx').on(t.medicamentoId),
  ],
);

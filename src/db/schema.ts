import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
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

// Solo venta y recogida en la clínica: pendiente → confirmado → pagado → entregado, o cancelado.
export const estadoPedido = vitalis.enum('estado_pedido', [
  'pendiente',
  'confirmado',
  'pagado',
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
    // Ya no se piden (solo recogida en la clínica). Se conservan para los pedidos antiguos.
    direccion: text('direccion'),
    municipio: text('municipio'),
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

// ─── Panel: usuarios, roles, permisos, sesiones y auditoría ───────────────────────────────────

export const roles = vitalis.table(
  'roles',
  {
    id: id(),
    slug: text('slug').notNull().unique(),
    nombre: text('nombre').notNull().unique(),
    descripcion: text('descripcion'),
    // Los roles de sistema (superadmin, admin, usuario) no se borran ni se renombran; un trigger lo garantiza.
    esSistema: boolean('es_sistema').notNull().default(false),
    createdAt: creado(),
    updatedAt: actualizado(),
  },
  (t) => [
    check('roles_slug_formato', sql`${t.slug} ~ ${SLUG}`),
    check('roles_nombre_largo', sql`char_length(${t.nombre}) between 2 and 60`),
    check('roles_descripcion_largo', sql`char_length(${t.descripcion}) <= 300`),
  ],
);

// Copia del catálogo que vive en el código (src/admin/permisos.ts). Lo sincroniza un script.
export const permisos = vitalis.table(
  'permisos',
  {
    id: id(),
    codigo: text('codigo').notNull().unique(),
    modulo: text('modulo').notNull(),
    nombre: text('nombre').notNull(),
    descripcion: text('descripcion').notNull(),
    datosPersonales: boolean('datos_personales').notNull().default(false),
  },
  (t) => [check('permisos_codigo_formato', sql`${t.codigo} ~ '^[a-z_]+:[a-z_]+$'`)],
);

export const rolPermiso = vitalis.table(
  'rol_permiso',
  {
    rolId: bigint('rol_id', { mode: 'number' })
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permisoId: bigint('permiso_id', { mode: 'number' })
      .notNull()
      .references(() => permisos.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.rolId, t.permisoId] }),
    index('rol_permiso_permiso_id_idx').on(t.permisoId),
  ],
);

export const usuarios = vitalis.table(
  'usuarios',
  {
    id: id(),
    nombre: text('nombre').notNull(),
    email: text('email').notNull(),
    claveHash: text('clave_hash').notNull(),
    rolId: bigint('rol_id', { mode: 'number' })
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    activo: boolean('activo').notNull().default(true),
    debeCambiarClave: boolean('debe_cambiar_clave').notNull().default(true),
    ultimoAcceso: timestamp('ultimo_acceso', { withTimezone: true }),
    createdAt: creado(),
    updatedAt: actualizado(),
  },
  (t) => [
    uniqueIndex('usuarios_email_unique').on(sql`lower(${t.email})`),
    index('usuarios_rol_id_idx').on(t.rolId),
    check('usuarios_nombre_largo', sql`char_length(${t.nombre}) between 2 and 80`),
    check(
      'usuarios_email_formato',
      sql`${t.email} ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' and char_length(${t.email}) <= 120`,
    ),
    check('usuarios_clave_formato', sql`${t.claveHash} like 'scrypt$%'`),
  ],
);

export const sesiones = vitalis.table(
  'sesiones',
  {
    // Solo el SHA-256 del token: quien lea la tabla no puede usar las sesiones.
    tokenHash: text('token_hash').primaryKey(),
    usuarioId: bigint('usuario_id', { mode: 'number' })
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    expiraEn: timestamp('expira_en', { withTimezone: true }).notNull(),
    ultimoUso: timestamp('ultimo_uso', { withTimezone: true }).notNull().defaultNow(),
    createdAt: creado(),
  },
  (t) => [index('sesiones_usuario_id_idx').on(t.usuarioId), index('sesiones_expira_en_idx').on(t.expiraEn)],
);

export const EVENTOS_AUDITORIA = [
  'login_ok',
  'login_fallido',
  'logout',
  'clave_cambiada',
  'clave_restablecida',
  'usuario_creado',
  'usuario_desactivado',
  'usuario_reactivado',
  'rol_asignado',
  'rol_creado',
  'rol_editado',
  'rol_eliminado',
  'permisos_rol_cambiados',
  'medicamento_creado',
  'medicamento_editado',
  'medicamento_eliminado',
  'stock_ajustado',
  'categoria_creada',
  'categoria_editada',
  'categoria_eliminada',
  'pedido_estado_cambiado',
  'cita_estado_cambiado',
] as const;
export type EventoAuditoria = (typeof EVENTOS_AUDITORIA)[number];

// Solo se inserta y se lee: el rol del panel no tiene UPDATE ni DELETE sobre esta tabla.
export const auditoria = vitalis.table(
  'auditoria',
  {
    id: id(),
    createdAt: creado(),
    actorId: bigint('actor_id', { mode: 'number' }).references(() => usuarios.id, { onDelete: 'restrict' }),
    evento: text('evento').$type<EventoAuditoria>().notNull(),
    entidad: text('entidad'),
    entidadId: text('entidad_id'),
    ipHash: text('ip_hash'),
    // HMAC del correo en los intentos de login: sirve para el límite aunque la cuenta no exista.
    sujetoHash: text('sujeto_hash'),
    detalle: jsonb('detalle').$type<Record<string, unknown>>(),
  },
  (t) => [
    check(
      'auditoria_evento_valido',
      sql.raw(`evento in (${EVENTOS_AUDITORIA.map((e) => `'${e}'`).join(', ')})`),
    ),
    index('auditoria_created_at_id_idx').on(t.createdAt.desc(), t.id.desc()),
    index('auditoria_actor_id_idx').on(t.actorId),
    index('auditoria_login_idx').on(t.evento, t.sujetoHash, t.createdAt),
    index('auditoria_login_ip_idx').on(t.evento, t.ipHash, t.createdAt),
  ],
);

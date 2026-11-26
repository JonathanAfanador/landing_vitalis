CREATE SCHEMA "vitalis";
--> statement-breakpoint
CREATE TYPE "vitalis"."estado_pedido" AS ENUM('pendiente', 'confirmado', 'enviado', 'entregado', 'cancelado');--> statement-breakpoint
CREATE TABLE "vitalis"."categorias" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vitalis"."categorias_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "categorias_nombre_unique" UNIQUE("nombre"),
	CONSTRAINT "categorias_slug_unique" UNIQUE("slug"),
	CONSTRAINT "categorias_slug_formato" CHECK ("vitalis"."categorias"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "vitalis"."especies" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vitalis"."especies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "especies_nombre_unique" UNIQUE("nombre"),
	CONSTRAINT "especies_slug_unique" UNIQUE("slug"),
	CONSTRAINT "especies_slug_formato" CHECK ("vitalis"."especies"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "vitalis"."medicamento_especie" (
	"medicamento_id" bigint NOT NULL,
	"especie_id" bigint NOT NULL,
	CONSTRAINT "medicamento_especie_medicamento_id_especie_id_pk" PRIMARY KEY("medicamento_id","especie_id")
);
--> statement-breakpoint
CREATE TABLE "vitalis"."medicamentos" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vitalis"."medicamentos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"slug" text NOT NULL,
	"principio_activo" text NOT NULL,
	"presentacion" text NOT NULL,
	"laboratorio" text NOT NULL,
	"registro_ica" text,
	"requiere_formula" boolean DEFAULT false NOT NULL,
	"precio_cop" integer NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"imagen" text,
	"categoria_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "medicamentos_slug_unique" UNIQUE("slug"),
	CONSTRAINT "medicamentos_slug_formato" CHECK ("vitalis"."medicamentos"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "medicamentos_nombre_largo" CHECK (char_length("vitalis"."medicamentos"."nombre") between 2 and 120),
	CONSTRAINT "medicamentos_precio_positivo" CHECK ("vitalis"."medicamentos"."precio_cop" > 0),
	CONSTRAINT "medicamentos_stock_no_negativo" CHECK ("vitalis"."medicamentos"."stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vitalis"."pedido_items" (
	"pedido_id" bigint NOT NULL,
	"medicamento_id" bigint NOT NULL,
	"cantidad" integer NOT NULL,
	"precio_unitario_cop" integer NOT NULL,
	CONSTRAINT "pedido_items_pedido_id_medicamento_id_pk" PRIMARY KEY("pedido_id","medicamento_id"),
	CONSTRAINT "pedido_items_cantidad" CHECK ("vitalis"."pedido_items"."cantidad" between 1 and 99),
	CONSTRAINT "pedido_items_precio_positivo" CHECK ("vitalis"."pedido_items"."precio_unitario_cop" > 0)
);
--> statement-breakpoint
CREATE TABLE "vitalis"."pedidos" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vitalis"."pedidos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"codigo" text NOT NULL,
	"nombre_cliente" text NOT NULL,
	"telefono" text NOT NULL,
	"email" text,
	"direccion" text NOT NULL,
	"municipio" text NOT NULL,
	"estado" "vitalis"."estado_pedido" DEFAULT 'pendiente' NOT NULL,
	"total_cop" integer NOT NULL,
	"notas" text,
	"declara_formula" boolean DEFAULT false NOT NULL,
	"acepta_tratamiento_datos" boolean NOT NULL,
	"ip_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pedidos_codigo_unique" UNIQUE("codigo"),
	CONSTRAINT "pedidos_codigo_formato" CHECK ("vitalis"."pedidos"."codigo" ~ '^VIT-[A-Z2-9]{6}$'),
	CONSTRAINT "pedidos_telefono_formato" CHECK ("vitalis"."pedidos"."telefono" ~ '^[0-9]{10}$'),
	CONSTRAINT "pedidos_total_no_negativo" CHECK ("vitalis"."pedidos"."total_cop" >= 0),
	CONSTRAINT "pedidos_acepta_datos" CHECK ("vitalis"."pedidos"."acepta_tratamiento_datos"),
	CONSTRAINT "pedidos_nombre_largo" CHECK (char_length("vitalis"."pedidos"."nombre_cliente") between 2 and 80),
	CONSTRAINT "pedidos_notas_largo" CHECK (char_length("vitalis"."pedidos"."notas") <= 500)
);
--> statement-breakpoint
ALTER TABLE "vitalis"."medicamento_especie" ADD CONSTRAINT "medicamento_especie_medicamento_id_medicamentos_id_fk" FOREIGN KEY ("medicamento_id") REFERENCES "vitalis"."medicamentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vitalis"."medicamento_especie" ADD CONSTRAINT "medicamento_especie_especie_id_especies_id_fk" FOREIGN KEY ("especie_id") REFERENCES "vitalis"."especies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vitalis"."medicamentos" ADD CONSTRAINT "medicamentos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "vitalis"."categorias"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vitalis"."pedido_items" ADD CONSTRAINT "pedido_items_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "vitalis"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vitalis"."pedido_items" ADD CONSTRAINT "pedido_items_medicamento_id_medicamentos_id_fk" FOREIGN KEY ("medicamento_id") REFERENCES "vitalis"."medicamentos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "medicamento_especie_especie_id_idx" ON "vitalis"."medicamento_especie" USING btree ("especie_id");--> statement-breakpoint
CREATE INDEX "medicamentos_categoria_id_idx" ON "vitalis"."medicamentos" USING btree ("categoria_id");--> statement-breakpoint
CREATE INDEX "medicamentos_activos_nombre_idx" ON "vitalis"."medicamentos" USING btree ("nombre","id") WHERE "vitalis"."medicamentos"."activo";--> statement-breakpoint
CREATE INDEX "pedido_items_medicamento_id_idx" ON "vitalis"."pedido_items" USING btree ("medicamento_id");--> statement-breakpoint
CREATE INDEX "pedidos_estado_created_at_idx" ON "vitalis"."pedidos" USING btree ("estado","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "pedidos_ip_hash_created_at_idx" ON "vitalis"."pedidos" USING btree ("ip_hash","created_at");
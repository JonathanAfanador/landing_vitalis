CREATE TABLE "vitalis"."auditoria" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vitalis"."auditoria_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" bigint,
	"evento" text NOT NULL,
	"entidad" text,
	"entidad_id" text,
	"ip_hash" text,
	"sujeto_hash" text,
	"detalle" jsonb,
	CONSTRAINT "auditoria_evento_valido" CHECK (evento in ('login_ok', 'login_fallido', 'logout', 'clave_cambiada', 'clave_restablecida', 'usuario_creado', 'usuario_desactivado', 'usuario_reactivado', 'rol_asignado', 'rol_creado', 'rol_editado', 'rol_eliminado', 'permisos_rol_cambiados', 'medicamento_creado', 'medicamento_editado', 'medicamento_eliminado', 'stock_ajustado', 'categoria_creada', 'categoria_editada', 'categoria_eliminada', 'pedido_estado_cambiado', 'cita_estado_cambiado'))
);
--> statement-breakpoint
CREATE TABLE "vitalis"."permisos" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vitalis"."permisos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"codigo" text NOT NULL,
	"modulo" text NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text NOT NULL,
	"datos_personales" boolean DEFAULT false NOT NULL,
	CONSTRAINT "permisos_codigo_unique" UNIQUE("codigo"),
	CONSTRAINT "permisos_codigo_formato" CHECK ("vitalis"."permisos"."codigo" ~ '^[a-z_]+:[a-z_]+$')
);
--> statement-breakpoint
CREATE TABLE "vitalis"."rol_permiso" (
	"rol_id" bigint NOT NULL,
	"permiso_id" bigint NOT NULL,
	CONSTRAINT "rol_permiso_rol_id_permiso_id_pk" PRIMARY KEY("rol_id","permiso_id")
);
--> statement-breakpoint
CREATE TABLE "vitalis"."roles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vitalis"."roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"es_sistema" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_slug_unique" UNIQUE("slug"),
	CONSTRAINT "roles_nombre_unique" UNIQUE("nombre"),
	CONSTRAINT "roles_slug_formato" CHECK ("vitalis"."roles"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "roles_nombre_largo" CHECK (char_length("vitalis"."roles"."nombre") between 2 and 60),
	CONSTRAINT "roles_descripcion_largo" CHECK (char_length("vitalis"."roles"."descripcion") <= 300)
);
--> statement-breakpoint
CREATE TABLE "vitalis"."sesiones" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"usuario_id" bigint NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"ultimo_uso" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vitalis"."usuarios" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vitalis"."usuarios_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"clave_hash" text NOT NULL,
	"rol_id" bigint NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"debe_cambiar_clave" boolean DEFAULT true NOT NULL,
	"ultimo_acceso" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_nombre_largo" CHECK (char_length("vitalis"."usuarios"."nombre") between 2 and 80),
	CONSTRAINT "usuarios_email_formato" CHECK ("vitalis"."usuarios"."email" ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' and char_length("vitalis"."usuarios"."email") <= 120),
	CONSTRAINT "usuarios_clave_formato" CHECK ("vitalis"."usuarios"."clave_hash" like 'scrypt$%')
);
--> statement-breakpoint
ALTER TABLE "vitalis"."auditoria" ADD CONSTRAINT "auditoria_actor_id_usuarios_id_fk" FOREIGN KEY ("actor_id") REFERENCES "vitalis"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vitalis"."rol_permiso" ADD CONSTRAINT "rol_permiso_rol_id_roles_id_fk" FOREIGN KEY ("rol_id") REFERENCES "vitalis"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vitalis"."rol_permiso" ADD CONSTRAINT "rol_permiso_permiso_id_permisos_id_fk" FOREIGN KEY ("permiso_id") REFERENCES "vitalis"."permisos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vitalis"."sesiones" ADD CONSTRAINT "sesiones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "vitalis"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vitalis"."usuarios" ADD CONSTRAINT "usuarios_rol_id_roles_id_fk" FOREIGN KEY ("rol_id") REFERENCES "vitalis"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auditoria_created_at_id_idx" ON "vitalis"."auditoria" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "auditoria_actor_id_idx" ON "vitalis"."auditoria" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "auditoria_login_idx" ON "vitalis"."auditoria" USING btree ("evento","sujeto_hash","created_at");--> statement-breakpoint
CREATE INDEX "auditoria_login_ip_idx" ON "vitalis"."auditoria" USING btree ("evento","ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "rol_permiso_permiso_id_idx" ON "vitalis"."rol_permiso" USING btree ("permiso_id");--> statement-breakpoint
CREATE INDEX "sesiones_usuario_id_idx" ON "vitalis"."sesiones" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "sesiones_expira_en_idx" ON "vitalis"."sesiones" USING btree ("expira_en");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_email_unique" ON "vitalis"."usuarios" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "usuarios_rol_id_idx" ON "vitalis"."usuarios" USING btree ("rol_id");
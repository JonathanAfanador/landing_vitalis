CREATE TYPE "vitalis"."estado_cita" AS ENUM('solicitada', 'confirmada', 'atendida', 'no_asistio', 'cancelada');--> statement-breakpoint
CREATE TYPE "vitalis"."franja_cita" AS ENUM('manana', 'tarde');--> statement-breakpoint
CREATE TABLE "vitalis"."solicitudes_cita" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vitalis"."solicitudes_cita_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"codigo" text NOT NULL,
	"nombre_tutor" text NOT NULL,
	"telefono" text NOT NULL,
	"especie_id" bigint NOT NULL,
	"nombre_mascota" text NOT NULL,
	"motivo" text NOT NULL,
	"fecha_preferida" date,
	"franja" "vitalis"."franja_cita",
	"estado" "vitalis"."estado_cita" DEFAULT 'solicitada' NOT NULL,
	"notas_internas" text,
	"acepta_tratamiento_datos" boolean NOT NULL,
	"ip_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "solicitudes_cita_codigo_unique" UNIQUE("codigo"),
	CONSTRAINT "solicitudes_cita_codigo_formato" CHECK ("vitalis"."solicitudes_cita"."codigo" ~ '^CIT-[A-Z2-9]{6}$'),
	CONSTRAINT "solicitudes_cita_telefono_formato" CHECK ("vitalis"."solicitudes_cita"."telefono" ~ '^[0-9]{10}$'),
	CONSTRAINT "solicitudes_cita_acepta_datos" CHECK ("vitalis"."solicitudes_cita"."acepta_tratamiento_datos"),
	CONSTRAINT "solicitudes_cita_tutor_largo" CHECK (char_length("vitalis"."solicitudes_cita"."nombre_tutor") between 2 and 80),
	CONSTRAINT "solicitudes_cita_mascota_largo" CHECK (char_length("vitalis"."solicitudes_cita"."nombre_mascota") between 1 and 60),
	CONSTRAINT "solicitudes_cita_motivo_largo" CHECK (char_length("vitalis"."solicitudes_cita"."motivo") between 5 and 500),
	CONSTRAINT "solicitudes_cita_notas_largo" CHECK (char_length("vitalis"."solicitudes_cita"."notas_internas") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "vitalis"."solicitudes_cita" ADD CONSTRAINT "solicitudes_cita_especie_id_especies_id_fk" FOREIGN KEY ("especie_id") REFERENCES "vitalis"."especies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "solicitudes_cita_estado_created_at_idx" ON "vitalis"."solicitudes_cita" USING btree ("estado","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "solicitudes_cita_ip_hash_created_at_idx" ON "vitalis"."solicitudes_cita" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "solicitudes_cita_especie_id_idx" ON "vitalis"."solicitudes_cita" USING btree ("especie_id");
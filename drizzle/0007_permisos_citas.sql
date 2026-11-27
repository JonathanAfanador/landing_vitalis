-- Citas (entrega 4C). La web pública crea solicitudes y solo lee lo necesario para el límite de envíos
-- y para devolver el código: nunca los datos del tutor. INSERT por tabla porque Drizzle nombra todas las columnas.
GRANT INSERT ON vitalis.solicitudes_cita TO vitalis_app;
--> statement-breakpoint
GRANT SELECT (id, codigo, ip_hash, created_at) ON vitalis.solicitudes_cita TO vitalis_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE vitalis.solicitudes_cita_id_seq TO vitalis_app;
--> statement-breakpoint
-- El panel lee las solicitudes y solo cambia su estado y las notas internas. Nunca edita lo que escribió el tutor.
GRANT SELECT ON vitalis.solicitudes_cita TO vitalis_admin;
--> statement-breakpoint
GRANT UPDATE (estado, notas_internas, updated_at) ON vitalis.solicitudes_cita TO vitalis_admin;

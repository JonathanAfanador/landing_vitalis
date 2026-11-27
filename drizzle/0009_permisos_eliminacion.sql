-- Eliminación lógica de pedidos y citas (solo el superadmin, lo controla la app). El panel solo marca o
-- desmarca la eliminación: nunca borra filas, así que no hay GRANT DELETE.
GRANT UPDATE (eliminado_en, eliminado_por) ON vitalis.pedidos TO vitalis_admin;
--> statement-breakpoint
GRANT UPDATE (eliminada_en, eliminada_por) ON vitalis.solicitudes_cita TO vitalis_admin;

-- Permisos del panel para la entrega 4B: catálogo (medicamentos, categorías, especies) y pedidos.
-- INSERT por tabla porque Drizzle nombra todas las columnas; los UPDATE son por columna.
GRANT SELECT ON vitalis.especies TO vitalis_admin;
--> statement-breakpoint
-- El slug de una categoría no cambia (lo usan los enlaces de la tienda); solo se renombra.
GRANT SELECT, INSERT, DELETE ON vitalis.categorias TO vitalis_admin;
--> statement-breakpoint
GRANT UPDATE (nombre) ON vitalis.categorias TO vitalis_admin;
--> statement-breakpoint
-- El slug de un medicamento tampoco cambia (enlaces y pedidos). El DELETE solo prospera si nunca estuvo
-- en un pedido: la FK de pedido_items es RESTRICT.
GRANT SELECT, INSERT, DELETE ON vitalis.medicamentos TO vitalis_admin;
--> statement-breakpoint
GRANT UPDATE (nombre, principio_activo, presentacion, laboratorio, registro_ica, requiere_formula, precio_cop, stock, activo, categoria_id, updated_at) ON vitalis.medicamentos TO vitalis_admin;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON vitalis.medicamento_especie TO vitalis_admin;
--> statement-breakpoint
-- Pedidos: el panel los lee y solo cambia su estado. Nunca edita datos del cliente ni montos.
GRANT SELECT ON vitalis.pedidos, vitalis.pedido_items TO vitalis_admin;
--> statement-breakpoint
GRANT UPDATE (estado, updated_at) ON vitalis.pedidos TO vitalis_admin;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE vitalis.medicamentos_id_seq, vitalis.categorias_id_seq TO vitalis_admin;

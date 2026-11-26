-- Rol con el que se conecta la web. Sin LOGIN hasta que se le asigne contraseña a mano:
--   ALTER ROLE vitalis_app WITH LOGIN PASSWORD '...';
-- Solo tiene los permisos que la web necesita, nada de DELETE ni de DDL.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vitalis_app') THEN
    CREATE ROLE vitalis_app NOLOGIN;
  END IF;
END $$;
--> statement-breakpoint
ALTER ROLE vitalis_app SET statement_timeout = '5s';
--> statement-breakpoint
ALTER ROLE vitalis_app SET idle_in_transaction_session_timeout = '10s';
--> statement-breakpoint
GRANT USAGE ON SCHEMA vitalis TO vitalis_app;
--> statement-breakpoint
GRANT SELECT ON vitalis.especies, vitalis.categorias, vitalis.medicamentos, vitalis.medicamento_especie TO vitalis_app;
--> statement-breakpoint
-- Crear un pedido descuenta stock: la web puede tocar solo esas dos columnas (y bloquear la fila con FOR UPDATE).
GRANT UPDATE (stock, updated_at) ON vitalis.medicamentos TO vitalis_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON vitalis.pedidos, vitalis.pedido_items TO vitalis_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE vitalis.pedidos_id_seq TO vitalis_app;
--> statement-breakpoint
-- Datos de referencia reales: especies que atiende la clínica y categorías iniciales de la tienda.
INSERT INTO vitalis.especies (nombre, slug) VALUES
  ('Perros', 'perro'),
  ('Gatos', 'gato')
ON CONFLICT (slug) DO NOTHING;
--> statement-breakpoint
INSERT INTO vitalis.categorias (nombre, slug) VALUES
  ('Antiparasitarios', 'antiparasitarios'),
  ('Antibióticos', 'antibioticos'),
  ('Antiinflamatorios', 'antiinflamatorios'),
  ('Analgésicos', 'analgesicos'),
  ('Dermatológicos', 'dermatologicos'),
  ('Articulares', 'articulares')
ON CONFLICT (slug) DO NOTHING;

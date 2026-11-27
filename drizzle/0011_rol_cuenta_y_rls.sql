-- Portal de clientes (entrega 4D). Tercer rol de base de datos, vitalis_cuenta, para leer y tocar SOLO los datos
-- del cliente con sesión. Cada consulta corre en una transacción con set_config('vitalis.usuario_id', id, true)
-- y RLS filtra las filas: aunque una consulta olvide el WHERE, no puede ver datos de otra persona.
-- Sin LOGIN hasta que se le asigne contraseña a mano: ALTER ROLE vitalis_cuenta WITH LOGIN PASSWORD '...';
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vitalis_cuenta') THEN
    CREATE ROLE vitalis_cuenta NOLOGIN;
  END IF;
END $$;
--> statement-breakpoint
ALTER ROLE vitalis_cuenta SET statement_timeout = '5s';
--> statement-breakpoint
ALTER ROLE vitalis_cuenta SET idle_in_transaction_session_timeout = '10s';
--> statement-breakpoint
GRANT USAGE ON SCHEMA vitalis TO vitalis_cuenta;
--> statement-breakpoint
-- Lo que muestra el portal. Nada de IP, notas internas ni datos de quien eliminó.
GRANT SELECT ON vitalis.especies TO vitalis_cuenta;
--> statement-breakpoint
GRANT SELECT (id, nombre) ON vitalis.medicamentos TO vitalis_cuenta;
--> statement-breakpoint
GRANT SELECT (id, codigo, estado, total_cop, created_at, usuario_id, eliminado_en) ON vitalis.pedidos TO vitalis_cuenta;
--> statement-breakpoint
GRANT SELECT (pedido_id, medicamento_id, cantidad, precio_unitario_cop) ON vitalis.pedido_items TO vitalis_cuenta;
--> statement-breakpoint
GRANT SELECT (id, codigo, especie_id, nombre_mascota, motivo, fecha_preferida, franja, estado, created_at, usuario_id, eliminada_en) ON vitalis.solicitudes_cita TO vitalis_cuenta;
--> statement-breakpoint
-- Cancelar sus citas: solo el estado (la política de abajo solo deja pasar a "cancelada").
GRANT UPDATE (estado, updated_at) ON vitalis.solicitudes_cita TO vitalis_cuenta;
--> statement-breakpoint
-- Su perfil: ve nombre, correo y celular; cambia nombre y celular. La contraseña va por el núcleo de sesiones.
GRANT SELECT (id, nombre, email, telefono, created_at) ON vitalis.usuarios TO vitalis_cuenta;
--> statement-breakpoint
GRANT UPDATE (nombre, telefono, updated_at) ON vitalis.usuarios TO vitalis_cuenta;
--> statement-breakpoint
-- Cuenta de la transacción actual (null si no se fijó: entonces RLS no deja ver nada).
CREATE OR REPLACE FUNCTION vitalis.cuenta_actual() RETURNS bigint
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('vitalis.usuario_id', true), '')::bigint $$;
--> statement-breakpoint
-- RLS. El dueño de las tablas (migraciones y scripts) no está sujeto a RLS. Los otros dos roles reciben
-- políticas explícitas que mantienen exactamente lo que ya podían hacer con sus GRANT.
ALTER TABLE vitalis.usuarios ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY usuarios_panel ON vitalis.usuarios TO vitalis_admin USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY usuarios_cuenta ON vitalis.usuarios TO vitalis_cuenta
  USING (id = vitalis.cuenta_actual()) WITH CHECK (id = vitalis.cuenta_actual());
--> statement-breakpoint
ALTER TABLE vitalis.pedidos ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY pedidos_panel ON vitalis.pedidos TO vitalis_admin USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY pedidos_web_leer ON vitalis.pedidos FOR SELECT TO vitalis_app USING (true);
--> statement-breakpoint
CREATE POLICY pedidos_web_crear ON vitalis.pedidos FOR INSERT TO vitalis_app WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY pedidos_cuenta ON vitalis.pedidos FOR SELECT TO vitalis_cuenta
  USING (usuario_id = vitalis.cuenta_actual() AND eliminado_en IS NULL);
--> statement-breakpoint
ALTER TABLE vitalis.pedido_items ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY pedido_items_panel ON vitalis.pedido_items TO vitalis_admin USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY pedido_items_web_leer ON vitalis.pedido_items FOR SELECT TO vitalis_app USING (true);
--> statement-breakpoint
CREATE POLICY pedido_items_web_crear ON vitalis.pedido_items FOR INSERT TO vitalis_app WITH CHECK (true);
--> statement-breakpoint
-- La subconsulta pasa por la política de pedidos: solo ve las líneas de sus propios pedidos.
CREATE POLICY pedido_items_cuenta ON vitalis.pedido_items FOR SELECT TO vitalis_cuenta
  USING (EXISTS (SELECT 1 FROM vitalis.pedidos p WHERE p.id = pedido_id));
--> statement-breakpoint
ALTER TABLE vitalis.solicitudes_cita ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY citas_panel ON vitalis.solicitudes_cita TO vitalis_admin USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY citas_web_leer ON vitalis.solicitudes_cita FOR SELECT TO vitalis_app USING (true);
--> statement-breakpoint
CREATE POLICY citas_web_crear ON vitalis.solicitudes_cita FOR INSERT TO vitalis_app WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY citas_cuenta_leer ON vitalis.solicitudes_cita FOR SELECT TO vitalis_cuenta
  USING (usuario_id = vitalis.cuenta_actual() AND eliminada_en IS NULL);
--> statement-breakpoint
CREATE POLICY citas_cuenta_cancelar ON vitalis.solicitudes_cita FOR UPDATE TO vitalis_cuenta
  USING (usuario_id = vitalis.cuenta_actual() AND eliminada_en IS NULL AND estado IN ('solicitada', 'confirmada'))
  WITH CHECK (usuario_id = vitalis.cuenta_actual() AND estado = 'cancelada');
--> statement-breakpoint
-- Derecho de supresión (Ley 1581). Una sola operación atómica con permisos de dueño, porque el panel no puede
-- editar los datos personales de pedidos y citas: anonimiza la cuenta, cierra sus sesiones, quita los datos
-- personales de sus pedidos y citas (se conservan como registro de ventas) y cancela sus citas pendientes.
CREATE OR REPLACE FUNCTION vitalis.eliminar_cuenta_cliente(p_usuario bigint) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = vitalis, pg_temp
  AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vitalis.usuarios u JOIN vitalis.roles r ON r.id = u.rol_id
    WHERE u.id = p_usuario AND r.slug = 'usuario'
  ) THEN
    RAISE EXCEPTION 'Solo se eliminan cuentas de clientes';
  END IF;

  UPDATE vitalis.usuarios
  SET nombre = 'Cuenta eliminada', email = 'eliminada-' || p_usuario || '@cuentas.invalid', telefono = NULL,
      clave_hash = 'scrypt$cuenta-eliminada', activo = false, acepta_datos_en = NULL, updated_at = now()
  WHERE id = p_usuario;

  DELETE FROM vitalis.sesiones WHERE usuario_id = p_usuario;

  UPDATE vitalis.pedidos
  SET nombre_cliente = 'Cuenta eliminada', telefono = '0000000000', email = NULL, notas = NULL,
      direccion = NULL, municipio = NULL, updated_at = now()
  WHERE usuario_id = p_usuario;

  UPDATE vitalis.solicitudes_cita
  SET nombre_tutor = 'Cuenta eliminada', telefono = '0000000000', nombre_mascota = 'Eliminado',
      motivo = 'Datos eliminados por el titular', notas_internas = NULL,
      estado = CASE WHEN estado IN ('solicitada', 'confirmada') THEN 'cancelada'::vitalis.estado_cita ELSE estado END,
      updated_at = now()
  WHERE usuario_id = p_usuario;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION vitalis.eliminar_cuenta_cliente(bigint) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION vitalis.eliminar_cuenta_cliente(bigint) TO vitalis_admin;

-- Cambios del portal pedidos por el usuario:
-- 1. Las citas ya no se cancelan desde el portal (se hace por WhatsApp): fuera la política y el permiso de UPDATE.
DROP POLICY IF EXISTS citas_cuenta_cancelar ON vitalis.solicitudes_cita;
--> statement-breakpoint
REVOKE UPDATE ON vitalis.solicitudes_cita FROM vitalis_cuenta;
--> statement-breakpoint
-- 2. La eliminación de la cuenta pasa a ser una solicitud: el cliente solo marca o retira la fecha en su fila
--    (RLS: la política usuarios_cuenta ya limita a la propia fila). La ejecuta el superadmin desde el panel.
GRANT SELECT (eliminacion_solicitada_en) ON vitalis.usuarios TO vitalis_cuenta;
--> statement-breakpoint
GRANT UPDATE (eliminacion_solicitada_en) ON vitalis.usuarios TO vitalis_cuenta;
--> statement-breakpoint
-- La supresión también borra la marca de la solicitud (ya atendida).
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
      clave_hash = 'scrypt$cuenta-eliminada', activo = false, acepta_datos_en = NULL,
      eliminacion_solicitada_en = NULL, updated_at = now()
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

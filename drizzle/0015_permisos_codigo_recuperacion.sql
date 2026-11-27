-- Código de recuperación de contraseña (opción B, sin servicio de correo). Lo maneja el núcleo de sesiones con
-- vitalis_admin, igual que la contraseña. El portal (vitalis_cuenta) no puede leerlo ni cambiarlo.
GRANT UPDATE (codigo_recuperacion_hash, codigo_recuperacion_en) ON vitalis.usuarios TO vitalis_admin;
--> statement-breakpoint
-- El perfil muestra cuándo se generó el código (la fecha, nunca el hash).
GRANT SELECT (codigo_recuperacion_en) ON vitalis.usuarios TO vitalis_cuenta;
--> statement-breakpoint
-- La supresión de una cuenta también borra su código.
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
      eliminacion_solicitada_en = NULL, codigo_recuperacion_hash = NULL, codigo_recuperacion_en = NULL,
      updated_at = now()
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

-- Rol de base de datos del panel. Igual que vitalis_app: sin LOGIN hasta asignarle contraseña a mano:
--   ALTER ROLE vitalis_admin WITH LOGIN PASSWORD '...';
-- La 4A solo le da lo que usan la autenticación, los roles y la auditoría. Cada entrega suma lo suyo.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vitalis_admin') THEN
    CREATE ROLE vitalis_admin NOLOGIN;
  END IF;
END $$;
--> statement-breakpoint
ALTER ROLE vitalis_admin SET statement_timeout = '5s';
--> statement-breakpoint
ALTER ROLE vitalis_admin SET idle_in_transaction_session_timeout = '10s';
--> statement-breakpoint
GRANT USAGE ON SCHEMA vitalis TO vitalis_admin;
--> statement-breakpoint
GRANT SELECT ON vitalis.permisos TO vitalis_admin;
--> statement-breakpoint
-- INSERT por tabla porque Drizzle nombra todas las columnas (con DEFAULT) y PostgreSQL exige permiso sobre
-- cada una. Que la app no cree roles de sistema lo garantiza el trigger proteger_roles_sistema.
-- UPDATE sí es por columna: es_sistema y slug no se pueden cambiar desde la app.
GRANT SELECT, INSERT, DELETE ON vitalis.roles TO vitalis_admin;
--> statement-breakpoint
GRANT UPDATE (nombre, descripcion, updated_at) ON vitalis.roles TO vitalis_admin;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON vitalis.rol_permiso TO vitalis_admin;
--> statement-breakpoint
-- Los usuarios no se borran (se desactivan) y el correo no cambia.
GRANT SELECT, INSERT ON vitalis.usuarios TO vitalis_admin;
--> statement-breakpoint
GRANT UPDATE (nombre, clave_hash, rol_id, activo, debe_cambiar_clave, ultimo_acceso, updated_at) ON vitalis.usuarios TO vitalis_admin;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON vitalis.sesiones TO vitalis_admin;
--> statement-breakpoint
-- Auditoría de solo inserción y lectura: nadie desde la app puede editar ni borrar el registro.
GRANT SELECT, INSERT ON vitalis.auditoria TO vitalis_admin;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE vitalis.roles_id_seq, vitalis.usuarios_id_seq, vitalis.auditoria_id_seq TO vitalis_admin;
--> statement-breakpoint
-- La web pública deja de poder leer los datos personales de los pedidos: solo lo que necesita para
-- el límite de envíos y para devolver el código al crear el pedido.
REVOKE SELECT ON vitalis.pedidos FROM vitalis_app;
--> statement-breakpoint
GRANT SELECT (id, codigo, ip_hash, created_at) ON vitalis.pedidos TO vitalis_app;
--> statement-breakpoint
-- Nunca queda el sistema sin superadmin activo. El candado evita que dos cambios simultáneos
-- (cada uno viendo al otro superadmin todavía activo) lo dejen en cero.
CREATE OR REPLACE FUNCTION vitalis.proteger_ultimo_superadmin() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  rol_superadmin bigint;
BEGIN
  SELECT id INTO rol_superadmin FROM vitalis.roles WHERE slug = 'superadmin';
  IF OLD.rol_id = rol_superadmin AND OLD.activo
     AND (TG_OP = 'DELETE' OR NEW.rol_id <> rol_superadmin OR NOT NEW.activo) THEN
    PERFORM pg_advisory_xact_lock(hashtext('vitalis.superadmins'));
    IF NOT EXISTS (
      SELECT 1 FROM vitalis.usuarios WHERE rol_id = rol_superadmin AND activo AND id <> OLD.id
    ) THEN
      RAISE EXCEPTION 'No se puede dejar el sistema sin un superadmin activo'
        USING ERRCODE = 'P0001', HINT = 'ultimo_superadmin';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
--> statement-breakpoint
CREATE TRIGGER usuarios_proteger_ultimo_superadmin
  BEFORE UPDATE OF rol_id, activo OR DELETE ON vitalis.usuarios
  FOR EACH ROW EXECUTE FUNCTION vitalis.proteger_ultimo_superadmin();
--> statement-breakpoint
-- Los roles de sistema no se crean desde la app ni se borran ni se renombran.
-- Solo el dueño de la tabla (las migraciones) puede crear roles de sistema.
CREATE OR REPLACE FUNCTION vitalis.proteger_roles_sistema() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.es_sistema
     AND NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'vitalis.roles'::regclass), 'MEMBER') THEN
    RAISE EXCEPTION 'Los roles de sistema solo se crean en las migraciones' USING ERRCODE = 'P0001', HINT = 'rol_sistema';
  END IF;
  IF TG_OP = 'DELETE' AND OLD.es_sistema THEN
    RAISE EXCEPTION 'Los roles de sistema no se pueden eliminar' USING ERRCODE = 'P0001', HINT = 'rol_sistema';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.es_sistema
     AND (NEW.slug <> OLD.slug OR NEW.nombre <> OLD.nombre OR NOT NEW.es_sistema) THEN
    RAISE EXCEPTION 'Los roles de sistema no se pueden renombrar' USING ERRCODE = 'P0001', HINT = 'rol_sistema';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
--> statement-breakpoint
CREATE TRIGGER roles_proteger_sistema
  BEFORE INSERT OR UPDATE OR DELETE ON vitalis.roles
  FOR EACH ROW EXECUTE FUNCTION vitalis.proteger_roles_sistema();
--> statement-breakpoint
INSERT INTO vitalis.roles (slug, nombre, descripcion, es_sistema) VALUES
  ('superadmin', 'Superadministrador', 'Control total del panel. Es el único que gestiona roles y permisos.', true),
  ('admin', 'Administrador', 'Gestiona la operación: medicamentos, pedidos y citas.', true),
  ('usuario', 'Cliente', 'Cuenta de cliente del portal. Solo ve y gestiona lo suyo.', true)
ON CONFLICT (slug) DO NOTHING;

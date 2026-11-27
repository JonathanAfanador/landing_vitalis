# Fase 4 · Plan (Paso 0)

Autenticación, roles y permisos, panel `/admin`, citas y pendientes de la Fase 3. No hay código hasta que se apruebe.

Entregas: **4A** autenticación + RBAC + auditoría · **4B** medicamentos, categorías y pedidos (con el cambio a venta solo en tienda) · **4C** citas · **4D** portal de clientes.

## Decisiones del usuario (respuestas a la sección 11)

| Tema | Decisión |
| :-- | :-- |
| Rol `usuario` | Se crea **con permisos reales de cliente** y un portal mínimo (entrega 4D). Ver la sección 12 |
| Exportar CSV | **Pospuesto.** Queda en `docs/pendientes.md` y se recuerda al cerrar cada entrega |
| Envíos | **No hay domicilios: solo venta y recogida en la clínica.** Se quita `enviado` y se dejan de pedir dirección y municipio. Ver la sección 13 |
| Aviso por WhatsApp al confirmar | **No se hace ahora.** Queda en pendientes |
| Citas | **Se agendan por WhatsApp.** La administradora acomoda los horarios: el formulario guarda la solicitud y lleva al tutor a WhatsApp con el mensaje escrito. Ver la sección 17 |
| Pago | **Transferencia antes de recoger** (Nequi, Daviplata, cuenta o llave Bre-B). La clínica envía los datos de pago por WhatsApp al confirmar y marca el pedido como pagado en el panel. Nada de "pagas al recoger" |

---

## 1. Autenticación: sesiones propias

**Decisión: sesiones propias (~200 líneas) siguiendo el patrón de OWASP y de la guía de sesiones de Lucia**, sin librería.

| Opción | Por qué no / por qué sí |
| :-- | :-- |
| Lucia | Su autor la dejó de mantener en 2025 y recomienda escribir las sesiones a mano con su guía |
| Better Auth | Mantenida y completa, pero trae sus propias tablas y su plugin de roles. Choca con el schema `vitalis`, con los dos roles de base de datos y con el catálogo de permisos en código. Sería código de más para un solo panel |
| **Propias** | Poco código, todo bajo nuestro esquema y nuestros GRANT, sin dependencias |

Detalle:

- **Contraseñas: scrypt** de `node:crypto` con los parámetros de OWASP (N = 2^17, r = 8, p = 1, sal de 16 bytes, clave de 64 bytes, `maxmem` de 256 MB). Sin dependencias nativas. Se guarda como `scrypt$17$8$1$<sal>$<hash>`: si se suben los parámetros, el hash se rehace al iniciar sesión.
- **Comparación en tiempo constante** con `timingSafeEqual`. Si el correo no existe, se calcula igual un scrypt contra un hash falso: la respuesta tarda lo mismo y no revela si la cuenta existe.
- **Contraseña:** mínimo 12 caracteres, máximo 128, distinta del correo.
- **Sesiones en base de datos:** token aleatorio de 32 bytes. En la base solo se guarda su SHA-256; si alguien lee la tabla, no puede usar las sesiones.
- **Cookie** `__Host-vitalis_sesion`: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` y sin `Domain` (el prefijo `__Host-` lo obliga).
- **Expiración:** absoluta de 12 h e inactividad de 2 h. La fecha de último uso se actualiza como mucho cada 15 min, para no escribir en cada petición.
- **Invalidación:**
  - Cerrar sesión borra la sesión.
  - Cambiar contraseña o desactivar el usuario borra todas sus sesiones. Cambiarle el rol no hace falta: los permisos se leen en cada petición, así que el cambio surte efecto en la siguiente página sin obligarle a ingresar de nuevo.
  - Los **permisos se leen de la base en cada petición** (una consulta con JOIN). Por eso un cambio en los permisos de un rol surte efecto en la siguiente petición sin cerrar sesión.
- **Primer ingreso:** la columna `debe_cambiar_clave` obliga a pasar por `/admin/cambiar-clave` antes de usar el panel.

## 2. Dos roles de base de datos

| Rol | Conexión | Lo usa |
| :-- | :-- | :-- |
| `vitalis_app` | `DATABASE_URL` | Páginas públicas: tienda, pedido y citas |
| `vitalis_admin` | `DATABASE_URL_ADMIN` | Solo `/admin`, el login y sus Actions |

- **Separación en el código:** dos clientes, `src/db/client.ts` y `src/db/client-admin.ts`. Una regla de ESLint (`no-restricted-imports`) impide importar el cliente de admin fuera de `src/admin/`, `src/pages/admin/` y `src/actions/admin/`.
- **Qué protege:** un error de lógica o una inyección SQL en una página pública no puede leer usuarios, sesiones ni auditoría, ni cambiar pedidos.
- **Qué no protege:** si alguien ejecutara código arbitrario en el servidor, tendría las dos variables de entorno, porque comparten despliegue. Para eso hacen falta despliegues separados, que hoy sería exagerado.

### Permisos mínimos

**`vitalis_app` (se endurece respecto a la Fase 3):**

| Tabla | Permisos |
| :-- | :-- |
| especies, categorias, medicamentos, medicamento_especie | `SELECT` |
| medicamentos | `UPDATE (stock, updated_at)` |
| pedidos | `INSERT` y `SELECT` **solo de `id, codigo, ip_hash, created_at`**. Hoy puede leer la tabla entera; se le quita el acceso a los datos personales |
| pedido_items | `INSERT` |
| solicitudes_cita | `INSERT` y `SELECT (id, ip_hash, created_at)` para el límite de envíos |
| usuarios, sesiones, roles, permisos, rol_permiso, auditoria | **Nada** |

**`vitalis_admin`:**

| Tabla | Permisos |
| :-- | :-- |
| especies, permisos | `SELECT` |
| categorias | `SELECT, INSERT, UPDATE, DELETE` (el DELETE falla si tiene medicamentos, por `RESTRICT`) |
| medicamentos | `SELECT, INSERT, UPDATE, DELETE` (el DELETE solo prospera si nunca estuvo en un pedido, por `RESTRICT`) |
| medicamento_especie | `SELECT, INSERT, DELETE` |
| pedidos | `SELECT`, `UPDATE (estado, updated_at)` |
| pedido_items | `SELECT` |
| solicitudes_cita | `SELECT`, `UPDATE (estado, notas_internas, updated_at)` |
| usuarios | `SELECT, INSERT` y `UPDATE (nombre, clave_hash, rol_id, activo, debe_cambiar_clave, ultimo_acceso, updated_at)`. Sin DELETE (se desactivan) y el correo no cambia |
| sesiones | `SELECT, INSERT, UPDATE, DELETE` |
| roles | `SELECT, INSERT, DELETE` y `UPDATE (nombre, descripcion, updated_at)`. El trigger impide crear roles de sistema desde la app |
| rol_permiso | `SELECT, INSERT, DELETE` |
| auditoria | **`SELECT, INSERT`**. Sin UPDATE ni DELETE: es de solo escritura y lectura |

Más el `USAGE` de las secuencias necesarias. Los dos roles tienen `statement_timeout` de 5 s.

**Protección extra en la base** (si falla el código, la base lo frena):
- **Trigger en `usuarios`:** impide desactivar o cambiar de rol al **último superadmin activo**. Toma un candado (`pg_advisory_xact_lock`) para que dos cambios simultáneos no lo dejen en cero.
- **Trigger en `roles`:** impide borrar o renombrar los roles de sistema y cambiar `es_sistema`.

## 3. Roles y catálogo de permisos

### Roles

| Rol | Tipo | Notas |
| :-- | :-- | :-- |
| superadmin | Sistema, intocable | Bypass explícito en **un solo lugar**: `can()` devuelve `true` si el rol es superadmin. Es el único que gestiona roles |
| admin | Sistema, permisos editables | Operación del día a día |
| usuario | Sistema, permisos editables | Cuenta de cliente del portal (4D). Solo ve y toca lo suyo |
| invitado | Implícito | No existe en la base: es quien no tiene sesión (tienda, pedido, citas) |
| Personalizados | Creados por el superadmin | Crear, editar, duplicar y eliminar (solo si no tienen usuarios) |

### Catálogo (vive en `src/admin/permisos.ts`)

Cada permiso corresponde a una comprobación real en el código. Los que exponen datos personales llevan la marca **🔒 datos personales**, y el editor de roles lo muestra.

| Módulo | Permiso | Qué permite | Depende de |
| :-- | :-- | :-- | :-- |
| Medicamentos | `medicamentos:ver` | Ver el catálogo en el panel, con inactivos | |
| | `medicamentos:crear` | Crear medicamentos | ver |
| | `medicamentos:editar` | Editar datos, precio, especies y activar o desactivar | ver |
| | `medicamentos:ajustar_stock` | Cambiar el stock con un motivo (queda en auditoría) | ver |
| | `medicamentos:eliminar` | Borrar **solo** si nunca estuvo en un pedido (creado por error). Si tiene pedidos, solo se desactiva | ver |
| Categorías | `categorias:gestionar` | Crear, renombrar y borrar categorías sin medicamentos | |
| Pedidos | `pedidos:ver` 🔒 | Ver pedidos con los datos del cliente | |
| | `pedidos:cambiar_estado` | Avanzar el estado | ver |
| | `pedidos:cancelar` | Cancelar y devolver el stock | ver |
| Citas | `citas:ver` 🔒 | Ver solicitudes con los datos del tutor | |
| | `citas:gestionar` | Cambiar estado y escribir notas internas | ver |
| Usuarios | `usuarios:ver` 🔒 | Ver usuarios del panel (nombre, correo, rol) | |
| | `usuarios:gestionar` | Crear usuarios, desactivarlos y restablecer contraseñas | ver |
| | `usuarios:asignar_roles` | Cambiar el rol de otros usuarios (con anti-escalada) | ver |
| Auditoría | `auditoria:ver` | Ver el registro de actividad | |
| Mi cuenta | `cuenta:ver_pedidos` | Ver **sus** pedidos y su estado | |
| | `cuenta:ver_citas` | Ver **sus** citas y su estado | |
| | `cuenta:cancelar_cita` | Cancelar **sus** citas solicitadas o confirmadas | ver_citas |
| | `cuenta:editar_perfil` | Cambiar su nombre, teléfono y contraseña | |
| | `cuenta:eliminar` | Pedir la eliminación de su cuenta (derecho de supresión, Ley 1581) | |

**Cambios respecto al prompt:**
- **`roles:gestionar` no es asignable.** El prompt dice que solo el superadmin gestiona roles; si existiera como permiso, se podría dar a otro rol y se rompería esa regla. Queda como capacidad exclusiva del superadmin dentro de `can()`.
- **`usuarios:gestionar` es nuevo.** Sin él nadie podría crear las cuentas del panel.
- **`pedidos:exportar` y `citas:exportar` quedan fuera:** ver la pregunta 2.
- **Dependencias:** marcar un permiso marca los que necesita, y el servidor rechaza combinaciones incoherentes.

### Matriz por defecto

| Permiso | superadmin | admin | usuario |
| :-- | :-: | :-: | :-: |
| Todo | ✔ (bypass) | | |
| medicamentos:* | | ✔ | |
| categorias:gestionar | | ✔ | |
| pedidos:ver / cambiar_estado / cancelar | | ✔ | |
| citas:ver / gestionar | | ✔ | |
| usuarios:ver / gestionar / asignar_roles | | | |
| auditoria:ver | | | |
| cuenta:* | | | ✔ |

### Sincronización código → base

`pnpm db:migrate` corre las migraciones y luego `scripts/sincronizar-permisos.ts`, que es idempotente:
- Inserta los permisos nuevos y actualiza el nombre y la descripción de los existentes.
- **Solo cuando un permiso se crea por primera vez** se le da a los roles de su matriz por defecto. Después nunca toca `rol_permiso`, así no pisa lo que decidió el superadmin.
- Si un permiso desaparece del código, se borra con sus asignaciones (`CASCADE`) y queda registrado.

### Reglas en el servidor

- **Middleware de `/admin/*`:** sin sesión redirige a `/admin/login`. Con `debe_cambiar_clave` redirige a cambiar contraseña. Añade `Cache-Control: no-store` y `X-Robots-Tag: noindex` a todas las respuestas del panel.
- **`requerirPermiso(contexto, 'pedidos:cancelar')`** al inicio de **cada** Action y de cada página del panel. Sin sesión da 401; sin permiso, 403.
- **Anti-escalada:**
  - Nadie cambia su propio rol.
  - Solo se asigna un rol cuyos permisos ⊆ los propios.
  - Nadie que no sea superadmin asigna ni quita el rol superadmin.
  - Un usuario no se desactiva a sí mismo.
- **Último superadmin:** se comprueba en el código (mensaje claro) y en el trigger de la base (garantía).
- **Origen:** el middleware rechaza todo POST a `/_actions/*` cuyo `Origin` no sea el del sitio. Se suma a `SameSite` y a que las Actions solo aceptan JSON.

## 4. Login

- **Límites:**
  - Por cuenta: 5 fallos en 15 min bloquean 15 min.
  - Por IP (hash): 20 fallos en 15 min.
  - **Retraso progresivo:** 0, 1, 2 y 4 s según los fallos recientes, con un máximo de 4 s.
- **Mensaje siempre igual:** "Correo o contraseña incorrectos", exista o no la cuenta y esté o no bloqueada. El bloqueo solo queda en la auditoría.
- Los fallos se cuentan en la tabla de **auditoría**, sin tabla aparte. Se guarda un HMAC del correo, que sirve aunque la cuenta no exista y no guarda el correo en claro.
- **Primer superadmin:** `pnpm db:crear-superadmin` lee `SUPERADMIN_EMAIL` del `.env`, pide la contraseña dos veces por consola (sin mostrarla), la valida y crea el usuario con `debe_cambiar_clave = true`. No escribe la contraseña en ningún sitio. Si ya existe un superadmin, se niega.

## 5. Esquema nuevo

```mermaid
erDiagram
  roles ||--o{ usuarios : "RESTRICT"
  roles ||--o{ rol_permiso : "CASCADE"
  permisos ||--o{ rol_permiso : "CASCADE"
  usuarios ||--o{ sesiones : "CASCADE"
  usuarios ||--o{ auditoria : "RESTRICT"
  especies ||--o{ solicitudes_cita : "RESTRICT"

  roles {
    bigint id PK
    text slug UK
    text nombre UK
    text descripcion
    bool es_sistema
    timestamptz created_at
    timestamptz updated_at
  }
  permisos {
    bigint id PK
    text codigo UK "modulo:accion"
    text modulo
    text nombre
    text descripcion
    bool datos_personales
  }
  rol_permiso {
    bigint rol_id PK,FK
    bigint permiso_id PK,FK
  }
  usuarios {
    bigint id PK
    text nombre
    text email "UNIQUE lower(email)"
    text clave_hash
    bigint rol_id FK
    bool activo
    bool debe_cambiar_clave
    timestamptz ultimo_acceso
    timestamptz created_at
    timestamptz updated_at
  }
  sesiones {
    text token_hash PK
    bigint usuario_id FK
    timestamptz expira_en
    timestamptz ultimo_uso
    timestamptz created_at
  }
  auditoria {
    bigint id PK
    timestamptz created_at
    bigint actor_id FK "null si no hay sesión"
    text evento
    text entidad
    text entidad_id
    text ip_hash
    text sujeto_hash "HMAC del correo en logins"
    jsonb detalle "sin datos personales"
  }
  solicitudes_cita {
    bigint id PK
    text codigo UK
    text nombre_tutor
    text telefono
    text email
    bigint especie_id FK
    text nombre_mascota
    text motivo
    date fecha_preferida
    franja franja
    estado_cita estado
    text notas_internas
    bool acepta_tratamiento_datos "CHECK = true"
    text ip_hash
    timestamptz created_at
    timestamptz updated_at
  }
```

- **Enums:** `estado_cita` (solicitada, confirmada, atendida, cancelada, no_asistio) y `franja` (manana, tarde).
- **CHECKs:**
  - Formato de `codigo` y del teléfono, longitudes de texto y `acepta_tratamiento_datos`.
  - `evento` dentro de una lista cerrada.
  - `fecha_preferida` no puede ser anterior a la creación.
- **Índices:**
  - FK: `usuarios(rol_id)`, `rol_permiso(permiso_id)`, `sesiones(usuario_id)`, `solicitudes_cita(especie_id)` y `auditoria(actor_id)`.
  - Listados del panel: `solicitudes_cita(estado, fecha_preferida)`, `auditoria(created_at desc, id)` para paginar por cursor y `auditoria(evento, sujeto_hash, created_at)` para los límites del login.
  - Mantenimiento: `sesiones(expira_en)` para borrar las caducadas.
- **Pedidos:** no cambia la tabla, solo los GRANT. **Todas las migraciones solo añaden**: no se borra ni se renombra nada de lo que usa la tienda.

### Qué registra la auditoría

Login correcto, login fallido, cierre de sesión, cambio de contraseña, usuario creado o desactivado, cambio de rol de un usuario, rol creado, editado o eliminado, cambio de permisos de un rol, medicamento creado, editado, desactivado o eliminado, ajuste de stock, cambio de estado de pedido y de cita, y categoría creada o eliminada.

En `detalle` van IDs y valores antes/después, **nunca** nombres, teléfonos ni direcciones de clientes.

## 6. Máquinas de estado

**Pedido** (solo recogida en la clínica):

```text
pendiente ──► confirmado ──► pagado ──► entregado
    │              │
    └──────────────┴──► cancelado (devuelve el stock)
```

Solo se entrega un pedido pagado. Un pedido pagado no se cancela desde el panel: si hay que devolver el dinero, se resuelve fuera de la web y queda pendiente definir ese caso.

**Cancelar:**
- Solo desde `pendiente` o `confirmado`.
- Una sola transacción: `UPDATE pedidos SET estado = 'cancelado' WHERE id = $1 AND estado IN ('pendiente','confirmado') RETURNING id`. Solo si esa fila vuelve, se suma el stock de sus líneas.
- **Dos cancelaciones simultáneas:** la segunda espera el candado de la fila, ya no encuentra el estado permitido y no devuelve nada. **Es idempotente por construcción.**

**Cita:**

```text
solicitada ──► confirmada ──► atendida
     │              ├───────► no_asistio
     └──────────────┴───────► cancelada
```

Las dos máquinas viven en `src/lib/estados.ts` como funciones puras con pruebas unitarias, y el `UPDATE` siempre lleva `WHERE estado IN (estados de origen válidos)`.

## 7. Citas

> Cambió en la entrega 4C por decisión del usuario: ver la sección 17. Lo que sigue es el plan original.

- **Formulario público** en la sección "Agenda una valoración" de la portada. Campos:
  - Nombre del tutor, teléfono, correo (opcional), especie, nombre de la mascota y motivo.
  - Fecha preferida: desde mañana y hasta 60 días.
  - Franja: mañana o tarde. El horario real sigue pendiente.
  - Autorización de la Ley 1581, campo trampa y límite de 3 solicitudes por IP en 10 minutos.
- **Respuesta:** un código `CIT-XXXXXX` y el aviso de que la clínica confirmará la cita.
- **Panel:** listado con filtros por estado y rango de fechas (paginado por cursor), detalle, cambio de estado y notas internas. El listado muestra solo nombre, mascota, fecha y estado; teléfono, correo y motivo solo en el detalle.
- **Aviso al confirmar:** ver la pregunta 4.

## 8. Interfaz del panel

`/admin/login`, `/admin/cambiar-clave`, `/admin` (resumen con conteos, sin datos personales), `/admin/medicamentos` (listado, crear y editar), `/admin/categorias`, `/admin/pedidos` (listado y detalle), `/admin/citas` (listado y detalle), `/admin/usuarios`, `/admin/roles` (listado y editor) y `/admin/auditoria`.

- Todo se renderiza en el servidor con `no-store`.
- El menú solo muestra lo que el usuario puede usar.
- **Editor de rol:** permisos agrupados por módulo, "seleccionar todo el módulo", buscador, marca 🔒 de datos personales y dependencias automáticas.
- **Confirmación** antes de cancelar un pedido, eliminar un medicamento o un rol, desactivar un usuario o cambiar un rol. Usa un diálogo nativo `<dialog>`, sin librerías.
- Misma paleta y tipografía, contrastes verificados, usable desde el celular.
- **Medicamentos:**
  - Formulario validado con Zod, precio entero en pesos, registro ICA, especies, categoría y activo o inactivo.
  - Se rechaza cualquier nombre que empiece por `[DEMO]`.
  - La imagen del producto queda fuera de esta fase porque no hay almacenamiento de archivos.

## 9. Pruebas

- **Unitarias:**
  - `can()`, resolución de permisos y dependencias.
  - Anti-escalada y protección del último superadmin.
  - Máquinas de estado de pedido y cita.
  - Hash y verificación de contraseñas y política de contraseñas.
- **Contra el servidor, sin navegador:**
  - Cada Action sin sesión (401) y con un rol sin el permiso (403).
  - Asignarse un rol superior y cambiarse el rol propio.
  - Editar el superadmin y borrar o degradar al último superadmin, también **directo en SQL** para comprobar el trigger.
  - Cancelar dos veces y cancelaciones concurrentes.
  - Envío desde otro origen, fuerza bruta del login y tiempos de respuesta con correo existente frente a inexistente.
- **Navegador real:** el superadmin crea un rol, le da permisos y se lo asigna a un usuario. Ese usuario solo ve y puede lo permitido, y al cambiarle los permisos el efecto llega sin cerrar sesión.
- **Base de datos:** `vitalis_app` no puede leer usuarios, sesiones, auditoría ni los datos personales de pedidos y citas.
- En cada entrega: lint, formato, tipos, pruebas y build en verde.

## 10. Lo que te tocará hacer en Neon

Lo detallaré con SQL exacto en `docs/base-de-datos.md`:
1. Correr `pnpm db:migrate`.
2. Poner contraseña a `vitalis_admin`.
3. Añadir `DATABASE_URL_ADMIN` y `SUPERADMIN_EMAIL` al `.env` y `DATABASE_URL_ADMIN` a Vercel. El HMAC del correo reutiliza `IP_HASH_SALT` con otro prefijo.
4. Correr `pnpm db:crear-superadmin`.

## 11. Preguntas

1. **Rol `usuario`:** hoy no hay ningún permiso de cliente, porque todos son del panel. Crearlo ahora sería un rol vacío que no se puede usar. **Recomiendo crearlo junto con el portal de clientes, más adelante.** ¿Lo creo ahora vacío o lo pospongo?
2. **Exportar pedidos y citas (CSV):** no está en las pantallas pedidas y es la salida más delicada de datos personales. **Recomiendo dejarlo para después.** ¿Lo incluyo ahora?
3. **Estado `enviado`:** lo dejo como paso opcional (confirmado → entregado si recogen en la clínica, o confirmado → enviado → entregado si hay domicilio). ¿De acuerdo?
4. **Aviso al confirmar una cita o pedido:** lo sencillo con lo que ya existe es un botón "Avisar por WhatsApp" en el panel, que abre WhatsApp con el mensaje escrito y el número del cliente. Lo envía la persona desde su celular, sin servicios de pago. Un envío automático necesita la API de WhatsApp Business o un servicio de correo, y lo dejaría anotado como pendiente. ¿Va el botón?

Respuestas: ver "Decisiones del usuario" al inicio.

## 12. Portal de clientes (entrega 4D)

Cada permiso `cuenta:*` corresponde a una pantalla o Action real, y **siempre sobre los registros propios**.

- **Rutas:** `/cuenta/registro`, `/cuenta/ingresar`, `/cuenta` (mis pedidos y mis citas), `/cuenta/perfil` y `/cuenta/salir`.
- **Registro:** nombre, correo, teléfono, contraseña y autorización de la Ley 1581. El servidor **siempre** asigna el rol `usuario`, sin importar lo que llegue. Tiene campo trampa y límite por IP.
- **Mismo sistema de sesiones** que el panel. Un cliente nunca entra a `/admin` porque no tiene permisos de panel. El middleware exige al menos uno, y cada página exige el suyo.
- **Pedidos y citas hechos con sesión** quedan ligados a la cuenta (`usuario_id`, opcional) y el formulario viene prellenado. Los hechos sin cuenta no se pueden reclamar después: no se ligan por teléfono ni por correo, para no exponer datos de otra persona.
- **Eliminar cuenta:** desactiva la cuenta, borra sus sesiones y anonimiza nombre, correo y teléfono. Los pedidos se conservan sin datos personales, porque son registro de ventas.

**Datos de clientes en la base:** el portal usa un **tercer rol de base de datos, `vitalis_cuenta`**, con **RLS**. Cada consulta corre en una transacción con `set_config('vitalis.usuario_id', <id de la sesión>, true)`. Las políticas solo dejan ver y tocar filas cuyo `usuario_id` coincida. Así, aunque una consulta olvide el `WHERE`, no puede devolver datos de otro cliente.

Para que RLS no afecte al resto, las otras tablas y roles llevan sus políticas explícitas:
- `vitalis_admin`: acceso según sus GRANT.
- `vitalis_app`: `INSERT` y su lectura mínima por columnas.

**Sin correo transaccional no hay verificación de correo ni "olvidé mi contraseña" automático.** Mientras tanto, la clínica restablece la contraseña desde el panel (`usuarios:gestionar`) con cambio obligatorio en el siguiente ingreso. Un servicio de correo gratuito (por ejemplo Resend) necesita un dominio propio; queda en pendientes.

## 13. Cambio a "solo venta en tienda" (entrega 4B)

| Dónde | Cambio |
| :-- | :-- |
| Base de datos | Migración no destructiva: `direccion` y `municipio` pasan a opcionales (los datos existentes se conservan) y se dejan de pedir. El enum `estado_pedido` se recrea sin `enviado`: ningún pedido lo usa, así que la migración es segura y lo comprueba antes |
| `/pedido` | "Datos de entrega" pasa a "Tus datos": nombre, teléfono, correo opcional y notas. Mensaje final: "Te avisaremos cuando esté listo para recoger en la clínica" |
| Textos | "Cómo pedir", FAQ ("¿Hacen domicilios?" → "No, los pedidos se recogen en la clínica en Girardot"; "¿Cómo pago?" → "Por transferencia cuando te confirmemos el pedido por WhatsApp"), términos, tienda y mensaje de WhatsApp |
| Stock | Se reserva al crear el pedido y vuelve al cancelarlo. Los pedidos que nadie recoge se cancelan a mano desde el panel |

Los datos de pago (Nequi, Daviplata, cuenta o llave Bre-B) no van en la web: los envía la clínica por WhatsApp.


## 14. Ajustes que salieron de las pruebas de la 4A

| Hallazgo | Corrección |
| :-- | :-- |
| Drizzle nombra todas las columnas en los INSERT (con `DEFAULT`) y PostgreSQL exige permiso sobre cada una, así que los INSERT por columna fallaban | INSERT por tabla en `roles` y `usuarios`. Que la app no cree roles de sistema lo garantiza el trigger (solo el dueño de la tabla puede). Los UPDATE siguen siendo por columna |
| Astro devuelve el mensaje de cualquier error inesperado también en producción; con Drizzle incluye el SQL y sus parámetros | `protegerErrores()` envuelve todas las Actions (también las públicas): registra el error en el servidor y responde con un mensaje genérico |
| La validación de entrada corre antes que la autorización: sin sesión se recibía 400 y se veían los nombres de los campos | El middleware responde 401 a cualquier Action del panel sin sesión, llegue por `/_actions/` o por `?_action=` en cualquier página |
| Astro solo reconoce una lista de checkboxes si el esquema la declara con `.default()` por fuera; con un solo permiso marcado llegaba un texto | `permisos: z.array(...).default([])`; probado con 0, 1 y 3 permisos |
| En consultas de una sola tabla, Drizzle no califica las columnas dentro de `sql`: la subconsulta de permisos del rol se correlacionaba mal y el editor mostraba los roles vacíos | Consultas reescritas con JOIN y GROUP BY |
| Calcular el hash falso en la primera petición duplicaba el tiempo y delataba que el correo no existía | Hash falso constante (de una clave aleatoria descartada) |
| `dorado-700` sobre `arena-100` daba 4,21:1, por debajo de AA | Token oscurecido a `#7A5C24` (5,2:1). Afectaba también a secciones de la portada y a la tienda |

## 15. Carrito en cookie del servidor (decisión del usuario)

Se reemplaza el carrito en `localStorage` por una cookie `HttpOnly`:

- **`vitalis_carrito`**: `HttpOnly`, `Secure`, `SameSite=Lax`, 30 días. Formato `slug.cantidad|slug.cantidad`, validado al leerla (`src/lib/carrito.ts`). Solo guarda qué y cuánto; precio y stock salen siempre de la base.
- **`vitalis_carrito_n`**: solo el número de unidades, legible por el navegador para el contador de la bolsa. La tienda se guarda 60 s en la CDN y no puede llevar datos de cada persona en el HTML.
- **"Agregar", cambiar cantidad y enviar el pedido son formularios** (Actions con `accept: 'form'`): funcionan sin JavaScript (con redirección 303 para no reenviar) y con JavaScript "Agregar" no recarga.
- **`/pedido` se renderiza en el servidor** con `Cache-Control: private, no-store`. Si el envío falla, vuelve a rellenar los campos y muestra cada error junto a su campo.
- Se eliminan `src/scripts/cart.ts`, `src/scripts/pedido.ts` y la Action `carrito.resumen`.

## 16. Entrega 4B

- **Migraciones:** `0004` (pedidos sin dirección ni municipio; enum de estados recreado con `pagado` y sin `enviado`, con una comprobación previa) y `0005` (GRANT de `vitalis_admin` para catálogo y pedidos: el panel solo cambia el estado de un pedido, nunca montos ni datos del cliente; el slug de medicamentos y categorías no se edita).
- **Permisos nuevos (9):** `medicamentos:ver|crear|editar|ajustar_stock|eliminar`, `categorias:gestionar` y `pedidos:ver|cambiar_estado|cancelar`. El rol `admin` los recibe por defecto al crearse.
- **Máquina de estados** en `src/lib/estados.ts` con pruebas. Cada cambio se aplica con `WHERE estado IN (origenes)`. Cancelar devuelve el stock en la misma transacción y solo si el UPDATE afectó la fila, así que es idempotente y seguro ante cancelaciones simultáneas.
- **Panel:** medicamentos (listado con filtros y cursor, crear, editar, activar o desactivar, ajustar stock con motivo, eliminar solo si nunca estuvo en pedidos), categorías (crear, renombrar, borrar vacías) y pedidos (listado por estado, detalle y botones según la máquina de estados y los permisos). El resumen muestra los pedidos pendientes.
- **Solo venta en tienda:** el pedido pide nombre, celular, correo opcional y notas; textos, preguntas frecuentes, términos y política de datos actualizados.
- **Pruebas contra el servidor:** 53 de 53 (401/403 por Action, roles con permisos parciales, `[DEMO]` rechazado, transiciones inválidas, cancelación doble y triple simultánea con el stock devuelto una vez, borrados protegidos y permisos de la base).

## 17. Entrega 4C: citas por WhatsApp (decisión del usuario)

La administradora acomoda los horarios, así que la web no maneja agenda: **el formulario guarda la solicitud y lleva al tutor a WhatsApp con el mensaje escrito**. El día y la hora se acuerdan en el chat.

- **Formulario en `/cita`** (renderizado en el servidor, como `/pedido`). La sección "Agenda una valoración" de la portada y el botón secundario del hero llevan ahí. Campos: nombre, celular, perro o gato, nombre de la mascota, motivo y, **opcionales**, día preferido (desde mañana y hasta 60 días, en hora de Colombia) y franja (mañana, tarde o me da igual). Autorización de la Ley 1581, campo trampa y **3 solicitudes por IP cada 10 minutos**.
- **Respecto al plan original:** no se pide correo (con el celular basta y es un dato personal menos), y fecha y franja pasan a ser opcionales porque el horario lo decide la clínica.
- **Respuesta:** código `CIT-XXXXXX` y botón "Enviar por WhatsApp" con código, mascota, especie, motivo y preferencia. Es un botón y no una redirección automática: los navegadores de Instagram y Facebook bloquean abrir apps sin un toque, y así el tutor ve su código. Si no envía el mensaje, la solicitud igual queda en el panel.
- **Estados:** solicitada ("Por agendar") → confirmada ("Agendada") → atendida o no asistió; se cancela desde solicitada o confirmada. Mismo patrón que los pedidos: `WHERE estado IN (origenes)` y pruebas en `tests/unit/citas.test.ts`.
- **Panel `/admin/citas`:** listado por estado con cursor (tutor, mascota y preferencia; el celular y el motivo solo en el detalle), detalle con botón "Escribir por WhatsApp" al celular del tutor (para cuando no llegó su mensaje), cambio de estado y **notas internas** para anotar el día y la hora acordados. El resumen muestra cuántas citas faltan por agendar.
- **Permisos nuevos (2):** `citas:ver` (datos personales) y `citas:gestionar`. El rol `admin` los recibe por defecto.
- **Auditoría:** cada cambio de estado (`cita_estado_cambiado`). Las notas no se auditan porque pueden tener datos de salud.
- **Migraciones:** `0006` (tabla `solicitudes_cita` y enums `estado_cita` y `franja_cita`) y `0007` (GRANT). `vitalis_app` inserta y solo lee `id, codigo, ip_hash, created_at`, nunca los datos del tutor. `vitalis_admin` lee y solo cambia `estado` y `notas_internas`.
- **Refactor:** el cursor `(created_at, id)` de los listados del panel pasa a `src/admin/cursor.ts` (lo usan pedidos, citas y auditoría).
- **Probado contra PostgreSQL 16 local:** migraciones desde cero, GRANT por columna, formulario con errores y relleno, camino feliz con el mensaje de WhatsApp, límite de envíos y, en el panel, notas, agendar y atender con su registro en la auditoría.

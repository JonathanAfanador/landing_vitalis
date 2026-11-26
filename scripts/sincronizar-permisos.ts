// Sincroniza el catálogo de permisos del código (src/admin/permisos.ts) con la base de datos.
// Idempotente: se ejecuta después de cada migración (`pnpm db:migrate`).
// - Inserta los permisos nuevos y actualiza nombre y descripción de los existentes.
// - Solo cuando un permiso se crea por primera vez se da a los roles de su `porDefecto`; después
//   nunca toca rol_permiso, para no pisar lo que decidió el superadmin.
// - Borra los permisos que ya no están en el código (con sus asignaciones).
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, inArray } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '../src/db/schema';
import { PERMISOS } from '../src/admin/permisos';

const url = process.env.DATABASE_URL_MIGRACIONES;
if (!url) throw new Error('Falta DATABASE_URL_MIGRACIONES en el entorno (.env)');

const pool = new pg.Pool({ connectionString: url, max: 1 });
const db = drizzle({ client: pool, schema });
const catalogo = Object.entries(PERMISOS);

try {
  const resumen = await db.transaction(async (tx) => {
    const existentes = new Set(
      (await tx.select({ codigo: schema.permisos.codigo }).from(schema.permisos)).map((p) => p.codigo),
    );
    const nuevos = catalogo.filter(([codigo]) => !existentes.has(codigo));
    const obsoletos = [...existentes].filter((codigo) => !Object.hasOwn(PERMISOS, codigo));

    for (const [codigo, def] of catalogo) {
      const valores = {
        modulo: def.modulo,
        nombre: def.nombre,
        descripcion: def.descripcion,
        datosPersonales: 'datosPersonales' in def ? def.datosPersonales : false,
      };
      await tx
        .insert(schema.permisos)
        .values({ codigo, ...valores })
        .onConflictDoUpdate({ target: schema.permisos.codigo, set: valores });
    }

    for (const [codigo, def] of nuevos) {
      const roles = 'porDefecto' in def ? (def.porDefecto as readonly string[]) : [];
      if (!roles.length) continue;
      const [permiso] = await tx
        .select({ id: schema.permisos.id })
        .from(schema.permisos)
        .where(eq(schema.permisos.codigo, codigo));
      const destinos = await tx
        .select({ id: schema.roles.id })
        .from(schema.roles)
        .where(inArray(schema.roles.slug, [...roles]));
      if (permiso && destinos.length) {
        await tx
          .insert(schema.rolPermiso)
          .values(destinos.map((r) => ({ rolId: r.id, permisoId: permiso.id })))
          .onConflictDoNothing();
      }
    }

    if (obsoletos.length) await tx.delete(schema.permisos).where(inArray(schema.permisos.codigo, obsoletos));
    return { nuevos: nuevos.map(([c]) => c), obsoletos };
  });

  console.log(`Permisos sincronizados: ${catalogo.length} en el catálogo.`);
  if (resumen.nuevos.length) console.log(`  Nuevos: ${resumen.nuevos.join(', ')}`);
  if (resumen.obsoletos.length)
    console.log(`  Eliminados (ya no están en el código): ${resumen.obsoletos.join(', ')}`);
} finally {
  await pool.end();
}

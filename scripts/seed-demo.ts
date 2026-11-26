// Carga medicamentos de ejemplo, claramente ficticios ([DEMO]), para desarrollar y probar la tienda.
// Uso: pnpm db:seed:demo   (con DATABASE_URL_MIGRACIONES apuntando a una base de desarrollo)
import { drizzle } from 'drizzle-orm/node-postgres';
import { inArray } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '../src/db/schema';

const url = process.env.DATABASE_URL_MIGRACIONES;
if (!url) throw new Error('Falta DATABASE_URL_MIGRACIONES en el entorno (.env)');
if (process.env.NODE_ENV === 'production')
  throw new Error('Los datos de ejemplo no se cargan en producción.');

const demo = [
  {
    nombre: 'Antipulgas en pipeta perros 10 a 20 kg',
    principioActivo: 'Fipronil',
    presentacion: 'Pipeta 1,34 ml',
    categoria: 'antiparasitarios',
    especies: ['perro'],
    precioCop: 38900,
    stock: 14,
    requiereFormula: false,
  },
  {
    nombre: 'Antiparasitario interno gatos',
    principioActivo: 'Praziquantel y pirantel',
    presentacion: 'Caja x 2 tabletas',
    categoria: 'antiparasitarios',
    especies: ['gato'],
    precioCop: 24500,
    stock: 9,
    requiereFormula: false,
  },
  {
    nombre: 'Antibiótico de amplio espectro 250 mg',
    principioActivo: 'Amoxicilina y ácido clavulánico',
    presentacion: 'Caja x 10 tabletas',
    categoria: 'antibioticos',
    especies: ['perro', 'gato'],
    precioCop: 52300,
    stock: 6,
    requiereFormula: true,
  },
  {
    nombre: 'Antiinflamatorio para perros 75 mg',
    principioActivo: 'Carprofeno',
    presentacion: 'Caja x 14 tabletas',
    categoria: 'antiinflamatorios',
    especies: ['perro'],
    precioCop: 67800,
    stock: 3,
    requiereFormula: true,
  },
  {
    nombre: 'Analgésico oral gotas',
    principioActivo: 'Meloxicam',
    presentacion: 'Frasco 10 ml',
    categoria: 'analgesicos',
    especies: ['perro', 'gato'],
    precioCop: 41200,
    stock: 0,
    requiereFormula: true,
  },
  {
    nombre: 'Shampoo dermatológico',
    principioActivo: 'Clorhexidina y miconazol',
    presentacion: 'Frasco 250 ml',
    categoria: 'dermatologicos',
    especies: ['perro', 'gato'],
    precioCop: 46700,
    stock: 11,
    requiereFormula: false,
  },
  {
    nombre: 'Condroprotector articular',
    principioActivo: 'Glucosamina y condroitina',
    presentacion: 'Frasco x 60 tabletas',
    categoria: 'articulares',
    especies: ['perro'],
    precioCop: 89400,
    stock: 8,
    requiereFormula: false,
  },
  {
    nombre: 'Suplemento articular en pasta para gatos',
    principioActivo: 'Ácidos grasos omega 3',
    presentacion: 'Tubo 50 g',
    categoria: 'articulares',
    especies: ['gato'],
    precioCop: 35600,
    stock: 5,
    requiereFormula: false,
  },
];

const slugificar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const pool = new pg.Pool({ connectionString: url, max: 1 });
const db = drizzle({ client: pool, schema });

try {
  console.log(`Cargando ${demo.length} medicamentos [DEMO] en ${new URL(url).host}…`);
  const categorias = new Map((await db.select().from(schema.categorias)).map((c) => [c.slug, c.id]));
  const especies = new Map((await db.select().from(schema.especies)).map((e) => [e.slug, e.id]));

  await db.transaction(async (tx) => {
    for (const m of demo) {
      const categoriaId = categorias.get(m.categoria);
      if (!categoriaId) throw new Error(`No existe la categoría ${m.categoria}. ¿Corriste las migraciones?`);
      const nombre = `[DEMO] ${m.nombre}`;
      const [fila] = await tx
        .insert(schema.medicamentos)
        .values({
          nombre,
          slug: `demo-${slugificar(m.nombre)}`,
          principioActivo: m.principioActivo,
          presentacion: m.presentacion,
          laboratorio: 'Laboratorio de ejemplo',
          registroIca: null,
          requiereFormula: m.requiereFormula,
          precioCop: m.precioCop,
          stock: m.stock,
          categoriaId,
        })
        .onConflictDoUpdate({
          target: schema.medicamentos.slug,
          set: { precioCop: m.precioCop, stock: m.stock, requiereFormula: m.requiereFormula },
        })
        .returning({ id: schema.medicamentos.id });
      if (!fila) continue;
      const ids = m.especies.map((slug) => especies.get(slug)).filter((id): id is number => id !== undefined);
      await tx
        .delete(schema.medicamentoEspecie)
        .where(inArray(schema.medicamentoEspecie.medicamentoId, [fila.id]));
      await tx
        .insert(schema.medicamentoEspecie)
        .values(ids.map((especieId) => ({ medicamentoId: fila.id, especieId })));
    }
  });
  console.log('Listo.');
} finally {
  await pool.end();
}

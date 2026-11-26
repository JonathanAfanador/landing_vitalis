import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { eq } from 'drizzle-orm';
import { registrar } from '../../admin/auditoria';
import { crearCategoria } from '../../admin/categorias';
import { esViolacionUnica } from '../../admin/errores-db';
import { requerirPermiso } from '../../admin/guard';
import {
  actualizarMedicamento,
  ajustarStock,
  crearMedicamento,
  obtenerMedicamentoPanel,
  vecesEnPedidos,
} from '../../admin/medicamentos';
import { dbAdmin } from '../../db/client-admin';
import { categorias, medicamentos } from '../../db/schema';
import { protegerErrores } from '../../lib/acciones';

const id = z.coerce.number().int().positive();
const texto = (campo: string, max: number) =>
  z
    .string({ error: `Escribe ${campo}.` })
    .trim()
    .min(2, `Escribe ${campo}.`)
    .max(max);
// Los precios se escriben como en Colombia ("45.900" o "45900") y se guardan como pesos enteros.
const pesos = z
  .string({ error: 'Escribe el precio.' })
  .transform((v) => Number(v.replace(/\D/g, '')))
  .pipe(z.number().int().positive('El precio debe ser mayor que cero.').max(100_000_000));
const unidades = z.coerce
  .number({ error: 'Escribe las unidades.' })
  .int()
  .min(0, 'No puede ser negativo.')
  .max(100_000);

// Astro lee el formulario según el esquema: .default()/.nullish() por fuera para casillas y campos vacíos.
const datosMedicamento = z.object({
  nombre: texto('el nombre', 120).refine(
    (v) => !/^\[demo\]/i.test(v),
    'Los nombres [DEMO] son solo para datos de prueba.',
  ),
  principioActivo: texto('el principio activo', 160),
  presentacion: texto('la presentación', 120),
  laboratorio: texto('el laboratorio', 120),
  registroIca: z.string().trim().max(60).nullish(),
  requiereFormula: z.boolean().default(false),
  precioCop: pesos,
  categoriaId: id,
  especies: z.array(z.coerce.number().int().positive()).max(10).default([]),
});

const columnas = (d: z.output<typeof datosMedicamento>) => ({
  nombre: d.nombre,
  principioActivo: d.principioActivo,
  presentacion: d.presentacion,
  laboratorio: d.laboratorio,
  registroIca: d.registroIca || null,
  requiereFormula: d.requiereFormula,
  precioCop: d.precioCop,
  categoriaId: d.categoriaId,
  especies: d.especies,
});

// Una FK inexistente (categoría o especie que no existe) no debe salir como error genérico.
const traducirFk = (error: unknown): never => {
  if (error instanceof Error && (error.cause as { code?: string } | undefined)?.code === '23503') {
    throw new ActionError({ code: 'BAD_REQUEST', message: 'La categoría o la especie elegida no existe.' });
  }
  throw error;
};

export const catalogoAdmin = {
  medicamentos: {
    crear: defineAction({
      accept: 'form',
      input: datosMedicamento.extend({ stock: unidades }),
      handler: protegerErrores(async (datos, ctx) => {
        const actor = requerirPermiso(ctx.locals.usuario, 'medicamentos:crear');
        const nuevo = await dbAdmin
          .transaction(async (tx) => {
            const creado = await crearMedicamento(tx, { ...columnas(datos), stock: datos.stock });
            await registrar(
              {
                actorId: actor.id,
                evento: 'medicamento_creado',
                entidad: 'medicamento',
                entidadId: creado.id,
                detalle: { stock: datos.stock },
              },
              tx,
            );
            return creado;
          })
          .catch(traducirFk);
        return { id: nuevo.id };
      }),
    }),

    editar: defineAction({
      accept: 'form',
      input: datosMedicamento.extend({ medicamentoId: id, activo: z.boolean().default(false) }),
      handler: protegerErrores(async ({ medicamentoId, activo, ...datos }, ctx) => {
        const actor = requerirPermiso(ctx.locals.usuario, 'medicamentos:editar');
        const antes = await obtenerMedicamentoPanel(medicamentoId);
        if (!antes) throw new ActionError({ code: 'NOT_FOUND', message: 'El medicamento no existe.' });
        await dbAdmin
          .transaction(async (tx) => {
            await actualizarMedicamento(tx, medicamentoId, { ...columnas(datos), activo });
            await registrar(
              {
                actorId: actor.id,
                evento: 'medicamento_editado',
                entidad: 'medicamento',
                entidadId: medicamentoId,
                detalle: {
                  ...(antes.precioCop !== datos.precioCop && { precio: [antes.precioCop, datos.precioCop] }),
                  ...(antes.activo !== activo && { activo: [antes.activo, activo] }),
                },
              },
              tx,
            );
          })
          .catch(traducirFk);
        return { ok: true };
      }),
    }),

    ajustarStock: defineAction({
      accept: 'form',
      input: z.object({
        medicamentoId: id,
        stock: unidades,
        motivo: z
          .string({ error: 'Escribe el motivo.' })
          .trim()
          .min(3, 'Escribe el motivo del ajuste.')
          .max(200),
      }),
      handler: protegerErrores(async ({ medicamentoId, stock, motivo }, ctx) => {
        const actor = requerirPermiso(ctx.locals.usuario, 'medicamentos:ajustar_stock');
        await dbAdmin.transaction(async (tx) => {
          const anterior = await ajustarStock(tx, medicamentoId, stock);
          if (anterior === null)
            throw new ActionError({ code: 'NOT_FOUND', message: 'El medicamento no existe.' });
          await registrar(
            {
              actorId: actor.id,
              evento: 'stock_ajustado',
              entidad: 'medicamento',
              entidadId: medicamentoId,
              detalle: { de: anterior, a: stock, motivo },
            },
            tx,
          );
        });
        return { ok: true };
      }),
    }),

    eliminar: defineAction({
      accept: 'form',
      input: z.object({ medicamentoId: id }),
      handler: protegerErrores(async ({ medicamentoId }, ctx) => {
        const actor = requerirPermiso(ctx.locals.usuario, 'medicamentos:eliminar');
        const NO = new ActionError({
          code: 'CONFLICT',
          message:
            'Este medicamento ya estuvo en pedidos: no se puede borrar. Desactívalo para ocultarlo de la tienda.',
        });
        if (await vecesEnPedidos(medicamentoId)) throw NO;
        try {
          await dbAdmin.transaction(async (tx) => {
            const [borrado] = await tx
              .delete(medicamentos)
              .where(eq(medicamentos.id, medicamentoId))
              .returning({ slug: medicamentos.slug });
            if (!borrado) throw new ActionError({ code: 'NOT_FOUND', message: 'El medicamento no existe.' });
            await registrar(
              {
                actorId: actor.id,
                evento: 'medicamento_eliminado',
                entidad: 'medicamento',
                entidadId: medicamentoId,
                detalle: { slug: borrado.slug },
              },
              tx,
            );
          });
        } catch (error) {
          // Entre la comprobación y el borrado entró un pedido: la FK RESTRICT lo frena.
          if (error instanceof Error && (error.cause as { code?: string } | undefined)?.code === '23503')
            throw NO;
          throw error;
        }
        return { ok: true };
      }),
    }),
  },

  categorias: {
    crear: defineAction({
      accept: 'form',
      input: z.object({ nombre: texto('el nombre', 60) }),
      handler: protegerErrores(async ({ nombre }, ctx) => {
        const actor = requerirPermiso(ctx.locals.usuario, 'categorias:gestionar');
        try {
          await dbAdmin.transaction(async (tx) => {
            const nueva = await crearCategoria(tx, nombre);
            await registrar(
              { actorId: actor.id, evento: 'categoria_creada', entidad: 'categoria', entidadId: nueva.id },
              tx,
            );
          });
        } catch (error) {
          if (esViolacionUnica(error, 'categorias_nombre_unique')) {
            throw new ActionError({ code: 'CONFLICT', message: 'Ya existe una categoría con ese nombre.' });
          }
          throw error;
        }
        return { ok: true };
      }),
    }),

    renombrar: defineAction({
      accept: 'form',
      input: z.object({ categoriaId: id, nombre: texto('el nombre', 60) }),
      handler: protegerErrores(async ({ categoriaId, nombre }, ctx) => {
        const actor = requerirPermiso(ctx.locals.usuario, 'categorias:gestionar');
        try {
          const [cambiada] = await dbAdmin
            .update(categorias)
            .set({ nombre })
            .where(eq(categorias.id, categoriaId))
            .returning({ id: categorias.id });
          if (!cambiada) throw new ActionError({ code: 'NOT_FOUND', message: 'La categoría no existe.' });
        } catch (error) {
          if (esViolacionUnica(error, 'categorias_nombre_unique')) {
            throw new ActionError({ code: 'CONFLICT', message: 'Ya existe una categoría con ese nombre.' });
          }
          throw error;
        }
        await registrar({
          actorId: actor.id,
          evento: 'categoria_editada',
          entidad: 'categoria',
          entidadId: categoriaId,
          detalle: { nombre },
        });
        return { ok: true };
      }),
    }),

    eliminar: defineAction({
      accept: 'form',
      input: z.object({ categoriaId: id }),
      handler: protegerErrores(async ({ categoriaId }, ctx) => {
        const actor = requerirPermiso(ctx.locals.usuario, 'categorias:gestionar');
        try {
          const [borrada] = await dbAdmin
            .delete(categorias)
            .where(eq(categorias.id, categoriaId))
            .returning({ slug: categorias.slug });
          if (!borrada) throw new ActionError({ code: 'NOT_FOUND', message: 'La categoría no existe.' });
          await registrar({
            actorId: actor.id,
            evento: 'categoria_eliminada',
            entidad: 'categoria',
            entidadId: categoriaId,
            detalle: { slug: borrada.slug },
          });
        } catch (error) {
          if (error instanceof Error && (error.cause as { code?: string } | undefined)?.code === '23503') {
            throw new ActionError({
              code: 'CONFLICT',
              message: 'La categoría tiene medicamentos. Muévelos a otra antes de borrarla.',
            });
          }
          throw error;
        }
        return { ok: true };
      }),
    }),
  },
};

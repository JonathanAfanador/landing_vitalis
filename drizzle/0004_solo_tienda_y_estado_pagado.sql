-- Solo venta en tienda: el estado "enviado" desaparece y llega "pagado". Si hubiera pedidos en "enviado",
-- se detiene con un mensaje claro (y la migración entera se deshace) en lugar de fallar a mitad.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM vitalis.pedidos WHERE estado::text = 'enviado') THEN
    RAISE EXCEPTION 'Hay pedidos en estado enviado: pásalos a entregado antes de migrar';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "vitalis"."pedidos" ALTER COLUMN "estado" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "vitalis"."pedidos" ALTER COLUMN "estado" SET DEFAULT 'pendiente'::text;--> statement-breakpoint
DROP TYPE "vitalis"."estado_pedido";--> statement-breakpoint
CREATE TYPE "vitalis"."estado_pedido" AS ENUM('pendiente', 'confirmado', 'pagado', 'entregado', 'cancelado');--> statement-breakpoint
ALTER TABLE "vitalis"."pedidos" ALTER COLUMN "estado" SET DEFAULT 'pendiente'::"vitalis"."estado_pedido";--> statement-breakpoint
ALTER TABLE "vitalis"."pedidos" ALTER COLUMN "estado" SET DATA TYPE "vitalis"."estado_pedido" USING "estado"::"vitalis"."estado_pedido";--> statement-breakpoint
ALTER TABLE "vitalis"."pedidos" ALTER COLUMN "direccion" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vitalis"."pedidos" ALTER COLUMN "municipio" DROP NOT NULL;
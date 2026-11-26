// Reconoce errores de PostgreSQL envueltos por Drizzle.
type ErrorPg = { code?: string; constraint?: string; hint?: string };

const causa = (error: unknown): ErrorPg | undefined =>
  error instanceof Error ? ((error.cause ?? error) as ErrorPg) : undefined;

export const esViolacionUnica = (error: unknown, restriccion?: string) => {
  const pg = causa(error);
  return pg?.code === '23505' && (!restriccion || pg.constraint === restriccion);
};

// Los triggers de protección lanzan P0001 con una pista (`ultimo_superadmin`, `rol_sistema`).
export const pistaDeTrigger = (error: unknown) => {
  const pg = causa(error);
  return pg?.code === 'P0001' ? pg.hint : undefined;
};

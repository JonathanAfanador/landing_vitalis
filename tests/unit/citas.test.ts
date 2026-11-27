import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { paginar } from '../../src/admin/cursor';
import { origenesCita, puedePasarCita, siguientesCita } from '../../src/lib/estados';
import { formatoFecha, nombreEspecie } from '../../src/lib/formato';
import { generarCodigo } from '../../src/lib/pedido';
import { datosCitaSchema, rangoFechaCita } from '../../src/lib/validacion';
import { mensajeCita, preferenciaCita } from '../../src/lib/whatsapp';

describe('máquina de estados de la cita', () => {
  it('sigue el camino solicitada → confirmada → atendida', () => {
    expect(puedePasarCita('solicitada', 'confirmada')).toBe(true);
    expect(puedePasarCita('confirmada', 'atendida')).toBe(true);
  });

  it('no permite marcar atendida o no asistió sin haber agendado', () => {
    expect(puedePasarCita('solicitada', 'atendida')).toBe(false);
    expect(puedePasarCita('solicitada', 'no_asistio')).toBe(false);
    expect(origenesCita('no_asistio')).toEqual(['confirmada']);
  });

  it('se cancela antes de atenderla y los demás son estados finales', () => {
    expect(origenesCita('cancelada')).toEqual(['solicitada', 'confirmada']);
    for (const final of ['atendida', 'no_asistio', 'cancelada'] as const) {
      expect(siguientesCita(final)).toEqual([]);
    }
  });
});

describe('rangoFechaCita', () => {
  it('va de mañana a 60 días, en la hora de Colombia', () => {
    // 27 de noviembre a las 11 p. m. en Bogotá: en UTC ya es 28, pero "mañana" sigue siendo el 28.
    expect(rangoFechaCita(new Date('2026-11-28T04:00:00Z'))).toEqual({
      min: '2026-11-28',
      max: '2027-01-26',
    });
  });
});

describe('datosCitaSchema', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-27T15:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  // Así llegan los datos de un formulario a la Action: los campos vacíos como null.
  const valido = {
    nombre: 'Laura Gómez',
    telefono: '310 555 1234',
    especie: 'perro',
    mascota: 'Luna',
    motivo: 'Cojea de la pata trasera derecha.',
    fecha: null,
    franja: null,
    aceptaDatos: true,
  };

  it('acepta una solicitud sin fecha ni franja y normaliza el teléfono', () => {
    const r = datosCitaSchema.parse(valido);
    expect(r.telefono).toBe('3105551234');
    expect(r.fecha).toBeNull();
    expect(r.franja).toBeNull();
  });

  it('acepta una fecha dentro del rango y una franja válida', () => {
    const r = datosCitaSchema.parse({ ...valido, fecha: '2026-11-28', franja: 'tarde' });
    expect(r.fecha).toBe('2026-11-28');
    expect(r.franja).toBe('tarde');
  });

  it.each(['2026-11-27', '2027-01-27', '2026-02-30', '28/11/2026'])('rechaza la fecha %s', (fecha) => {
    expect(datosCitaSchema.safeParse({ ...valido, fecha }).success).toBe(false);
  });

  it('rechaza una franja desconocida, un motivo muy corto y la falta de autorización', () => {
    expect(datosCitaSchema.safeParse({ ...valido, franja: 'noche' }).success).toBe(false);
    expect(datosCitaSchema.safeParse({ ...valido, motivo: 'mal' }).success).toBe(false);
    expect(datosCitaSchema.safeParse({ ...valido, aceptaDatos: false }).success).toBe(false);
  });

  it('pide elegir la especie con un mensaje claro', () => {
    const r = datosCitaSchema.safeParse({ ...valido, especie: undefined });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('Elige si es perro o gato.');
  });
});

describe('mensaje de WhatsApp de la cita', () => {
  const cita = {
    codigo: 'CIT-7K3Q9M',
    mascota: 'Luna',
    especie: 'perro',
    motivo: 'Cojea de la pata trasera.',
    fecha: '2026-12-02',
    franja: 'manana' as const,
  };

  it('lleva el código, la mascota, el motivo y la preferencia', () => {
    expect(mensajeCita(cita)).toBe(
      [
        'Hola, acabo de solicitar la cita CIT-7K3Q9M en la web de Vitalis.',
        'Mascota: Luna (perro)',
        'Motivo: Cojea de la pata trasera.',
        'Preferencia: miércoles, 2 de diciembre, en la mañana',
        'Quedo pendiente para acordar el horario.',
      ].join('\n'),
    );
  });

  it('dice "Sin preferencia" cuando no hay fecha ni franja', () => {
    expect(preferenciaCita(null, null)).toBe('Sin preferencia');
    expect(preferenciaCita(null, 'tarde')).toBe('en la tarde');
  });
});

describe('utilidades de la cita', () => {
  it('formatea la fecha sin que la zona horaria la corra un día', () => {
    expect(formatoFecha('2026-12-01')).toBe('martes, 1 de diciembre');
  });

  it('nombra la especie en singular a partir del slug', () => {
    expect(nombreEspecie('perro')).toBe('Perro');
    expect(nombreEspecie('gato')).toBe('Gato');
  });

  it('genera códigos CIT con el formato de la base de datos', () => {
    for (let i = 0; i < 100; i++) expect(generarCodigo('CIT')).toMatch(/^CIT-[A-Z2-9]{6}$/);
  });
});

describe('paginar (cursor del panel)', () => {
  const filas = [1, 2, 3].map((id) => ({ id, fechaExacta: `2026-11-2${id} 10:00:00.123456-05` }));

  it('sin fila de sobra no hay página siguiente', () => {
    expect(paginar(filas, 3)).toEqual({ pagina: filas, siguienteCursor: null });
  });

  it('con una fila de sobra, el cursor apunta a la última mostrada', () => {
    const { pagina, siguienteCursor } = paginar(filas, 2);
    expect(pagina).toHaveLength(2);
    expect(JSON.parse(Buffer.from(siguienteCursor ?? '', 'base64url').toString())).toEqual([
      '2026-11-22 10:00:00.123456-05',
      2,
    ]);
  });
});

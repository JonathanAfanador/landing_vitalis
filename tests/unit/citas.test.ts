import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { origenesCita, puedePasarCita, siguientesCita } from '../../src/lib/estados';
import { formatoFecha, formatoTelefono, nombreEspecie } from '../../src/lib/formato';
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
    expect(r.error?.issues[0]?.message).toBe('Elige qué tipo de mascota es.');
  });
});

describe('mensaje de WhatsApp de la cita', () => {
  const cita = {
    codigo: 'CIT-7K3Q9M',
    nombre: 'Laura Gómez',
    telefono: '3105551234',
    mascota: 'Luna',
    motivo: 'Cojea de la pata trasera.',
    fecha: '2026-12-02',
    franja: 'manana' as const,
  };

  it('es el tutor presentándose y pidiendo la cita, con el código al final', () => {
    expect(mensajeCita(cita)).toBe(
      [
        'Hola, soy Laura Gómez, mi número es 310 555 1234.',
        'Mi mascota se llama Luna. Lo que le pasa: Cojea de la pata trasera.',
        'Si es posible, me queda mejor el miércoles, 2 de diciembre, en la mañana.',
        'Deseo agendar una cita de valoración.',
        '(Código de la web: CIT-7K3Q9M)',
      ].join('\n'),
    );
  });

  it('sin fecha ni franja no menciona preferencia', () => {
    const mensaje = mensajeCita({ ...cita, fecha: null, franja: null });
    expect(mensaje).not.toContain('Si es posible');
    expect(mensajeCita({ ...cita, fecha: null, franja: 'tarde' })).toContain(
      'Si es posible, me queda mejor en la tarde.',
    );
  });

  it('en el panel la preferencia vacía se lee "Sin preferencia"', () => {
    expect(preferenciaCita(null, null)).toBe('Sin preferencia');
    expect(preferenciaCita(null, 'tarde')).toBe('en la tarde');
  });
});

describe('utilidades de la cita', () => {
  it('formatea la fecha sin que la zona horaria la corra un día', () => {
    expect(formatoFecha('2026-12-01')).toBe('martes, 1 de diciembre');
  });

  it('agrupa el teléfono para leerlo fácil', () => {
    expect(formatoTelefono('3105551234')).toBe('310 555 1234');
    expect(formatoTelefono('6012345678')).toBe('601 234 5678');
  });

  it('nombra la especie en singular a partir del slug', () => {
    expect(nombreEspecie('perro')).toBe('Perro');
    expect(nombreEspecie('gato')).toBe('Gato');
  });

  it('genera códigos CIT con el formato de la base de datos', () => {
    for (let i = 0; i < 100; i++) expect(generarCodigo('CIT')).toMatch(/^CIT-[A-Z2-9]{6}$/);
  });
});

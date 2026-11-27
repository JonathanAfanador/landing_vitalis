import { crc32, inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { crearXlsx, letraColumna } from '../../src/lib/xlsx';

// Lee el ZIP desde su directorio central y devuelve cada archivo descomprimido, comprobando su CRC.
function leerZip(zip: Buffer) {
  const fin = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const total = zip.readUInt16LE(fin + 10);
  let p = zip.readUInt32LE(fin + 16);
  const archivos = new Map<string, string>();
  for (let i = 0; i < total; i++) {
    expect(zip.readUInt32LE(p)).toBe(0x02014b50);
    const crc = zip.readUInt32LE(p + 16);
    const comprimido = zip.readUInt32LE(p + 20);
    const largoNombre = zip.readUInt16LE(p + 28);
    const local = zip.readUInt32LE(p + 42);
    const nombre = zip.toString('utf8', p + 46, p + 46 + largoNombre);
    const inicio = local + 30 + zip.readUInt16LE(local + 26);
    const datos = inflateRawSync(zip.subarray(inicio, inicio + comprimido));
    expect(crc32(datos)).toBe(crc);
    archivos.set(nombre, datos.toString('utf8'));
    p += 46 + largoNombre;
  }
  return archivos;
}

describe('crearXlsx', () => {
  const archivos = leerZip(
    crearXlsx(
      'Citas',
      [{ titulo: 'Código' }, { titulo: 'Celular' }, { titulo: 'Total', pesos: true }, { titulo: 'Notas' }],
      [
        ['CIT-7K3Q9M', '3105551234', 45900, 'Dice "hola" & <adiós>\u0007'],
        ['CIT-2', '3001112233', null, '=HYPERLINK("http://malo")'],
      ],
    ),
  );
  const hoja = archivos.get('xl/worksheets/sheet1.xml') ?? '';

  it('trae las partes que Excel necesita', () => {
    expect([...archivos.keys()].sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ]);
    expect(archivos.get('xl/workbook.xml')).toContain('<sheet name="Citas"');
  });

  it('encabezado en negrita, celular como texto y pesos como número con formato', () => {
    expect(hoja).toContain('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Código</t></is></c>');
    expect(hoja).toContain('<c r="B2" t="inlineStr"><is><t xml:space="preserve">3105551234</t></is></c>');
    expect(hoja).toContain('<c r="C2" s="2"><v>45900</v></c>');
    expect(hoja).not.toContain('r="C3"');
  });

  it('escapa el XML, quita caracteres de control y nunca crea fórmulas', () => {
    expect(hoja).toContain('Dice &quot;hola&quot; &amp; &lt;adiós&gt;</t>');
    expect(hoja).not.toContain('\u0007');
    expect(hoja).not.toContain('<f>');
    expect(hoja).toContain('<t xml:space="preserve">=HYPERLINK');
  });

  it('congela el encabezado y pone filtros en todo el rango', () => {
    expect(hoja).toContain('state="frozen"');
    expect(hoja).toContain('<autoFilter ref="A1:D3"/>');
  });
});

describe('letraColumna', () => {
  it.each([
    [0, 'A'],
    [25, 'Z'],
    [26, 'AA'],
    [27, 'AB'],
    [701, 'ZZ'],
    [702, 'AAA'],
  ])('%i → %s', (indice, letra) => expect(letraColumna(indice)).toBe(letra));
});

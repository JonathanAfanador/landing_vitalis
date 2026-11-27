import { crc32, deflateRawSync } from 'node:zlib';

// Genera un .xlsx real (Excel, LibreOffice, Google Sheets) sin dependencias: unas pocas partes XML dentro
// de un ZIP. Una sola hoja con encabezado en negrita, fila congelada, filtros y anchos de columna.
// Los textos van como texto (inlineStr): el celular no se vuelve 3,1E+09 y un "=..." escrito por un
// cliente nunca se ejecuta como fórmula.

export type Columna = { titulo: string; ancho?: number; pesos?: boolean };
export type Celda = string | number | null | undefined;

const ESTILO_ENCABEZADO = 1;
const ESTILO_PESOS = 2;

// Caracteres de control que el XML no admite (el tabulador y los saltos de línea sí).
// eslint-disable-next-line no-control-regex
const NO_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

const escapar = (texto: string) =>
  texto
    .replace(NO_XML, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const letraColumna = (indice: number) => {
  let letra = '';
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letra = String.fromCharCode(65 + ((n - 1) % 26)) + letra;
  }
  return letra;
};

const celda = (valor: Celda, ref: string, estilo?: number) => {
  if (valor === null || valor === undefined || valor === '') return '';
  const s = estilo ? ` s="${estilo}"` : '';
  if (typeof valor === 'number') return `<c r="${ref}"${s}><v>${valor}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${escapar(valor)}</t></is></c>`;
};

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const TIPO = 'application/vnd.openxmlformats-officedocument.spreadsheetml';

function hojaXml(columnas: Columna[], filas: Celda[][]) {
  const ultima = letraColumna(columnas.length - 1);
  const encabezado = columnas
    .map((c, i) => celda(c.titulo, `${letraColumna(i)}1`, ESTILO_ENCABEZADO))
    .join('');
  const cuerpo = filas
    .map((fila, f) => {
      const r = f + 2;
      const celdas = columnas
        .map((c, i) => celda(fila[i], `${letraColumna(i)}${r}`, c.pesos ? ESTILO_PESOS : undefined))
        .join('');
      return `<row r="${r}">${celdas}</row>`;
    })
    .join('');
  const anchos = columnas
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.ancho ?? 16}" customWidth="1"/>`)
    .join('');
  return [
    `${XML}<worksheet xmlns="${NS}" xmlns:r="${NS_R}">`,
    '<sheetViews><sheetView workbookViewId="0">',
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>',
    '</sheetView></sheetViews>',
    `<cols>${anchos}</cols>`,
    `<sheetData><row r="1">${encabezado}</row>${cuerpo}</sheetData>`,
    `<autoFilter ref="A1:${ultima}${filas.length + 1}"/>`,
    '</worksheet>',
  ].join('');
}

const ESTILOS = [
  `${XML}<styleSheet xmlns="${NS}">`,
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>',
  '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>',
  '<fills count="2"><fill><patternFill patternType="none"/></fill>',
  '<fill><patternFill patternType="gray125"/></fill></fills>',
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>',
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
  '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>',
  // numFmtId 3 es "#,##0": los pesos se ven con separador de miles y siguen siendo números.
  '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>',
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>',
  '</styleSheet>',
].join('');

function partes(nombreHoja: string, columnas: Columna[], filas: Celda[][]): [string, string][] {
  const hoja = escapar(nombreHoja.replace(/[[\]:*?/\\]/g, '').slice(0, 31) || 'Hoja1');
  const rango = `'${hoja.replace(/'/g, "''")}'!$A$1:$${letraColumna(columnas.length - 1)}$${filas.length + 1}`;
  return [
    [
      '[Content_Types].xml',
      [
        `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`,
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`,
        '<Default Extension="xml" ContentType="application/xml"/>',
        `<Override PartName="/xl/workbook.xml" ContentType="${TIPO}.sheet.main+xml"/>`,
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${TIPO}.worksheet+xml"/>`,
        `<Override PartName="/xl/styles.xml" ContentType="${TIPO}.styles+xml"/>`,
        '</Types>',
      ].join(''),
    ],
    [
      '_rels/.rels',
      `${XML}<Relationships xmlns="${NS_REL}"><Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      'xl/workbook.xml',
      [
        `${XML}<workbook xmlns="${NS}" xmlns:r="${NS_R}">`,
        `<sheets><sheet name="${hoja}" sheetId="1" r:id="rId1"/></sheets>`,
        `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${rango}</definedName></definedNames>`,
        '</workbook>',
      ].join(''),
    ],
    [
      'xl/_rels/workbook.xml.rels',
      [
        `${XML}<Relationships xmlns="${NS_REL}">`,
        `<Relationship Id="rId1" Type="${NS_R}/worksheet" Target="worksheets/sheet1.xml"/>`,
        `<Relationship Id="rId2" Type="${NS_R}/styles" Target="styles.xml"/>`,
        '</Relationships>',
      ].join(''),
    ],
    ['xl/styles.xml', ESTILOS],
    ['xl/worksheets/sheet1.xml', hojaXml(columnas, filas)],
  ];
}

// ZIP con deflate: cabecera local y datos de cada archivo, luego el directorio central y su cierre.
function zip(archivos: [string, string][]) {
  const locales: Buffer[] = [];
  const central: Buffer[] = [];
  const ahora = new Date();
  const hora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
  const dia = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
  let desplazamiento = 0;
  for (const [nombre, contenido] of archivos) {
    const datos = Buffer.from(contenido, 'utf8');
    const comprimido = deflateRawSync(datos);
    const nombreBytes = Buffer.from(nombre, 'utf8');
    const crc = crc32(datos);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(dia, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(nombreBytes.length, 26);
    locales.push(local, nombreBytes, comprimido);

    const entrada = Buffer.alloc(46);
    entrada.writeUInt32LE(0x02014b50, 0);
    entrada.writeUInt16LE(20, 4);
    entrada.writeUInt16LE(20, 6);
    entrada.writeUInt16LE(0x0800, 8);
    entrada.writeUInt16LE(8, 10);
    entrada.writeUInt16LE(hora, 12);
    entrada.writeUInt16LE(dia, 14);
    entrada.writeUInt32LE(crc, 16);
    entrada.writeUInt32LE(comprimido.length, 20);
    entrada.writeUInt32LE(datos.length, 24);
    entrada.writeUInt16LE(nombreBytes.length, 28);
    entrada.writeUInt32LE(desplazamiento, 42);
    central.push(entrada, nombreBytes);

    desplazamiento += local.length + nombreBytes.length + comprimido.length;
  }
  const tamanoCentral = central.reduce((total, b) => total + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(archivos.length, 8);
  fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(tamanoCentral, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  return Buffer.concat([...locales, ...central, fin]);
}

export const crearXlsx = (nombreHoja: string, columnas: Columna[], filas: Celda[][]) =>
  zip(partes(nombreHoja, columnas, filas));

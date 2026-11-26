/**
 * Small, dependency-free Excel (.xlsx) reader and writer, plus a CSV reader.
 * Enough for the FAQ upload/download: one or more simple sheets of text and numbers.
 *
 *   readTable(buffer, filename)  -> { sheet, rows: [[cell, ...], ...] }   (first sheet, or the one named "FAQs")
 *   writeWorkbook(sheets)        -> Buffer (.xlsx)
 *
 * Writer sheet format:
 *   { name, columns: [{ header, width, wrap, list: ['Yes','No'], hint }], rows: [[...]], freeze: true,
 *     headerFill: 'FF6E2E3A', note: 'text under the header' }   or   { name, text: [['line', 'style']] } for instructions
 * .xls (old binary Excel) is not supported: the caller gets a clear message to save as .xlsx.
 */
const zlib = require('zlib');

// ---------------------------------------------------------------------------
// ZIP
// ---------------------------------------------------------------------------
function readZip(buf) {
  // End of central directory: last 22..65557 bytes
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not-zip');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad-zip');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const data = buf.slice(start, start + compSize);
    files[name] = { method, data };
    p += 46 + nameLen + extraLen + commentLen;
  }
  return {
    has: (name) => !!files[name],
    text(name) {
      const f = files[name];
      if (!f) return null;
      if (f.method === 0) return f.data.toString('utf8');
      if (f.method === 8) return zlib.inflateRawSync(f.data).toString('utf8');
      throw new Error('unsupported-compression');
    }
  };
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function writeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  entries.forEach(({ name, content }) => {
    const raw = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const comp = zlib.deflateRawSync(raw, { level: 9 });
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);           // UTF-8 names
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, comp);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  });
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------
function decodeXml(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function encodeXml(s) {
  return String(s)
    // characters Excel cannot store in XML
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function textOf(xml) {
  // all <t> pieces (rich text runs included), ignoring phonetic hints
  const clean = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  const parts = [];
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m;
  while ((m = re.exec(clean))) parts.push(m[1] ? decodeXml(m[1]) : '');
  return parts.join('');
}

function colIndex(ref) {
  const letters = String(ref).replace(/[^A-Z]/gi, '').toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function colName(i) {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------
function readXlsx(buf) {
  const zip = readZip(buf);
  if (!zip.has('xl/workbook.xml')) throw new Error('not-xlsx');
  const shared = [];
  const ss = zip.text('xl/sharedStrings.xml');
  if (ss) {
    const re = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\s*\/>/g;
    let m;
    while ((m = re.exec(ss))) shared.push(m[1] ? textOf(m[1]) : '');
  }
  // pick the sheet: one named like "FAQ", otherwise the first
  const wb = zip.text('xl/workbook.xml');
  const rels = zip.text('xl/_rels/workbook.xml.rels') || '';
  const sheets = [];
  const sre = /<sheet\b([^>]*)\/?>/g;
  let sm;
  while ((sm = sre.exec(wb))) {
    const attrs = sm[1];
    const name = decodeXml((attrs.match(/\bname="([^"]*)"/) || [])[1] || '');
    const rid = (attrs.match(/\br:id="([^"]*)"/) || attrs.match(/\bid="([^"]*)"/) || [])[1];
    let target = null;
    if (rid) {
      const rm = rels.match(new RegExp('<Relationship\\b[^>]*Id="' + rid.replace(/[^\w]/g, '') + '"[^>]*>'));
      if (rm) target = (rm[0].match(/Target="([^"]*)"/) || [])[1];
    }
    if (target) {
      target = target.replace(/^\/?xl\//, '').replace(/^\//, '');
      sheets.push({ name, path: 'xl/' + target });
    }
  }
  if (!sheets.length) sheets.push({ name: 'Sheet1', path: 'xl/worksheets/sheet1.xml' });
  const chosen = sheets.find(s => /faq/i.test(s.name)) || sheets[0];
  const xml = zip.text(chosen.path);
  if (!xml) throw new Error('not-xlsx');
  const rows = [];
  const rre = /<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g;
  let rm;
  let nextRow = 0;
  while ((rm = rre.exec(xml))) {
    const attrs = rm[1] || rm[3] || '';
    const rNum = parseInt((attrs.match(/\br="(\d+)"/) || [])[1], 10);
    const ri = Number.isFinite(rNum) ? rNum - 1 : nextRow;
    nextRow = ri + 1;
    const row = [];
    const body = rm[2] || '';
    const cre = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    let nextCol = 0;
    while ((cm = cre.exec(body))) {
      const cattrs = cm[1];
      const ref = (cattrs.match(/\br="([A-Z]+\d+)"/i) || [])[1];
      const ci = ref ? colIndex(ref) : nextCol;
      nextCol = ci + 1;
      const type = (cattrs.match(/\bt="([^"]*)"/) || [])[1] || 'n';
      const inner = cm[2] || '';
      let value = '';
      if (type === 's') {
        const idx = parseInt((inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1], 10);
        value = Number.isFinite(idx) ? (shared[idx] || '') : '';
      } else if (type === 'inlineStr') {
        value = textOf((inner.match(/<is>([\s\S]*?)<\/is>/) || [])[1] || '');
      } else if (type === 'b') {
        value = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1] === '1' ? 'TRUE' : 'FALSE';
      } else {
        const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        value = v === undefined ? '' : decodeXml(v);
      }
      row[ci] = value;
    }
    for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = '';
    rows[ri] = row;
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return { sheet: chosen.name, rows };
}

function readCsv(buf) {
  let text = buf.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  // Excel in some regions saves with semicolons
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const delim = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return { sheet: 'CSV', rows };
}

/** Read the first useful table from an .xlsx or .csv upload. Throws Error with a friendly message. */
function readTable(buf, filename = '') {
  const lower = String(filename).toLowerCase();
  if (!buf || !buf.length) throw friendly('The file is empty.');
  const isZip = buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50;
  if (lower.endsWith('.xls') && !isZip) throw friendly('This is an old .xls file. In Excel choose File → Save As → "Excel Workbook (.xlsx)" and upload that file.');
  if (isZip) {
    try {
      return readXlsx(buf);
    } catch (e) {
      throw friendly('We could not read this Excel file. Please save it again as "Excel Workbook (.xlsx)" and upload it.');
    }
  }
  if (lower.endsWith('.csv') || lower.endsWith('.txt') || !lower) return readCsv(buf);
  throw friendly('Please upload an Excel file (.xlsx) or a CSV file.');
}

function friendly(message) {
  const e = new Error(message);
  e.status = 400;
  return e;
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------
// Style ids (cellXfs order below)
const ST = { normal: 0, header: 1, wrap: 2, center: 3, title: 4, body: 5, hint: 6, strong: 7, required: 8 };

function stylesXml(headerFill) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="6">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="16"/><color rgb="FF4C2934"/><name val="Calibri"/></font>' +
      '<font><i/><sz val="10"/><color rgb="FF7A5C63"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FF4C2934"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFF3C4"/><name val="Calibri"/></font>' +
    '</fonts>' +
    '<fills count="4">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="' + (headerFill || 'FF6E2E3A') + '"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF8A402F"/><bgColor indexed="64"/></patternFill></fill>' +
    '</fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border><left style="thin"><color rgb="FFE3D3CB"/></left><right style="thin"><color rgb="FFE3D3CB"/></right><top style="thin"><color rgb="FFE3D3CB"/></top><bottom style="thin"><color rgb="FFE3D3CB"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="9">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="5" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';
}

function cellXml(ref, value, style) {
  const s = style ? ` s="${style}"` : '';
  if (value === null || value === undefined || value === '') return style ? `<c r="${ref}"${s}/>` : '';
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${s}><v>${value}</v></c>`;
  const text = encodeXml(value);
  const space = /^\s|\s$|\n/.test(String(value)) ? ' xml:space="preserve"' : '';
  return `<c r="${ref}"${s} t="inlineStr"><is><t${space}>${text}</t></is></c>`;
}

function tableSheetXml(sheet) {
  const cols = sheet.columns || [];
  const rows = sheet.rows || [];
  const lastCol = colName(Math.max(0, cols.length - 1));
  const lastRow = rows.length + 1;
  let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<dimension ref="A1:${lastCol}${lastRow}"/>` +
    '<sheetViews><sheetView workbookViewId="0"' + (sheet.active ? ' tabSelected="1"' : '') + '>' +
    (sheet.freeze !== false ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' : '') +
    '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>';
  x += '<cols>' + cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 14}" customWidth="1"/>`).join('') + '</cols>';
  x += '<sheetData>';
  x += '<row r="1" ht="32" customHeight="1">' + cols.map((c, i) => cellXml(colName(i) + '1', c.header, c.required ? ST.required : ST.header)).join('') + '</row>';
  rows.forEach((r, ri) => {
    const rn = ri + 2;
    x += `<row r="${rn}">` + cols.map((c, i) => cellXml(colName(i) + rn, r[i], c.list ? ST.center : ST.wrap)).join('') + '</row>';
  });
  x += '</sheetData>';
  if (cols.length) x += `<autoFilter ref="A1:${lastCol}${Math.max(2, lastRow)}"/>`;
  // dropdown lists (Yes / No) for the whole column, generous range for new rows
  const listCols = cols.map((c, i) => ({ c, i })).filter(o => o.c.list);
  if (listCols.length) {
    const maxRow = Math.max(2000, lastRow + 1000);
    x += `<dataValidations count="${listCols.length}">` + listCols.map(({ c, i }) =>
      `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Choose from the list" error="Please choose ${encodeXml(c.list.join(' or '))}."` +
      (c.hint ? ` promptTitle="${encodeXml(c.header).slice(0, 32)}" prompt="${encodeXml(c.hint).slice(0, 250)}"` : '') +
      ` sqref="${colName(i)}2:${colName(i)}${maxRow}"><formula1>"${encodeXml(c.list.join(','))}"</formula1></dataValidation>`
    ).join('') + '</dataValidations>';
  }
  x += '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>';
  x += '</worksheet>';
  return x;
}

function textSheetXml(sheet) {
  const lines = sheet.text || [];
  let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0" showGridLines="0"' + (sheet.active ? ' tabSelected="1"' : '') + '/></sheetViews><sheetFormatPr defaultRowHeight="15"/>' +
    `<cols><col min="1" max="1" width="${sheet.width || 110}" customWidth="1"/></cols><sheetData>`;
  lines.forEach((l, i) => {
    const [text, kind] = Array.isArray(l) ? l : [l, 'body'];
    const style = ST[kind] || ST.body;
    const ht = kind === 'title' ? ' ht="26" customHeight="1"' : '';
    x += `<row r="${i + 1}"${ht}>` + cellXml('A' + (i + 1), text, style) + '</row>';
  });
  return x + '</sheetData><pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/></worksheet>';
}

/** sheets: [{ name, columns, rows } | { name, text }] -> Buffer */
function writeWorkbook(sheets, opts = {}) {
  const files = [];
  const n = sheets.length;
  files.push({
    name: '[Content_Types].xml',
    content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      '</Types>'
  });
  files.push({
    name: '_rels/.rels',
    content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
      '</Relationships>'
  });
  const iso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  files.push({
    name: 'docProps/core.xml',
    content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      `<dc:title>${encodeXml(opts.title || 'SPOUZY')}</dc:title><dc:creator>SPOUZY</dc:creator>` +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified>` +
      '</cp:coreProperties>'
  });
  files.push({
    name: 'docProps/app.xml',
    content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>SPOUZY</Application></Properties>'
  });
  const activeIndex = Math.max(0, sheets.findIndex(s => s.active));
  files.push({
    name: 'xl/workbook.xml',
    content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<bookViews><workbookView activeTab="${activeIndex}"/></bookViews><sheets>` +
      sheets.map((s, i) => `<sheet name="${encodeXml(String(s.name).slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
      '</sheets>' +
      (sheets.some(s => s.columns && s.columns.length) ? '<definedNames>' + sheets.map((s, i) => (s.columns && s.columns.length
        ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${encodeXml(String(s.name).slice(0, 31))}'!$A$1:$${colName(s.columns.length - 1)}$${Math.max(2, (s.rows || []).length + 1)}</definedName>` : '')).join('') + '</definedNames>' : '') +
      '</workbook>'
  });
  files.push({
    name: 'xl/_rels/workbook.xml.rels',
    content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
      `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      '</Relationships>'
  });
  files.push({ name: 'xl/styles.xml', content: stylesXml(opts.headerFill) });
  sheets.forEach((s, i) => {
    files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, content: s.columns ? tableSheetXml(s) : textSheetXml(s) });
  });
  return writeZip(files);
}

module.exports = { readTable, writeWorkbook, colName };

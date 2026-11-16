/* Docpeek - exporters: DOCX, XLSX, CSV, TXT, image ZIP. Pure JS, uses fflate's zipSync. */
import { formatCell } from './tables.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // XML 1.0 forbids most control characters
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
const enc = (s) => new TextEncoder().encode(s);

// ---------- DOCX ----------
export function makeDocx(zipSync, { title, paragraphs, extraSections = [] }) {
  const para = (t, style) => {
    const lines = String(t).split('\n');
    const runs = lines.map((l, i) => `${i ? '<w:r><w:br/></w:r>' : ''}<w:r><w:t xml:space="preserve">${esc(l)}</w:t></w:r>`).join('');
    return `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}${runs}</w:p>`;
  };
  let body = '';
  if (title) body += para(title, 'Title');
  for (const p of paragraphs) body += para(p);
  for (const sec of extraSections) {
    if (!sec.items || !sec.items.length) continue;
    body += para(sec.heading, 'Heading1');
    for (const p of sec.items) body += para(p);
  }
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Yu Gothic" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="40"/><w:b/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="360"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:sz w:val="30"/><w:b/></w:rPr></w:style>
</w:styles>`;
  const files = {
    '[Content_Types].xml': enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`),
    '_rels/.rels': enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`),
    'word/_rels/document.xml.rels': enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'word/document.xml': enc(document),
    'word/styles.xml': enc(styles),
    'docProps/core.xml': enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(title || '')}</dc:title><dc:creator>Docpeek</dc:creator></cp:coreProperties>`),
  };
  return zipSync(files, { level: 6 });
}

// ---------- XLSX ----------
const colName = (c) => { let s = ''; c++; while (c) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
function sheetName(name, used) {
  let n = String(name || 'Sheet').replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet';
  let base = n, i = 2;
  while (used.has(n.toLowerCase())) { const suf = ` (${i++})`; n = base.slice(0, 31 - suf.length) + suf; }
  used.add(n.toLowerCase());
  return n;
}
/** tables: [{name, rows:[[cell]]}] where cell = {t,v,f}; produces one worksheet per table */
export function makeXlsx(zipSync, tables) {
  const used = new Set();
  const sheets = tables.map((t) => ({ name: sheetName(t.name, used), rows: t.rows, headerRows: t.headerRows || 0 }));
  // styles: 0 default, 1 date, 2 datetime, 3 percent, 4 bold (header)
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy/mm/dd"/><numFmt numFmtId="165" formatCode="yyyy/mm/dd hh:mm"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const files = {};
  sheets.forEach((s, i) => {
    let xml = '';
    s.rows.forEach((row, r) => {
      let cells = '';
      row.forEach((c, ci) => {
        if (!c || c.v == null || c.v === '') return;
        const ref = colName(ci) + (r + 1);
        const hdr = r < s.headerRows ? ' s="4"' : '';
        if (c.t === 'n' && Number.isFinite(c.v)) {
          const pct = c.f && c.f[1] && c.f[1][0] === 258;
          cells += `<c r="${ref}"${pct ? ' s="3"' : hdr}><v>${c.v}</v></c>`;
        } else if (c.t === 'b') cells += `<c r="${ref}" t="b"${hdr}><v>${c.v ? 1 : 0}</v></c>`;
        else if (c.t === 'd' && !isNaN(c.v)) {
          const serial = (c.v.getTime() - EXCEL_EPOCH) / 86400000;
          cells += `<c r="${ref}" s="${serial % 1 ? 2 : 1}"><v>${serial}</v></c>`;
        } else {
          const text = c.t === 's' || c.t === 'e' ? String(c.v) : formatCell(c);
          cells += `<c r="${ref}" t="inlineStr"${hdr}><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
        }
      });
      if (cells) xml += `<row r="${r + 1}">${cells}</row>`;
    });
    files[`xl/worksheets/sheet${i + 1}.xml`] = enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xml}</sheetData></worksheet>`);
  });
  files['[Content_Types].xml'] = enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  files['_rels/.rels'] = enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  files['xl/workbook.xml'] = enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
  files['xl/_rels/workbook.xml.rels'] = enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  files['xl/styles.xml'] = enc(styles);
  return zipSync(files, { level: 6 });
}

// ---------- CSV / TXT ----------
export function makeCsv(rows) {
  const q = (s) => (/[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
  const body = rows.map((r) => r.map((c) => q(formatCell(c))).join(',')).join('\r\n');
  return enc('﻿' + body); // BOM so Excel reads UTF-8 (Japanese) correctly
}
export const makeTxt = (text) => enc('﻿' + text.replace(/\r?\n/g, '\r\n'));

export function keynoteOutline(doc) {
  const out = [];
  for (const s of doc.slides) {
    out.push(`--- ${s.index}${s.skipped ? ' (skipped)' : ''} ---`);
    if (s.title) out.push(s.title);
    for (const b of s.body) out.push(...b.split('\n').map((l) => '  • ' + l));
    if (s.notes) { out.push('  [Notes]'); out.push(...s.notes.split('\n').map((l) => '  ' + l)); }
    out.push('');
  }
  return out.join('\n');
}
export function pagesText(doc) {
  const parts = [doc.paragraphs.join('\n')];
  if (doc.textBoxes.length) parts.push('', ...doc.textBoxes);
  if (doc.footnotes.length) parts.push('', '---', ...doc.footnotes);
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ---------- images ----------
export function makeImageZip(zipSync, images) {
  const files = {}; const used = new Set();
  images.forEach((im, i) => {
    let n = (im.name || `image-${i + 1}`).replace(/[\\/:*?"<>|]/g, '_');
    if (used.has(n)) { const dot = n.lastIndexOf('.'); n = (dot > 0 ? n.slice(0, dot) : n) + `-${i + 1}` + (dot > 0 ? n.slice(dot) : ''); }
    used.add(n);
    files[n] = [im.bytes, { level: 0 }];
  });
  return zipSync(files);
}

/* Docpeek - iWork reader core (IWA = Snappy + Protocol Buffers inside a ZIP).
 * Runs in the browser and in Node (ES module). No network, no dependencies except an unzip function.
 * Format notes: https://github.com/obriensp/iWorkFileFormat, https://github.com/psobot/keynote-parser
 */

// ---------- Snappy (raw blocks, as used by iWork: no framing CRC) ----------
export function snappyDecompress(src) {
  let pos = 0, len = 0, shift = 0, b;
  do { b = src[pos++]; len |= (b & 0x7f) << shift; shift += 7; } while (b & 0x80 && pos < src.length);
  len >>>= 0;
  const out = new Uint8Array(len);
  let op = 0;
  while (pos < src.length) {
    const tag = src[pos++];
    const t = tag & 3;
    if (t === 0) {
      let n = tag >>> 2;
      if (n >= 60) {
        const nb = n - 59; n = 0;
        for (let i = 0; i < nb; i++) n |= src[pos++] << (8 * i);
        n >>>= 0;
      }
      n += 1;
      if (pos + n > src.length || op + n > len) throw new Error('snappy: literal out of range');
      out.set(src.subarray(pos, pos + n), op); pos += n; op += n;
    } else {
      let n, off;
      if (t === 1) { n = ((tag >>> 2) & 7) + 4; off = ((tag >>> 5) << 8) | src[pos++]; }
      else if (t === 2) { n = (tag >>> 2) + 1; off = src[pos] | (src[pos + 1] << 8); pos += 2; }
      else { n = (tag >>> 2) + 1; off = (src[pos] | (src[pos + 1] << 8) | (src[pos + 2] << 16) | (src[pos + 3] << 24)) >>> 0; pos += 4; }
      if (off === 0 || off > op || op + n > len) throw new Error('snappy: copy out of range');
      for (let i = 0; i < n; i++) { out[op] = out[op - off]; op++; }
    }
  }
  return op === len ? out : out.subarray(0, op);
}

// IWA files are a series of chunks: [0x00][3-byte LE length][snappy block]
export function unwrapIwa(buf) {
  const parts = []; let pos = 0, total = 0;
  while (pos + 4 <= buf.length) {
    const type = buf[pos];
    const n = buf[pos + 1] | (buf[pos + 2] << 8) | (buf[pos + 3] << 16);
    pos += 4;
    const block = buf.subarray(pos, pos + n); pos += n;
    if (type !== 0) continue; // unknown chunk types are skipped
    const d = snappyDecompress(block); parts.push(d); total += d.length;
  }
  if (parts.length === 1) return parts[0];
  const out = new Uint8Array(total); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ---------- Minimal protobuf reader ----------
function readVarint(buf, st) {
  let lo = 0, hi = 0, shift = 0, b;
  // read up to 10 bytes; keep it as a JS number when it fits in 53 bits
  for (let i = 0; i < 10; i++) {
    b = buf[st.p++];
    if (shift < 28) lo |= (b & 0x7f) << shift;
    else if (shift === 28) { lo |= (b & 0x0f) << 28; hi |= (b & 0x7f) >>> 4; }
    else hi |= (b & 0x7f) << (shift - 32);
    shift += 7;
    if (!(b & 0x80)) break;
  }
  return (hi >>> 0) * 4294967296 + (lo >>> 0);
}

/** Decode a protobuf message into {fieldNumber: [values]}.
 *  varint -> number, length-delimited -> Uint8Array, fixed64 -> {f64,bytes}, fixed32 -> {f32,u32} */
export function pb(buf) {
  const m = Object.create(null);
  const st = { p: 0 };
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  while (st.p < buf.length) {
    const key = readVarint(buf, st);
    const f = Math.floor(key / 8), wt = key & 7;
    let v;
    if (wt === 0) v = readVarint(buf, st);
    else if (wt === 2) { const n = readVarint(buf, st); v = buf.subarray(st.p, st.p + n); st.p += n; }
    else if (wt === 1) { v = { f64: view.getFloat64(st.p, true), lo: view.getUint32(st.p, true), hi: view.getUint32(st.p + 4, true) }; st.p += 8; }
    else if (wt === 5) { v = { f32: view.getFloat32(st.p, true), u32: view.getUint32(st.p, true) }; st.p += 4; }
    else throw new Error('protobuf: bad wire type ' + wt);
    if (st.p > buf.length) throw new Error('protobuf: truncated');
    (m[f] || (m[f] = [])).push(v);
  }
  return m;
}
export function packedVarints(bytes) { const out = [], st = { p: 0 }; while (st.p < bytes.length) out.push(readVarint(bytes, st)); return out; }
const td = new TextDecoder('utf-8');
export const str = (b) => (b ? td.decode(b) : '');
export const first = (m, f) => (m && m[f] ? m[f][0] : undefined);
/** TSP.Reference / DataReference -> identifier */
export const refId = (b) => (b ? first(pb(b), 1) : undefined);

// ---------- Archive objects ----------
/** Parse one decompressed .iwa stream into objects. */
export function parseArchives(buf, file, objects) {
  const st = { p: 0 };
  while (st.p < buf.length) {
    const alen = readVarint(buf, st);
    const ai = pb(buf.subarray(st.p, st.p + alen)); st.p += alen;
    const id = first(ai, 1);
    const infos = (ai[2] || []).map((b) => pb(b));
    let firstMsg = null;
    for (const mi of infos) {
      const len = first(mi, 3) || 0;
      const payload = buf.subarray(st.p, st.p + len); st.p += len;
      if (!firstMsg) {
        firstMsg = {
          id, type: first(mi, 1), payload, file,
          refs: mi[5] ? mi[5].flatMap((x) => (x instanceof Uint8Array ? packedVarints(x) : [x])) : [],
          dataRefs: mi[6] ? mi[6].flatMap((x) => (x instanceof Uint8Array ? packedVarints(x) : [x])) : [],
        };
      }
    }
    if (firstMsg && id != null && !objects.has(id)) objects.set(id, firstMsg);
  }
}

// ---------- Document container ----------
const IMG_EXT = /\.(jpe?g|png|gif|tiff?|heic|webp|bmp|pdf)$/i;
export function mimeOf(name) {
  const e = (name.split('.').pop() || '').toLowerCase();
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff', heic: 'image/heic', pdf: 'application/pdf' })[e] || 'application/octet-stream';
}

/** Open an iWork file. `unzip(bytes) -> {path: Uint8Array}` must be supplied (fflate.unzipSync works). */
export function openPackage(bytes, unzip, nameHint = '') {
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    throw new IWorkError('not-zip', 'このファイルは iWork の書類ではないようです（ZIP 形式ではありません）。');
  }
  let files;
  try { files = unzip(bytes); } catch (e) {
    if (zipHasEncryptedEntry(bytes)) throw new IWorkError('encrypted', 'パスワードで保護された書類は、いまは開けません。Mac か iPhone でパスワードを外してから送ってもらってください。');
    throw new IWorkError('bad-zip', 'ファイルが壊れているため開けません。送り主にもう一度送ってもらってください。');
  }
  return openFiles(files, unzip, nameHint);
}

/** Open from a {path: bytes} map - a ZIP's contents or a package folder picked from disk. */
export function openFiles(files, unzip, nameHint = '') {
  // A .zip that simply wraps one iWork file (common with e-mail attachments)
  const inner = Object.keys(files).filter((k) => !k.startsWith('__MACOSX/') && /\.(pages|numbers|key)$/i.test(k) && files[k].length > 4 && files[k][0] === 0x50 && files[k][1] === 0x4b);
  if (inner.length >= 1 && !Object.keys(files).some((k) => /(^|\/)(Index\/|Index\.zip$|index\.xml$|index\.apxl$)/.test(k))) {
    return openPackage(files[inner[0]], unzip, inner[0].split('/').pop());
  }
  // Files zipped from a Mac Finder package keep the bundle folder name as a prefix
  const keys = Object.keys(files).filter((k) => !k.startsWith('__MACOSX/'));
  const PREF_RE = /^(.+\/)(Index\/Document\.iwa|Index\.zip|index\.xml|index\.apxl)$/;
  const pref = keys.filter((k) => PREF_RE.test(k)).sort((a, b) => a.length - b.length)[0];
  if (pref && !files['Index/Document.iwa'] && !files['Index.zip'] && !files['index.xml'] && !files['index.apxl']) {
    const root = PREF_RE.exec(pref)[1];
    const nf = {}; for (const k of keys) if (k.startsWith(root) && k.length > root.length) nf[k.slice(root.length)] = files[k];
    files = nf;
  }
  // Some documents keep the archives inside a nested Index.zip
  if (files['Index.zip'] && !Object.keys(files).some((k) => k.startsWith('Index/'))) {
    try { const inner = unzip(files['Index.zip']); for (const k in inner) files[k.startsWith('Index/') ? k : 'Index/' + k] = inner[k]; } catch (e) { /* ignore */ }
  }
  for (const k of Object.keys(files)) if (k.endsWith('/') || k.startsWith('__MACOSX/')) delete files[k];
  const names = Object.keys(files);
  const pkg = { files, names, kind: null, legacy: false, objects: new Map(), dataById: new Map(), errors: [] };

  // iWork '09 (XML) documents
  if (files['index.xml'] || files['index.apxl'] || files['index.xml.gz'] || files['index.apxl.gz']) { pkg.legacy = true; }
  if (names.some((n) => /\.iwph$|Metadata\/.*encrypted|\.iwpv$/i.test(n)) || (files['.iwph'])) {
    throw new IWorkError('encrypted', 'パスワードで保護された書類は、いまは開けません。Mac か iPhone でパスワードを外してから送ってもらってください。');
  }
  if (!pkg.legacy) {
    const iwas = names.filter((n) => n.startsWith('Index/') && n.endsWith('.iwa'));
    if (!iwas.length) throw new IWorkError('no-index', 'iWork の書類の中身が見つかりません。iCloud で「書き出し」したファイルか、元の書類を送ってもらってください。');
    // Document.iwa first so that its objects win
    iwas.sort((a, b) => (a === 'Index/Document.iwa' ? -1 : b === 'Index/Document.iwa' ? 1 : a.localeCompare(b)));
    for (const n of iwas) {
      try { parseArchives(unwrapIwa(files[n]), n, pkg.objects); }
      catch (e) { pkg.errors.push(n + ': ' + e.message); }
    }
    if (!pkg.objects.size) throw new IWorkError('bad-index', '書類の中身を読み取れませんでした。新しい版の iWork で保存し直してもらうと開ける場合があります。');
    buildDataMap(pkg);
  }
  pkg.kind = detectKind(pkg, nameHint);
  return pkg;
}

function zipHasEncryptedEntry(b) {
  for (let i = 0; i + 8 < b.length; i++) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 3 && b[i + 3] === 4 && ((b[i + 6] & 1) || (b[i + 8] | (b[i + 9] << 8)) > 99)) return true;
  }
  return false;
}
export class IWorkError extends Error { constructor(code, msg) { super(msg); this.code = code; } }

function buildDataMap(pkg) {
  for (const o of pkg.objects.values()) {
    if (o.type !== 11006) continue; // TSP.PackageMetadata
    const m = pb(o.payload);
    for (const d of m[4] || []) {
      const di = pb(d);
      const id = first(di, 1);
      const pref = str(first(di, 3));
      const fname = str(first(di, 4));
      pkg.dataById.set(id, { id, preferred: pref, fileName: fname });
    }
  }
  // resolve to actual paths inside Data/
  const dataFiles = pkg.names.filter((n) => n.startsWith('Data/'));
  for (const d of pkg.dataById.values()) {
    const cands = [d.fileName, d.preferred].filter(Boolean).map((x) => 'Data/' + x);
    let path = cands.find((c) => pkg.files[c]);
    if (!path) {
      const base = (d.preferred || '').replace(/\.[^.]+$/, '');
      const ext = (d.preferred || '').split('.').pop();
      path = dataFiles.find((f) => f === `Data/${base}-${d.id}.${ext}`) || dataFiles.find((f) => f.includes(`-${d.id}.`) && (!base || f.includes(base.slice(0, 12))));
    }
    d.path = path || null;
  }
}

function detectKind(pkg, nameHint) {
  const ext = (nameHint.split('.').pop() || '').toLowerCase();
  if (['pages', 'numbers', 'key'].includes(ext)) return ext === 'key' ? 'keynote' : ext;
  if (pkg.legacy) return pkg.files['index.apxl'] || pkg.files['index.apxl.gz'] ? 'keynote' : 'pages';
  if (pkg.names.some((n) => /^Index\/(Slide|MasterSlide)/.test(n))) return 'keynote';
  for (const o of pkg.objects.values()) if (o.type === 10000) return 'pages';
  if (pkg.names.some((n) => /^Index\/Tables\//.test(n))) return 'numbers';
  return 'pages';
}

export function dataBytes(pkg, dataId) {
  const d = pkg.dataById.get(dataId);
  if (!d || !d.path) return null;
  return { bytes: pkg.files[d.path], name: d.preferred || d.path.slice(5), mime: mimeOf(d.path) };
}

// ---------- Text ----------
/** Text of a TSWP.StorageArchive object (type 2005 / 2001), with paragraphs split. */
export function storageText(pkg, id) {
  const o = pkg.objects.get(id);
  if (!o || !(o.type === 2005 || o.type === 2001)) return null;
  const m = pb(o.payload);
  const raw = (m[3] || []).map(str).join('');
  return { kind: first(m, 1) ?? 3, text: cleanText(raw) };
}
export function cleanText(s) {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/\u2029/g, '\n')
    .replace(/\u2028/g, '\n')
    .replace(/[\uFFFC\uFFFD]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, (c) => (c === '\u0004' || c === '\u0005' ? '\n' : ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------- Keynote ----------
const TEXT_HOLDERS = new Set([7, 2011, 2005, 2001, 15]);
export function readKeynote(pkg) {
  const objs = pkg.objects;
  let show = null;
  for (const o of objs.values()) if (o.type === 2 && o.file === 'Index/Document.iwa') { show = o; break; }
  if (!show) for (const o of objs.values()) if (o.type === 2) { show = o; break; }
  const slides = [];
  const usedImages = new Set();
  if (show) {
    const sm = pb(show.payload);
    const tree = first(sm, 3);
    const nodeIds = tree ? (pb(tree)[2] || []).map(refId) : [];
    let n = 0;
    for (const nid of nodeIds) {
      const node = objs.get(nid);
      if (!node) continue;
      const nm = pb(node.payload);
      const skipped = !!first(nm, 4);
      const slideId = refId(first(nm, 2));
      const thumbs = (nm[16] || []).map(refId).map((id) => dataBytes(pkg, id)).filter(Boolean);
      // largest thumbnail
      thumbs.sort((a, b) => b.bytes.length - a.bytes.length);
      const slide = slideId != null ? objs.get(slideId) : null;
      const s = { index: ++n, skipped, title: '', body: [], notes: '', images: [], thumb: thumbs[0] || null, tables: 0 };
      if (slide) {
        const m = pb(slide.payload);
        const titleId = refId(first(m, 5));
        const bodyId = refId(first(m, 6));
        const noteId = refId(first(m, 27));
        const drawIds = [...new Set([...(m[42] || []).map(refId), ...(m[7] || []).map(refId)])].filter((x) => x != null);
        const seenStorage = new Set();
        const textOf = (id, depth = 0) => {
          const o = objs.get(id); if (!o || depth > 4) return [];
          if (o.type === 2005 || o.type === 2001) { if (seenStorage.has(id)) return []; seenStorage.add(id); const t = storageText(pkg, id); return t && t.text ? [t.text] : []; }
          if (o.type === 3008) { // group
            return (pb(o.payload)[2] || []).map(refId).flatMap((c) => textOf(c, depth + 1));
          }
          if (TEXT_HOLDERS.has(o.type) || o.type >= 2000 && o.type < 2100) {
            return o.refs.filter((r) => { const x = objs.get(r); return x && (x.type === 2005 || x.type === 2001); }).flatMap((r) => textOf(r, depth + 1));
          }
          return [];
        };
        const imagesOf = (id, depth = 0) => {
          const o = objs.get(id); if (!o || depth > 4) return;
          if (o.type === 3005) {
            const im = pb(o.payload);
            const did = refId(first(im, 11)) ?? refId(first(im, 13));
            const d = did != null ? dataBytes(pkg, did) : null;
            if (d && !usedImages.has(d.name + d.bytes.length)) { usedImages.add(d.name + d.bytes.length); s.images.push(d); }
          } else if (o.type === 3008) (pb(o.payload)[2] || []).map(refId).forEach((c) => imagesOf(c, depth + 1));
          else if (o.type === 6000) { s.tables++; (s.tableIds || (s.tableIds = [])).push(id); }
        };
        if (titleId != null) s.title = textOf(titleId).join(' ').replace(/\s*\n\s*/g, ' ').trim();
        if (bodyId != null) s.body.push(...textOf(bodyId));
        for (const d of drawIds) { if (d === titleId || d === bodyId) continue; s.body.push(...textOf(d)); imagesOf(d); }
        if (noteId != null) s.notes = textOf(noteId).join('\n');
      }
      slides.push(s);
    }
  }
  return { kind: 'keynote', slides, preview: previewOf(pkg) };
}

// ---------- Pages ----------
export function readPages(pkg) {
  const storages = [];
  for (const [id, o] of pkg.objects) {
    if (o.type !== 2005 && o.type !== 2001) continue;
    const t = storageText(pkg, id);
    if (!t || !t.text) continue;
    storages.push({ id, kind: t.kind, text: t.text, file: o.file });
  }
  // Main body: the BODY storage (kind 0) that the document archive references; fall back to the longest BODY.
  let bodyIds = new Set();
  for (const o of pkg.objects.values()) if (o.type === 10000) for (const r of o.refs) bodyIds.add(r);
  const bodies = storages.filter((s) => s.kind === 0);
  let main = bodies.find((s) => bodyIds.has(s.id)) || bodies.sort((a, b) => b.text.length - a.text.length)[0] || null;
  const headers = storages.filter((s) => s.kind === 1).map((s) => s.text);
  const footnotes = storages.filter((s) => s.kind === 2).map((s) => s.text);
  const boxes = storages.filter((s) => s !== main && s.kind !== 1 && s.kind !== 2 && s.kind !== 5 && s.kind !== 4).map((s) => s.text);
  const notes = storages.filter((s) => s.kind === 4).map((s) => s.text);
  // page-layout documents (flyers etc.) have no BODY: use text boxes in file order
  const paragraphs = main ? main.text.split('\n') : [];
  const images = [];
  const seen = new Set();
  for (const o of pkg.objects.values()) {
    if (o.type !== 3005) continue;
    const im = pb(o.payload);
    const did = refId(first(im, 11)) ?? refId(first(im, 13));
    const d = did != null ? dataBytes(pkg, did) : null;
    if (d && !seen.has(d.name + d.bytes.length)) { seen.add(d.name + d.bytes.length); images.push(d); }
  }
  return { kind: 'pages', paragraphs, textBoxes: dedupe(boxes), headers: dedupe(headers), footnotes, comments: notes, images, preview: previewOf(pkg) };
}
const dedupe = (a) => [...new Set(a.filter(Boolean))];

export function previewOf(pkg) {
  for (const n of ['preview.jpg', 'QuickLook/Preview.jpg', 'QuickLook/Thumbnail.jpg', 'preview-web.jpg', 'QuickLook/Preview.pdf']) {
    if (pkg.files[n]) return { bytes: pkg.files[n], name: n, mime: mimeOf(n) };
  }
  return null;
}

/** All images packed in the document (Data/ folder) - used for "save all images". */
export function allImages(pkg) {
  return pkg.names.filter((n) => n.startsWith('Data/') && IMG_EXT.test(n) && !/^Data\/(mt|st)-/.test(n))
    .map((n) => ({ bytes: pkg.files[n], name: n.slice(5).replace(/-\d+(\.[^.]+)$/, '$1'), mime: mimeOf(n) }));
}

// ---------- iWork '09 (XML) ----------
export function readLegacy(pkg, kind, gunzip) {
  let xmlBytes = pkg.files['index.xml'] || pkg.files['index.apxl'];
  if (!xmlBytes && (pkg.files['index.xml.gz'] || pkg.files['index.apxl.gz']) && gunzip) xmlBytes = gunzip(pkg.files['index.xml.gz'] || pkg.files['index.apxl.gz']);
  const xml = xmlBytes ? str(xmlBytes) : '';
  const decode = (s) => s.replace(/<sf:br\/>|<sf:lnbr\/>/g, '\n').replace(/<sf:tab\/>/g, '\t').replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, '&');
  const paras = [];
  const re = /<sf:p\b[^>]*>([\s\S]*?)<\/sf:p>/g; let m;
  while ((m = re.exec(xml))) { const t = decode(m[1]).trim(); if (t) paras.push(t); }
  if (kind === 'keynote') {
    const slides = []; const sre = /<key:slide\b[\s\S]*?<\/key:slide>/g; let sm; let i = 0;
    while ((sm = sre.exec(xml))) {
      const ps = []; const pre = /<sf:p\b[^>]*>([\s\S]*?)<\/sf:p>/g; let pm;
      while ((pm = pre.exec(sm[0]))) { const t = decode(pm[1]).trim(); if (t) ps.push(t); }
      slides.push({ index: ++i, skipped: false, title: ps[0] || '', body: ps.slice(1), notes: '', images: [], thumb: null, tables: 0 });
    }
    return { kind: 'keynote', slides, preview: previewOf(pkg), legacy: true };
  }
  if (kind === 'numbers') {
    return { kind: 'numbers', legacy: true, xml };
  }
  return { kind: 'pages', paragraphs: paras, textBoxes: [], headers: [], footnotes: [], comments: [], images: allImages(pkg), preview: previewOf(pkg), legacy: true };
}

/** High-level entry point. deps = { unzip, gunzip?, readNumbers? } */
export function readDocument(bytes, name, deps) {
  // bytes may be a ZIP (Uint8Array) or an already-expanded {path: bytes} map (package folder)
  const pkg = bytes instanceof Uint8Array ? openPackage(bytes, deps.unzip, name) : openFiles(bytes, deps.unzip, name);
  let doc;
  if (pkg.legacy) doc = readLegacy(pkg, pkg.kind, deps.gunzip);
  else if (pkg.kind === 'keynote') doc = readKeynote(pkg);
  else if (pkg.kind === 'pages') doc = readPages(pkg);
  else doc = { kind: 'numbers', preview: previewOf(pkg) };
  if (doc.kind === 'pages' && !pkg.legacy && !doc.paragraphs.length && !doc.textBoxes.length) {
    // page-layout documents: nothing in BODY - text boxes were filtered as duplicates; fall back to all text
    const all = [];
    for (const [id, o] of pkg.objects) if (o.type === 2005 || o.type === 2001) { const t = storageText(pkg, id); if (t && t.text) all.push(t.text); }
    doc.textBoxes = [...new Set(all)];
  }
  doc.images = doc.images || allImages(pkg);
  doc.allImages = allImages(pkg);
  doc.name = name;
  doc.pkg = pkg;
  return doc;
}

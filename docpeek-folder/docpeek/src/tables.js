/* Docpeek - Numbers tables (TST). Reads both the current cell storage (v5) and the older one (v0-4).
 * Layout reference: numbers-parser (MIT) and the TST protobuf definitions published by keynote-parser. */
import { pb, first, refId, str, storageText } from './iwa.js';

const T_TABLE_INFO = 6000, T_TABLE_MODEL = 6001, T_TILE = 6002, T_DATALIST = 6201, T_SEGMENT = 6011;
const EPOCH_MS = Date.UTC(2001, 0, 1);

function dataList(pkg, id, cache) {
  if (id == null) return new Map();
  if (cache.has(id)) return cache.get(id);
  const out = new Map();
  const o = pkg.objects.get(id);
  if (o) {
    const m = pb(o.payload);
    const type = first(m, 1);
    const addEntries = (arr) => {
      for (const e of arr || []) {
        const em = pb(e);
        const key = first(em, 1);
        if (type === 1) out.set(key, str(first(em, 3)));
        else if (type === 8) { // rich text payload -> storage text
          const payload = pkg.objects.get(refId(first(em, 9)));
          let text = '';
          if (payload) {
            const sid = refId(first(pb(payload.payload), 1));
            const t = storageText(pkg, sid);
            text = t ? t.text : '';
          }
          out.set(key, text);
        } else if (type === 2) { const f = first(em, 6); out.set(key, f ? pb(f) : null); }
        else if (type === 10) out.set(key, ''); // comments not shown
      }
    };
    addEntries(m[3]);
    for (const segRef of m[4] || []) {
      const so = pkg.objects.get(refId(segRef));
      if (so) addEntries(pb(so.payload)[3]);
    }
  }
  cache.set(id, out);
  return out;
}

function readDecimal128(dv, off) {
  // IEEE 754-2008 decimal128, BID encoding, little endian (as written by Numbers)
  const lo = dv.getBigUint64(off, true), hi = dv.getBigUint64(off + 8, true);
  const neg = (hi >> 63n) & 1n;
  let exp, coeff;
  if (((hi >> 61n) & 3n) === 3n) { exp = Number((hi >> 47n) & 0x3fffn); coeff = ((0x8n | ((hi >> 46n) & 1n)) << 110n) | ((hi & 0x3fffffffffffn) << 64n) | lo; }
  else { exp = Number((hi >> 49n) & 0x3fffn); coeff = ((hi & 0x1ffffffffffffn) << 64n) | lo; }
  exp -= 6176;
  let v = Number(coeff) * Math.pow(10, exp);
  // round to 15 significant digits to drop binary noise
  if (v !== 0 && Number.isFinite(v)) v = Number(v.toPrecision(15));
  return neg ? -v : v;
}

function parseNewCell(buf, ctx) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const flags = dv.getUint32(8, true);
  let off = 12, d128, dbl, secs, sidx, ridx, fmt = {};
  if (flags & 0x1) { d128 = readDecimal128(dv, off); off += 16; }
  if (flags & 0x2) { dbl = dv.getFloat64(off, true); off += 8; }
  if (flags & 0x4) { secs = dv.getFloat64(off, true); off += 8; }
  if (flags & 0x8) { sidx = dv.getUint32(off, true); off += 4; }
  if (flags & 0x10) { ridx = dv.getUint32(off, true); off += 4; }
  for (const bit of [0x20, 0x40, 0x80, 0x100, 0x200, 0x400, 0x800, 0x1000]) if (flags & bit) off += 4;
  if (flags & 0x2000) { fmt.num = dv.getUint32(off, true); off += 4; }
  if (flags & 0x4000) { fmt.cur = dv.getUint32(off, true); off += 4; }
  if (flags & 0x8000) { fmt.date = dv.getUint32(off, true); off += 4; }
  if (flags & 0x10000) { fmt.dur = dv.getUint32(off, true); off += 4; }
  const type = buf[1];
  switch (type) {
    case 0: return null;
    case 2: return { t: 'n', v: d128 ?? dbl ?? 0, f: fmt.num != null ? ctx.formats.get(fmt.num) : null };
    case 10: return { t: 'n', v: d128 ?? dbl ?? 0, f: fmt.cur != null ? ctx.formats.get(fmt.cur) : { 1: [257] }, cur: true };
    case 3: return { t: 's', v: ctx.sst.get(sidx) ?? '' };
    case 5: return { t: 'd', v: new Date(EPOCH_MS + (secs || 0) * 1000), f: fmt.date != null ? ctx.formats.get(fmt.date) : null };
    case 6: return { t: 'b', v: (dbl || 0) > 0 };
    case 7: return { t: 'dur', v: dbl || 0 };
    case 8: return { t: 'e', v: '#ERROR' };
    case 9: return { t: 's', v: ridx != null ? (ctx.rich.get(ridx) ?? '') : (ctx.sst.get(sidx) ?? '') };
    default: return d128 != null ? { t: 'n', v: d128 } : sidx != null ? { t: 's', v: ctx.sst.get(sidx) ?? '' } : null;
  }
}

function popcnt(x) { let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; }
function parseOldCell(buf, ctx) {
  const v = buf[0];
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const flags = dv.getUint32(4, true);
  let off = (v > 1 ? 12 : 8) + popcnt(flags & (v > 1 ? 3470 : 398)) * 4;
  let ridx = -1, sidx = -1, ieee = NaN, secs = 0;
  if (flags & 512) { ridx = dv.getUint32(off, true); off += 4; }
  off += popcnt(flags & (v > 1 ? 12288 : 4096)) * 4;
  if (flags & 16) { sidx = dv.getUint32(off, true); off += 4; }
  if (flags & 32) { ieee = dv.getFloat64(off, true); off += 8; }
  if (flags & 64) { secs = dv.getFloat64(off, true); off += 8; }
  switch (v >= 4 ? buf[1] : buf[2]) {
    case 0: return null;
    case 2: return { t: 'n', v: ieee };
    case 3: return { t: 's', v: ctx.sst.get(sidx) ?? '' };
    case 5: return { t: 'd', v: new Date(EPOCH_MS + secs * 1000) };
    case 6: return { t: 'b', v: ieee > 0 };
    case 7: return { t: 'dur', v: ieee };
    case 8: return { t: 'e', v: '#ERROR' };
    case 9: return ridx > -1 ? { t: 's', v: ctx.rich.get(ridx) ?? '' } : sidx > -1 ? { t: 's', v: ctx.sst.get(sidx) ?? '' } : (!isNaN(ieee) ? { t: 'n', v: ieee } : null);
    default: return null;
  }
}

function rowBuffers(storage, offsetsBytes, wide) {
  const dv = new DataView(offsetsBytes.buffer, offsetsBytes.byteOffset, offsetsBytes.byteLength);
  const n = offsetsBytes.length >> 1; const offs = [];
  for (let c = 0; c < n; c++) { const o = dv.getUint16(c * 2, true); if (o !== 0xffff) offs.push([c, o * (wide ? 4 : 1)]); }
  const cells = [];
  for (let i = 0; i < offs.length; i++) {
    const [c, s] = offs[i];
    const e = i + 1 < offs.length ? offs[i + 1][1] : storage.length;
    cells[c] = storage.subarray(s, e);
  }
  return cells;
}

function readTableModel(pkg, modelId, caches) {
  const o = pkg.objects.get(modelId);
  if (!o || o.type !== T_TABLE_MODEL) return null;
  const m = pb(o.payload);
  const name = str(first(m, 8));
  const nrows = first(m, 6) || 0, ncols = first(m, 7) || 0;
  const headerRows = first(m, 9) ?? 1, headerCols = first(m, 10) ?? 1, footerRows = first(m, 11) || 0;
  const nameShown = first(m, 22) ?? true;
  const ds = pb(first(m, 4));
  const ctx = {
    sst: dataList(pkg, refId(first(ds, 4)), caches),
    rich: dataList(pkg, refId(first(ds, 17)), caches),
    formats: dataList(pkg, refId(first(ds, 22)) ?? refId(first(ds, 11)), caches),
  };
  const ts = pb(first(ds, 3));
  const tileSize = first(ts, 2) || 256;
  const rows = [];
  let seq = 0;
  for (const tb of ts[1] || []) {
    const tm = pb(tb);
    const tileId = first(tm, 1) ?? 0;
    const tile = pkg.objects.get(refId(first(tm, 2)));
    if (!tile || tile.type !== T_TILE) continue;
    const t = pb(tile.payload);
    const bnc = !!first(t, 7);
    const base = (ts[1].length > 1 || tileId) ? tileId * tileSize : seq;
    for (const ri of t[5] || []) {
      const r = pb(ri);
      const R = base + (first(r, 1) || 0);
      const newBuf = first(r, 6), newOff = first(r, 7);
      const oldBuf = first(r, 3), oldOff = first(r, 4);
      let cells;
      if (newBuf && newOff && newBuf.length && (bnc || !oldBuf || newBuf[0] === 5)) {
        const bufs = rowBuffers(newBuf, newOff, !!first(r, 8));
        cells = bufs.map((b) => { try { return b && b.length >= 12 && b[0] === 5 ? parseNewCell(b, ctx) : (b && b.length >= 8 ? parseOldCell(b, ctx) : null); } catch (e) { return null; } });
      } else if (oldBuf && oldOff) {
        const bufs = rowBuffers(oldBuf, oldOff, false);
        cells = bufs.map((b) => { try { return b && b.length >= 8 ? (b[0] === 5 ? parseNewCell(b, ctx) : parseOldCell(b, ctx)) : null; } catch (e) { return null; } });
      } else continue;
      rows[R] = cells;
    }
    seq += first(t, 4) || 0;
  }
  // trim to real size
  const grid = [];
  let maxR = -1, maxC = -1;
  for (let r = 0; r < Math.max(nrows, rows.length); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) if (row[c] != null && row[c].v !== '' ) { if (r > maxR) maxR = r; if (c > maxC) maxC = c; }
  }
  const R = Math.max(Math.min(nrows || maxR + 1, Math.max(maxR + 1, 0)), 0);
  const C = Math.max(Math.min(ncols || maxC + 1, Math.max(maxC + 1, 0)), 0);
  for (let r = 0; r < R; r++) { const row = rows[r] || []; const out = []; for (let c = 0; c < C; c++) out.push(row[c] || null); grid.push(out); }
  return { name, nameShown, headerRows: Math.min(headerRows, R), headerCols: Math.min(headerCols, C), footerRows, rows: grid, declared: [nrows, ncols] };
}

/** Return [{name, tables:[{name, rows:[[cell]]}]}] for a Numbers document, or tables found in Pages/Keynote. */
export function readTables(pkg) {
  const caches = new Map();
  const objs = pkg.objects;
  const sheets = [];
  const used = new Set();
  // TN.DocumentArchive (type 1) -> sheets (field 1) -> TN.SheetArchive (type 2): name (1), drawables (2)
  let doc = null;
  for (const o of objs.values()) if (o.type === 1 && o.file === 'Index/Document.iwa') { doc = o; break; }
  if (doc && pkg.kind === 'numbers') {
    const dm = pb(doc.payload);
    for (const sref of dm[1] || []) {
      const so = objs.get(refId(sref));
      if (!so || so.type !== 2) continue;
      const sm = pb(so.payload);
      const sheet = { name: str(first(sm, 1)), tables: [] };
      for (const dref of sm[2] || []) {
        const d = objs.get(refId(dref));
        if (!d || d.type !== T_TABLE_INFO) continue;
        const mid = refId(first(pb(d.payload), 2));
        const t = readTableModel(pkg, mid, caches);
        if (t) { sheet.tables.push(t); used.add(mid); }
      }
      sheets.push(sheet);
    }
  }
  // any remaining tables (Keynote / Pages, or unusual Numbers files)
  const extra = [];
  for (const [id, o] of objs) {
    if (o.type !== T_TABLE_MODEL || used.has(id)) continue;
    const t = readTableModel(pkg, id, caches);
    if (t && t.rows.length) extra.push(t);
  }
  if (extra.length) sheets.push({ name: sheets.length ? 'その他の表' : '表', tables: extra });
  return sheets;
}

/** Map table-model ids so Keynote/Pages can show a slide's tables */
export function tableById(pkg, infoId, caches = new Map()) {
  const d = pkg.objects.get(infoId);
  if (!d || d.type !== T_TABLE_INFO) return null;
  return readTableModel(pkg, refId(first(pb(d.payload), 2)), caches);
}

// ---------- display formatting ----------
const pad = (n) => String(n).padStart(2, '0');
export function formatCell(c, locale = 'ja-JP') {
  if (!c) return '';
  switch (c.t) {
    case 's': return c.v;
    case 'b': return c.v ? 'TRUE' : 'FALSE';
    case 'e': return c.v;
    case 'dur': {
      const s = Math.abs(c.v); const h = Math.floor(s / 3600), mi = Math.floor((s % 3600) / 60), se = Math.round(s % 60);
      return (c.v < 0 ? '-' : '') + (h ? `${h}:${pad(mi)}:${pad(se)}` : `${mi}:${pad(se)}`);
    }
    case 'd': {
      const d = c.v; if (isNaN(d)) return '';
      const ds = locale && !locale.startsWith('ja') && !locale.startsWith('zh') && !locale.startsWith('ko')
        ? d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
        : `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`;
      const hasTime = d.getUTCHours() || d.getUTCMinutes() || d.getUTCSeconds();
      const f = c.f; const sup = f ? { date: first(f, 12), time: first(f, 13) } : {};
      if (sup.date && hasTime) return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
      return hasTime && !sup.time ? `${ds} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : ds;
    }
    case 'n': {
      const v = c.v; if (!Number.isFinite(v)) return '';
      const f = c.f; const ft = f ? first(f, 1) : null;
      const dp = f && first(f, 2) != null && first(f, 2) < 50 ? first(f, 2) : null;
      const sep = f ? !!first(f, 5) : false;
      const opts = dp != null ? { minimumFractionDigits: dp, maximumFractionDigits: dp } : { maximumFractionDigits: 10 };
      if (ft === 258) return (v * 100).toLocaleString(locale, { ...opts, useGrouping: sep }) + '%';
      if (ft === 257 || c.cur) {
        const code = f && first(f, 3) ? str(first(f, 3)) : null;
        try { if (code) return v.toLocaleString(locale, { style: 'currency', currency: code, ...(dp != null ? opts : {}) }); } catch (e) { /* unknown code */ }
        return v.toLocaleString(locale, { ...opts, useGrouping: true });
      }
      if (ft === 259) return v.toExponential(dp ?? 2);
      return v.toLocaleString(locale, { ...opts, useGrouping: sep });
    }
  }
  return String(c.v ?? '');
}
/** raw value for spreadsheet export */
export function rawCell(c) {
  if (!c) return null;
  if (c.t === 'd') return isNaN(c.v) ? null : c.v;
  if (c.t === 'dur') return formatCell(c);
  if (c.t === 'n' && c.f && first(c.f, 1) === 258) return c.v; // keep number; format applied in xlsx writer
  return c.v;
}

// ---------- iWork '09 Numbers (XML) ----------
const xmlDecode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, '&');
const attr = (a, n) => { const m = new RegExp(n.replace(':', '\\:') + '="([^"]*)"').exec(a); return m ? xmlDecode(m[1]) : null; };
export function readLegacyTables(xml) {
  const sheets = [];
  const parts = xml.split(/<ls:workspace\b/).slice(1);
  const chunks = parts.length ? parts.map((p) => ({ name: attr(p.slice(0, 400), 'ls:workspace-name') || '', body: p })) : [{ name: '', body: xml }];
  for (const ch of chunks) {
    const sheet = { name: ch.name, tables: [] };
    const tre = /<sf:tabular-model\b([^>]*)>([\s\S]*?)<\/sf:tabular-model>/g; let tm;
    while ((tm = tre.exec(ch.body))) {
      const a = tm[1], body = tm[2];
      const g = /<sf:grid\b([^>]*)>/.exec(body);
      const ncols = g ? +(attr(g[1], 'sf:numcols') || 0) : 0;
      const ds = /<sf:datasource\b[^>]*>([\s\S]*?)<\/sf:datasource>/.exec(body);
      if (!ncols || !ds) continue;
      const cells = [];
      const cre = /<sf:(t|n|d|f|g|s|b|du|o|e|pm)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/sf:\1>)/g; let c;
      while ((c = cre.exec(ds[1]))) {
        const k = c[1], at = c[2] || '', inner = c[3] || '';
        let cell = null;
        if (k === 'pm') {
          const ref = /<sf:proxied-cell-ref\b[^>]*sfa:IDREF="([^"]+)"/.exec(inner);
          if (ref) { const it = new RegExp('<sf:t\\b[^>]*sfa:ID="' + ref[1] + '"[^>]*>[\\s\\S]*?sfa:s="([^"]*)"').exec(inner); if (it) cell = { t: 's', v: xmlDecode(it[1]) };
            else { const itn = new RegExp('<sf:n\\b[^>]*sfa:ID="' + ref[1] + '"[^>]*sf:v="([^"]*)"').exec(inner); if (itn) cell = { t: 'n', v: +itn[1] }; } }
        } else if (k === 't') { const s = /sfa:s="([^"]*)"/.exec(inner); cell = { t: 's', v: s ? xmlDecode(s[1]) : xmlDecode(inner.replace(/<[^>]+>/g, '')).trim() }; }
        else if (k === 'n') { const v = attr(at, 'sf:v'); cell = v != null ? { t: 'n', v: +v } : null; }
        else if (k === 'd') { const v = attr(at, 'sf:cell-date'); cell = v ? { t: 'd', v: /^-?[\d.]+$/.test(v) ? new Date(EPOCH_MS + (+v) * 1000) : new Date(v.endsWith('Z') ? v : v + 'Z') } : null; }
        else if (k === 'b') { cell = { t: 'b', v: attr(at, 'sf:v') === '1' || attr(at, 'sf:v') === 'true' }; }
        else if (k === 'du') { const v = attr(at, 'sf:du'); cell = v != null ? { t: 'dur', v: +v } : null; }
        else if (k === 'f') {
          const rn = /<sf:rn\b([^>]*)\/?>/.exec(inner), rs = /<sf:rs\b[^>]*>([\s\S]*?)<\/sf:rs>/.exec(inner), rb = /<sf:rb\b([^>]*)\/?>/.exec(inner), rd = /<sf:rd\b([^>]*)\/?>/.exec(inner);
          if (rn) cell = { t: 'n', v: +attr(rn[1], 'sf:v') };
          else if (rs) { const s = /sfa:s="([^"]*)"/.exec(rs[1]); cell = { t: 's', v: s ? xmlDecode(s[1]) : xmlDecode(rs[1].replace(/<[^>]+>/g, '')).trim() }; }
          else if (rb) cell = { t: 'b', v: attr(rb[1], 'sf:v') === '1' };
          else if (rd) { const v = attr(rd[1], 'sf:cell-date'); cell = v ? { t: 'd', v: /^-?[\d.]+$/.test(v) ? new Date(EPOCH_MS + (+v) * 1000) : new Date(v + 'Z') } : null; }
        }
        cells.push(cell);
        const span = +(attr(at, 'sf:col-span') || 1);
        for (let i = 1; i < span; i++) cells.push(null);
      }
      const rows = []; for (let i = 0; i < cells.length; i += ncols) rows.push(cells.slice(i, i + ncols));
      while (rows.length && rows[rows.length - 1].every((x) => !x)) rows.pop();
      if (!rows.some((r) => r.some((x) => x && x.v !== '' && x.v != null))) continue;
      sheet.tables.push({ name: attr(a, 'sf:name') || '', nameShown: true, headerRows: +(attr(a, 'sf:num-header-rows') || 0), headerCols: +(attr(a, 'sf:num-header-columns') || 0), footerRows: +(attr(a, 'sf:num-footer-rows') || 0), rows, declared: [rows.length, ncols] });
    }
    if (sheet.tables.length) sheets.push(sheet);
  }
  return sheets;
}

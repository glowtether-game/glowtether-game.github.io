// QuickTime (.mov) → MP4 without re-encoding. Only the index (moov) is rewritten;
// the picture and sound data (mdat) are copied byte for byte with File.slice, so
// nothing is decoded and big files are never held in memory.

const td = new TextDecoder('latin1');
const fourcc = (u, o) => td.decode(u.subarray(o, o + 4));
const u32 = (u, o) => ((u[o] << 24) | (u[o + 1] << 16) | (u[o + 2] << 8) | u[o + 3]) >>> 0;
const u16 = (u, o) => (u[o] << 8) | u[o + 1];
const put32 = (u, o, v) => { u[o] = (v >>> 24) & 255; u[o + 1] = (v >>> 16) & 255; u[o + 2] = (v >>> 8) & 255; u[o + 3] = v & 255; };
const u64 = (u, o) => u32(u, o) * 4294967296 + u32(u, o + 4);
const put64 = (u, o, v) => { put32(u, o, Math.floor(v / 4294967296)); put32(u, o + 4, v % 4294967296); };

const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'udta']);

/** A box in the tree: {type, data (payload bytes, without header) | kids} */
function parseKids(u, start, end) {
  const out = [];
  let o = start;
  while (o + 8 <= end) {
    let size = u32(u, o); const type = fourcc(u, o + 4); let hdr = 8;
    if (size === 1) { size = u64(u, o + 8); hdr = 16; } else if (size === 0) size = end - o;
    if (size < hdr || o + size > end) break; // QuickTime udta may end with a 4-byte zero terminator
    const box = { type };
    if (CONTAINERS.has(type)) box.kids = parseKids(u, o + hdr, o + size);
    else box.data = u.subarray(o + hdr, o + size);
    out.push(box);
    o += size;
  }
  return out;
}
const kid = (b, t) => b.kids && b.kids.find((k) => k.type === t);
const path = (b, ...ts) => { for (const t of ts) { b = b && kid(b, t); } return b; };

function boxSize(b) { const p = b.kids ? b.kids.reduce((s, k) => s + boxSize(k), 0) : b.data.length; return p + 8; }
function writeBox(b, out, o) {
  const size = boxSize(b);
  put32(out, o, size); for (let i = 0; i < 4; i++) out[o + 4 + i] = b.type.charCodeAt(i);
  let p = o + 8;
  if (b.kids) for (const k of b.kids) p = writeBox(k, out, p);
  else { out.set(b.data, p); p += b.data.length; }
  return p;
}
const box = (type, data) => ({ type, data });
const str = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const cat = (...parts) => { const n = parts.reduce((s, p) => s + p.length, 0); const r = new Uint8Array(n); let o = 0; for (const p of parts) { r.set(p, o); o += p.length; } return r; };

/** Read the top-level boxes of a file without loading it. */
async function topBoxes(file) {
  const list = []; let o = 0;
  while (o + 8 <= file.size) {
    const h = new Uint8Array(await file.slice(o, o + 16).arrayBuffer());
    let size = u32(h, 0); const type = fourcc(h, 4); let hdr = 8;
    if (size === 1) { size = u64(h, 8); hdr = 16; } else if (size === 0) size = file.size - o;
    if (size < hdr) throw new Error('bad box');
    list.push({ type, start: o, end: Math.min(o + size, file.size), hdr });
    o += size;
  }
  return list;
}

function handlerOf(trak) { const h = path(trak, 'mdia', 'hdlr'); return h ? fourcc(h.data, 8) : ''; }
function sampleEntry(trak) { const s = path(trak, 'mdia', 'minf', 'stbl', 'stsd'); return s && s.data.length >= 16 ? fourcc(s.data, 12) : ''; }

function fixHdlr(h, kind) {
  const name = kind === 'vide' ? 'VideoHandler' : 'SoundHandler';
  h.data = cat(new Uint8Array(4), new Uint8Array(4), str(kind), new Uint8Array(12), str(name), new Uint8Array(1));
}
function fixDinf(minf) {
  const url = cat(new Uint8Array([0, 0, 0, 1]));
  const dref = cat(new Uint8Array(4), new Uint8Array([0, 0, 0, 1]), new Uint8Array([0, 0, 0, 12]), str('url '), url);
  const d = kid(minf, 'dinf');
  const nd = { type: 'dinf', kids: [box('dref', dref)] };
  if (d) minf.kids[minf.kids.indexOf(d)] = nd; else minf.kids.splice(1, 0, nd);
}
function fixMdhd(m) {
  const v = m.data[0]; const lo = v === 1 ? 32 : 20;
  if (m.data.length >= lo + 2) { const lang = u16(m.data, lo); if (lang < 0x400) { m.data = m.data.slice(); m.data[lo] = 0x55; m.data[lo + 1] = 0xc4; } }
}
/** QuickTime sound description v1/v2 → plain MP4 AudioSampleEntry (v0), esds pulled out of 'wave'. */
function fixSoundEntry(stsd) {
  const d = stsd.data; const count = u32(d, 4); if (count !== 1) return;
  const eSize = u32(d, 8); const type = fourcc(d, 12); const e = d.subarray(16, 8 + eSize);
  if (e.length < 28) return;
  const ver = u16(e, 8);
  if (ver === 0 && type !== 'mp4a') return;
  let channels = u16(e, 16), bits = u16(e, 18), rate = u32(e, 24), kidsAt = 28;
  if (ver === 1) kidsAt = 44;
  else if (ver === 2) {
    const dv = new DataView(e.buffer, e.byteOffset, e.byteLength);
    rate = Math.round(dv.getFloat64(32)); channels = dv.getUint32(40); kidsAt = 64; bits = 16;
  }
  if (ver === 0) return;
  let kids = parseKids(e, kidsAt, e.length);
  const wave = kids.find((k) => k.type === 'wave');
  if (wave) { const inner = parseKids(wave.data, 0, wave.data.length).filter((k) => k.type === 'esds'); kids = kids.filter((k) => k !== wave).concat(inner); }
  const base = new Uint8Array(28);
  base.set(e.subarray(0, 8)); // reserved + data_reference_index
  base[17] = channels; base[16] = channels >> 8; base[19] = bits || 16; base[18] = (bits || 16) >> 8;
  put32(base, 24, (Math.min(rate, 65535) << 16) >>> 0);
  const kidBytes = kids.map((k) => { const b = new Uint8Array(boxSize(k)); writeBox(k, b, 0); return b; });
  const entry = cat(base, ...kidBytes);
  const head = new Uint8Array(16); head.set(d.subarray(0, 8)); put32(head, 8, entry.length + 8); head.set(str(type), 12);
  stsd.data = cat(head, entry);
}

/** Read Apple "mdta" keys (moov/meta or udta/meta) into {key: string value}. */
function mdtaValues(meta) {
  const d = meta.data; const out = {};
  const off = fourcc(d, 4) === 'hdlr' ? 0 : 4; // QuickTime meta has no version/flags; ISO meta does
  const kids = parseKids(d, off, d.length);
  const hdlr = kids.find((k) => k.type === 'hdlr'); if (!hdlr || fourcc(hdlr.data, 8) !== 'mdta') return null;
  const keys = kids.find((k) => k.type === 'keys'), ilst = kids.find((k) => k.type === 'ilst');
  if (!keys || !ilst) return out;
  const names = []; let o = 8; const n = u32(keys.data, 4);
  for (let i = 0; i < n && o + 8 <= keys.data.length; i++) { const sz = u32(keys.data, o); names.push(td.decode(keys.data.subarray(o + 8, o + sz))); o += sz; }
  let p = 0; const L = ilst.data;
  while (p + 8 <= L.length) {
    const sz = u32(L, p); if (sz < 8) break; const idx = u32(L, p + 4);
    const inner = parseKids(L, p + 8, p + sz).find((k) => k.type === 'data');
    if (inner && inner.data.length >= 8 && names[idx - 1]) out[names[idx - 1]] = new TextDecoder().decode(inner.data.subarray(8));
    p += sz;
  }
  return out;
}
/** udta ©xyz box (ISO 6709 location string), the form MP4 players and photo apps read. */
function xyzBox(iso) { const s = str(iso); const d = new Uint8Array(4 + s.length); d[0] = s.length >> 8; d[1] = s.length & 255; d[2] = 0x15; d[3] = 0xc7; d.set(s, 4); return box('©xyz', d); }

/** Inspect a .mov: what codecs it has, its date, and whether we can convert it. */
export async function inspect(file) {
  const tops = await topBoxes(file);
  const moovT = tops.find((b) => b.type === 'moov');
  if (!moovT) throw new Error('no moov');
  if (tops.some((b) => b.type === 'moof')) throw new Error('fragmented');
  const mu = new Uint8Array(await file.slice(moovT.start, moovT.end).arrayBuffer());
  const moov = { type: 'moov', kids: parseKids(mu, moovT.hdr, mu.length) };
  const traks = moov.kids.filter((k) => k.type === 'trak');
  const video = traks.filter((t) => handlerOf(t) === 'vide').map(sampleEntry);
  const audio = traks.filter((t) => handlerOf(t) === 'soun').map(sampleEntry);
  const mvhd = kid(moov, 'mvhd');
  let date = null;
  if (mvhd) { const v = mvhd.data[0]; const secs = v === 1 ? u64(mvhd.data, 4) : u32(mvhd.data, 4); if (secs > 2082844800) date = new Date((secs - 2082844800) * 1000); }
  return { tops, moov, video, audio, date, hevc: video.some((c) => c === 'hvc1' || c === 'hev1'), spatial: audio.some((c) => c === 'apac') };
}

/** Build the MP4 as a Blob (made of slices of the original file). opts.dropLocation removes GPS from udta. */
export async function remux(file, info, opts = {}) {
  info ||= await inspect(file);
  const { tops, moov } = info;
  // keep picture and sound tracks only (drop timecode, metadata and other helper tracks)
  // spatial audio (APAC) is dropped when a normal sound track is also present, since most players can't read it
  const plainSound = moov.kids.some((k) => k.type === 'trak' && handlerOf(k) === 'soun' && sampleEntry(k) !== 'apac');
  // Apple keeps the location in QuickTime-style keys (moov/meta), which MP4 does not define:
  // move it to udta/©xyz unless the user asked to remove it
  let iso = null;
  for (const m of [kid(moov, 'meta'), path(moov, 'udta', 'meta')]) { const v = m && mdtaValues(m); if (v && v['com.apple.quicktime.location.ISO6709']) iso ||= v['com.apple.quicktime.location.ISO6709']; }
  moov.kids = moov.kids.filter((k) => {
    if (k.type === 'trak') return handlerOf(k) === 'vide' || (handlerOf(k) === 'soun' && !(plainSound && sampleEntry(k) === 'apac'));
    if (k.type === 'meta') return false;
    return true;
  });
  let udta = kid(moov, 'udta');
  if (udta) udta.kids = udta.kids.filter((k) => !(k.type === 'meta' && mdtaValues(k)) && !(opts.dropLocation && (k.type === '\u00a9xyz' || k.type === 'loci')));
  if (iso && !opts.dropLocation && !(udta && kid(udta, '\u00a9xyz'))) { if (!udta) moov.kids.push(udta = { type: 'udta', kids: [] }); udta.kids.push(xyzBox(iso)); }
  if (udta && !udta.kids.length) moov.kids.splice(moov.kids.indexOf(udta), 1);
  const traks = moov.kids.filter((k) => k.type === 'trak');
  if (!traks.some((t) => handlerOf(t) === 'vide')) throw new Error('no video');
  for (const t of traks) {
    const kind = handlerOf(t);
    t.kids = t.kids.filter((k) => !['tref', 'tapt', 'load', 'meta', 'clip', 'matt', 'imap'].includes(k.type));
    const mdia = kid(t, 'mdia'); const minf = kid(mdia, 'minf');
    fixHdlr(kid(mdia, 'hdlr'), kind); fixMdhd(kid(mdia, 'mdhd'));
    minf.kids = minf.kids.filter((k) => k.type !== 'hdlr' && k.type !== 'gmhd');
    fixDinf(minf);
    if (kind === 'soun') fixSoundEntry(kid(kid(minf, 'stbl'), 'stsd'));
  }
  const mdats = tops.filter((b) => b.type === 'mdat');
  const total = mdats.reduce((s, b) => s + (b.end - b.start), 0);
  // chunk offsets: switch to 64-bit when the result can pass 4 GB
  const big = opts.force64 || total + 1e7 > 4294967295;
  const tables = [];
  for (const t of traks) {
    const stbl = path(t, 'mdia', 'minf', 'stbl');
    const st = kid(stbl, 'stco') || kid(stbl, 'co64');
    const is64 = st.type === 'co64'; const n = u32(st.data, 4);
    const offs = new Array(n); for (let i = 0; i < n; i++) offs[i] = is64 ? u64(st.data, 8 + i * 8) : u32(st.data, 8 + i * 4);
    const nb = { type: big ? 'co64' : 'stco', data: new Uint8Array(8 + n * (big ? 8 : 4)) };
    put32(nb.data, 4, n);
    stbl.kids[stbl.kids.indexOf(st)] = nb;
    tables.push({ nb, offs });
  }
  const ftyp = box('ftyp', cat(str('mp42'), new Uint8Array(4), str('isommp42')));
  const head = boxSize(ftyp) + boxSize(moov);
  let pos = head; const map = [];
  for (const m of mdats) { map.push({ s: m.start, e: m.end, d: pos - m.start }); pos += m.end - m.start; }
  for (const { nb, offs } of tables) {
    offs.forEach((o, i) => {
      const m = map.find((r) => o >= r.s && o < r.e);
      if (!m) throw new Error('offset outside data');
      const v = o + m.d;
      if (big) put64(nb.data, 8 + i * 8, v); else put32(nb.data, 8 + i * 4, v);
    });
  }
  const headBytes = new Uint8Array(head);
  writeBox(moov, headBytes, writeBox(ftyp, headBytes, 0));
  return new Blob([headBytes, ...mdats.map((m) => file.slice(m.start, m.end))], { type: 'video/mp4' });
}

/** Build an audio-only M4A (the first normal sound track) as a Blob, copying only that track's chunks.
 *  Used to make an MP3 from a video without reading the whole video into memory. */
export async function audioOnly(file, info) {
  info ||= await inspect(file);
  const { tops } = info;
  const mu = new Uint8Array(await file.slice(tops.find((b) => b.type === 'moov').start, tops.find((b) => b.type === 'moov').end).arrayBuffer());
  const moov = { type: 'moov', kids: parseKids(mu, 8, mu.length) };
  const sounds = moov.kids.filter((k) => k.type === 'trak' && handlerOf(k) === 'soun');
  const t = sounds.find((k) => sampleEntry(k) !== 'apac') || sounds[0];
  if (!t) throw new Error('no audio');
  moov.kids = moov.kids.filter((k) => k.type === 'mvhd' || k === t);
  t.kids = t.kids.filter((k) => !['tref', 'tapt', 'load', 'meta', 'clip', 'matt', 'imap'].includes(k.type));
  const mdia = kid(t, 'mdia'); const minf = kid(mdia, 'minf'); const stbl = kid(minf, 'stbl');
  fixHdlr(kid(mdia, 'hdlr'), 'soun'); fixMdhd(kid(mdia, 'mdhd'));
  minf.kids = minf.kids.filter((k) => k.type !== 'hdlr' && k.type !== 'gmhd');
  fixDinf(minf); fixSoundEntry(kid(stbl, 'stsd'));
  // chunk sizes from stsz + stsc
  const stsz = kid(stbl, 'stsz').data, stsc = kid(stbl, 'stsc').data, st = kid(stbl, 'stco') || kid(stbl, 'co64');
  const fixed = u32(stsz, 4), count = u32(stsz, 8);
  const size = (i) => fixed || u32(stsz, 12 + i * 4);
  const is64 = st.type === 'co64', nChunks = u32(st.data, 4);
  const offs = []; for (let i = 0; i < nChunks; i++) offs.push(is64 ? u64(st.data, 8 + i * 8) : u32(st.data, 8 + i * 4));
  const runs = []; for (let i = 0; i < u32(stsc, 4); i++) runs.push([u32(stsc, 8 + i * 12), u32(stsc, 12 + i * 12)]);
  const lens = []; let s = 0;
  for (let c = 0; c < nChunks; c++) {
    let per = 0; for (const [first, n] of runs) if (first <= c + 1) per = n;
    let len = 0; for (let k = 0; k < per && s < count; k++, s++) len += size(s);
    lens.push(len);
  }
  const total = lens.reduce((a, b) => a + b, 0);
  const big = total + 1e7 > 4294967295;
  const nb = { type: big ? 'co64' : 'stco', data: new Uint8Array(8 + nChunks * (big ? 8 : 4)) };
  put32(nb.data, 4, nChunks);
  stbl.kids[stbl.kids.indexOf(st)] = nb;
  const ftyp = box('ftyp', cat(str('M4A '), new Uint8Array(4), str('M4A mp42isom')));
  const head = boxSize(ftyp) + boxSize(moov) + 8;
  let pos = head;
  for (let c = 0; c < nChunks; c++) { if (big) put64(nb.data, 8 + c * 8, pos); else put32(nb.data, 8 + c * 4, pos); pos += lens[c]; }
  const headBytes = new Uint8Array(head);
  let p = writeBox(moov, headBytes, writeBox(ftyp, headBytes, 0));
  put32(headBytes, p, total + 8); headBytes.set(str('mdat'), p + 4);
  return new Blob([headBytes, ...offs.map((o, c) => file.slice(o, o + lens[c]))], { type: 'audio/mp4' });
}

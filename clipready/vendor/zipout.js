// Streams files into one or more ZIP files (no compression, each file keeps its date).
// Output goes into a folder the user picks (File System Access API) or, if that is not
// available, into downloads. A new part starts before 3.5 GB because plain ZIP (no ZIP64)
// stops at 4 GB.
import { Zip, ZipPassThrough } from './fflate.js';

const PART_LIMIT_DIR = 3.5 * 1024 ** 3, PART_LIMIT_DL = 1024 ** 3;

export async function pickOutputFolder() {
  if (!('showDirectoryPicker' in window)) return null;
  return window.showDirectoryPicker({ id: 'out', mode: 'readwrite', startIn: 'pictures' });
}

export class ZipOut {
  constructor(baseName, dir) { this.base = baseName; this.dir = dir; this.part = 0; this.size = 0; this.zip = null; this.files = []; }
  async _open() {
    this.part++; this.size = 0;
    const name = `${this.base}${this.part > 1 ? '-part' + this.part : ''}.zip`;
    this.files.push(name);
    let write, close;
    if (this.dir) {
      const fh = await this.dir.getFileHandle(name, { create: true });
      const ws = await fh.createWritable();
      let chain = Promise.resolve();
      write = (c) => { chain = chain.then(() => ws.write(c)); return chain; };
      close = async () => { await chain; await ws.close(); };
    } else {
      const chunks = [];
      write = (c) => { chunks.push(c); return Promise.resolve(); };
      close = async () => {
        const url = URL.createObjectURL(new Blob(chunks, { type: 'application/zip' }));
        const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      };
    }
    let pending = Promise.resolve(), err = null;
    const zip = new Zip((e, chunk) => { if (e) { err = e; return; } pending = pending.then(() => write(chunk)); });
    this.zip = { zip, close: async () => { zip.end(); await pending; await close(); if (err) throw err; }, flush: () => pending };
  }
  /** add(path, Uint8Array, Date) */
  async add(path, bytes, date) {
    if (!this.zip || this.size + bytes.length > (this.dir ? PART_LIMIT_DIR : PART_LIMIT_DL)) { if (this.zip) await this.zip.close(); await this._open(); }
    const f = new ZipPassThrough(path);
    if (date && !isNaN(date)) f.mtime = clampDate(date);
    this.zip.zip.add(f);
    f.push(bytes, true);
    this.size += bytes.length + path.length + 100;
    await this.zip.flush();
  }
  async close() { if (this.zip) await this.zip.close(); this.zip = null; return this.files; }
}

// DOS dates in ZIP cover 1980–2107
function clampDate(d) { const t = d.getTime(); const lo = new Date(1980, 0, 2).getTime(); return new Date(Math.max(t, lo)); }

/** Lists files from a folder input / drag-drop, giving {file, path}. */
export async function filesFromDrop(dt) {
  const out = [];
  const items = [...(dt.items || [])].map((i) => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (!items.length) { for (const f of dt.files) out.push({ file: f, path: f.name }); return out; }
  const walk = async (entry, prefix) => {
    if (entry.isFile) { const f = await new Promise((r, j) => entry.file(r, j)); out.push({ file: f, path: prefix + f.name }); return; }
    const reader = entry.createReader();
    for (;;) { const batch = await new Promise((r, j) => reader.readEntries(r, j)); if (!batch.length) break; for (const e of batch) await walk(e, prefix + entry.name + '/'); }
  };
  for (const e of items) await walk(e, '');
  return out;
}
export function filesFromInput(list) { return [...list].map((f) => ({ file: f, path: f.webkitRelativePath || f.name })); }

export async function sha256(bytes) {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** EXIF date string "YYYY:MM:DD HH:MM:SS" (local time) */
export function exifDate(d) { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}:${p(d.getMonth() + 1)}:${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; }
export function ym(d) { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}/${p(d.getMonth() + 1)}`; }

/** Binary string helpers for piexif */
export function toBin(u8) { let s = ''; const C = 0x8000; for (let i = 0; i < u8.length; i += C) s += String.fromCharCode.apply(null, u8.subarray(i, i + C)); return s; }
export function fromBin(s) { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; }

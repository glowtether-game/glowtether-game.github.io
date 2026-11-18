// mbox reading without loading the whole file: find where each message starts,
// then read single messages with File.slice when they are needed.
import PostalMime, { decodeWords } from '../vendor/postal-mime/postal-mime.js';

const CHUNK = 8 * 1024 * 1024;
const FROM = [70, 114, 111, 109, 32]; // "From "

/** Offsets of the "From " separator lines. onProgress(fraction). */
export async function indexMbox(file, onProgress) {
  const starts = [];
  let pos = 0, prevNL = true; // the file start counts as a line start
  while (pos < file.size) {
    const end = Math.min(file.size, pos + CHUNK + 4);
    const u = new Uint8Array(await file.slice(pos, end).arrayBuffer());
    const lim = Math.min(u.length, CHUNK);
    for (let i = 0; i < lim; i++) {
      const atLine = i === 0 ? prevNL : u[i - 1] === 10;
      if (atLine && u[i] === 70 && u[i + 1] === 114 && u[i + 2] === 111 && u[i + 3] === 109 && u[i + 4] === 32) starts.push(pos + i);
    }
    prevNL = u[lim - 1] === 10;
    pos += lim;
    if (onProgress) onProgress(pos / file.size);
    await new Promise((r) => setTimeout(r, 0));
  }
  return starts;
}

/** Raw bytes of message i (without the "From " line, with mboxrd ">From " unescaped). */
export async function rawMessage(file, starts, i) {
  const a = starts[i], b = i + 1 < starts.length ? starts[i + 1] : file.size;
  let u = new Uint8Array(await file.slice(a, b).arrayBuffer());
  let k = 0; while (k < u.length && u[k] !== 10) k++;
  u = u.subarray(k + 1);
  return unescapeFrom(u);
}

function unescapeFrom(u) {
  // lines like ">From " / ">>From " lose one ">"
  let hits = 0;
  for (let i = 0; i < u.length - 5; i++) if ((i === 0 || u[i - 1] === 10) && u[i] === 62) { let j = i; while (u[j] === 62) j++; if (u[j] === 70 && u[j + 1] === 114 && u[j + 2] === 111 && u[j + 3] === 109 && u[j + 4] === 32) hits++; }
  if (!hits) return u;
  const out = new Uint8Array(u.length - hits); let o = 0;
  for (let i = 0; i < u.length; i++) {
    if ((i === 0 || u[i - 1] === 10) && u[i] === 62) { let j = i; while (u[j] === 62) j++; if (u[j] === 70 && u[j + 1] === 114 && u[j + 2] === 111 && u[j + 3] === 109 && u[j + 4] === 32) { continue; } }
    out[o++] = u[i];
  }
  return out.subarray(0, o);
}

/** Quick header summary of message i (reads only the start of the message). */
export async function summary(file, starts, i) {
  const a = starts[i], b = i + 1 < starts.length ? starts[i + 1] : file.size;
  const len = b - a;
  const head = new Uint8Array(await file.slice(a, Math.min(b, a + 65536)).arrayBuffer());
  let k = 0; while (k < head.length && head[k] !== 10) k++;
  let s = new TextDecoder('latin1').decode(head.subarray(k + 1));
  const end = s.search(/\r?\n\r?\n/);
  if (end >= 0) s = s.slice(0, end);
  const h = {};
  for (const line of s.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9-]+):\s*(.*)$/);
    if (m) { const key = m[1].toLowerCase(); if (!(key in h)) h[key] = m[2]; }
  }
  const dec = (v) => { if (!v) return ''; try { return decodeWords(bytesToUtf8(v)); } catch (e) { return v; } };
  const d = h.date ? new Date(h.date) : null;
  const ct = (h['content-type'] || '').toLowerCase();
  return {
    i, size: len,
    from: dec(h.from), to: dec(h.to), subject: dec(h.subject),
    date: d && !isNaN(d) ? d : null,
    labels: dec(h['x-gmail-labels']).split(',').map((x) => x.trim()).filter(Boolean),
    attach: /multipart\/(mixed|related)/.test(ct),
  };
}

// header values are 7-bit by the standard, but some mailers put raw UTF-8 in them
function bytesToUtf8(latin1) {
  if (!/[\x80-\xff]/.test(latin1)) return latin1;
  const u = Uint8Array.from(latin1, (c) => c.charCodeAt(0));
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u); } catch (e) { return new TextDecoder('shift_jis').decode(u); }
}

export async function parseMessage(raw) {
  return PostalMime.parse(raw, { attachmentEncoding: 'arraybuffer' });
}

export function nameOf(addr) {
  if (!addr) return '';
  const m = addr.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  return m ? (m[1].trim() || m[2]) : addr.trim();
}

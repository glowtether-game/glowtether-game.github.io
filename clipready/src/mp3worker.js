// Encodes PCM to MP3 with LAME (lamejs, LGPL, loaded as a separate file).
importScripts('../vendor/lame.min.js');

function toI16(f) { const o = new Int16Array(f.length); for (let i = 0; i < f.length; i++) { const s = Math.max(-1, Math.min(1, f[i])); o[i] = s < 0 ? s * 0x8000 : s * 0x7fff; } return o; }

// ID3v2.3 tag (UTF-16 text) so Windows shows the title and year
function id3(tags) {
  const frames = [];
  const text = (id, s) => {
    if (!s) return;
    const body = new Uint8Array(3 + s.length * 2 + 2); body[0] = 1; body[1] = 0xff; body[2] = 0xfe;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); body[3 + i * 2] = c & 255; body[4 + i * 2] = c >> 8; }
    const h = new Uint8Array(10); for (let i = 0; i < 4; i++) h[i] = id.charCodeAt(i);
    const n = body.length; h[4] = n >>> 24; h[5] = (n >>> 16) & 255; h[6] = (n >>> 8) & 255; h[7] = n & 255;
    frames.push(h, body);
  };
  text('TIT2', tags.title); text('TYER', tags.year); text('TENC', 'Clipready');
  const size = frames.reduce((s, f) => s + f.length, 0);
  const head = new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, (size >> 21) & 127, (size >> 14) & 127, (size >> 7) & 127, size & 127]);
  return [head, ...frames];
}

self.onmessage = (e) => {
  const { id, channels, sampleRate, kbps, tags } = e.data;
  try {
    const n = channels.length > 1 ? 2 : 1;
    const enc = new lamejs.Mp3Encoder(n, sampleRate, kbps);
    const L = toI16(channels[0]), R = n > 1 ? toI16(channels[1]) : null;
    const out = [...id3(tags || {})];
    const step = 1152 * 20;
    for (let i = 0; i < L.length; i += step) {
      const buf = n > 1 ? enc.encodeBuffer(L.subarray(i, i + step), R.subarray(i, i + step)) : enc.encodeBuffer(L.subarray(i, i + step));
      if (buf.length) out.push(new Uint8Array(buf));
      if ((i / step) % 20 === 0) self.postMessage({ id, progress: i / L.length });
    }
    const end = enc.flush(); if (end.length) out.push(new Uint8Array(end));
    self.postMessage({ id, blob: new Blob(out, { type: 'audio/mpeg' }) });
  } catch (err) { self.postMessage({ id, error: String(err && err.message || err) }); }
};

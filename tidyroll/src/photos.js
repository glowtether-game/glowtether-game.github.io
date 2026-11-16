// Pure helpers for Tidyroll (no DOM, testable in Node).
export const kindOf = (name) => {
  const n = name.toLowerCase();
  if (/\.(heic|heif)$/.test(n)) return 'heic';
  if (/\.(jpe?g)$/.test(n)) return 'jpeg';
  if (/\.(png|gif|webp|dng|tiff?)$/.test(n)) return 'image';
  if (/\.(mov|mp4|m4v|3gp)$/.test(n)) return 'video';
  return null;
};
const stemOf = (p) => p.replace(/\.[^./]+$/, '').toLowerCase();
const dirOf = (p) => { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); };

/** Marks videos that belong to a Live Photo (same folder and name as a photo). */
export function markLive(items) {
  const photos = new Set(items.filter((i) => i.kind === 'heic' || i.kind === 'jpeg').map((i) => stemOf(i.path)));
  for (const i of items) if (i.kind === 'video') i.live = photos.has(stemOf(i.path)) || photos.has(stemOf(i.path).replace(/_3$/, ''));
  return items;
}

/** Creation date of a MOV/MP4 from the movie header (mvhd). */
export function videoDate(u8) {
  for (let i = 4; i < u8.length - 24; i++) {
    if (u8[i] === 0x6d && u8[i + 1] === 0x76 && u8[i + 2] === 0x68 && u8[i + 3] === 0x64) { // 'mvhd'
      const v = u8[i + 4]; const dv = new DataView(u8.buffer, u8.byteOffset + i + 8);
      const secs = v === 1 ? Number(dv.getBigUint64(0)) : dv.getUint32(0);
      if (!secs) return null;
      const d = new Date((secs - 2082844800) * 1000); // seconds since 1904
      return d.getFullYear() > 1990 && d.getFullYear() < 2100 ? d : null;
    }
  }
  return null;
}

export function dateFromName(name) {
  const m = name.match(/(20\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?([0-2]\d|3[01])[-_ T.]?([01]\d|2[0-3])[-_.:]?([0-5]\d)[-_.:]?([0-5]\d)/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
}

export function outName(path, kind, converted) {
  const base = path.slice(path.lastIndexOf('/') + 1);
  return converted ? base.replace(/\.(heic|heif)$/i, '.jpg') : base;
}
export { dirOf };

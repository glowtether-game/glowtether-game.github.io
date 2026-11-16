// Google Takeout (Google Photos) logic: pair each photo/video with its JSON sidecar and
// work out the date it was taken. No DOM here so it can be tested in Node.

export const MEDIA_RE = /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp|tiff?|dng|raw|cr2|nef|arw|mp4|mov|m4v|3gp|avi|mkv|webm|mpg|mpeg|mts|m2ts|wmv)$/i;
export const VIDEO_RE = /\.(mp4|mov|m4v|3gp|avi|mkv|webm|mpg|mpeg|mts|m2ts|wmv)$/i;
const EDITED = ['-edited', '-bearbeitet', '-modifié', '-modificato', '-editado', '-bewerkt', '-編集済み', '-编辑', '-편집됨', '-redigerad', '-muokattu', '-edytowane'];

const dirOf = (p) => { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); };
const baseOf = (p) => p.slice(p.lastIndexOf('/') + 1);
const splitExt = (n) => { const i = n.lastIndexOf('.'); return i <= 0 ? [n, ''] : [n.slice(0, i), n.slice(i)]; };

/** Strips Takeout's json suffixes: "a.jpg.supplemental-metadata(1).json" -> {stem:"a.jpg", n:"1"} */
export function jsonStem(jsonName) {
  let s = jsonName.replace(/\.json$/i, '');
  let n = null;
  const m = s.match(/\((\d+)\)$/); if (m) { n = m[1]; s = s.slice(0, -m[0].length); }
  // supplemental-metadata, possibly truncated (".supplemental-metad", ".suppl", ".s")
  const m2 = s.match(/\.([a-z-]+)$/i);
  if (m2 && 'supplemental-metadata'.startsWith(m2[1].toLowerCase()) && /\.[^.]+\.[a-z-]+$/i.test(s)) s = s.slice(0, -m2[0].length);
  return { stem: s, n };
}

/** Reads the useful fields from a sidecar JSON (object). */
export function readSidecar(o) {
  const ts = Number(o?.photoTakenTime?.timestamp || 0) || Number(o?.creationTime?.timestamp || 0);
  const g = o?.geoDataExif && (o.geoDataExif.latitude || o.geoDataExif.longitude) ? o.geoDataExif : o?.geoData;
  const geo = g && (g.latitude || g.longitude) ? { lat: g.latitude, lon: g.longitude, alt: g.altitude || 0 } : null;
  return { title: typeof o?.title === 'string' ? o.title : '', taken: ts ? new Date(ts * 1000) : null, geo, fromTaken: !!Number(o?.photoTakenTime?.timestamp || 0) };
}

/** Builds lookup keys a sidecar can match: folder/mediaName (lowercase). */
export function sidecarKeys(jsonPath, side) {
  const dir = dirOf(jsonPath).toLowerCase();
  const { stem, n } = jsonStem(baseOf(jsonPath));
  const names = new Set();
  const add = (x) => { if (x) names.add(x.toLowerCase()); };
  const title = side.title || stem;
  const [ts, te] = splitExt(title);
  if (n) { add(`${ts}(${n})${te}`); add(`${stem}(${n})`); }
  else { add(title); add(stem); for (const e of EDITED) add(ts + e + te); }
  return [...names].map((x) => dir + '/' + x);
}

/** Dates in file names: IMG_20240715_102030, PXL_20240715_102030123, Screenshot_2024-07-15-10-20-30, 2024-07-15 10.20.30, VID-20240715-WA0001 */
export function dateFromName(name) {
  let m = name.match(/(20\d{2}|19\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?([0-2]\d|3[01])[-_ T.]?([01]\d|2[0-3])[-_.:]?([0-5]\d)[-_.:]?([0-5]\d)/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  m = name.match(/(?:^|[^\d])(20\d{2})[-_]?(0[1-9]|1[0-2])[-_]?([0-2]\d|3[01])(?:[^\d]|$)/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
  return null;
}

/**
 * Plans the job. entries: [{path, size}] (all files). sidecars: Map(jsonPath -> parsed object).
 * Returns [{path, size, date, source:'json'|'name'|null, geo, json}]
 */
export function plan(entries, sidecars) {
  const byKey = new Map();
  const byDir = new Map(); // dir -> [{stem, side}] for truncated names
  for (const [p, obj] of sidecars) {
    const side = readSidecar(obj);
    for (const k of sidecarKeys(p, side)) if (!byKey.has(k)) byKey.set(k, { side, p });
    const d = dirOf(p).toLowerCase();
    if (!byDir.has(d)) byDir.set(d, []);
    byDir.get(d).push({ stem: jsonStem(baseOf(p)).stem.toLowerCase(), side, p });
  }
  const out = [];
  for (const e of entries) {
    if (!MEDIA_RE.test(e.path)) continue;
    const dir = dirOf(e.path).toLowerCase(), name = baseOf(e.path).toLowerCase();
    let hit = byKey.get(dir + '/' + name);
    if (!hit) { // Takeout cuts long names (about 46-47 characters) in both the media and the json name
      const cand = (byDir.get(dir) || []).filter((c) => c.stem.length >= 20 && (name.startsWith(c.stem) || c.stem.startsWith(splitExt(name)[0])));
      if (cand.length === 1) hit = cand[0];
    }
    if (hit && hit.side.taken) { out.push({ ...e, date: hit.side.taken, source: 'json', geo: hit.side.geo, json: hit.p }); continue; }
    const nd = dateFromName(baseOf(e.path));
    out.push({ ...e, date: nd, source: nd ? 'name' : null, geo: null, json: hit ? hit.p : null });
  }
  return out;
}

/** Summary for the report */
export function summarize(items, dupGroups = 0) {
  const s = { total: items.length, photos: 0, videos: 0, fromJson: 0, fromName: 0, noDate: 0, dups: dupGroups };
  for (const it of items) { if (VIDEO_RE.test(it.path)) s.videos++; else s.photos++; if (it.source === 'json') s.fromJson++; else if (it.source === 'name') s.fromName++; else s.noDate++; }
  return s;
}

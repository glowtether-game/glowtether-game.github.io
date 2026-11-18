import { Unzip, UnzipInflate } from './vendor/fflate.js';
import { ZipOut, pickOutputFolder, filesFromDrop, filesFromInput, sha256, exifDate, ym, toBin, fromBin } from './vendor/zipout.js';
import { makePro } from './vendor/pro.js';
import { makeNudge } from './vendor/nudge.js';
import { plan, summarize, MEDIA_RE, VIDEO_RE } from './src/takeout.js';
import I18N from './i18n.js';

const VERSION = '1.1.0';
const FREE_LIMIT = 100;
const pro = makePro({ sku: 'redate_pro', storeId: '9PC1BKKH8RG4', key: 'redate-pro' });

const T = {
  en: {
    tag: 'Put the dates back on your Google Photos export', drop: 'Drop your Takeout zip files or the extracted Takeout folder here',
    sub: 'Everything happens on this PC. Nothing is uploaded.', chooseZip: 'Choose zip files', chooseFolder: 'Choose a folder',
    scanning: 'Reading… {n} files', planning: 'Matching photos with their date files…',
    report: 'What we found', rPhotos: 'Photos', rVideos: 'Videos', rJson: 'Date found in Google’s date file', rName: 'Date found in the file name', rNone: 'No date found (kept as is)', rDups: 'Duplicate copies',
    optLayout: 'Folders', optKeep: 'Keep the Takeout folders', optYm: 'Sort into Year / Month folders', optDup: 'Leave out duplicate copies', optExif: 'Write the date into JPEG photos (EXIF)', optGeo: 'Also write the location into JPEG photos when it is missing',
    freeNote: 'Free version: dates are restored for the first {n} files. The rest are copied unchanged. Pro restores every file and unlocks the Pro options.',
    start: 'Restore dates', outFolder: 'Choose where to save the result', working: 'Working… {i} of {n}', done: 'Done', doneText: 'Saved {files}. Open the zip with Windows (right-click › Extract All). The photos and videos keep their dates.',
    savedTo: 'Saved in the folder you chose.', downloaded: 'Saved to your Downloads folder.', again: 'Start over', proBadge: 'Pro',
    proTitle: 'Redate Pro', proBody: 'Restore the dates of every file, sort into Year / Month folders and leave out duplicates.', proOnce: 'One payment, no subscription. It stays with your Microsoft account.', proBuy: 'Get Pro', proBuyP: 'Get Pro for {p}', proRestore: 'I already bought Pro', proWeb: 'Redate Pro is sold in the Microsoft Store app. Install Redate from the Store, then get Pro there.', proOpenStore: 'Open in Microsoft Store', proLater: 'Not now', proThanks: 'Thank you! Redate Pro is ready.', proFail: 'The purchase did not go through. Nothing was charged.', proNone: 'No Pro purchase was found for this Microsoft account.',
    noMedia: 'No photos or videos were found. Choose the Takeout zip files, or the folder you got after extracting them.', err: 'Something went wrong: {m}', privacy: 'Privacy', how: 'How to get your files from Google: takeout.google.com › select Google Photos › export.',
  },
  ja: {
    tag: 'Google フォトの書き出しに、撮影日を戻す', drop: 'Takeout の zip ファイル、または展開したフォルダーをここにドラッグ',
    sub: 'すべてこの PC の中で処理します。アップロードはしません。', chooseZip: 'zip ファイルを選ぶ', chooseFolder: 'フォルダーを選ぶ',
    scanning: '読み込み中… {n} 件', planning: '写真と日付のファイルを照らし合わせています…',
    report: '見つかったもの', rPhotos: '写真', rVideos: '動画', rJson: 'Google の日付ファイルから日付が分かった', rName: 'ファイル名から日付が分かった', rNone: '日付が分からない（そのまま残します）', rDups: '重複しているもの',
    optLayout: 'フォルダー', optKeep: 'Takeout のフォルダーのまま', optYm: '年／月のフォルダーに分ける', optDup: '重複を入れない', optExif: 'JPEG 写真に撮影日を書き込む（EXIF）', optGeo: '位置情報が無い JPEG 写真に、位置情報も書き込む',
    freeNote: '無料版では、最初の {n} 件の日付を戻します。残りはそのまま入ります。Pro ではすべての日付を戻し、Pro の設定も使えます。',
    start: '撮影日を戻す', outFolder: '保存する場所を選ぶ', working: '処理中… {n} 件中 {i} 件', done: '完了', doneText: '{files} を保存しました。Windows で zip を開いてください（右クリック ›「すべて展開」）。写真と動画は撮影日のまま展開されます。',
    savedTo: '選んだフォルダーに保存しました。', downloaded: 'ダウンロードフォルダーに保存しました。', again: '最初から', proBadge: 'Pro',
    proTitle: 'Redate Pro', proBody: 'すべてのファイルの撮影日を戻し、年／月のフォルダー分けと重複の除外ができます。', proOnce: '一度の支払いだけで、月額ではありません。Microsoft アカウントにひもづきます。', proBuy: 'Pro にする', proBuyP: '{p} で Pro にする', proRestore: '購入済みの方はこちら', proWeb: 'Redate Pro は Microsoft Store 版で販売しています。Store から Redate を入れて、その中で Pro にしてください。', proOpenStore: 'Microsoft Store で開く', proLater: 'あとで', proThanks: 'ありがとうございます。Redate Pro が使えるようになりました。', proFail: '購入は完了しませんでした。料金はかかっていません。', proNone: 'この Microsoft アカウントでは Pro の購入が見つかりませんでした。',
    noMedia: '写真や動画が見つかりませんでした。Takeout の zip ファイルか、展開したフォルダーを選んでください。', err: '問題が起きました：{m}', privacy: 'プライバシー', how: 'Google からの取り出し方：takeout.google.com › Google フォト を選ぶ › エクスポート',
  },
};
Object.assign(T, I18N);
const LANG = ((l) => ['ja', 'de', 'fr', 'es', 'pt', 'ko'].includes(l) ? l : 'en')(((navigator.languages && navigator.languages[0]) || navigator.language || 'en').toLowerCase().slice(0, 2));
const nudge = makeNudge({ app: 'Redate', storeId: '9PC1BKKH8RG4', key: 'redate', lang: LANG, where: () => pro.where(), listed: true });
const t = (k, v) => { let s = T[LANG][k] ?? T.en[k] ?? k; if (v) for (const [a, b] of Object.entries(v)) s = s.replaceAll(`{${a}}`, b); return s; };
document.documentElement.lang = LANG;
for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
const $ = (id) => document.getElementById(id);
$('ver').textContent = 'v' + VERSION;

let sources = []; // [{kind:'zip', file} | {kind:'file', file, path}]
let items = [], sidecars = new Map();

function show(id) { for (const s of ['start', 'busy', 'report', 'finish']) $(s).hidden = s !== id; }
function busy(msg) { show('busy'); $('busyText').textContent = msg; }

// ---------- reading ----------
async function eachZipEntry(file, want, onEntry) {
  const uz = new Unzip(); uz.register(UnzipInflate);
  const done = [];
  uz.onfile = (f) => {
    const keep = want(f.name);
    if (!keep) { onEntry({ name: f.name, size: f.originalSize ?? f.size ?? 0 }, null); return; }
    const parts = []; let len = 0;
    f.ondata = (err, d, fin) => { if (err) throw err; parts.push(d); len += d.length; if (fin) { const u = new Uint8Array(len); let o = 0; for (const p of parts) { u.set(p, o); o += p.length; } done.push([{ name: f.name, size: len }, u]); } };
    f.start();
  };
  const r = file.stream().getReader();
  for (;;) {
    const { value, done: end } = await r.read();
    uz.push(value || new Uint8Array(0), !!end);
    while (done.length) { const [e, u] = done.shift(); await onEntry(e, u); }
    if (end) break;
  }
}

async function scan(list) {
  sources = []; sidecars = new Map(); items = [];
  for (const s of list) { if (/\.zip$/i.test(s.path)) sources.push({ kind: 'zip', file: s.file }); else sources.push({ kind: 'file', file: s.file, path: s.path }); }
  const entries = []; let n = 0;
  const td = new TextDecoder();
  for (const s of sources) {
    if (s.kind === 'zip') {
      await eachZipEntry(s.file, (nm) => /\.json$/i.test(nm), async (e, u) => {
        n++; if (n % 200 === 0) busy(t('scanning', { n }));
        if (u) { try { sidecars.set(e.name, JSON.parse(td.decode(u))); } catch (x) {} }
        else if (!e.name.endsWith('/')) entries.push({ path: e.name, size: e.size, src: s });
      });
    } else {
      n++; if (n % 200 === 0) busy(t('scanning', { n }));
      if (/\.json$/i.test(s.path)) { try { sidecars.set(s.path, JSON.parse(await s.file.text())); } catch (x) {} }
      else entries.push({ path: s.path, size: s.file.size, src: s });
    }
  }
  busy(t('planning'));
  items = plan(entries, sidecars);
  if (!items.length) { show('start'); alertBox(t('noMedia')); return; }
  // rough duplicate estimate: same name and size in different folders (exact check happens while saving)
  const seen = new Map(); let dups = 0;
  for (const it of items) { const k = it.path.split('/').pop().toLowerCase() + '|' + it.size; if (seen.has(k)) dups++; else seen.set(k, 1); }
  renderReport(summarize(items, dups));
}

function alertBox(msg) { $('msg').textContent = msg; $('msg').hidden = false; }

function renderReport(s) {
  show('report'); $('msg').hidden = true;
  const rows = [[t('rPhotos'), s.photos], [t('rVideos'), s.videos], [t('rJson'), s.fromJson], [t('rName'), s.fromName], [t('rNone'), s.noDate], [t('rDups'), s.dups]];
  $('stats').replaceChildren(...rows.map(([k, v]) => { const li = document.createElement('li'); li.innerHTML = `<b></b><span></span>`; li.firstChild.textContent = v.toLocaleString(); li.lastChild.textContent = k; return li; }));
  $('freeNote').hidden = !(pro.live() && !pro.has());
  $('freeNote').textContent = t('freeNote', { n: FREE_LIMIT });
  for (const id of ['optYm', 'optDup']) { const b = $(id + 'Badge'); b.hidden = !pro.live() || pro.has(); }
}

// ---------- writing ----------
function readExifDate(bytes) {
  try {
    const ex = window.piexif.load(toBin(bytes.subarray(0, Math.min(bytes.length, 256 * 1024))));
    const s = ex.Exif?.[window.piexif.ExifIFD.DateTimeOriginal] || ex['0th']?.[window.piexif.ImageIFD.DateTime];
    if (s) { const m = s.match(/(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/); if (m && +m[1] > 1970) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]); }
  } catch (e) {}
  return null;
}
function deg(v) { const a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 60), s = Math.round(((a - d) * 60 - m) * 60 * 100); return [[d, 1], [m, 1], [s, 100]]; }
function writeJpegExif(bytes, date, geo, withGeo, overwrite) {
  const P = window.piexif;
  let bin = toBin(bytes), ex;
  try { ex = P.load(bin); } catch (e) { ex = { '0th': {}, Exif: {}, GPS: {}, '1st': {}, thumbnail: null }; }
  ex.Exif = ex.Exif || {}; ex.GPS = ex.GPS || {}; ex['0th'] = ex['0th'] || {};
  let changed = false;
  if (date && (overwrite || !ex.Exif[P.ExifIFD.DateTimeOriginal]) && ex.Exif[P.ExifIFD.DateTimeOriginal] !== exifDate(date)) { const s = exifDate(date); ex.Exif[P.ExifIFD.DateTimeOriginal] = s; ex.Exif[P.ExifIFD.DateTimeDigitized] = s; changed = true; }
  if (withGeo && geo && !ex.GPS[P.GPSIFD.GPSLatitude]) {
    ex.GPS[P.GPSIFD.GPSLatitudeRef] = geo.lat >= 0 ? 'N' : 'S'; ex.GPS[P.GPSIFD.GPSLatitude] = deg(geo.lat);
    ex.GPS[P.GPSIFD.GPSLongitudeRef] = geo.lon >= 0 ? 'E' : 'W'; ex.GPS[P.GPSIFD.GPSLongitude] = deg(geo.lon);
    changed = true;
  }
  if (!changed) return bytes;
  try { return fromBin(P.insert(P.dump(ex), bin)); } catch (e) { return bytes; }
}

async function run() {
  const opts = { ym: $('optYm').checked, dup: $('optDup').checked, exif: $('optExif').checked, geo: $('optGeo').checked };
  if ((opts.ym || opts.dup) && !pro.has()) { showPro(() => run()); return; }
  let dir = null;
  try { dir = await pickOutputFolder(); } catch (e) { return; } // cancelled
  const out = new ZipOut('Redate ' + new Date().toISOString().slice(0, 10), dir);
  const want = new Map(items.map((it) => [it.src.kind === 'zip' ? it.src.file.name + '\u0000' + it.path : it.path, it]));
  const hashes = new Set(); let i = 0, fixed = 0; const N = items.length;
  const names = new Set();
  const handle = async (it, bytes) => {
    i++; if (i % 10 === 0 || i === N) { $('busyText').textContent = t('working', { i: i.toLocaleString(), n: N.toLocaleString() }); $('bar').value = i / N; }
    if (opts.dup) { const h = await sha256(bytes); if (hashes.has(h)) return; hashes.add(h); }
    let date = it.date;
    const allowed = pro.has() || fixed < FREE_LIMIT;
    const isJpeg = /\.jpe?g$/i.test(it.path);
    if (!date && isJpeg) date = readExifDate(bytes);
    if (allowed && date) { fixed++; if (isJpeg && (opts.exif || opts.geo)) bytes = writeJpegExif(bytes, opts.exif ? date : null, it.geo, opts.geo, it.source === 'json'); }
    const base = it.path.split('/').pop();
    let path = opts.ym && date ? ym(date) + '/' + base : (opts.ym ? 'No date/' + base : it.path.replace(/^Takeout\//i, ''));
    if (names.has(path.toLowerCase())) { const [a, b] = [path.replace(/(\.[^./]+)$/, ''), (path.match(/(\.[^./]+)$/) || [''])[0]]; let k = 2; while (names.has(`${a} (${k})${b}`.toLowerCase())) k++; path = `${a} (${k})${b}`; }
    names.add(path.toLowerCase());
    await out.add(path, bytes, allowed && date ? date : undefined);
  };
  busy(t('working', { i: 0, n: N.toLocaleString() })); $('bar').hidden = false; $('bar').value = 0;
  try {
    for (const s of sources) {
      if (s.kind === 'zip') {
        await eachZipEntry(s.file, (nm) => want.has(s.file.name + '\u0000' + nm), async (e, u) => { if (u) await handle(want.get(s.file.name + '\u0000' + e.name), u); });
      } else if (want.has(s.path)) await handle(want.get(s.path), new Uint8Array(await s.file.arrayBuffer()));
    }
    const files = await out.close();
    show('finish');
    nudge.success();
    $('doneText').textContent = t('doneText', { files: files.join(', ') }) + ' ' + (dir ? t('savedTo') : t('downloaded'));
  } catch (e) { show('report'); alertBox(t('err', { m: e.message || String(e) })); }
  $('bar').hidden = true;
}

// ---------- Pro dialog ----------
function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else e.setAttribute(k, v); } for (const k of kids) e.append(k); return e; }
function showPro(after) {
  const msg = el('p', { class: 'pro-msg' });
  const close = () => back.remove();
  const done = () => { close(); renderReport(summarize(items)); alertBox(t('proThanks')); if (after) after(); };
  let actions;
  if (pro.where() === 'store') {
    const b = el('button', { class: 'btn primary big', onclick: async () => { b.disabled = true; try { (await pro.buy()) ? done() : (msg.textContent = t('proFail')); } catch (e) { msg.textContent = t('proFail'); } b.disabled = false; } }, pro.price() ? t('proBuyP', { p: pro.price() }) : t('proBuy'));
    actions = [el('div', { class: 'row' }, b), el('p', {}, el('button', { class: 'link', onclick: async () => ((await pro.restore()) ? done() : (msg.textContent = t('proNone'))) }, t('proRestore')))];
  } else actions = [el('p', {}, t('proWeb')), el('div', { class: 'row' }, el('a', { class: 'btn primary big', href: pro.storeApp }, t('proOpenStore')))];
  const back = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) close(); } }, el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, el('h2', {}, t('proTitle')), el('p', {}, t('proBody')), el('p', { class: 'small' }, t('proOnce')), ...actions, msg, el('button', { class: 'btn ghost', onclick: close }, t('proLater'))));
  document.body.append(back);
}

// ---------- events ----------
async function go(list) { if (!list.length) return; busy(t('scanning', { n: 0 })); try { await scan(list); } catch (e) { show('start'); alertBox(t('err', { m: e.message || String(e) })); } }
$('zipBtn').onclick = () => $('zipIn').click();
$('dirBtn').onclick = () => $('dirIn').click();
$('zipIn').onchange = (e) => { go(filesFromInput(e.target.files)); e.target.value = ''; };
$('dirIn').onchange = (e) => { go(filesFromInput(e.target.files)); e.target.value = ''; };
$('startBtn').onclick = run;
$('againBtn').onclick = () => { items = []; sources = []; show('start'); };
for (const id of ['optYm', 'optDup']) $(id).addEventListener('change', (e) => { if (e.target.checked && !pro.has()) { e.target.checked = false; showPro(() => { e.target.checked = true; }); } });
const dz = $('drop');
window.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) dz.classList.remove('over'); });
window.addEventListener('drop', async (e) => { e.preventDefault(); dz.classList.remove('over'); go(await filesFromDrop(e.dataTransfer)); });
if ('launchQueue' in window) window.launchQueue.setConsumer(async (p) => { if (p.files?.length) go(await Promise.all(p.files.map(async (h) => ({ file: await h.getFile(), path: h.name })))); });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
Promise.resolve(pro.init()).catch(() => {}).finally(() => nudge.webNote());
window.__redate = { go, get items() { return items; }, run, pro, show };
show('start');

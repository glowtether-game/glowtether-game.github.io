import { ZipOut, pickOutputFolder, filesFromDrop, filesFromInput, sha256, exifDate, ym, toBin, fromBin } from './vendor/zipout.js';
import { makePro } from './vendor/pro.js';
import { kindOf, markLive, videoDate, dateFromName, outName } from './src/photos.js';

const VERSION = '1.0.0';
const FREE_LIMIT = 20;
const pro = makePro({ sku: 'tidyroll_pro', storeId: 'TIDYROLL_STORE_ID', key: 'tidyroll-pro' });

const T = {
  en: {
    drop: 'Drop iPhone photos (HEIC) or a whole folder here', sub: 'Converted on this PC. Nothing is uploaded.', chooseFiles: 'Choose photos', chooseFolder: 'Choose a folder',
    tag: 'HEIC to JPG, sorted by date, Live Photo videos kept apart', scanning: 'Reading… {n} files',
    report: 'What we found', rHeic: 'HEIC photos (will become JPG)', rJpeg: 'JPG photos', rOther: 'Other pictures', rVideo: 'Videos', rLive: 'of them Live Photo videos', rDate: 'With a date',
    optLayout: 'Folders', optFlat: 'All in one folder', optYm: 'Sort into Year / Month folders', optLive: 'Put Live Photo videos in their own folder', optDup: 'Leave out duplicates', optGeo: 'Remove location from the photos', optKeep: 'Also keep the original HEIC files', quality: 'JPG quality',
    freeNote: 'Free version: converts up to {n} HEIC photos at a time. The rest are copied unchanged. Pro converts everything and unlocks the Pro options.',
    start: 'Convert and save', working: 'Working… {i} of {n}', done: 'Done', doneText: 'Saved {files}. Open the zip with Windows (right-click › Extract All). Files keep the date they were taken.',
    savedTo: 'Saved in the folder you chose.', downloaded: 'Saved to your Downloads folder.', again: 'Start over', none: 'No photos or videos were found.', err: 'Something went wrong: {m}', privacy: 'Privacy', badHeic: '{n} HEIC file(s) could not be read and were copied unchanged.',
    proTitle: 'Tidyroll Pro', proBody: 'Convert any number of photos, sort into Year / Month folders, keep Live Photo videos apart, leave out duplicates and remove location.', proOnce: 'One payment, no subscription. It stays with your Microsoft account.', proBuy: 'Get Pro', proBuyP: 'Get Pro for {p}', proRestore: 'I already bought Pro', proWeb: 'Tidyroll Pro is sold in the Microsoft Store app. Install Tidyroll from the Store, then get Pro there.', proOpenStore: 'Open in Microsoft Store', proLater: 'Not now', proThanks: 'Thank you! Tidyroll Pro is ready.', proFail: 'The purchase did not go through. Nothing was charged.', proNone: 'No Pro purchase was found for this Microsoft account.',
  },
  ja: {
    drop: 'iPhone の写真（HEIC）やフォルダーごとここにドラッグ', sub: 'この PC の中で変換します。アップロードはしません。', chooseFiles: '写真を選ぶ', chooseFolder: 'フォルダーを選ぶ',
    tag: 'HEIC を JPG に、撮影日で整理、Live Photo の動画は別に', scanning: '読み込み中… {n} 件',
    report: '見つかったもの', rHeic: 'HEIC の写真（JPG にします）', rJpeg: 'JPG の写真', rOther: 'そのほかの画像', rVideo: '動画', rLive: 'うち Live Photo の動画', rDate: '撮影日が分かるもの',
    optLayout: 'フォルダー', optFlat: '1つのフォルダーにまとめる', optYm: '年／月のフォルダーに分ける', optLive: 'Live Photo の動画を別のフォルダーに', optDup: '重複を入れない', optGeo: '写真から位置情報を消す', optKeep: '元の HEIC も残す', quality: 'JPG の画質',
    freeNote: '無料版では、一度に {n} 枚まで HEIC を変換します。残りはそのまま入ります。Pro ではすべて変換し、Pro の設定も使えます。',
    start: '変換して保存', working: '処理中… {n} 件中 {i} 件', done: '完了', doneText: '{files} を保存しました。Windows で zip を開いてください（右クリック ›「すべて展開」）。撮影日のまま展開されます。',
    savedTo: '選んだフォルダーに保存しました。', downloaded: 'ダウンロードフォルダーに保存しました。', again: '最初から', none: '写真や動画が見つかりませんでした。', err: '問題が起きました：{m}', privacy: 'プライバシー', badHeic: '読み取れなかった HEIC {n} 件は、そのまま入れました。',
    proTitle: 'Tidyroll Pro', proBody: '枚数の制限なしで変換し、年／月のフォルダー分け、Live Photo の動画の仕分け、重複の除外、位置情報の削除ができます。', proOnce: '一度の支払いだけで、月額ではありません。Microsoft アカウントにひもづきます。', proBuy: 'Pro にする', proBuyP: '{p} で Pro にする', proRestore: '購入済みの方はこちら', proWeb: 'Tidyroll Pro は Microsoft Store 版で販売しています。Store から Tidyroll を入れて、その中で Pro にしてください。', proOpenStore: 'Microsoft Store で開く', proLater: 'あとで', proThanks: 'ありがとうございます。Tidyroll Pro が使えるようになりました。', proFail: '購入は完了しませんでした。料金はかかっていません。', proNone: 'この Microsoft アカウントでは Pro の購入が見つかりませんでした。',
  },
};
const LANG = (navigator.language || 'en').toLowerCase().startsWith('ja') ? 'ja' : 'en';
const t = (k, v) => { let s = T[LANG][k] ?? T.en[k] ?? k; if (v) for (const [a, b] of Object.entries(v)) s = s.replaceAll(`{${a}}`, b); return s; };
document.documentElement.lang = LANG;
for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
const $ = (id) => document.getElementById(id);
$('ver').textContent = 'v' + VERSION;
const PRO_OPTS = ['optYm', 'optLive', 'optDup', 'optGeo'];

let items = [];
let exifr = null, heif = null;
const loadExifr = async () => (exifr ||= (await import('./vendor/exifr.mjs')).default);
const loadHeif = async () => { if (!heif) { const m = await import('./vendor/libheif-bundle.mjs'); heif = await m.default(); } return heif; };

function show(id) { for (const s of ['start', 'busy', 'report', 'finish']) $(s).hidden = s !== id; }
function busy(msg) { show('busy'); $('busyText').textContent = msg; }
function alertBox(msg) { $('msg').textContent = msg; $('msg').hidden = !msg; }

async function scan(list) {
  alertBox('');
  const ex = await loadExifr();
  items = [];
  let n = 0;
  for (const s of list) {
    const kind = kindOf(s.path); if (!kind) continue;
    n++; if (n % 25 === 0) busy(t('scanning', { n }));
    const it = { file: s.file, path: s.path, kind, size: s.file.size, date: null, meta: null };
    if (kind !== 'video') {
      try {
        const m = await ex.parse(s.file, { pick: ['DateTimeOriginal', 'CreateDate', 'Make', 'Model', 'LensModel', 'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef', 'GPSAltitude'], gps: true, translateValues: false, reviveValues: true });
        it.meta = m || null; it.date = (m && (m.DateTimeOriginal || m.CreateDate)) || null;
      } catch (e) {}
      if (!it.date && kind === 'heic') { // some HEIC writers store EXIF without the offset header: find the TIFF block ourselves
        try {
          const u = new Uint8Array(await s.file.slice(0, Math.min(s.file.size, 512 * 1024)).arrayBuffer());
          for (let i = 0; i < u.length - 8; i++) {
            if ((u[i] === 0x4d && u[i + 1] === 0x4d && u[i + 2] === 0 && u[i + 3] === 0x2a) || (u[i] === 0x49 && u[i + 1] === 0x49 && u[i + 2] === 0x2a && u[i + 3] === 0)) {
              const m = await ex.parse(u.slice(i), { gps: true, reviveValues: true });
              if (m && (m.DateTimeOriginal || m.CreateDate || m.Make)) { it.meta = m; it.date = m.DateTimeOriginal || m.CreateDate || null; break; }
            }
          }
        } catch (e) {}
      }
    } else {
      try { const head = new Uint8Array(await s.file.slice(0, Math.min(s.file.size, 4 * 1024 * 1024)).arrayBuffer()); it.date = videoDate(head); } catch (e) {}
    }
    if (!(it.date instanceof Date) || isNaN(it.date)) it.date = dateFromName(s.path.split('/').pop());
    items.push(it);
  }
  if (!items.length) { show('start'); alertBox(t('none')); return; }
  markLive(items);
  renderReport();
}

function renderReport() {
  show('report');
  const c = (f) => items.filter(f).length;
  const rows = [[t('rHeic'), c((i) => i.kind === 'heic')], [t('rJpeg'), c((i) => i.kind === 'jpeg')], [t('rOther'), c((i) => i.kind === 'image')], [t('rVideo'), c((i) => i.kind === 'video')], [t('rLive'), c((i) => i.live)], [t('rDate'), c((i) => i.date)]];
  $('stats').replaceChildren(...rows.map(([k, v]) => { const li = document.createElement('li'); const b = document.createElement('b'); b.textContent = v.toLocaleString(); const s = document.createElement('span'); s.textContent = k; li.append(b, s); return li; }));
  $('freeNote').hidden = !(pro.live() && !pro.has());
  $('freeNote').textContent = t('freeNote', { n: FREE_LIMIT });
  for (const id of PRO_OPTS) $(id + 'Badge').hidden = !pro.live() || pro.has();
}

// ---------- conversion ----------
function gpsArr(v) { const a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 60), s = Math.round(((a - d) * 60 - m) * 60 * 100); return [[d, 1], [m, 1], [s, 100]]; }
function buildExif(meta, date, keepGeo) {
  const P = window.piexif; const ex = { '0th': {}, Exif: {}, GPS: {}, '1st': {}, thumbnail: null };
  ex['0th'][P.ImageIFD.Orientation] = 1; // pixels are already upright
  if (meta?.Make) ex['0th'][P.ImageIFD.Make] = String(meta.Make);
  if (meta?.Model) ex['0th'][P.ImageIFD.Model] = String(meta.Model);
  ex['0th'][P.ImageIFD.Software] = 'Tidyroll';
  if (date) { const s = exifDate(date); ex.Exif[P.ExifIFD.DateTimeOriginal] = s; ex.Exif[P.ExifIFD.DateTimeDigitized] = s; ex['0th'][P.ImageIFD.DateTime] = s; }
  if (keepGeo && typeof meta?.latitude === 'number' && typeof meta?.longitude === 'number') {
    ex.GPS[P.GPSIFD.GPSLatitudeRef] = meta.latitude >= 0 ? 'N' : 'S'; ex.GPS[P.GPSIFD.GPSLatitude] = gpsArr(meta.latitude);
    ex.GPS[P.GPSIFD.GPSLongitudeRef] = meta.longitude >= 0 ? 'E' : 'W'; ex.GPS[P.GPSIFD.GPSLongitude] = gpsArr(meta.longitude);
  }
  return P.dump(ex);
}
async function heicToJpeg(bytes, quality) {
  const lib = await loadHeif();
  const dec = new lib.HeifDecoder();
  const imgs = dec.decode(bytes);
  if (!imgs || !imgs.length) throw new Error('decode');
  const img = imgs[0]; // the primary image comes first (is_primary() is broken in this build)
  const w = img.get_width(), h = img.get_height();
  const cv = new OffscreenCanvas(w, h); const ctx = cv.getContext('2d');
  const id = ctx.createImageData(w, h);
  await new Promise((res, rej) => img.display(id, (d) => (d ? res() : rej(new Error('display')))));
  ctx.putImageData(id, 0, 0);
  for (const i of imgs) { try { i.free && i.free(); } catch (e) {} }
  const blob = await cv.convertToBlob({ type: 'image/jpeg', quality });
  return new Uint8Array(await blob.arrayBuffer());
}
function stripJpegGps(bytes) {
  try { const P = window.piexif; const bin = toBin(bytes); const ex = P.load(bin); if (!ex.GPS || !Object.keys(ex.GPS).length) return bytes; ex.GPS = {}; return fromBin(P.insert(P.dump(ex), bin)); } catch (e) { return bytes; }
}

async function run() {
  const o = { ym: $('optYm').checked, live: $('optLive').checked, dup: $('optDup').checked, geo: $('optGeo').checked, keep: $('optKeep').checked, q: Number($('quality').value) / 100 };
  if ((o.ym || o.live || o.dup || o.geo) && !pro.has()) { showPro(() => run()); return; }
  let dir = null; try { dir = await pickOutputFolder(); } catch (e) { return; }
  const out = new ZipOut('Tidyroll ' + new Date().toISOString().slice(0, 10), dir);
  const N = items.length; let i = 0, converted = 0, bad = 0; const hashes = new Set(), names = new Set();
  const place = async (name, bytes, date, it) => {
    let folder = '';
    if (o.ym) folder = date ? ym(date) + '/' : 'No date/';
    if (o.live && it.live) folder = (o.ym && date ? ym(date) + '/' : '') + 'Live Photos/';
    let p = folder + name;
    if (names.has(p.toLowerCase())) { const ext = (p.match(/\.[^./]+$/) || [''])[0], st = p.slice(0, p.length - ext.length); let k = 2; while (names.has(`${st} (${k})${ext}`.toLowerCase())) k++; p = `${st} (${k})${ext}`; }
    names.add(p.toLowerCase());
    await out.add(p, bytes, date || undefined);
  };
  busy(t('working', { i: 0, n: N })); $('bar').hidden = false;
  try {
    for (const it of items) {
      i++; $('busyText').textContent = t('working', { i, n: N }); $('bar').value = i / N;
      let bytes = new Uint8Array(await it.file.arrayBuffer());
      if (o.dup) { const h = await sha256(bytes); if (hashes.has(h)) continue; hashes.add(h); }
      if (it.kind === 'heic' && (pro.has() || converted < FREE_LIMIT)) {
        try {
          let jpg = await heicToJpeg(bytes, o.q);
          jpg = fromBin(window.piexif.insert(buildExif(it.meta, it.date, !o.geo), toBin(jpg)));
          await place(outName(it.path, it.kind, true), jpg, it.date, it); converted++;
          if (o.keep) await place(outName(it.path, it.kind, false), bytes, it.date, it);
          continue;
        } catch (e) { bad++; console.warn('HEIC', it.path, e); }
      }
      if (it.kind === 'jpeg' && o.geo) bytes = stripJpegGps(bytes);
      await place(outName(it.path, it.kind, false), bytes, it.date, it);
    }
    const files = await out.close();
    show('finish');
    $('doneText').textContent = t('doneText', { files: files.join(', ') }) + ' ' + (dir ? t('savedTo') : t('downloaded')) + (bad ? ' ' + t('badHeic', { n: bad }) : '');
  } catch (e) { show('report'); alertBox(t('err', { m: e.message || String(e) })); }
  $('bar').hidden = true;
}

// ---------- Pro dialog ----------
function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else e.setAttribute(k, v); } for (const k of kids) e.append(k); return e; }
function showPro(after) {
  const msg = el('p', { class: 'pro-msg' });
  const close = () => back.remove();
  const done = () => { close(); renderReport(); alertBox(t('proThanks')); if (after) after(); };
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
$('fileBtn').onclick = () => $('fileIn').click();
$('dirBtn').onclick = () => $('dirIn').click();
$('fileIn').onchange = (e) => { go(filesFromInput(e.target.files)); e.target.value = ''; };
$('dirIn').onchange = (e) => { go(filesFromInput(e.target.files)); e.target.value = ''; };
$('startBtn').onclick = run;
$('againBtn').onclick = () => { items = []; show('start'); };
$('quality').oninput = (e) => { $('qv').textContent = e.target.value; };
for (const id of PRO_OPTS) $(id).addEventListener('change', (e) => { if (e.target.checked && !pro.has()) { e.target.checked = false; showPro(() => { e.target.checked = true; }); } });
const dz = $('drop');
window.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) dz.classList.remove('over'); });
window.addEventListener('drop', async (e) => { e.preventDefault(); dz.classList.remove('over'); go(await filesFromDrop(e.dataTransfer)); });
if ('launchQueue' in window) window.launchQueue.setConsumer(async (p) => { if (p.files?.length) go(await Promise.all(p.files.map(async (h) => ({ file: await h.getFile(), path: h.name })))); });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
pro.init();
window.__tidyroll = { go, get items() { return items; }, run, pro };
show('start');

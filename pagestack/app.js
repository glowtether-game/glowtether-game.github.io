import { pickOutputFolder, filesFromDrop, filesFromInput } from './vendor/zipout.js';
import { makePro } from './vendor/pro.js';
import { makeNudge } from './vendor/nudge.js';
import { LANG, makeT, $, el, baseName, safeName, saveTo, showPro, withPro, dropZone } from './vendor/appkit.js';
import { PDFDocument, degrees } from './vendor/pdf-lib.esm.min.js';

const VERSION = '1.0.0';
const FREE_MERGE = 3; // files per merge in the free version
const STORE_ID = '';
const pro = makePro({ sku: 'pagestack_pro', storeId: STORE_ID, key: 'pagestack-pro' });

const T = withPro({
  en: {
    drop: 'Drop PDF files here', sub: 'Merge or split PDFs on this PC. Nothing is uploaded.', chooseFiles: 'Choose PDFs', chooseFolder: 'Choose a folder',
    tag: 'Contracts, statements and forms stay on your PC. No size limit, no waiting in line.', reading: 'Reading… {n} files',
    tabMerge: 'Merge', tabSplit: 'Split', add: 'Add PDFs', pages: '{n} pages', page1: '1 page', up: 'Move up', down: 'Move down', remove: 'Remove',
    eEnc: 'has a password (remove it first, for example with Paperlock)', eBad: 'cannot be read',
    arrange: 'Arrange pages (move, rotate, delete)', outName: 'File name', mergedName: 'merged',
    howEach: 'One PDF per page', howRanges: 'Page ranges, one PDF each', howEvery: 'Every', howEvery2: 'pages',
    rangesHelp: 'Ranges: "1-3" pages 1 to 3, "5" page 5, "8-" page 8 to the end. Separate with commas.',
    saveMerge: 'Merge and save', saveSplit: 'Split and save', left: 'Move left', right: 'Move right', rotate: 'Rotate', del: 'Delete', pageOf: '{f} p.{p}',
    freeMerge: 'Free version: merges up to {n} files at a time. Pro merges any number and lets you arrange pages.', freeSplit: 'Free version: splits one PDF at a time. Pro splits many at once and can split every N pages.',
    working: 'Working… {i} of {n}', done: 'Done', doneMerge: 'Saved {f} ({n} pages).', doneSplit: 'Saved {n} PDF(s).', savedTo: 'It is in the folder you chose.', savedToN: 'They are in the folder you chose.', downloaded: 'Look in your Downloads folder.',
    failed: '{n} file(s) were left out: {names}', back: 'Back to these files', again: 'Start over', none: 'No PDF files were found.', err: 'Something went wrong: {m}', privacy: 'Privacy',
    eRanges: 'Type page ranges, for example 1-3, 5, 8-', eNoPages: 'There are no pages to save.', eTwo: 'Add two or more PDFs to merge (or arrange the pages of one PDF with Pro).',
    proTitle: 'Pagestack Pro', proBody: 'Merge any number of PDFs, arrange pages (move, rotate, delete) before saving, split many PDFs at once and split every N pages.',
  },
  ja: {
    drop: 'PDF をここにドラッグ', sub: 'この PC の中で PDF をつなぐ・分ける。アップロードはしません。', chooseFiles: 'PDF を選ぶ', chooseFolder: 'フォルダーを選ぶ',
    tag: '契約書・明細・申込書が PC の外に出ません。大きさの上限も、待ち時間もありません。', reading: '読み込み中… {n} 件',
    tabMerge: 'つなぐ（結合）', tabSplit: '分ける（分割）', add: 'PDF を足す', pages: '{n} ページ', page1: '1 ページ', up: '上へ', down: '下へ', remove: '外す',
    eEnc: 'パスワードがかかっています（Paperlock などで先に外してください）', eBad: '読み取れません',
    arrange: 'ページを並べ替える（移動・回転・削除）', outName: 'ファイル名', mergedName: '結合',
    howEach: '1ページずつ別の PDF に', howRanges: 'ページの範囲ごとに PDF に', howEvery: '', howEvery2: 'ページごとに PDF に',
    rangesHelp: '範囲の書き方：「1-3」は1〜3ページ、「5」は5ページ、「8-」は8ページから最後まで。カンマで区切ります。',
    saveMerge: 'つないで保存', saveSplit: '分けて保存', left: '左へ', right: '右へ', rotate: '回転', del: '削除', pageOf: '{f} {p}ページ',
    freeMerge: '無料版では、一度に {n} 個までつなげます。Pro では数の制限なしでつなげ、ページの並べ替えもできます。', freeSplit: '無料版では、一度に1つの PDF を分けます。Pro ではまとめて分けられ、Nページごとにも分けられます。',
    working: '処理中… {n} 件中 {i} 件', done: '完了', doneMerge: '{f} を保存しました（{n} ページ）。', doneSplit: 'PDF を {n} 件保存しました。', savedTo: '選んだフォルダーに入っています。', savedToN: '選んだフォルダーに入っています。', downloaded: 'ダウンロードフォルダーを見てください。',
    failed: '対象外にしたファイル {n} 件：{names}', back: 'このファイルに戻る', again: '最初から', none: 'PDF が見つかりませんでした。', err: '問題が起きました：{m}', privacy: 'プライバシー',
    eRanges: 'ページの範囲を入力してください（例：1-3, 5, 8-）', eNoPages: '保存するページがありません。', eTwo: 'つなぐには PDF を2つ以上入れてください（1つの PDF のページの並べ替えは Pro でできます）。',
    proTitle: 'Pagestack Pro', proBody: '数の制限なしで PDF をつなぐ、保存の前にページを並べ替える（移動・回転・削除）、たくさんの PDF をまとめて分ける、Nページごとに分けることができます。',
  },
}, 'Pagestack');
const t = makeT(T);
const nudge = makeNudge({ app: 'Pagestack', storeId: STORE_ID, key: 'pagestack', lang: LANG, where: () => pro.where(), listed: false });
$('ver').textContent = 'v' + VERSION;

let docs = [];      // {file, name, bytes, count, err, lib (PDFDocument), js (pdf.js doc)}
let order = null;   // page grid: [{d, p, rot}] or null when not arranging
let tab = 'merge';
let pdfjs = null;
async function getPdfjs() {
  if (!pdfjs) { pdfjs = await import('./vendor/pdf.min.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.mjs'; }
  return pdfjs;
}

function show(id) { for (const s of ['start', 'busy', 'work', 'finish']) $(s).hidden = s !== id; }
function busy(m) { show('busy'); $('busyText').textContent = m; }
function alertBox(m) { $('msg').textContent = m; $('msg').hidden = !m; }
const okDocs = () => docs.filter((d) => !d.err);

async function addFiles(src) {
  alertBox(''); let n = 0;
  for (const s of src) {
    const name = s.path.split('/').pop();
    if (!/\.pdf$/i.test(name) || name.startsWith('.')) continue;
    if (++n % 3 === 0) busy(t('reading', { n }));
    const d = { file: s.file, name, bytes: null, count: 0, err: '' };
    try {
      d.bytes = new Uint8Array(await s.file.arrayBuffer());
      d.lib = await PDFDocument.load(d.bytes, { updateMetadata: false });
      d.count = d.lib.getPageCount();
    } catch (e) { d.err = /encrypt/i.test(e.message || '') ? t('eEnc') : t('eBad'); }
    docs.push(d);
  }
  if (!docs.length) { show('start'); alertBox(t('none')); return; }
  if (!$('mergeName').value) $('mergeName').value = (okDocs()[0] ? baseName(okDocs()[0].name) + '_' : '') + t('mergedName');
  if (order) rebuildOrder();
  render();
}

function rebuildOrder() {
  const keep = order ? order.filter((x) => docs[x.d] && !docs[x.d].err) : [];
  const have = new Set(keep.map((x) => x.d));
  order = [...keep];
  docs.forEach((d, di) => { if (!d.err && !have.has(di)) for (let p = 0; p < d.count; p++) order.push({ d: di, p, rot: 0 }); });
}

function render() {
  show('work');
  $('tabMerge').setAttribute('aria-selected', tab === 'merge'); $('tabSplit').setAttribute('aria-selected', tab === 'split');
  $('mergePane').hidden = tab !== 'merge'; $('splitPane').hidden = tab !== 'split';
  $('startBtn').textContent = tab === 'merge' ? t('saveMerge') : t('saveSplit');
  const lis = docs.map((d, i) => el('li', { class: d.err ? 'bad' : '' },
    el('span', { class: 'nm', text: d.name }),
    el('span', { class: 'pg', text: d.err || (d.count === 1 ? t('page1') : t('pages', { n: d.count })) }),
    el('button', { class: 'mini', title: t('up'), 'aria-label': t('up'), disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
    el('button', { class: 'mini', title: t('down'), 'aria-label': t('down'), disabled: i === docs.length - 1, onclick: () => move(i, 1) }, '↓'),
    el('button', { class: 'mini', title: t('remove'), 'aria-label': t('remove'), onclick: () => removeDoc(i) }, '✕')));
  $('files').replaceChildren(...lis);
  const lim = pro.live() && !pro.has();
  for (const b of document.querySelectorAll('.pro-only')) b.hidden = !lim;
  const fn = $('freeNote');
  if (lim && tab === 'merge' && okDocs().length > FREE_MERGE) { fn.hidden = false; fn.textContent = t('freeMerge', { n: FREE_MERGE }); }
  else if (lim && tab === 'split' && okDocs().length > 1) { fn.hidden = false; fn.textContent = t('freeSplit'); }
  else fn.hidden = true;
  $('arrange').checked = !!order;
  $('pages').hidden = !order || tab !== 'merge';
  if (order && tab === 'merge') drawPages();
}

function move(i, k) {
  const j = i + k; if (j < 0 || j >= docs.length) return;
  [docs[i], docs[j]] = [docs[j], docs[i]];
  if (order) order = order.map((x) => ({ ...x, d: x.d === i ? j : x.d === j ? i : x.d }));
  render();
}
function removeDoc(i) {
  docs.splice(i, 1);
  if (order) order = order.filter((x) => x.d !== i).map((x) => ({ ...x, d: x.d > i ? x.d - 1 : x.d }));
  if (!docs.length) { order = null; show('start'); return; }
  render();
}

// ---------- page grid (Pro) ----------
const thumbCache = new Map(); // "d:p" -> canvas (unrotated)
let drawToken = 0;
async function thumb(di, p) {
  const k = docs[di].name + ':' + docs[di].count + ':' + p;
  if (thumbCache.has(k)) return thumbCache.get(k);
  const lib = await getPdfjs();
  const d = docs[di];
  d.js ||= await lib.getDocument({ data: d.bytes.slice(), cMapUrl: 'vendor/cmaps/', cMapPacked: true, standardFontDataUrl: 'vendor/standard_fonts/', isEvalSupported: false }).promise;
  const page = await d.js.getPage(p + 1);
  const vp0 = page.getViewport({ scale: 1 }); const scale = 220 / Math.max(vp0.width, vp0.height);
  const vp = page.getViewport({ scale });
  const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  thumbCache.set(k, c);
  return c;
}
function rotated(src, rot) {
  const r = ((rot % 360) + 360) % 360; const c = document.createElement('canvas');
  c.width = r % 180 ? src.height : src.width; c.height = r % 180 ? src.width : src.height;
  const g = c.getContext('2d'); g.translate(c.width / 2, c.height / 2); g.rotate(r * Math.PI / 180); g.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}
async function drawPages() {
  const tok = ++drawToken;
  const cards = order.map((x, i) => {
    const holder = el('div', { class: 'ph', style: 'height:150px;display:flex;align-items:center;justify-content:center;color:var(--muted)' }, '…');
    const card = el('div', { class: 'pg-card' }, holder,
      el('div', { class: 'cap', text: t('pageOf', { f: baseName(docs[x.d].name).slice(0, 14), p: x.p + 1 }) }),
      el('div', { class: 'tools' },
        el('button', { class: 'mini', title: t('left'), 'aria-label': t('left'), disabled: i === 0, onclick: () => { [order[i - 1], order[i]] = [order[i], order[i - 1]]; render(); } }, '←'),
        el('button', { class: 'mini', title: t('rotate'), 'aria-label': t('rotate'), onclick: () => { x.rot = (x.rot + 90) % 360; render(); } }, '↻'),
        el('button', { class: 'mini', title: t('del'), 'aria-label': t('del'), onclick: () => { order.splice(i, 1); render(); } }, '✕'),
        el('button', { class: 'mini', title: t('right'), 'aria-label': t('right'), disabled: i === order.length - 1, onclick: () => { [order[i + 1], order[i]] = [order[i], order[i + 1]]; render(); } }, '→')));
    card._x = x; card._holder = holder; return card;
  });
  $('pages').replaceChildren(...cards);
  for (const c of cards) {
    if (tok !== drawToken) return;
    try { const base = await thumb(c._x.d, c._x.p); const r = rotated(base, c._x.rot + docs[c._x.d].lib.getPage(c._x.p).getRotation().angle); c._holder.replaceWith(r); } catch (e) { c._holder.textContent = '×'; }
  }
}

// ---------- saving ----------
function parseRanges(s, count) {
  const out = [];
  for (const part of s.split(/[,、，]+/).map((x) => x.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)?\s*[-–〜~]\s*(\d+)?$/) || part.match(/^(\d+)$/);
    if (!m) return null;
    let a, b;
    if (m.length === 2) { a = b = +m[1]; } else { a = m[1] ? +m[1] : 1; b = m[2] ? +m[2] : count; }
    a = Math.max(1, a); b = Math.min(count, b);
    if (a <= b) out.push([a, b]);
  }
  return out.length ? out : null;
}

async function buildPdf(list) { // list: [{d, p, rot}]
  const out = await PDFDocument.create();
  const byDoc = new Map();
  for (const x of list) { if (!byDoc.has(x.d)) byDoc.set(x.d, []); byDoc.get(x.d).push(x.p); }
  const copied = new Map();
  for (const [d, ps] of byDoc) { const pages = await out.copyPages(docs[d].lib, [...new Set(ps)]); [...new Set(ps)].forEach((p, i) => copied.set(d + ':' + p, pages[i])); }
  const usedOnce = new Set();
  for (const x of list) {
    let pg = copied.get(x.d + ':' + x.p);
    if (usedOnce.has(pg)) { [pg] = await out.copyPages(docs[x.d].lib, [x.p]); }
    usedOnce.add(pg);
    if (x.rot) pg.setRotation(degrees((pg.getRotation().angle + x.rot) % 360));
    out.addPage(pg);
  }
  return new Blob([await out.save()], { type: 'application/pdf' });
}

async function run() {
  alertBox('');
  const lim = pro.live() && !pro.has();
  if (tab === 'merge') {
    const good = okDocs();
    if (!order && good.length < 2) return alertBox(t('eTwo'));
    if (lim && (good.length > FREE_MERGE || order)) { showPro(pro, t, render); return; }
    const list = order || docs.flatMap((d, di) => (d.err ? [] : Array.from({ length: d.count }, (_, p) => ({ d: di, p, rot: 0 }))));
    if (!list.length) return alertBox(t('eNoPages'));
    let dir = null; try { dir = await pickOutputFolder(); } catch (e) { return; }
    busy(t('working', { i: 1, n: 1 }));
    try {
      const name = await saveTo(dir, safeName($('mergeName').value || t('mergedName')).replace(/\.pdf$/i, '') + '.pdf', await buildPdf(list), new Set());
      finish(t('doneMerge', { f: name, n: list.length }) + ' ' + (dir ? t('savedTo') : t('downloaded')), docs.filter((d) => d.err), false);
    } catch (e) { render(); alertBox(t('err', { m: e.message || String(e) })); }
    return;
  }
  // split
  const how = document.querySelector('input[name=how]:checked').value;
  if (how === 'every' && lim) { showPro(pro, t, render); return; }
  let good = okDocs();
  const limited = lim && good.length > 1;
  if (limited) good = good.slice(0, 1);
  if (how === 'ranges' && !$('ranges').value.trim()) return alertBox(t('eRanges'));
  let dir = null; try { dir = await pickOutputFolder(); } catch (e) { return; }
  const used = new Set(); let saved = 0;
  try {
    for (let k = 0; k < good.length; k++) {
      const d = good[k], di = docs.indexOf(d), stem = safeName(baseName(d.name));
      let groups;
      if (how === 'each') groups = Array.from({ length: d.count }, (_, p) => [p + 1, p + 1]);
      else if (how === 'every') { const n = Math.max(1, +$('everyN').value || 1); groups = []; for (let a = 1; a <= d.count; a += n) groups.push([a, Math.min(d.count, a + n - 1)]); }
      else { groups = parseRanges($('ranges').value, d.count); if (!groups) { render(); return alertBox(t('eRanges')); } }
      const w = String(d.count).length;
      for (let g = 0; g < groups.length; g++) {
        const [a, b] = groups[g];
        busy(t('working', { i: saved + 1, n: '…' })); $('bar').hidden = false; $('bar').value = (k + g / groups.length) / good.length;
        const list = []; for (let p = a; p <= b; p++) list.push({ d: di, p: p - 1, rot: 0 });
        const tag = a === b ? `p${String(a).padStart(w, '0')}` : `p${String(a).padStart(w, '0')}-${String(b).padStart(w, '0')}`;
        await saveTo(dir, `${stem}_${tag}.pdf`, await buildPdf(list), used);
        saved++;
      }
    }
    $('bar').hidden = true;
    finish(t('doneSplit', { n: saved }) + ' ' + (dir ? t('savedToN') : t('downloaded')), docs.filter((d) => d.err), limited);
  } catch (e) { $('bar').hidden = true; render(); alertBox(t('err', { m: e.message || String(e) })); }
}

function finish(text, bad, limited) {
  show('finish');
  nudge.success();
  $('doneText').textContent = text;
  $('failText').hidden = !bad.length; $('failText').textContent = t('failed', { n: bad.length, names: bad.map((d) => `${d.name} (${d.err})`).join(', ') });
  $('freeDone').hidden = !limited; $('freeBtn').hidden = !limited; $('freeDone').textContent = t('freeSplit');
}

// ---------- events ----------
async function go(src) { if (!src.length) return; busy(t('reading', { n: 0 })); try { await addFiles(src); } catch (e) { show(docs.length ? 'work' : 'start'); alertBox(t('err', { m: e.message || String(e) })); } }
$('fileBtn').onclick = () => $('fileIn').click();
$('addBtn').onclick = () => $('fileIn').click();
$('dirBtn').onclick = () => $('dirIn').click();
$('fileIn').onchange = (e) => { go(filesFromInput(e.target.files)); e.target.value = ''; };
$('dirIn').onchange = (e) => { go(filesFromInput(e.target.files)); e.target.value = ''; };
$('tabMerge').onclick = () => { tab = 'merge'; render(); };
$('tabSplit').onclick = () => { tab = 'split'; render(); };
$('arrange').onchange = (e) => {
  if (e.target.checked && pro.live() && !pro.has()) { e.target.checked = false; showPro(pro, t, () => { rebuildOrder(); render(); }); return; }
  if (e.target.checked) rebuildOrder(); else order = null;
  render();
};
document.querySelector('input[name=how][value=every]').addEventListener('change', (e) => { if (pro.live() && !pro.has()) { document.querySelector('input[name=how][value=each]').checked = true; showPro(pro, t, () => { e.target.checked = true; }); } });
$('ranges').addEventListener('focus', () => { document.querySelector('input[name=how][value=ranges]').checked = true; });
$('startBtn').onclick = run;
$('freeBtn').onclick = () => showPro(pro, t);
$('backBtn').onclick = () => render();
$('againBtn').onclick = () => { docs = []; order = null; thumbCache.clear(); $('mergeName').value = ''; show('start'); };
dropZone(go, filesFromDrop);
Promise.resolve(pro.init()).catch(() => {}).finally(() => nudge.webNote());
window.__app = { go, get docs() { return docs; }, run, pro, setTab: (x) => { tab = x; render(); } };
show('start');

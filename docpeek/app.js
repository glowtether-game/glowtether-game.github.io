import { unzipSync, gunzipSync, zipSync } from './vendor/fflate.js';
import { readDocument } from './src/iwa.js';
import { readTables, readLegacyTables, tableById, formatCell } from './src/tables.js';
import { makeDocx, makeXlsx, makeCsv, makeTxt, makeImageZip, keynoteOutline, pagesText } from './src/export.js';
import { makePptx } from './src/pptx.js';
import { makeNudge } from './src/nudge.js';
import { initPro, hasPro, proLive, buyPro, restorePro, where, priceText, STORE_WEB, STORE_APP, _test as proTest } from './src/pro.js';
import I18N from './i18n.js';

const VERSION = '1.4.0';
const ROW_PAGE = 1000;

// ---------- i18n ----------
const T = {
  en: {
    open: 'Open', save: 'Save as', print: 'Print / PDF', choose: 'Choose a file', reading: 'Reading…', privacy: 'Privacy',
    dropTitle: 'Open a Pages, Numbers or Keynote file', dropSub: 'Drag a .pages, .numbers or .key file here, or choose one.',
    openFolder: 'The file is a folder? Open the folder instead',
    p1t: 'Stays on your PC', p1: 'Your file is read right here. Nothing is uploaded, and there is no account.',
    p2t: 'Text, tables, slides', p2: 'Pages documents, Numbers sheets (every table) and Keynote slides with notes and images.',
    p3t: 'Save in Office formats', p3: 'Save as Word, Excel, PowerPoint, CSV or text, or print to PDF.',
    pages: 'Pages', numbers: 'Numbers', keynote: 'Keynote',
    textBoxes: 'Text boxes', headers: 'Headers and footers', footnotes: 'Footnotes', comments: 'Comments', images: 'Images', tables: 'Tables',
    firstPage: 'Picture of the first page (saved inside the file)', noText: 'No text was found in this document.',
    slide: 'Slide', skipped: 'Skipped', notes: 'Presenter notes', noThumb: 'No slide picture saved', slideTables: 'table(s) on this slide',
    rows: 'rows', cols: 'columns', showMore: 'Show {n} more rows', showing: 'Showing {a} of {b} rows', copyTable: 'Copy table',
    sheetEmpty: 'This sheet has no tables with data.',
    legacyNote: 'This file was made with iWork ’09 (2009–2012). Text is shown without its layout.',
    layoutNote: 'Docpeek shows the text, tables and pictures. Fonts, colours and exact layout are not reproduced.',
    exDocx: 'Word document (.docx)', exDocxS: 'Text of the document, editable in Word', exTxt: 'Text (.txt)', exTxtS: 'Plain text',
    exXlsx: 'Excel workbook (.xlsx)', exXlsxS: 'Every table as a separate sheet', exCsv: 'CSV of the table you are viewing (.csv)', exCsvS: 'Opens in Excel; UTF-8 with BOM',
    exPptx: 'PowerPoint (.pptx)', exPptxS: 'Editable slides: titles, bullet points, pictures, tables and presenter notes', exOutline: 'Slide text and notes (.txt)', exOutlineS: 'Titles, bullet points and presenter notes',
    exImages: 'All pictures (.zip)', exImagesS: '{n} picture(s) in the file', exPrint: 'Print or save as PDF', exPrintS: 'Use “Microsoft Print to PDF” to make a PDF',
    saved: 'Saved {f}', copied: 'Table copied. Paste it into Excel or Word.', notSupported: 'This file type is not supported.',
    errTitle: 'This file could not be opened', tryAgain: 'Choose another file',
    'err-not-zip': 'This does not look like a Pages, Numbers or Keynote file.',
    'err-bad-zip': 'The file seems to be damaged or incomplete. Ask the sender to send it again.',
    'err-encrypted': 'This document is protected with a password. Docpeek cannot open password-protected documents yet. Ask the sender to remove the password (File › Set Password) and send it again.',
    'err-no-index': 'The document contents are missing. If you received a folder, use “Open the folder instead”.',
    'err-bad-index': 'The document contents could not be read. Ask the sender to save it again with a current version of Pages, Numbers or Keynote.',
    'err-generic': 'Something went wrong while reading the file.',
    proFree: 'Pro · {n} free', proFreeUsed: 'That was your last free Pro save. Get Pro to keep saving as Word, Excel, PowerPoint and pictures.',
    proTitle: 'Docpeek Pro', proBody: 'Saving as Word, Excel, PowerPoint and the picture zip is part of Docpeek Pro. Viewing, text, CSV and printing stay free.',
    proOnce: 'One payment, no subscription. It stays with your Microsoft account.', proBuy: 'Get Pro', proBuyP: 'Get Pro for {p}', proRestore: 'I already bought Pro',
    proWeb: 'Docpeek Pro is sold in the Microsoft Store app. Install Docpeek from the Store, then get Pro there.', proOpenStore: 'Open in Microsoft Store', proStorePage: 'Store page',
    proLater: 'Not now', proThanks: 'Thank you! Docpeek Pro is ready.', proNone: 'No Pro purchase was found for this Microsoft account.', proFail: 'The purchase did not go through. Nothing was charged.', proOwned: 'Pro',
    tooBig: 'Large file: showing the first {n} rows of each table. Everything is included when you save as Excel.',
  },
  ja: {
    open: '開く', save: '保存', print: '印刷・PDF', choose: 'ファイルを選ぶ', reading: '読み込み中…', privacy: 'プライバシー',
    dropTitle: 'Pages・Numbers・Keynote のファイルを開く', dropSub: '.pages / .numbers / .key のファイルをここにドラッグするか、選んでください。',
    openFolder: 'ファイルがフォルダーになっている場合は、フォルダーを開く',
    p1t: 'PC の外に出ません', p1: 'ファイルはこの PC の中だけで読みます。アップロードもアカウントもありません。',
    p2t: '文字・表・スライド', p2: 'Pages の文書、Numbers のシート（すべての表）、Keynote のスライドとメモ・画像。',
    p3t: 'Office 形式で保存', p3: 'Word・Excel・PowerPoint・CSV・テキストで保存したり、PDF に印刷したりできます。',
    pages: 'Pages', numbers: 'Numbers', keynote: 'Keynote',
    textBoxes: 'テキストボックス', headers: 'ヘッダ・フッタ', footnotes: '脚注', comments: 'コメント', images: '画像', tables: '表',
    firstPage: '1ページ目の画像（ファイルの中に保存されているもの）', noText: 'この書類には文字が見つかりませんでした。',
    slide: 'スライド', skipped: 'スキップ', notes: '発表者メモ', noThumb: 'スライドの画像は保存されていません', slideTables: '個の表があります',
    rows: '行', cols: '列', showMore: 'さらに {n} 行を表示', showing: '{b} 行のうち {a} 行を表示中', copyTable: '表をコピー',
    sheetEmpty: 'このシートにはデータの入った表がありません。',
    legacyNote: 'このファイルは iWork ’09（2009〜2012年ごろ）で作られています。文字だけを表示しています。',
    layoutNote: 'Docpeek は文字・表・画像を表示します。フォントや色、細かいレイアウトは再現しません。',
    exDocx: 'Word 文書（.docx）', exDocxS: '本文を Word で編集できる形で保存', exTxt: 'テキスト（.txt）', exTxtS: '文字だけ',
    exXlsx: 'Excel ブック（.xlsx）', exXlsxS: '表ごとに1枚のシートとして保存', exCsv: '表示中の表を CSV（.csv）', exCsvS: 'Excel で開けます（UTF-8・BOM付き）',
    exPptx: 'PowerPoint（.pptx）', exPptxS: '編集できるスライド：タイトル・箇条書き・画像・表・発表者メモ', exOutline: 'スライドの文字とメモ（.txt）', exOutlineS: 'タイトル・箇条書き・発表者メモ',
    exImages: 'すべての画像（.zip）', exImagesS: 'ファイル内の画像 {n} 枚', exPrint: '印刷または PDF で保存', exPrintS: '「Microsoft Print to PDF」を選ぶと PDF になります',
    saved: '{f} を保存しました', copied: '表をコピーしました。Excel や Word に貼り付けられます。', notSupported: 'この種類のファイルには対応していません。',
    errTitle: 'このファイルは開けませんでした', tryAgain: '別のファイルを選ぶ',
    'err-not-zip': 'Pages・Numbers・Keynote のファイルではないようです。',
    'err-bad-zip': 'ファイルが壊れているか、途中までしかありません。送った人にもう一度送ってもらってください。',
    'err-encrypted': 'パスワードで保護された書類です。Docpeek はまだパスワード付きの書類を開けません。送った人に、パスワードを外して（ファイル › パスワードを設定）送り直してもらってください。',
    'err-no-index': '書類の中身が見つかりません。フォルダーとして受け取った場合は「フォルダーを開く」を使ってください。',
    'err-bad-index': '書類の中身を読み取れませんでした。送った人に、新しい版の Pages・Numbers・Keynote で保存し直してもらってください。',
    'err-generic': 'ファイルの読み込み中に問題が起きました。',
    proFree: 'Pro・あと{n}回無料', proFreeUsed: '無料の Pro 保存はこれで最後です。続けて Word・Excel・PowerPoint・画像で保存するには Pro にしてください。',
    proTitle: 'Docpeek Pro', proBody: 'Word・Excel・PowerPoint・画像まとめでの保存は Docpeek Pro の機能です。表示・テキスト・CSV・印刷は無料のまま使えます。',
    proOnce: '一度の支払いだけで、月額ではありません。Microsoft アカウントにひもづきます。', proBuy: 'Pro にする', proBuyP: '{p} で Pro にする', proRestore: '購入済みの方はこちら',
    proWeb: 'Docpeek Pro は Microsoft Store 版で販売しています。Store から Docpeek を入れて、その中で Pro にしてください。', proOpenStore: 'Microsoft Store で開く', proStorePage: 'Store のページ',
    proLater: 'あとで', proThanks: 'ありがとうございます。Docpeek Pro が使えるようになりました。', proNone: 'この Microsoft アカウントでは Pro の購入が見つかりませんでした。', proFail: '購入は完了しませんでした。料金はかかっていません。', proOwned: 'Pro',
    tooBig: '大きなファイルのため、各表の最初の {n} 行を表示しています。Excel で保存するとすべて入ります。',
  },
};
Object.assign(T, I18N);
const LANG = ((l) => ['ja', 'de', 'fr', 'es', 'pt', 'ko'].includes(l) ? l : 'en')(((navigator.languages && navigator.languages[0]) || navigator.language || 'en').toLowerCase().slice(0, 2));
const nudge = makeNudge({ app: 'Docpeek', storeId: '9MWX5B6B0XPM', key: 'docpeek', lang: LANG, where });
const t = (k, vars) => { let s = (T[LANG][k] ?? T.en[k] ?? k); if (vars) for (const [a, b] of Object.entries(vars)) s = s.replace(`{${a}}`, b); return s; };
document.documentElement.lang = LANG;
for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
for (const el of document.querySelectorAll('[data-i18n-title]')) { el.title = t(el.dataset.i18nTitle); el.setAttribute('aria-label', t(el.dataset.i18nTitle)); }
document.getElementById('ver').textContent = 'v' + VERSION;

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
};
let urls = [];
const urlOf = (img) => { const u = URL.createObjectURL(new Blob([img.bytes], { type: img.mime })); urls.push(u); return u; };
const baseName = (n) => (n || 'document').replace(/\.(pages|numbers|key|zip)$/i, '');
let toastTimer;
function toast(msg) { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 3200); }

async function saveFile(bytes, name, mime, ext) {
  const blob = new Blob([bytes], { type: mime });
  if (window.showSaveFilePicker) {
    try {
      const fh = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: ext.toUpperCase(), accept: { [mime]: ['.' + ext] } }] });
      const w = await fh.createWritable(); await w.write(blob); await w.close();
      toast(t('saved', { f: fh.name })); setTimeout(() => nudge.success(), 3300); return;
    } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(t('saved', { f: name })); setTimeout(() => nudge.success(), 3300);
}

// ---------- state ----------
const state = { doc: null, sheets: [], activeSheet: 0, name: '' };

// ---------- opening ----------
async function openBlob(file) {
  if (!file) return;
  $('busy').hidden = false;
  await new Promise((r) => setTimeout(r, 20));
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    openBytes(bytes, file.name);
  } catch (e) { showError(e); }
  finally { $('busy').hidden = true; }
}
function openBytes(bytes, name) {
  urls.forEach((u) => URL.revokeObjectURL(u)); urls = [];
  const doc = readDocument(bytes, name, { unzip: unzipSync, gunzip: gunzipSync });
  state.doc = doc; state.name = name; state.activeSheet = 0;
  if (doc.kind === 'numbers') state.sheets = doc.pkg.legacy ? readLegacyTables(doc.xml) : readTables(doc.pkg);
  else if (doc.kind === 'pages' && !doc.pkg.legacy) state.sheets = readTables(doc.pkg);
  else state.sheets = [];
  render();
}
async function openFolder(fileList) {
  const list = [...fileList]; if (!list.length) return;
  $('busy').hidden = false;
  await new Promise((r) => setTimeout(r, 20));
  try {
    const files = {};
    const root = list[0].webkitRelativePath.split('/')[0];
    for (const f of list) files[f.webkitRelativePath.split('/').slice(1).join('/')] = new Uint8Array(await f.arrayBuffer());
    openBytes(files, root);
  } catch (e) { showError(e); }
  finally { $('busy').hidden = true; }
}

function showError(e) {
  if (e && e.code) console.warn(e.code, e.message); else console.error(e);
  state.doc = null;
  const code = e && e.code ? 'err-' + e.code : 'err-generic';
  $('empty').hidden = true; $('exportWrap').hidden = true; $('btnPrint').hidden = true; $('docname').hidden = true;
  const v = $('view'); v.hidden = false; v.replaceChildren(
    h('div', { class: 'errorcard' },
      h('h2', { text: t('errTitle') }),
      h('p', { text: T[LANG][code] ? t(code) : t('err-generic') }),
      h('button', { class: 'btn primary', text: t('tryAgain'), onclick: () => $('file').click() })));
}

// ---------- rendering ----------
function render() {
  const d = state.doc;
  $('empty').hidden = true;
  const v = $('view'); v.hidden = false; v.replaceChildren();
  $('docname').hidden = false;
  $('docname').replaceChildren(h('span', { class: 'kind', text: t(d.kind) }), h('b', { text: state.name }));
  document.title = state.name + ' – Docpeek';
  $('exportWrap').hidden = !!window.DOCPEEK_PREVIEW; $('btnPrint').hidden = !!window.DOCPEEK_PREVIEW;
  buildExportMenu();
  if (d.pkg.legacy) v.append(h('p', { class: 'note', text: t('legacyNote') }));
  if (d.kind === 'pages') renderPages(v, d);
  else if (d.kind === 'keynote') renderKeynote(v, d);
  else renderNumbers(v);
  window.scrollTo(0, 0);
}

function gallery(images) {
  return h('div', { class: 'gallery' }, images.map((im) => {
    const u = urlOf(im);
    return h('figure', {}, h('img', { src: u, alt: im.name, loading: 'lazy', onclick: () => lightbox(u) }), h('figcaption', { text: im.name, title: im.name }));
  }));
}
function lightbox(u) { const lb = h('div', { class: 'lightbox', onclick: () => lb.remove() }, h('img', { src: u, alt: '' })); document.body.append(lb); }

function renderPages(v, d) {
  if (d.preview && d.preview.mime.startsWith('image/')) {
    v.append(h('details', { class: 'preview' }, h('summary', { text: t('firstPage') }), h('img', { src: urlOf(d.preview), alt: '' })));
  }
  const paper = h('article', { class: 'paper' });
  const paras = d.paragraphs;
  if (!paras.some((p) => p.trim()) && !d.textBoxes.length) paper.append(h('p', { text: t('noText') }));
  let firstDone = false;
  for (const p of paras) {
    if (!p.trim()) { paper.append(h('p', { class: 'gap' })); continue; }
    const isTitle = !firstDone && p.length < 90 && paras.length > 2;
    firstDone = true;
    paper.append(h('p', { class: isTitle ? 'title' : null, text: p }));
  }
  v.append(paper);
  const wrap = h('div', { class: 'wrapw' });
  const sec = (key, items) => { if (items && items.length) wrap.append(h('h2', { class: 'sec', text: t(key) }), h('div', { class: 'boxes' }, items.map((x) => h('div', { text: x })))); };
  sec('textBoxes', d.textBoxes); sec('headers', d.headers); sec('footnotes', d.footnotes); sec('comments', d.comments);
  const tables = state.sheets.flatMap((s) => s.tables).filter((x) => x.rows.length);
  if (tables.length) { wrap.append(h('h2', { class: 'sec', text: t('tables') })); for (const tb of tables) wrap.append(tableCard(tb)); }
  if (d.images.length) wrap.append(h('h2', { class: 'sec', text: `${t('images')} (${d.images.length})` }), gallery(d.images));
  wrap.append(h('p', { class: 'note', text: t('layoutNote') }));
  v.append(wrap);
}

function renderKeynote(v, d) {
  const list = h('div', { class: 'slides' });
  const caches = new Map();
  for (const s of d.slides) {
    // Keynote keeps only small slide pictures; the first slide also has a large preview.jpg
    const pic = s.index === 1 && d.preview && d.preview.mime.startsWith('image/') ? d.preview : s.thumb;
    const thumb = pic ? h('img', { src: urlOf(pic), alt: `${t('slide')} ${s.index}`, onclick: (e) => lightbox(e.target.src), onload: (e) => { const w = e.target.naturalWidth; if (w && w < 600) e.target.style.maxWidth = Math.max(w * 1.5, 120) + 'px'; } }) : h('div', { class: 'ph', text: t('noThumb') });
    const body = h('div', {});
    if (s.title) body.append(h('h3', { text: s.title }));
    const bullets = s.body.flatMap((b) => b.split('\n')).filter((x) => x.trim());
    if (bullets.length) body.append(h('ul', {}, bullets.map((b) => h('li', { text: b }))));
    if (s.notes) body.append(h('div', { class: 'notes' }, h('b', { text: t('notes') }), s.notes));
    if (s.tableIds && s.tableIds.length && !d.pkg.legacy) {
      const tw = h('div', { class: 'tables' });
      for (const id of s.tableIds) { const tb = tableById(d.pkg, id, caches); if (tb && tb.rows.length) tw.append(tableCard(tb, true)); }
      body.append(tw);
    }
    if (s.images.length) body.append(gallery(s.images));
    if (!s.title && !bullets.length && !s.notes && !s.images.length && !(s.tableIds || []).length) body.append(h('p', { class: 'meta', text: '—' }));
    list.append(h('section', { class: 'slide' + (s.skipped ? ' skipped' : '') },
      h('div', { class: 'thumb' }, thumb, h('span', { class: 'num', text: s.index + (s.skipped ? ' · ' + t('skipped') : '') })), body));
  }
  v.append(list);
  v.append(h('p', { class: 'note', style: 'margin-top:16px', text: t('layoutNote') }));
}

function renderNumbers(v) {
  const sheets = state.sheets;
  if (!sheets.length) { v.append(h('p', { class: 'note', text: t('sheetEmpty') })); return; }
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const panel = h('div', { role: 'tabpanel' });
  sheets.forEach((s, i) => tabs.append(h('button', { class: 'tab', role: 'tab', 'aria-selected': String(i === state.activeSheet), text: s.name || `${i + 1}`, onclick: () => { state.activeSheet = i; renderNumbersPanel(panel); for (const [j, b] of [...tabs.children].entries()) b.setAttribute('aria-selected', String(j === i)); } })));
  v.append(tabs, panel);
  renderNumbersPanel(panel);
}
function renderNumbersPanel(panel) {
  panel.replaceChildren();
  const s = state.sheets[state.activeSheet];
  const tables = s.tables.filter((x) => x.rows.length);
  if (!tables.length) { panel.append(h('p', { class: 'note', text: t('sheetEmpty') })); return; }
  if (tables.some((x) => x.rows.length > ROW_PAGE)) panel.append(h('p', { class: 'note', text: t('tooBig', { n: ROW_PAGE.toLocaleString() }) }));
  for (const tb of tables) panel.append(tableCard(tb));
}

function tableCard(tb, compact = false) {
  const nc = Math.max(0, ...tb.rows.map((r) => r.length));
  const card = h('div', { class: 'tablecard' });
  card.append(h('h3', {}, tb.name || t('tables'), h('small', { text: `${tb.rows.length.toLocaleString()} ${t('rows')} × ${nc} ${t('cols')}` }),
    h('button', { class: 'link', text: t('copyTable'), onclick: () => copyTable(tb) })));
  const table = h('table', { class: 'grid' });
  const head = h('tr', {}, h('th', { class: 'rn' }));
  for (let c = 0; c < nc; c++) head.append(h('th', { text: colLetter(c) }));
  table.append(h('thead', {}, head));
  const tbody = h('tbody'); table.append(tbody);
  let shown = 0;
  const addRows = (n) => {
    const end = Math.min(tb.rows.length, shown + n);
    const frag = document.createDocumentFragment();
    for (let r = shown; r < end; r++) {
      const row = tb.rows[r];
      const tr = h('tr', { class: r < tb.headerRows ? 'h' : null }, h('th', { class: 'rn', text: r + 1 }));
      for (let c = 0; c < nc; c++) {
        const cell = row[c];
        tr.append(h('td', { class: [cell && (cell.t === 'n' || cell.t === 'd' || cell.t === 'dur') ? 'n' : '', c < tb.headerCols && r >= tb.headerRows ? 'hc' : ''].join(' ').trim() || null, text: cell && cell.t === 'b' ? (cell.v ? '\u2611' : '\u2610') : formatCell(cell, LANG === 'ja' ? 'ja-JP' : (navigator.language || 'en-US')) }));
      }
      frag.append(tr);
    }
    tbody.append(frag); shown = end;
    more.hidden = shown >= tb.rows.length;
    more.textContent = t('showMore', { n: Math.min(ROW_PAGE, tb.rows.length - shown).toLocaleString() });
    info.textContent = shown < tb.rows.length ? t('showing', { a: shown.toLocaleString(), b: tb.rows.length.toLocaleString() }) : '';
  };
  const more = h('button', { class: 'btn more', onclick: () => addRows(ROW_PAGE) });
  const info = h('small', { style: 'color:var(--muted);margin-left:10px' });
  card.append(h('div', { class: 'scroller', style: compact ? 'max-height:320px' : null }, table), h('div', {}, more, info));
  addRows(ROW_PAGE);
  return card;
}
const colLetter = (c) => { let s = ''; c++; while (c) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
async function copyTable(tb) {
  const tsv = tb.rows.map((r) => r.map((c) => formatCell(c).replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t')).join('\n');
  try { await navigator.clipboard.writeText(tsv); toast(t('copied')); } catch (e) { toast(t('err-generic')); }
}

// ---------- export ----------

// The first FREE_TRIES Pro saves are free, so people can see what Pro gives before buying.
const FREE_TRIES = 3;
function freeLeft() { try { return Math.max(0, FREE_TRIES - Number(localStorage.getItem('docpeek-pro-tries') || 0)); } catch (e) { return 0; } }
function useFree() { try { localStorage.setItem('docpeek-pro-tries', String(FREE_TRIES - freeLeft() + 1)); } catch (e) {} }
function buildExportMenu() {
  const d = state.doc, m = $('exportMenu'); m.replaceChildren();
  const item = (label, sub, fn, pro = false) => {
    const lock = pro && !hasPro();
    const left = freeLeft();
    const badge = lock ? (left > 0 ? t('proFree', { n: left }) : 'Pro') : null;
    m.append(h('button', { role: 'menuitem', class: lock && !left ? 'locked' : null, onclick: () => {
      closeMenu();
      if (!(pro && !hasPro())) return fn();
      if (freeLeft() > 0) { useFree(); fn(); if (freeLeft() === 0) toast(t('proFreeUsed')); buildExportMenu(); return; }
      showPro(fn);
    } }, h('span', { class: 'mi' }, label, badge ? h('span', { class: 'badge', text: badge }) : null), h('small', { text: sub })));
  };
  const name = baseName(state.name);
  const imgs = d.kind === 'keynote' ? collectKeynoteImages(d) : d.allImages;
  if (d.kind === 'pages') {
    item(t('exDocx'), t('exDocxS'), () => {
      const extra = [{ heading: t('textBoxes'), items: d.textBoxes }, { heading: t('headers'), items: d.headers }, { heading: t('footnotes'), items: d.footnotes }];
      saveFile(makeDocx(zipSync, { title: '', paragraphs: d.paragraphs, extraSections: extra }), name + '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx');
    }, true);
    item(t('exTxt'), t('exTxtS'), () => saveFile(makeTxt(pagesText(d)), name + '.txt', 'text/plain', 'txt'));
    const tables = state.sheets.flatMap((s) => s.tables).filter((x) => x.rows.length);
    if (tables.length) item(t('exXlsx'), t('exXlsxS'), () => saveFile(makeXlsx(zipSync, tables), name + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'), true);
  } else if (d.kind === 'keynote') {
    item(t('exPptx'), t('exPptxS'), () => {
      const caches = new Map();
      const slides = d.slides.map((s) => ({ ...s, tableRows: s.tableIds && !d.pkg.legacy ? s.tableIds.map((id) => tableById(d.pkg, id, caches)).filter((tb) => tb && tb.rows.length).map((tb) => tb.rows.map((r) => r.map((c) => formatCell(c)))) : [] }));
      saveFile(makePptx(zipSync, { slides }, { title: name }), name + '.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx');
    }, true);
    item(t('exOutline'), t('exOutlineS'), () => saveFile(makeTxt(keynoteOutline(d)), name + '.txt', 'text/plain', 'txt'));
    item(t('exDocx'), t('exOutlineS'), () => {
      const paras = []; for (const s of d.slides) { paras.push(`${t('slide')} ${s.index}${s.title ? ': ' + s.title : ''}`); for (const b of s.body) paras.push(b); if (s.notes) paras.push(`[${t('notes')}] ${s.notes}`); paras.push(''); }
      saveFile(makeDocx(zipSync, { title: name, paragraphs: paras }), name + '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx');
    }, true);
  } else {
    const all = state.sheets.flatMap((s) => s.tables.filter((x) => x.rows.length).map((x) => ({ ...x, name: (state.sheets.length > 1 || s.tables.length > 1) && s.name ? `${s.name} - ${x.name}` : (x.name || s.name) })));
    if (all.length) {
      item(t('exXlsx'), t('exXlsxS'), () => saveFile(makeXlsx(zipSync, all), name + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'), true);
      item(t('exCsv'), t('exCsvS'), () => { const s = state.sheets[state.activeSheet]; const tb = s.tables.find((x) => x.rows.length) || all[0]; saveFile(makeCsv(tb.rows), `${name} - ${tb.name || s.name}.csv`.replace(/[\\/:*?"<>|]/g, '_'), 'text/csv', 'csv'); });
    }
  }
  if (imgs.length) item(t('exImages'), t('exImagesS', { n: imgs.length }), () => saveFile(makeImageZip(zipSync, imgs), name + ' images.zip', 'application/zip', 'zip'), true);
  item(t('exPrint'), t('exPrintS'), () => window.print());
}
function collectKeynoteImages(d) {
  const out = [];
  for (const s of d.slides) { if (s.thumb) out.push({ ...s.thumb, name: `slide-${String(s.index).padStart(3, '0')}.${s.thumb.name.split('.').pop()}` }); }
  const seen = new Set(out.map((x) => x.bytes.length + x.name));
  for (const im of d.allImages) if (!seen.has(im.bytes.length + im.name)) out.push(im);
  return out;
}
function closeMenu() { $('exportMenu').hidden = true; $('btnExport').setAttribute('aria-expanded', 'false'); }


// ---------- Pro ----------
function showPro(after) {
  document.querySelector('.modal-back')?.remove();
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const msg = h('p', { class: 'pro-msg', role: 'status' });
  const done = (ok) => { if (ok) { close(); toast(t('proThanks')); updateProMark(); if (state.doc) buildExportMenu(); if (after) after(); } };
  let actions;
  if (where() === 'store') {
    const p = priceText();
    const buy = h('button', { class: 'btn primary big', onclick: async () => {
      buy.disabled = true; msg.textContent = '';
      try { const ok = await buyPro(); if (ok) done(true); else msg.textContent = t('proFail'); } catch (e) { msg.textContent = t('proFail'); }
      buy.disabled = false;
    } }, p ? t('proBuyP', { p }) : t('proBuy'));
    const restore = h('button', { class: 'link', onclick: async () => { const ok = await restorePro(); if (ok) done(true); else msg.textContent = t('proNone'); } }, t('proRestore'));
    actions = [h('div', { class: 'row' }, buy), h('p', { class: 'small' }, restore)];
  } else {
    actions = [h('p', { text: t('proWeb') }), h('div', { class: 'row' },
      h('a', { class: 'btn primary big', href: STORE_APP }, t('proOpenStore')),
      h('a', { class: 'btn big', href: STORE_WEB, target: '_blank', rel: 'noopener' }, t('proStorePage')))];
  }
  const back = h('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) close(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'proTitle' },
      h('h2', { id: 'proTitle', text: t('proTitle') }),
      h('p', { text: t('proBody') }), h('p', { class: 'small', text: t('proOnce') }),
      ...actions, msg,
      h('button', { class: 'btn ghost', onclick: close }, t('proLater'))));
  document.body.append(back);
  document.addEventListener('keydown', onKey);
  back.querySelector('.btn.primary, .btn')?.focus();
}
function updateProMark() { const el = $('proMark'); if (el) el.hidden = !(proLive() && hasPro()); }
initPro().then(() => { updateProMark(); if (state.doc && !window.DOCPEEK_PREVIEW) buildExportMenu(); }).catch(() => {}).finally(() => { if (!window.DOCPEEK_PREVIEW) nudge.webNote(); });
window.__docpeekPro = proTest;

// ---------- events ----------
$('btnOpen').onclick = $('btnOpen2').onclick = () => $('file').click();
$('btnFolder').onclick = () => $('folder').click();
$('file').onchange = (e) => { openBlob(e.target.files[0]); e.target.value = ''; };
$('folder').onchange = (e) => { openFolder(e.target.files); e.target.value = ''; };
$('btnPrint').onclick = () => window.print();
$('btnExport').onclick = (e) => { e.stopPropagation(); const m = $('exportMenu'); m.hidden = !m.hidden; $('btnExport').setAttribute('aria-expanded', String(!m.hidden)); if (!m.hidden) m.querySelector('button')?.focus(); };
document.addEventListener('click', (e) => { if (!$('exportWrap').contains(e.target)) closeMenu(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeMenu(); document.querySelector('.lightbox')?.remove(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); $('file').click(); }
});
$('drop').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file').click(); } });
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; $('drop').classList.add('over'); });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('drop').classList.remove('over'); } });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', async (e) => {
  e.preventDefault(); dragDepth = 0; $('drop').classList.remove('over');
  const item = e.dataTransfer.items && e.dataTransfer.items[0];
  const entry = item && item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
  if (entry && entry.isDirectory) { openFolder(await readDirEntry(entry)); return; }
  openBlob(e.dataTransfer.files[0]);
});
async function readDirEntry(dir) {
  const out = [];
  const walk = async (d, path) => {
    const reader = d.createReader();
    let batch; do { batch = await new Promise((res, rej) => reader.readEntries(res, rej)); for (const en of batch) { if (en.isDirectory) await walk(en, path + en.name + '/'); else { const f = await new Promise((res, rej) => en.file(res, rej)); Object.defineProperty(f, 'webkitRelativePath', { value: path + en.name }); out.push(f); } } } while (batch.length);
  };
  await walk(dir, dir.name + '/');
  return out;
}
// Windows "Open with Docpeek" / double-click (file handlers)
if ('launchQueue' in window) {
  window.launchQueue.setConsumer(async (params) => { if (params.files && params.files.length) openBlob(await params.files[0].getFile()); });
}
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__docpeek = { openBytes, state };
// preview page: open a bundled example so the first view shows what the app does
if (window.DOCPEEK_PREVIEW) {
  for (const b of document.querySelectorAll('[data-sample]')) b.onclick = () => loadSample(b.dataset.sample);
  async function loadSample(f) { $('busy').hidden = false; try { const r = await fetch('samples/' + f); openBytes(new Uint8Array(await r.arrayBuffer()), f); } catch (e) { showError(e); } finally { $('busy').hidden = true; } }
  loadSample('Trip budget.numbers');
}

import { pickOutputFolder, filesFromDrop, filesFromInput } from './vendor/zipout.js';
import { makePro } from './vendor/pro.js';
import { makeNudge } from './vendor/nudge.js';
import { LANG, makeT, $, el, baseName, saveTo, csvBlob, readCsvFile, showPro, withPro, dropZone } from './vendor/appkit.js';

const VERSION = '1.0.0';
const FREE_LIMIT = 1;
const STORE_ID = ''; // set when the Store product is reserved
const pro = makePro({ sku: 'paperlock_pro', storeId: STORE_ID, key: 'paperlock-pro' });

const T = withPro({
  en: {
    drop: 'Drop PDF files here', sub: 'Add or remove a password on this PC. Nothing is uploaded.', chooseFiles: 'Choose PDFs', chooseFolder: 'Choose a folder',
    tag: 'Strong AES-256 encryption, the same as Adobe Acrobat. Your files never leave your PC.', reading: 'Reading… {n} files',
    count: '{n} PDF(s)', stOpen: 'no password', stLocked: 'password', stBad: 'cannot be read', stRestr: 'limits only',
    modeLock: 'Add a password', modeUnlock: 'Remove the password', pwLabel: 'Password to open the PDF', pwAgain: 'Type it again', show: 'Show',
    each: 'Passwords', perSame: 'The same password for all files', perCsv: 'Read a list (CSV: file name, password)', perGen: 'Make a new password for each file and save the list (CSV)',
    limits: 'Limits (when someone opens it with the password)', noPrint: 'Do not allow printing', noCopy: 'Do not allow copying text and images', noEdit: 'Do not allow editing',
    upwLabel: 'Current password', unlockNote: 'Only remove passwords from PDFs that you are allowed to open. You need the current password.',
    csvRead: 'List read: {n} passwords. Files not in the list will be skipped: {m}.', csvNone: '(none)', csvBad: 'The list could not be read. Use two columns: file name, password.',
    freeNote: 'Free version: one PDF at a time. Pro does many PDFs at once.', start: 'Save', startLock: 'Add password and save', startUnlock: 'Remove password and save',
    working: 'Working… {i} of {n}: {name}', done: 'Done', doneText: 'Saved {n} PDF(s).', savedTo: 'They are in the folder you chose.', downloaded: 'They are in your Downloads folder.', listSaved: 'The password list was saved as {f}. Keep it somewhere safe.',
    failed: '{n} PDF(s) were not saved: {names}', again: 'More PDFs', none: 'No PDF files were found.', err: 'Something went wrong: {m}', privacy: 'Privacy',
    ePwEmpty: 'Type a password.', ePwMatch: 'The two passwords are different.', ePwShort: 'Use at least 4 characters.', eWrong: 'wrong password', eBroken: 'the PDF could not be read', eAlready: 'it already has a password (remove it first)', eNoPw: 'it has no password', eNotInList: 'not in the list',
    proTitle: 'Paperlock Pro', proBody: 'Lock or unlock many PDFs at once, give each file its own password (from a list, or made for you), and block printing, copying or editing.',
  },
  ja: {
    drop: 'PDF をここにドラッグ', sub: 'この PC の中でパスワードをかける・外す。アップロードはしません。', chooseFiles: 'PDF を選ぶ', chooseFolder: 'フォルダーを選ぶ',
    tag: 'Adobe Acrobat と同じ強さの AES-256 で暗号化。ファイルは PC の外に出ません。', reading: '読み込み中… {n} 件',
    count: 'PDF {n} 件', stOpen: 'パスワードなし', stLocked: 'パスワードあり', stBad: '読み取れません', stRestr: '制限のみ',
    modeLock: 'パスワードをかける', modeUnlock: 'パスワードを外す', pwLabel: 'PDF を開くときのパスワード', pwAgain: 'もう一度入力', show: '表示',
    each: 'パスワード', perSame: 'すべて同じパスワード', perCsv: '一覧から読み込む（CSV：ファイル名, パスワード）', perGen: 'ファイルごとに新しいパスワードを作り、一覧（CSV）も保存する',
    limits: '制限（パスワードで開いた人に対して）', noPrint: '印刷を禁止する', noCopy: '文字や画像のコピーを禁止する', noEdit: '編集を禁止する',
    upwLabel: '今のパスワード', unlockNote: 'パスワードを外すのは、開くことを許されている PDF だけにしてください。今のパスワードが必要です。',
    csvRead: '一覧を読み込みました：{n} 件。一覧にないファイルは保存しません：{m}', csvNone: '（なし）', csvBad: '一覧を読み取れませんでした。「ファイル名, パスワード」の2列にしてください。',
    freeNote: '無料版では、一度に1つの PDF を処理します。Pro ではまとめて処理できます。', start: '保存', startLock: 'パスワードをかけて保存', startUnlock: 'パスワードを外して保存',
    working: '処理中… {n} 件中 {i} 件：{name}', done: '完了', doneText: 'PDF を {n} 件保存しました。', savedTo: '選んだフォルダーに入っています。', downloaded: 'ダウンロードフォルダーに入っています。', listSaved: 'パスワードの一覧を {f} として保存しました。安全な場所に保管してください。',
    failed: '保存しなかった PDF {n} 件：{names}', again: 'ほかの PDF も', none: 'PDF が見つかりませんでした。', err: '問題が起きました：{m}', privacy: 'プライバシー',
    ePwEmpty: 'パスワードを入力してください。', ePwMatch: '2つのパスワードが違います。', ePwShort: '4文字以上にしてください。', eWrong: 'パスワードが違います', eBroken: 'PDF を読み取れません', eAlready: 'すでにパスワードがかかっています（先に外してください）', eNoPw: 'パスワードはかかっていません', eNotInList: '一覧にありません',
    proTitle: 'Paperlock Pro', proBody: 'たくさんの PDF にまとめてパスワードをかける・外す、ファイルごとに別のパスワード（一覧から読み込む・自動で作る）、印刷・コピー・編集の禁止ができます。',
  },
}, 'Paperlock');
const t = makeT(T);
const nudge = makeNudge({ app: 'Paperlock', storeId: STORE_ID, key: 'paperlock', lang: LANG, where: () => pro.where(), listed: false });
$('ver').textContent = 'v' + VERSION;

// ---------- qpdf worker ----------
let worker = null, jobId = 0;
function job(msg, transfer = []) {
  worker ||= new Worker('src/qpdf-worker.js');
  const id = ++jobId;
  return new Promise((res) => {
    const on = (e) => { if (e.data.id !== id) return; worker.removeEventListener('message', on); res(e.data); };
    worker.addEventListener('message', on);
    worker.postMessage({ id, ...msg }, transfer);
  });
}

let items = [], list = null; // list: Map(lowercase base name -> password)
function show(id) { for (const s of ['start', 'busy', 'report', 'finish']) $(s).hidden = s !== id; }
function busy(m) { show('busy'); $('busyText').textContent = m; }
function alertBox(m) { $('msg').textContent = m; $('msg').hidden = !m; }
const mode = () => document.querySelector('input[name=mode]:checked').value;
const per = () => document.querySelector('input[name=per]:checked').value;

async function scan(src) {
  alertBox(''); items = []; let n = 0;
  for (const s of src) {
    const name = s.path.split('/').pop();
    if (!/\.pdf$/i.test(name) || name.startsWith('.')) continue;
    if (++n % 5 === 0) busy(t('reading', { n }));
    const r = await job({ op: 'check', data: await s.file.arrayBuffer() });
    items.push({ file: s.file, path: s.path, name, enc: r.ok && r.enc, needs: r.ok && r.needs, bad: !r.ok });
  }
  if (!items.length) { show('start'); alertBox(t('none')); return; }
  const locked = items.filter((i) => i.needs).length;
  document.querySelector(`input[name=mode][value=${locked > items.length / 2 ? 'unlock' : 'lock'}]`).checked = true;
  render();
}

function render() {
  show('report');
  $('countTitle').textContent = t('count', { n: items.length });
  $('files').replaceChildren(...items.map((i) => el('li', { class: i.needs ? 'lock' : '' }, el('span', { text: i.path }), el('span', { text: i.bad ? t('stBad') : i.needs ? t('stLocked') : i.enc ? t('stRestr') : t('stOpen') }))));
  const m = mode();
  $('lockOpts').hidden = m !== 'lock'; $('unlockOpts').hidden = m !== 'unlock';
  $('samePw').hidden = m === 'lock' && per() !== 'same';
  $('startBtn').textContent = m === 'lock' ? t('startLock') : t('startUnlock');
  $('freeNote').textContent = t('freeNote');
  $('freeNote').hidden = !(pro.live() && !pro.has() && items.length > FREE_LIMIT);
  for (const b of document.querySelectorAll('.pro-only')) b.hidden = !pro.live() || pro.has();
  if (m === 'lock' && per() === 'csv' && list) {
    const miss = items.filter((i) => !list.has(baseName(i.name).toLowerCase())).map((i) => i.name);
    $('csvNote').hidden = false; $('csvNote').textContent = t('csvRead', { n: list.size, m: miss.length ? miss.join(', ') : t('csvNone') });
  } else $('csvNote').hidden = true;
}

const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
function genPw(n = 10) { const a = crypto.getRandomValues(new Uint32Array(n)); return Array.from(a, (x) => ALPH[x % ALPH.length]).join(''); }

function needsPro() {
  if (!pro.live() || pro.has()) return false;
  return mode() === 'lock' && (per() !== 'same' || $('noPrint').checked || $('noCopy').checked || $('noEdit').checked);
}

async function run() {
  alertBox('');
  if (needsPro()) { showPro(pro, t, render); return; }
  const m = mode();
  let samePw = '';
  if (m === 'lock' && per() === 'same') {
    samePw = $('pw1').value;
    if (!samePw) return alertBox(t('ePwEmpty'));
    if (samePw !== $('pw2').value) return alertBox(t('ePwMatch'));
    if (samePw.length < 4) return alertBox(t('ePwShort'));
  }
  if (m === 'lock' && per() === 'csv' && !list) { $('csvIn').click(); return; }
  if (m === 'unlock' && !$('upw').value) return alertBox(t('ePwEmpty'));
  let dir = null; try { dir = await pickOutputFolder(); } catch (e) { return; }
  const todo = pro.has() ? items : items.slice(0, FREE_LIMIT);
  const restrict = { print: $('noPrint').checked, copy: $('noCopy').checked, modify: $('noEdit').checked };
  const used = new Set(), failed = [], made = [LANG === 'ja' ? ['ファイル', 'パスワード'] : ['File', 'Password']]; let saved = 0;
  for (let i = 0; i < todo.length; i++) {
    const it = todo[i];
    busy(t('working', { i: i + 1, n: todo.length, name: it.name })); $('bar').hidden = false; $('bar').value = i / todo.length;
    try {
      if (it.bad) throw new Error(t('eBroken'));
      let r;
      if (m === 'lock') {
        if (it.enc) throw new Error(t('eAlready'));
        let pw = samePw;
        if (per() === 'csv') { pw = list.get(baseName(it.name).toLowerCase()); if (!pw) throw new Error(t('eNotInList')); }
        if (per() === 'gen') { pw = genPw(); }
        r = await job({ op: 'lock', data: await it.file.arrayBuffer(), user: pw, owner: genPw(24), restrict });
        if (r.ok && per() === 'gen') made.push([it.name, pw]);
      } else {
        if (!it.enc) throw new Error(t('eNoPw'));
        r = await job({ op: 'unlock', data: await it.file.arrayBuffer(), password: $('upw').value });
      }
      if (!r.ok) throw new Error(r.reason === 'password' ? t('eWrong') : t('eBroken'));
      await saveTo(dir, it.name, new Blob([r.data], { type: 'application/pdf' }), used);
      saved++;
    } catch (e) { failed.push(`${it.name} (${e.message})`); }
  }
  let listName = '';
  if (made.length > 1) listName = await saveTo(dir, LANG === 'ja' ? 'パスワード一覧.csv' : 'passwords.csv', csvBlob(made), used);
  $('bar').hidden = true;
  show('finish');
  if (saved) nudge.success();
  const parts = [t('doneText', { n: saved }), dir ? t('savedTo') : t('downloaded')];
  if (listName) parts.push(t('listSaved', { f: listName }));
  $('doneText').textContent = parts.join(' ');
  $('failText').hidden = !failed.length; $('failText').textContent = t('failed', { n: failed.length, names: failed.join(', ') });
  $('freeDone').hidden = todo.length === items.length; $('freeBtn').hidden = $('freeDone').hidden; $('freeDone').textContent = t('freeNote');
}

// ---------- events ----------
async function go(src) { if (!src.length) return; busy(t('reading', { n: 0 })); try { await scan(src); } catch (e) { show('start'); alertBox(t('err', { m: e.message || String(e) })); } }
$('fileBtn').onclick = () => $('fileIn').click();
$('dirBtn').onclick = () => $('dirIn').click();
$('fileIn').onchange = (e) => { go(filesFromInput(e.target.files)); e.target.value = ''; };
$('dirIn').onchange = (e) => { go(filesFromInput(e.target.files)); e.target.value = ''; };
$('csvIn').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const rows = await readCsvFile(f); const m = new Map();
    for (const r of rows) { const k = baseName((r[0] || '').trim()).toLowerCase(), v = (r[1] || '').trim(); if (k && v && !/^(file|ファイル)/i.test(k)) m.set(k, v); }
    if (!m.size) throw new Error();
    list = m; alertBox(''); render();
  } catch (err) { list = null; alertBox(t('csvBad')); render(); }
};
for (const r of document.querySelectorAll('input[name=mode],input[name=per]')) r.addEventListener('change', () => { if (per() === 'csv' && mode() === 'lock' && !list) $('csvIn').click(); render(); });
for (const c of ['noPrint', 'noCopy', 'noEdit']) $(c).addEventListener('change', (e) => { if (e.target.checked && pro.live() && !pro.has()) { e.target.checked = false; showPro(pro, t, () => { e.target.checked = true; render(); }); } });
for (const r of document.querySelectorAll('input[name=per]')) r.addEventListener('change', (e) => { if (e.target.value !== 'same' && pro.live() && !pro.has()) { document.querySelector('input[name=per][value=same]').checked = true; showPro(pro, t, render); render(); } });
$('pwShow').onchange = (e) => { $('pw1').type = $('pw2').type = e.target.checked ? 'text' : 'password'; };
$('upwShow').onchange = (e) => { $('upw').type = e.target.checked ? 'text' : 'password'; };
$('startBtn').onclick = run;
$('freeBtn').onclick = () => showPro(pro, t);
$('againBtn').onclick = () => { items = []; list = null; for (const id of ['pw1', 'pw2', 'upw']) $(id).value = ''; show('start'); };
dropZone(go, filesFromDrop);
Promise.resolve(pro.init()).catch(() => {}).finally(() => nudge.webNote());
window.__app = { go, get items() { return items; }, run, pro };
show('start');

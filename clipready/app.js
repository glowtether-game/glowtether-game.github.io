import { pickOutputFolder, filesFromDrop, filesFromInput } from './vendor/zipout.js';
import { makePro } from './vendor/pro.js';
import { makeNudge } from './vendor/nudge.js';
import { inspect, remux, audioOnly } from './src/remux.js';
import I18N from './i18n.js';

const VERSION = '1.2.1';
const FREE_LIMIT = 3;
const pro = makePro({ sku: 'clipready_pro', storeId: '9PPC4KF7HLQL', key: 'clipready-pro' });

const T = {
  en: {
    drop: 'Drop iPhone videos (MOV), MP4 videos or voice memos (M4A) here', sub: 'Converted on this PC. Nothing is uploaded.', chooseFiles: 'Choose files', chooseFolder: 'Choose a folder',
    tag: 'MOV to MP4 with no quality loss, in seconds. Voice memos and the sound of videos to MP3.', scanning: 'Reading… {n} files',
    report: 'What we found', rMov: 'Videos (MOV → MP4, no quality loss)', rHevc: 'of them HEVC (stays HEVC)', rAudio: 'Voice memos and audio (→ MP3)', rMp4: 'MP4 videos (sound → MP3)', rSkip: 'Other files (left out)',
    hevcNote: 'HEVC videos stay HEVC inside the MP4, so nothing is lost. Websites and most editors accept them. To play them in Windows, the "HEVC Video Extensions" may be needed.',
    spatialNote: 'Some videos have spatial audio. The normal stereo track is kept.',
    optMp3: 'MP3 quality', kbps64: '64 kbps (speech, small)', kbps128: '128 kbps (standard)', kbps192: '192 kbps (music)', optDate: 'Start MP3 file names with the recording date', optGeo: 'Remove location from the videos', optSound: 'Save only the sound of the MOV videos, as MP3',
    freeNote: 'Free version: converts up to {n} files at a time. Pro converts any number at once.',
    start: 'Convert and save', working: 'Working… {i} of {n}: {name}', done: 'Done', doneText: 'Saved {n} file(s).', savedTo: 'They are in the folder you chose.', downloaded: 'They are in your Downloads folder.', keptDate: 'Videos keep the date they were recorded inside the file.',
    failed: '{n} file(s) could not be converted: {names}', again: 'Convert more', none: 'No MOV videos or voice memos were found.', err: 'Something went wrong: {m}', privacy: 'Privacy',
    eFrag: 'this video format is not supported', eNoVideo: 'no video track', eAudio: 'this audio could not be read on this PC', eAlac: 'Apple Lossless (ALAC) recordings are not supported yet', eNoAudio: 'this video has no sound',
    proTitle: 'Clipready Pro', proBody: 'Convert any number of videos and voice memos at once, and remove location from videos.', proOnce: 'One payment, no subscription. It stays with your Microsoft account.', proBuy: 'Get Pro', proBuyP: 'Get Pro for {p}', proRestore: 'I already bought Pro', proWeb: 'Clipready Pro is sold in the Microsoft Store app. Install Clipready from the Store, then get Pro there.', proOpenStore: 'Open in Microsoft Store', proLater: 'Not now', proThanks: 'Thank you! Clipready Pro is ready.', proFail: 'The purchase did not go through. Nothing was charged.', proNone: 'No Pro purchase was found for this Microsoft account.',
  },
  ja: {
    drop: 'iPhone の動画（MOV）・MP4 の動画・ボイスメモ（M4A）をここにドラッグ', sub: 'この PC の中で変換します。アップロードはしません。', chooseFiles: 'ファイルを選ぶ', chooseFolder: 'フォルダーを選ぶ',
    tag: 'MOV を MP4 に、画質そのまま数秒で。ボイスメモや動画の音声は MP3 に。', scanning: '読み込み中… {n} 件',
    report: '見つかったもの', rMov: '動画（MOV → MP4、画質そのまま）', rHevc: 'うち HEVC（HEVC のまま）', rAudio: 'ボイスメモ・音声（→ MP3）', rMp4: 'MP4 の動画（音声 → MP3）', rSkip: 'そのほかのファイル（対象外）',
    hevcNote: 'HEVC の動画は、MP4 の中でも HEVC のままなので劣化しません。Web サイトや多くの編集ソフトはそのまま受け付けます。Windows で再生するには「HEVC ビデオ拡張機能」が要ることがあります。',
    spatialNote: '空間オーディオ付きの動画があります。ふつうのステレオ音声を残します。',
    optMp3: 'MP3 の音質', kbps64: '64 kbps（会話向け・小さい）', kbps128: '128 kbps（標準）', kbps192: '192 kbps（音楽向け）', optDate: 'MP3 のファイル名の先頭に録音日を付ける', optGeo: '動画から位置情報を消す', optSound: 'MOV の動画は、音声だけを MP3 で保存する',
    freeNote: '無料版では、一度に {n} 件まで変換します。Pro では件数の制限なしで一度に変換できます。',
    start: '変換して保存', working: '処理中… {n} 件中 {i} 件：{name}', done: '完了', doneText: '{n} 件を保存しました。', savedTo: '選んだフォルダーに入っています。', downloaded: 'ダウンロードフォルダーに入っています。', keptDate: '動画の中の撮影日はそのまま残ります。',
    failed: '変換できなかったファイル {n} 件：{names}', again: 'ほかのファイルも変換', none: 'MOV の動画やボイスメモが見つかりませんでした。', err: '問題が起きました：{m}', privacy: 'プライバシー',
    eFrag: 'この形式の動画には対応していません', eNoVideo: '映像が入っていません', eAudio: 'この PC では読み取れない音声です', eAlac: 'Apple ロスレス（ALAC）の録音にはまだ対応していません', eNoAudio: 'この動画には音声が入っていません',
    proTitle: 'Clipready Pro', proBody: '件数の制限なしで動画とボイスメモを一度に変換でき、動画から位置情報を消せます。', proOnce: '一度の支払いだけで、月額ではありません。Microsoft アカウントにひもづきます。', proBuy: 'Pro にする', proBuyP: '{p} で Pro にする', proRestore: '購入済みの方はこちら', proWeb: 'Clipready Pro は Microsoft Store 版で販売しています。Store から Clipready を入れて、その中で Pro にしてください。', proOpenStore: 'Microsoft Store で開く', proLater: 'あとで', proThanks: 'ありがとうございます。Clipready Pro が使えるようになりました。', proFail: '購入は完了しませんでした。料金はかかっていません。', proNone: 'この Microsoft アカウントでは Pro の購入が見つかりませんでした。',
  },
};
Object.assign(T, I18N);
const LANG = ((l) => ['ja', 'de', 'fr', 'es', 'pt', 'ko'].includes(l) ? l : 'en')(((navigator.languages && navigator.languages[0]) || navigator.language || 'en').toLowerCase().slice(0, 2));
const nudge = makeNudge({ app: 'Clipready', storeId: '9PPC4KF7HLQL', key: 'clipready', lang: LANG, where: () => pro.where(), listed: true });
const t = (k, v) => { let s = T[LANG][k] ?? T.en[k] ?? k; if (v) for (const [a, b] of Object.entries(v)) s = s.replaceAll(`{${a}}`, b); return s; };
document.documentElement.lang = LANG;
for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
const $ = (id) => document.getElementById(id);
$('ver').textContent = 'v' + VERSION;

const VIDEO = /\.(mov|qt)$/i, MP4 = /\.(mp4|m4v)$/i, AUDIO = /\.(m4a|qta|aac|caf|wav|aif|aiff)$/i;
let items = [], skipped = 0;

function show(id) { for (const s of ['start', 'busy', 'report', 'finish']) $(s).hidden = s !== id; }
function busy(msg) { show('busy'); $('busyText').textContent = msg; }
function alertBox(msg) { $('msg').textContent = msg; $('msg').hidden = !msg; }
const baseName = (p) => p.split('/').pop().replace(/\.[^.]+$/, '');
const day = (d) => { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

async function scan(list) {
  alertBox('');
  items = []; skipped = 0; let n = 0;
  for (const s of list) {
    const name = s.path.split('/').pop();
    if (name.startsWith('.')) continue;
    const kind = VIDEO.test(name) ? 'video' : MP4.test(name) ? 'mp4' : AUDIO.test(name) ? 'audio' : null;
    if (!kind) { skipped++; continue; }
    if (++n % 10 === 0) busy(t('scanning', { n }));
    const it = { file: s.file, path: s.path, kind, info: null, date: null, err: null };
    if (/\.(mov|qt|m4a|qta|mp4|m4v)$/i.test(name)) { try { it.info = await inspect(s.file); it.date = it.info.date; if (kind === 'mp4' && !it.info.audio.length) it.err = t('eNoAudio'); } catch (e) { if (kind !== 'audio') it.err = t('eFrag'); } }
    if (!it.date && s.file.lastModified) it.date = new Date(s.file.lastModified);
    items.push(it);
  }
  if (!items.length) { show('start'); alertBox(t('none')); return; }
  renderReport();
}

function renderReport() {
  show('report');
  const v = items.filter((i) => i.kind === 'video'), a = items.filter((i) => i.kind === 'audio'), m = items.filter((i) => i.kind === 'mp4');
  const hevc = v.filter((i) => i.info?.hevc).length, spatial = v.some((i) => i.info?.spatial);
  const rows = [[t('rMov'), v.length], [t('rHevc'), hevc], [t('rMp4'), m.length], [t('rAudio'), a.length]].filter(([, n], i) => n || i === 0 || i === 3);
  if (skipped) rows.push([t('rSkip'), skipped]);
  $('stats').replaceChildren(...rows.map(([k, n]) => { const li = document.createElement('li'); const b = document.createElement('b'); b.textContent = n.toLocaleString(); const s = document.createElement('span'); s.textContent = k; li.append(b, s); return li; }));
  $('hevcNote').hidden = !hevc; $('hevcNote').textContent = t('hevcNote');
  $('spatialNote').hidden = !spatial; $('spatialNote').textContent = t('spatialNote');
  $('audioOpts').hidden = !(a.length || m.length || v.length); $('videoOpts').hidden = !v.length;
  $('freeNote').hidden = !(pro.live() && !pro.has() && items.length > FREE_LIMIT);
  $('freeNote').textContent = t('freeNote', { n: FREE_LIMIT });
  $('optGeoBadge').hidden = !pro.live() || pro.has();
}

// ---------- audio ----------
let worker = null, jobId = 0;
function encodeMp3(channels, sampleRate, kbps, tags) {
  worker ||= new Worker('src/mp3worker.js');
  const id = ++jobId;
  return new Promise((res, rej) => {
    const on = (e) => { if (e.data.id !== id) return; if (e.data.blob) { worker.removeEventListener('message', on); res(e.data.blob); } else if (e.data.error) { worker.removeEventListener('message', on); rej(new Error(e.data.error)); } };
    worker.addEventListener('message', on);
    worker.postMessage({ id, channels, sampleRate, kbps, tags }, channels.map((c) => c.buffer));
  });
}
async function toMp3(it, kbps) {
  const ctx = new OfflineAudioContext(1, 1, 44100); // decoded audio comes out at 44.1 kHz
  let buf = null, chans = [], rate = 44100;
  const src = it.kind === 'audio' ? it.file : await audioOnly(it.file, it.info);
  try { buf = await ctx.decodeAudioData(await src.arrayBuffer()); } catch (e) {
    if (!it.info?.audio?.includes('alac')) throw new Error(t('eAudio'));
  }
  if (buf) { for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) chans.push(buf.getChannelData(c).slice()); rate = buf.sampleRate; }
  else { // Apple Lossless: browsers on Windows can't decode it, so use our own decoder
    const { decodeAlac } = await import('./src/alac.js');
    let r; try { r = await decodeAlac(it.file, it.info); } catch (e) { throw new Error(t('eAudio')); }
    chans = r.channels.slice(0, 2); rate = r.sampleRate;
    if (![8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000].includes(rate)) { // resample to 44.1 kHz for MP3
      const n = Math.ceil(chans[0].length * 44100 / rate), oc = new OfflineAudioContext(chans.length, n, 44100);
      const ab = oc.createBuffer(chans.length, chans[0].length, rate); chans.forEach((c, i) => ab.copyToChannel(c, i));
      const s = oc.createBufferSource(); s.buffer = ab; s.connect(oc.destination); s.start();
      const rb = await oc.startRendering(); chans = []; for (let c = 0; c < rb.numberOfChannels; c++) chans.push(rb.getChannelData(c).slice()); rate = 44100;
    }
  }
  if (chans.length === 2) { // a voice memo is often two identical channels: keep one
    let same = true; const A = chans[0], B = chans[1]; for (let i = 0; i < A.length; i += 97) if (Math.abs(A[i] - B[i]) > 1e-4) { same = false; break; }
    if (same) chans.pop();
  }
  return encodeMp3(chans, rate, kbps, { title: baseName(it.path), year: it.date ? String(it.date.getFullYear()) : '' });
}

// ---------- saving ----------
async function saveTo(dir, name, blob, used) {
  const ext = (name.match(/\.[^.]+$/) || [''])[0], st = name.slice(0, name.length - ext.length);
  let n = name, k = 2;
  const taken = async (x) => { if (used.has(x.toLowerCase())) return true; if (!dir) return false; try { await dir.getFileHandle(x); return true; } catch (e) { return false; } };
  while (await taken(n)) n = `${st} (${k++})${ext}`;
  used.add(n.toLowerCase());
  if (dir) { const fh = await dir.getFileHandle(n, { create: true }); const ws = await fh.createWritable(); await ws.write(blob); await ws.close(); }
  else { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = n; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 120000); }
  return n;
}

async function run() {
  const o = { kbps: Number($('kbps').value), date: $('optDate').checked, geo: $('optGeo').checked, sound: $('optSound').checked };
  if (o.geo && !pro.has()) { showPro(() => run()); return; }
  let dir = null; try { dir = await pickOutputFolder(); } catch (e) { return; }
  const todo = pro.has() ? items : items.slice(0, FREE_LIMIT);
  const used = new Set(); let saved = 0; const failed = [];
  $('bar').hidden = false;
  try {
    for (let i = 0; i < todo.length; i++) {
      const it = todo[i]; const name = it.path.split('/').pop();
      busy(t('working', { i: i + 1, n: todo.length, name })); $('bar').hidden = false; $('bar').value = i / todo.length;
      try {
        if (it.err) throw new Error(it.err);
        if (it.kind === 'video' && !o.sound) {
          const blob = await remux(it.file, await inspect(it.file), { dropLocation: o.geo });
          await saveTo(dir, baseName(it.path) + '.mp4', blob, used);
        } else {
          const blob = await toMp3(it, o.kbps);
          let b = baseName(it.path);
          if (o.date && it.date && !/^\d{4}-?\d{2}-?\d{2}/.test(b)) b = day(it.date) + ' ' + b;
          await saveTo(dir, b + '.mp3', blob, used);
        }
        saved++;
      } catch (e) { console.warn(it.path, e); failed.push(`${name} (${e.message})`); }
    }
    show('finish');
    if (saved) nudge.success();
    const parts = [t('doneText', { n: saved }), dir ? t('savedTo') : t('downloaded')];
    if (!o.sound && todo.some((i) => i.kind === 'video')) parts.push(t('keptDate'));
    $('doneText').textContent = parts.join(' ');
    $('failText').hidden = !failed.length; $('failText').textContent = t('failed', { n: failed.length, names: failed.join(', ') });
    $('freeDone').hidden = todo.length === items.length; $('freeBtn').hidden = $('freeDone').hidden; $('freeDone').textContent = t('freeNote', { n: FREE_LIMIT });
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
$('freeBtn').onclick = () => showPro();
$('againBtn').onclick = () => { items = []; show('start'); };
$('optGeo').addEventListener('change', (e) => { if (e.target.checked && !pro.has()) { e.target.checked = false; showPro(() => { e.target.checked = true; }); } });
const dz = $('drop');
window.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) dz.classList.remove('over'); });
window.addEventListener('drop', async (e) => { e.preventDefault(); dz.classList.remove('over'); go(await filesFromDrop(e.dataTransfer)); });
if ('launchQueue' in window) window.launchQueue.setConsumer(async (p) => { if (p.files?.length) go(await Promise.all(p.files.map(async (h) => ({ file: await h.getFile(), path: h.name })))); });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
Promise.resolve(pro.init()).catch(() => {}).finally(() => nudge.webNote());
window.__clipready = { go, get items() { return items; }, run, pro };
show('start');

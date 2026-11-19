import { pickOutputFolder, filesFromDrop, ZipOut } from './vendor/zipout.js';
import { makePro } from './vendor/pro.js';
import { makeNudge } from './vendor/nudge.js';
import { showMore } from './vendor/more.js';
import { LANG, makeT, $, el, safeName, saveTo, csvBlob, showPro, withPro, dropZone } from './vendor/appkit.js';
import { indexMbox, rawMessage, summary, parseMessage, nameOf } from './src/mbox.js';
import I18N from './i18n.js';

const VERSION = '1.0.3';
const STORE_ID = '9NLGX2T41Q8Z';
const PAGE = 300;
const pro = makePro({ sku: 'mailpeek_pro', storeId: STORE_ID, key: 'mailpeek-pro' });

const T = withPro({
  en: {
    drop: 'Drop an .mbox mail file here', sub: 'Read and search your mail on this PC. Nothing is uploaded.', chooseFile: 'Choose an .mbox file',
    hint: 'From Google Takeout (Gmail), Apple Mail (Export Mailbox), Thunderbird and others. Unzip a Takeout download first.',
    tag: 'Opens files of several GB. Pictures from the internet are never loaded, so senders can\'t tell you opened a mail.',
    finding: 'Finding the messages… {p}%', reading: 'Reading the headers… {i} of {n}', searching: 'Searching the text… {i} of {n}',
    search: 'Search sender, subject…', allLabels: 'All labels', inBody: 'Search the text too', count: '{n} of {t} messages', more: 'Show more',
    selAll: 'Select all shown', expEml: 'Save as .eml', expCsv: 'List as CSV', expAtt: 'Save attachments', pick: 'Choose a message on the left.',
    from: 'From', to: 'To', cc: 'Cc', date: 'Date', noSubject: '(no subject)', saveEml: 'Save this mail (.eml)', print: 'Print or save as PDF', blocked: 'Pictures from the internet are not shown.',
    none: 'No messages were found in this file. Is it an .mbox file?', zipNote: 'This is a ZIP file. Unzip it first (right-click › Extract All), then open the .mbox file inside.', err: 'Something went wrong: {m}', privacy: 'Privacy',
    nothingSel: 'Select messages first (tick the boxes, or "Select all shown").', saving: 'Saving… {i} of {n}', saved: 'Saved {n} file(s).', savedAtt: 'Saved {n} attachment(s) from {m} message(s).',
    proTitle: 'Mailpeek Pro', proBody: 'Search the text of every mail, and save many mails at once: as .eml files, as a CSV list for Excel, or all their attachments in one go.',
  },
  ja: {
    drop: 'メールのファイル（.mbox）をここにドラッグ', sub: 'この PC の中でメールを読む・探す。アップロードはしません。', chooseFile: '.mbox ファイルを選ぶ',
    hint: 'Google Takeout（Gmail）、Apple のメール（メールボックスを書き出す）、Thunderbird などのファイルに対応。Takeout の zip は先に展開してください。',
    tag: '数 GB のファイルも開けます。インターネット上の画像は読み込まないので、開いたことが送り主に伝わりません。',
    finding: 'メールを探しています… {p}%', reading: '見出しを読み込み中… {n} 件中 {i} 件', searching: '本文を検索中… {n} 件中 {i} 件',
    search: '差出人・件名で検索…', allLabels: 'すべてのラベル', inBody: '本文も検索する', count: '{t} 件中 {n} 件', more: 'もっと表示',
    selAll: '表示中をすべて選ぶ', expEml: '.eml で保存', expCsv: '一覧を CSV で', expAtt: '添付をまとめて保存', pick: '左の一覧からメールを選んでください。',
    from: '差出人', to: '宛先', cc: 'Cc', date: '日時', noSubject: '（件名なし）', saveEml: 'このメールを保存（.eml）', print: '印刷・PDF で保存', blocked: 'インターネット上の画像は表示していません。',
    none: 'このファイルにメールが見つかりませんでした。.mbox ファイルでしょうか。', zipNote: 'これは ZIP ファイルです。先に展開（右クリック › すべて展開）してから、中の .mbox ファイルを開いてください。', err: '問題が起きました：{m}', privacy: 'プライバシー',
    nothingSel: '先にメールを選んでください（チェックを入れるか「表示中をすべて選ぶ」）。', saving: '保存中… {n} 件中 {i} 件', saved: '{n} 件のファイルを保存しました。', savedAtt: '{m} 件のメールから添付を {n} 件保存しました。',
    proTitle: 'Mailpeek Pro', proBody: 'すべてのメールの本文を検索できます。たくさんのメールをまとめて保存できます：.eml ファイル、Excel で開ける CSV の一覧、添付ファイルを一度に。',
  },
}, 'Mailpeek');
Object.assign(T, I18N); withPro(T, 'Mailpeek');
const t = makeT(T);
const nudge = makeNudge({ app: 'Mailpeek', storeId: STORE_ID, key: 'mailpeek', lang: LANG, where: () => pro.where(), listed: false });
$('ver').textContent = 'v' + VERSION;

let file = null, starts = [], sums = [], shown = [], limit = PAGE, current = -1, bodyHits = null;
const sel = new Set();
const fmt = new Intl.DateTimeFormat(LANG === 'ja' ? 'ja-JP' : undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const fmtFull = new Intl.DateTimeFormat(LANG === 'ja' ? 'ja-JP' : undefined, { dateStyle: 'medium', timeStyle: 'short' });

function show(id) { $('start').hidden = id !== 'start'; $('busy').hidden = id !== 'busy'; $('viewer').hidden = id !== 'viewer'; $('main').hidden = id === 'viewer'; $('foot').hidden = id === 'viewer'; }
function busy(m, p) { show('busy'); $('busyText').textContent = m; $('bar').value = p || 0; }
function alertBox(m) { $('msg').textContent = m; $('msg').hidden = !m; }

async function open(f) {
  alertBox('');
  if (/\.zip$/i.test(f.name)) { alertBox(t('zipNote')); return; }
  file = f; sums = []; sel.clear(); current = -1; bodyHits = null;
  busy(t('finding', { p: 0 }));
  starts = await indexMbox(f, (p) => busy(t('finding', { p: Math.round(p * 100) }), p));
  if (!starts.length) { show('start'); alertBox(t('none')); return; }
  for (let i = 0; i < starts.length; i++) {
    sums.push(await summary(file, starts, i));
    if (i % 200 === 0) { busy(t('reading', { i, n: starts.length }), i / starts.length); await new Promise((r) => setTimeout(r, 0)); }
  }
  // labels (Gmail)
  const labels = new Map(); for (const s of sums) for (const l of s.labels) labels.set(l, (labels.get(l) || 0) + 1);
  $('label').replaceChildren(el('option', { value: '' }, t('allLabels')), ...[...labels].sort((a, b) => b[1] - a[1]).map(([l, n]) => el('option', { value: l }, `${l} (${n})`)));
  $('label').hidden = !labels.size;
  $('docname').textContent = f.name;
  show('viewer');
  for (const b of document.querySelectorAll('.pro-only')) b.hidden = !pro.live() || pro.has();
  filter();
  nudge.success();
}

function filter() {
  const q = $('q').value.trim().toLowerCase(), lab = $('label').value;
  shown = sums.filter((s) => (!lab || s.labels.includes(lab)) && (!q || (bodyHits ? bodyHits.has(s.i) : (s.from + ' ' + s.to + ' ' + s.subject).toLowerCase().includes(q))));
  shown.sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0));
  limit = PAGE;
  drawList();
}

function drawList() {
  $('count').textContent = t('count', { n: shown.length.toLocaleString(), t: sums.length.toLocaleString() });
  const rows = shown.slice(0, limit).map((s) => {
    const cb = el('input', { type: 'checkbox', 'aria-label': s.subject || t('noSubject'), onclick: (e) => { e.stopPropagation(); e.target.checked ? sel.add(s.i) : sel.delete(s.i); } });
    cb.checked = sel.has(s.i);
    return el('li', { class: s.i === current ? 'on' : '', onclick: () => view(s.i) }, cb,
      el('span', { class: 'fr', text: nameOf(s.from) || s.from }),
      el('span', { class: 'dt', text: (s.attach ? '📎 ' : '') + (s.date ? fmt.format(s.date) : '') }),
      el('span', { class: 'sj', text: s.subject || t('noSubject') }));
  });
  if (shown.length > limit) rows.push(el('li', { class: 'more', onclick: () => { limit += PAGE; drawList(); } }, el('button', { class: 'btn' }, t('more'))));
  $('list').replaceChildren(...rows);
}

function escapeHtml(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function toDataUrl(att) { let bin = ''; const u = new Uint8Array(att.content); for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return `data:${att.mimeType || 'application/octet-stream'};base64,${btoa(bin)}`; }
const addrs = (a) => (Array.isArray(a) ? a : a ? [a] : []).map((x) => (x.group ? x.group.map((g) => g.name ? `${g.name} <${g.address}>` : g.address).join(', ') : x.name ? `${x.name} <${x.address}>` : x.address)).join(', ');

async function view(i) {
  current = i; drawList();
  const v = $('view'); v.replaceChildren(el('p', { class: 'placeholder' }, '…'));
  const raw = await rawMessage(file, starts, i);
  let m; try { m = await parseMessage(raw); } catch (e) { v.replaceChildren(el('pre', {}, new TextDecoder().decode(raw.subarray(0, 200000)))); return; }
  const s = sums[i];
  const atts = (m.attachments || []).filter((a) => !(a.related && a.contentId && m.html && m.html.includes('cid:' + a.contentId.replace(/[<>]/g, ''))));
  const kids = [
    el('h1', {}, m.subject || t('noSubject')),
    el('p', { class: 'hdr' }, el('b', {}, t('from') + ': '), addrs(m.from) || s.from),
    el('p', { class: 'hdr' }, el('b', {}, t('to') + ': '), addrs(m.to) || s.to),
    m.cc ? el('p', { class: 'hdr' }, el('b', {}, t('cc') + ': '), addrs(m.cc)) : null,
    el('p', { class: 'hdr' }, el('b', {}, t('date') + ': '), s.date ? fmtFull.format(s.date) : (m.date || '')),
    s.labels.length ? el('div', { class: 'labels' }, ...s.labels.map((l) => el('span', {}, l))) : null,
    el('div', { class: 'atts' },
      ...atts.map((a) => el('button', { class: 'btn', onclick: () => saveTo(null, safeName(a.filename || 'attachment'), new Blob([a.content], { type: a.mimeType }), new Set()) }, '📎 ' + (a.filename || 'attachment') + ` (${Math.max(1, Math.round(a.content.byteLength / 1024))} KB)`)),
      el('button', { class: 'btn ghost', onclick: () => saveTo(null, safeName(m.subject || 'mail') + '.eml', new Blob([raw], { type: 'message/rfc822' }), new Set()) }, t('saveEml')),
      el('button', { class: 'btn ghost', onclick: () => window.print() }, t('print'))),
  ];
  const body = el('div', { class: 'body' });
  if (m.html) {
    // remove pictures from the internet before showing (the CSP below also blocks them)
    let html = m.html.replace(/(<img\b[^>]*?)\s(?:src|srcset)\s*=\s*(["'])\s*(?:https?:)?\/\/[^"']*\2/gi, '$1').replace(/url\(\s*(["']?)\s*(?:https?:)?\/\/[^)]*\1\s*\)/gi, 'none');
    for (const a of m.attachments || []) if (a.contentId) { const id = a.contentId.replace(/[<>]/g, ''); if (html.includes('cid:' + id)) html = html.split('cid:' + id).join(toDataUrl(a)); }
    const csp = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:\">";
    const fr = el('iframe', { sandbox: 'allow-popups allow-popups-to-escape-sandbox', referrerpolicy: 'no-referrer', title: m.subject || '' });
    fr.srcdoc = csp + '<base target="_blank"><style>body{font-family:system-ui,sans-serif;margin:0;padding:4px;word-break:break-word}img{max-width:100%;height:auto}</style>' + html;
    fr.addEventListener('load', () => { try { fr.style.height = Math.min(4000, fr.contentDocument.documentElement.scrollHeight + 20) + 'px'; } catch (e) {} });
    body.append(fr, el('p', { class: 'small', style: 'color:var(--muted)' }, t('blocked')));
  } else body.append(el('pre', {}, m.text || ''));
  kids.push(body);
  v.replaceChildren(...kids.filter(Boolean));
  v.scrollTop = 0;
}

// ---------- Pro: body search and exports ----------
async function bodySearch() {
  const q = $('q').value.trim().toLowerCase();
  if (!q || !$('inBody').checked) { bodyHits = null; filter(); return; }
  const hits = new Set();
  for (let i = 0; i < starts.length; i++) {
    const s = sums[i];
    if ((s.from + ' ' + s.to + ' ' + s.subject).toLowerCase().includes(q)) { hits.add(i); continue; }
    try { const m = await parseMessage(await rawMessage(file, starts, i)); if (((m.text || '') + ' ' + (m.html ? m.html.replace(/<[^>]+>/g, ' ') : '')).toLowerCase().includes(q)) hits.add(i); } catch (e) {}
    if (i % 50 === 0) { busy(t('searching', { i, n: starts.length }), i / starts.length); await new Promise((r) => setTimeout(r, 0)); }
  }
  bodyHits = hits; show('viewer'); filter();
}

function selected() { return shown.filter((s) => sel.has(s.i)); }
function needPro(fn) { if (pro.live() && !pro.has()) { showPro(pro, t, () => { for (const b of document.querySelectorAll('.pro-only')) b.hidden = true; fn(); }); return true; } return false; }
const stamp = (d) => { if (!d) return ''; const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}${p(d.getMinutes())}`; };

async function exportEml() {
  if (needPro(exportEml)) return;
  const list = selected(); if (!list.length) return alertView(t('nothingSel'));
  let dir = null; try { dir = await pickOutputFolder(); } catch (e) { return; }
  const used = new Set();
  for (let k = 0; k < list.length; k++) {
    busy(t('saving', { i: k + 1, n: list.length }), k / list.length);
    const s = list[k];
    await saveTo(dir, safeName(`${stamp(s.date)} ${s.subject || 'mail'}`).slice(0, 100) + '.eml', new Blob([await rawMessage(file, starts, s.i)], { type: 'message/rfc822' }), used);
  }
  show('viewer'); alertView(t('saved', { n: list.length }));
}

async function exportCsv() {
  if (needPro(exportCsv)) return;
  const list = selected(); if (!list.length) return alertView(t('nothingSel'));
  const rows = [LANG === 'ja' ? ['日時', '差出人', '宛先', '件名', 'ラベル', '添付あり', 'サイズ(KB)'] : ['Date', 'From', 'To', 'Subject', 'Labels', 'Attachments', 'Size (KB)']];
  for (const s of list) rows.push([s.date ? stamp(s.date) : '', s.from, s.to, s.subject, s.labels.join(' / '), s.attach ? 'yes' : '', Math.round(s.size / 1024)]);
  let dir = null; try { dir = await pickOutputFolder(); } catch (e) { return; }
  await saveTo(dir, safeName(file.name.replace(/\.[^.]+$/, '')) + '.csv', csvBlob(rows), new Set());
  alertView(t('saved', { n: 1 }));
}

async function exportAtt() {
  if (needPro(exportAtt)) return;
  const list = selected(); if (!list.length) return alertView(t('nothingSel'));
  let dir = null; try { dir = await pickOutputFolder(); } catch (e) { return; }
  const used = new Set(); let n = 0, m = 0;
  const zip = dir ? null : new ZipOut(safeName(file.name.replace(/\.[^.]+$/, '')) + '-attachments', null);
  for (let k = 0; k < list.length; k++) {
    busy(t('saving', { i: k + 1, n: list.length }), k / list.length);
    const s = list[k];
    let msg; try { msg = await parseMessage(await rawMessage(file, starts, s.i)); } catch (e) { continue; }
    const atts = (msg.attachments || []).filter((a) => !a.related);
    if (atts.length) m++;
    for (const a of atts) {
      const name = safeName(`${stamp(s.date).slice(0, 10)} ${a.filename || 'attachment'}`);
      if (zip) await zip.add(name, new Uint8Array(a.content), s.date || new Date()); else await saveTo(dir, name, new Blob([a.content], { type: a.mimeType }), used);
      n++;
    }
  }
  if (zip) await zip.close();
  show('viewer'); alertView(t('savedAtt', { n, m }));
}

function alertView(text) { const v = $('view'); const p = el('p', { class: 'note' }, text); v.prepend(p); setTimeout(() => p.remove(), 6000); }

// ---------- events ----------
$('fileBtn').onclick = () => $('fileIn').click();
$('fileIn').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) open(f).catch((err) => { show('start'); alertBox(t('err', { m: err.message || String(err) })); }); };
let qTimer = 0;
$('q').addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(() => { bodyHits = null; filter(); }, 200); });
$('q').addEventListener('keydown', (e) => { if (e.key === 'Enter' && $('inBody').checked) bodySearch(); });
$('label').onchange = filter;
$('inBody').onchange = (e) => { if (e.target.checked && pro.live() && !pro.has()) { e.target.checked = false; showPro(pro, t, () => { e.target.checked = true; bodySearch(); }); return; } bodySearch(); };
$('selAll').onchange = (e) => { for (const s of shown) e.target.checked ? sel.add(s.i) : sel.delete(s.i); drawList(); };
$('expEml').onclick = exportEml; $('expCsv').onclick = exportCsv; $('expAtt').onclick = exportAtt;
dropZone(async (src) => { const f = src.find((s) => /\.(mbox|mbx|zip)$/i.test(s.path)) || src[0]; if (f) open(f.file).catch((err) => { show('start'); alertBox(t('err', { m: err.message || String(err) })); }); }, filesFromDrop);
Promise.resolve(pro.init()).catch(() => {}).finally(() => nudge.webNote());
window.__app = { open, get sums() { return sums; }, view, pro, sel, exportCsv, exportEml, exportAtt, bodySearch };
show('start');

showMore({ from: 'mailpeek', lang: LANG, where: () => pro.where() });

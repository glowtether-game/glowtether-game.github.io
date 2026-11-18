// Small shared helpers for the PDF / mail apps: text, elements, saving, the Pro dialog.

export const LANG = (navigator.language || 'en').toLowerCase().startsWith('ja') ? 'ja' : 'en';

export function makeT(T) {
  const t = (k, v) => { let s = T[LANG][k] ?? T.en[k] ?? k; if (v) for (const [a, b] of Object.entries(v)) s = s.replaceAll(`{${a}}`, b); return s; };
  document.documentElement.lang = LANG;
  for (const e of document.querySelectorAll('[data-i18n]')) e.textContent = t(e.dataset.i18n);
  for (const e of document.querySelectorAll('[data-i18n-ph]')) e.placeholder = t(e.dataset.i18nPh);
  return t;
}

export const $ = (id) => document.getElementById(id);

export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids) if (k !== null && k !== undefined && k !== false) e.append(k);
  return e;
}

export const baseName = (p) => p.split('/').pop().replace(/\.[^.]+$/, '');
export const safeName = (s) => (s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'untitled';

/** Save a blob into the chosen folder (or downloads), never overwriting: "name (2).ext". */
export async function saveTo(dir, name, blob, used) {
  const ext = (name.match(/\.[^.]+$/) || [''])[0], st = name.slice(0, name.length - ext.length);
  let n = name, k = 2;
  const taken = async (x) => { if (used.has(x.toLowerCase())) return true; if (!dir) return false; try { await dir.getFileHandle(x); return true; } catch (e) { return false; } };
  while (await taken(n)) n = `${st} (${k++})${ext}`;
  used.add(n.toLowerCase());
  if (dir) { const fh = await dir.getFileHandle(n, { create: true }); const ws = await fh.createWritable(); await ws.write(blob); await ws.close(); }
  else { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = n; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 120000); }
  return n;
}

/** Excel-friendly CSV (UTF-8 with BOM). */
export function csvBlob(rows) {
  const q = (v) => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return new Blob(['﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n') + '\r\n'], { type: 'text/csv' });
}

/** Parse CSV text (handles quotes, commas and new lines inside quotes). */
export function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',' || c === '\t') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Read a CSV file that may be UTF-8 or Shift_JIS (Excel in Japan). */
export async function readCsvFile(file) {
  const buf = await file.arrayBuffer();
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { text = new TextDecoder('shift_jis').decode(buf); }
  return parseCsv(text);
}

/** The Pro dialog. `pro` is from makePro, `t` the text function, `onDone` runs after a purchase. */
export function showPro(pro, t, onDone) {
  const msg = el('p', { class: 'pro-msg' });
  const close = () => back.remove();
  const done = () => { close(); if (onDone) onDone(); };
  let actions;
  if (pro.where() === 'store') {
    const b = el('button', { class: 'btn primary big', onclick: async () => { b.disabled = true; try { (await pro.buy()) ? done() : (msg.textContent = t('proFail')); } catch (e) { msg.textContent = t('proFail'); } b.disabled = false; } }, pro.price() ? t('proBuyP', { p: pro.price() }) : t('proBuy'));
    actions = [el('div', { class: 'row' }, b), el('p', {}, el('button', { class: 'link', onclick: async () => ((await pro.restore()) ? done() : (msg.textContent = t('proNone'))) }, t('proRestore')))];
  } else actions = [el('p', {}, t('proWeb')), el('div', { class: 'row' }, el('a', { class: 'btn primary big', href: pro.storeApp }, t('proOpenStore')))];
  const back = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) close(); } },
    el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, el('h2', {}, t('proTitle')), el('p', {}, t('proBody')), el('p', { class: 'small' }, t('proOnce')), ...actions, msg, el('button', { class: 'btn ghost', onclick: close }, t('proLater'))));
  document.body.append(back);
}

export const PRO_TEXT = {
  en: { proBuy: 'Get Pro', proBuyP: 'Get Pro for {p}', proRestore: 'I already bought Pro', proWeb: '{app} Pro is sold in the Microsoft Store app. Install {app} from the Store, then get Pro there.', proOpenStore: 'Open in Microsoft Store', proLater: 'Not now', proFail: 'The purchase did not go through. Nothing was charged.', proNone: 'No Pro purchase was found for this Microsoft account.', proOnce: 'One payment, no subscription. It stays with your Microsoft account.' },
  ja: { proBuy: 'Pro にする', proBuyP: '{p} で Pro にする', proRestore: '購入済みの方はこちら', proWeb: '{app} Pro は Microsoft Store 版で販売しています。Store から {app} を入れて、その中で Pro にしてください。', proOpenStore: 'Microsoft Store で開く', proLater: 'あとで', proFail: '購入は完了しませんでした。料金はかかっていません。', proNone: 'この Microsoft アカウントでは Pro の購入が見つかりませんでした。', proOnce: '一度の支払いだけで、月額ではありません。Microsoft アカウントにひもづきます。' },
};
export function withPro(T, app) {
  for (const l of ['en', 'ja']) for (const [k, v] of Object.entries(PRO_TEXT[l])) T[l][k] ??= v.replaceAll('{app}', app);
  return T;
}

export function dropZone(onFiles, filesFromDrop) {
  const dz = $('drop');
  window.addEventListener('dragover', (e) => { e.preventDefault(); dz && dz.classList.add('over'); });
  window.addEventListener('dragleave', (e) => { if (!e.relatedTarget && dz) dz.classList.remove('over'); });
  window.addEventListener('drop', async (e) => { e.preventDefault(); dz && dz.classList.remove('over'); onFiles(await filesFromDrop(e.dataTransfer)); });
  if ('launchQueue' in window) window.launchQueue.setConsumer(async (p) => { if (p.files?.length) onFiles(await Promise.all(p.files.map(async (h) => ({ file: await h.getFile(), path: h.name })))); });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

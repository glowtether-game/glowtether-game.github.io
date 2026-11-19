// "Also from us": a small list of related apps above the footer.
// Links carry a Store campaign ID (cid=app-<from>) so Partner Center shows which app sent the visitor.
// Only apps whose Store page is public are shown (PUBLIC). Add an app here once its page is live.

const APPS = {
  docpeek: { name: 'Docpeek', id: '9MWX5B6B0XPM' },
  redate: { name: 'Redate', id: '9PC1BKKH8RG4' },
  clipready: { name: 'Clipready', id: '9PPC4KF7HLQL' },
  paperlock: { name: 'Paperlock', id: '9NLXQCMJPXMF' },
  pagestack: { name: 'Pagestack', id: '9NHMM322PGJ5' },
  mailpeek: { name: 'Mailpeek', id: '9NLGX2T41Q8Z' },
};
const PUBLIC = ['docpeek', 'redate', 'clipready'];
// Who points to whom: same customers (files from a Mac or an iPhone, Google Takeout, PDFs).
const RELATED = {
  docpeek: ['clipready', 'mailpeek'],
  redate: ['clipready', 'mailpeek'],
  clipready: ['redate', 'docpeek'],
  paperlock: ['pagestack'],
  pagestack: ['paperlock'],
  mailpeek: ['redate', 'docpeek'],
};
const TEXT = {
  en: { head: 'More free apps from us', docpeek: 'Open Pages, Numbers and Keynote files on Windows', redate: 'Put the dates back on your Google Photos download', clipready: 'iPhone videos (MOV) to MP4, voice memos to MP3', paperlock: 'Add or remove PDF passwords', pagestack: 'Merge and split PDFs', mailpeek: 'Open .mbox mail files (Gmail Takeout, Apple Mail)' },
  ja: { head: 'ほかの無料アプリ', docpeek: 'Mac の Pages・Numbers・Keynote を Windows で開く', redate: 'Google フォトから書き出した写真に撮影日を戻す', clipready: 'iPhone の動画（MOV）を MP4 に、ボイスメモを MP3 に', paperlock: 'PDF にパスワードをかける・外す', pagestack: 'PDF を結合・分割する', mailpeek: 'Gmail の Takeout などの .mbox メールを開く' },
  de: { head: 'Weitere kostenlose Apps von uns', docpeek: 'Pages-, Numbers- und Keynote-Dateien unter Windows öffnen', redate: 'Aufnahmedaten in Google-Fotos-Downloads wiederherstellen', clipready: 'iPhone-Videos (MOV) in MP4, Sprachmemos in MP3', paperlock: 'PDF-Passwörter hinzufügen oder entfernen', pagestack: 'PDFs zusammenfügen und teilen', mailpeek: 'MBOX-Maildateien öffnen (Gmail Takeout, Apple Mail)' },
  fr: { head: 'Nos autres applis gratuites', docpeek: 'Ouvrir les fichiers Pages, Numbers et Keynote sous Windows', redate: 'Remettre les dates sur vos photos téléchargées de Google Photos', clipready: 'Vidéos iPhone (MOV) en MP4, mémos vocaux en MP3', paperlock: 'Ajouter ou retirer le mot de passe d’un PDF', pagestack: 'Fusionner et diviser des PDF', mailpeek: 'Ouvrir les fichiers mail .mbox (Gmail Takeout, Apple Mail)' },
  es: { head: 'Otras apps gratis nuestras', docpeek: 'Abrir archivos de Pages, Numbers y Keynote en Windows', redate: 'Recuperar las fechas de las fotos descargadas de Google Fotos', clipready: 'Vídeos del iPhone (MOV) a MP4, notas de voz a MP3', paperlock: 'Poner o quitar la contraseña de un PDF', pagestack: 'Unir y dividir PDF', mailpeek: 'Abrir archivos de correo .mbox (Gmail Takeout, Apple Mail)' },
  pt: { head: 'Outros apps grátis nossos', docpeek: 'Abrir arquivos do Pages, Numbers e Keynote no Windows', redate: 'Recuperar as datas das fotos baixadas do Google Fotos', clipready: 'Vídeos do iPhone (MOV) para MP4, gravações de voz para MP3', paperlock: 'Colocar ou remover a senha de um PDF', pagestack: 'Juntar e dividir PDFs', mailpeek: 'Abrir arquivos de e-mail .mbox (Gmail Takeout, Apple Mail)' },
  ko: { head: '다른 무료 앱', docpeek: 'Windows에서 Pages·Numbers·Keynote 파일 열기', redate: 'Google 포토에서 내려받은 사진의 촬영 날짜 복원', clipready: 'iPhone 동영상(MOV)을 MP4로, 음성 메모를 MP3로', paperlock: 'PDF 암호 설정·해제', pagestack: 'PDF 합치기·나누기', mailpeek: '.mbox 메일 파일 열기(Gmail Takeout, Apple Mail)' },
};

export function linkFor(key, from, where) {
  const a = APPS[key], cid = 'app-' + from;
  return where === 'store' ? `ms-windows-store://pdp/?productid=${a.id}&cid=${cid}` : `https://apps.microsoft.com/detail/${a.id}?cid=${cid}`;
}

/** opts: { from: 'redate', lang, where: () => 'store'|'web' } — adds the list above <footer class="foot">. */
export function showMore({ from, lang, where }) {
  const keys = (RELATED[from] || []).filter((k) => PUBLIC.includes(k) && k !== from);
  if (!keys.length || document.getElementById('dpMore')) return null;
  const tx = TEXT[lang] || TEXT.en, w = where();
  const box = document.createElement('aside');
  box.id = 'dpMore';
  box.style.cssText = 'margin:24px auto 0;max-width:720px;width:calc(100% - 32px);padding:12px 16px;border:1px solid var(--line);border-radius:10px;background:var(--paper);font-size:14px';
  const h = document.createElement('div');
  h.textContent = tx.head;
  h.style.cssText = 'color:var(--muted);font-size:13px;margin-bottom:4px';
  box.append(h);
  for (const k of keys) {
    const a = document.createElement('a');
    a.href = linkFor(k, from, w);
    if (w !== 'store') { a.target = '_blank'; a.rel = 'noopener'; }
    a.style.cssText = 'display:block;padding:4px 0;color:inherit;text-decoration:none';
    const b = document.createElement('b'); b.textContent = APPS[k].name;
    const s = document.createElement('span'); s.textContent = ' — ' + (tx[k] || TEXT.en[k]); s.style.color = 'var(--muted)';
    a.append(b, s);
    box.append(a);
  }
  const foot = document.querySelector('footer.foot');
  if (foot) foot.before(box); else document.body.append(box);
  return box;
}

export const _test = { APPS, PUBLIC, RELATED, TEXT };

// Small, polite nudges shared by the Store apps:
//  - in the Store app: after the first successful run, ask once for a rating
//  - in the browser:   a one-line note that a Windows app exists in the Microsoft Store
// Both are shown at most once (dismissal is remembered in localStorage).

const TXT = {
  en: { rate: '{app} worked? A rating in the Microsoft Store helps others find it.', rateBtn: 'Rate {app}', later: 'Not now',
        web: 'On Windows? {app} is also a free app in the Microsoft Store.', webBtn: 'Get the app', close: 'Close' },
  ja: { rate: '{app} がお役に立ちましたか？ Microsoft Store で評価していただけると、ほかの人が見つけやすくなります。', rateBtn: '評価する', later: 'あとで',
        web: 'Windows なら、{app} は Microsoft Store の無料アプリとしても使えます。', webBtn: 'アプリを入手', close: '閉じる' },
};

function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

function bar(text, btnText, href, closeText, onClose, onGo) {
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.style.cssText = 'position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:50;max-width:min(560px,calc(100vw - 32px));display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:var(--paper,#fff);color:var(--ink,#1d2129);border:1px solid var(--line,#e3e6ea);border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:12px 14px;font-size:14px;line-height:1.5';
  const p = document.createElement('span'); p.textContent = text; p.style.cssText = 'flex:1 1 240px;min-width:0';
  const go = document.createElement('a'); go.textContent = btnText; go.href = href; go.className = 'btn primary'; go.rel = 'noopener'; if (/^https:/.test(href)) go.target = '_blank';
  const x = document.createElement('button'); x.type = 'button'; x.textContent = closeText; x.className = 'btn ghost';
  const done = () => el.remove();
  go.addEventListener('click', () => { onGo && onGo(); setTimeout(done, 300); });
  x.addEventListener('click', () => { onClose && onClose(); done(); });
  el.append(p, go, x);
  document.body.append(el);
  return el;
}

/** opts: { app, storeId, key, lang, where: () => 'store'|'web', listed: false while the Store page is not public yet } */
export function makeNudge({ app, storeId, key, lang, where, listed = true }) {
  const t = (k) => (TXT[lang] || TXT.en)[k].replaceAll('{app}', app);
  const kRate = key + '-rated', kWeb = key + '-webnote', kRuns = key + '-runs';
  return {
    /** call after each successful conversion/save */
    success() {
      const runs = (+store(kRuns) || 0) + 1; store(kRuns, String(runs));
      if (where() !== 'store' || store(kRate)) return;
      store(kRate, 'asked');
      setTimeout(() => bar(t('rate'), t('rateBtn'), `ms-windows-store://review/?ProductId=${storeId}`, t('later'), null, () => store(kRate, 'went')), 1200);
    },
    /** call once at start-up, after the Store check has finished */
    webNote() {
      if (!listed || where() === 'store' || store(kWeb)) return;
      if (!/Windows/i.test(navigator.userAgent)) return;
      setTimeout(() => bar(t('web'), t('webBtn'), `https://apps.microsoft.com/detail/${storeId}`, t('close'), () => store(kWeb, '1'), () => store(kWeb, '1')), 2500);
    },
  };
}

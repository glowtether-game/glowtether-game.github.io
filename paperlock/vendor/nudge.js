// Small, polite nudges shared by the Store apps:
//  - in the Store app: after the first successful run, ask once for a rating
//  - in the browser:   a one-line note that a Windows app exists in the Microsoft Store
// Both are shown at most once (dismissal is remembered in localStorage).

const TXT = {
  en: { rate: '{app} worked? A rating in the Microsoft Store helps others find it.', rateBtn: 'Rate {app}', later: 'Not now',
        web: 'On Windows? {app} is also a free app in the Microsoft Store.', webBtn: 'Get the app', close: 'Close' },
  ja: { rate: '{app} がお役に立ちましたか？ Microsoft Store で評価していただけると、ほかの人が見つけやすくなります。', rateBtn: '評価する', later: 'あとで',
        web: 'Windows なら、{app} は Microsoft Store の無料アプリとしても使えます。', webBtn: 'アプリを入手', close: '閉じる' },
  de: {"rate": "Hat {app} geholfen? Eine Bewertung im Microsoft Store hilft anderen, die App zu finden.", "rateBtn": "{app} bewerten", "later": "Nicht jetzt", "web": "Windows? {app} gibt es auch als kostenlose App im Microsoft Store.", "webBtn": "App holen", "close": "Schließen"},
  fr: {"rate": "{app} vous a été utile ? Une note dans le Microsoft Store aide d’autres personnes à le trouver.", "rateBtn": "Noter {app}", "later": "Plus tard", "web": "Sous Windows ? {app} existe aussi en application gratuite dans le Microsoft Store.", "webBtn": "Obtenir l’application", "close": "Fermer"},
  es: {"rate": "¿Te sirvió {app}? Una valoración en Microsoft Store ayuda a que otros lo encuentren.", "rateBtn": "Valorar {app}", "later": "Ahora no", "web": "¿Usas Windows? {app} también es una app gratuita en Microsoft Store.", "webBtn": "Obtener la app", "close": "Cerrar"},
  pt: {"rate": "O {app} ajudou? Uma avaliação na Microsoft Store ajuda outras pessoas a encontrá-lo.", "rateBtn": "Avaliar o {app}", "later": "Agora não", "web": "Usa Windows? O {app} também é um app gratuito na Microsoft Store.", "webBtn": "Obter o app", "close": "Fechar"},
  ko: {"rate": "{app}이(가) 도움이 되었나요? Microsoft Store에 평가를 남겨 주시면 다른 사람들이 찾기 쉬워집니다.", "rateBtn": "{app} 평가하기", "later": "나중에", "web": "Windows를 쓰시나요? {app}은(는) Microsoft Store에서 무료 앱으로도 받을 수 있습니다.", "webBtn": "앱 받기", "close": "닫기"},
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
      setTimeout(() => bar(t('web'), t('webBtn'), `https://apps.microsoft.com/detail/${storeId}?cid=web-nudge`, t('close'), () => store(kWeb, '1'), () => store(kWeb, '1')), 2500);
    },
  };
}

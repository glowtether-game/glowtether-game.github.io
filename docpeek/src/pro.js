// Docpeek Pro: a one-time purchase (Microsoft Store durable add-on) that unlocks
// saving as Word, Excel and the picture zip. Viewing, text, CSV and printing stay free.
//
// PRO_LIVE stays false until the add-on is published in Partner Center. While it is
// false every feature is free, so this file is safe to deploy at any time.
export const PRO_LIVE = true;
export const SKU = 'docpeek_pro';
export const STORE_ID = '9MWX5B6B0XPM';
export const STORE_WEB = `https://apps.microsoft.com/detail/${STORE_ID}?cid=web-pro`;
export const STORE_APP = `ms-windows-store://pdp/?productid=${STORE_ID}&cid=web-pro`;
const BILLING = 'https://store.microsoft.com/billing';
const KEY = 'docpeek-pro';

let service = null;
let owned = false;
let price = '';
let ready = false;

function remember(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) { /* storage may be blocked */ } }
function recalled() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }

/** Where the app runs: 'store' (installed from the Store, can buy), or 'web'. */
export const where = () => (service ? 'store' : 'web');
export const isReady = () => ready;
export const priceText = () => price;

/** Pro features are free when Pro is not live yet. */
export function proLive() { if (PRO_LIVE) return true; try { return localStorage.getItem('docpeek-pro-live') === '1'; } catch (e) { return false; } }
export function hasPro() { return !proLive() || owned; }

export async function initPro() {
  owned = recalled();
  try {
    if ('getDigitalGoodsService' in window) {
      service = await window.getDigitalGoodsService(BILLING);
      if (service) {
        const [det] = await service.getDetails([SKU]).catch(() => []);
        if (det && det.price) {
          try { price = new Intl.NumberFormat(navigator.language, { style: 'currency', currency: det.price.currency }).format(Number(det.price.value)); } catch (e) { price = `${det.price.value} ${det.price.currency}`; }
        }
        await refresh();
      }
    }
  } catch (e) {
    service = null; // not in the Store app, or the Store is unreachable: keep the remembered state
  }
  ready = true;
  return hasPro();
}

async function refresh() {
  if (!service) return owned;
  const list = await service.listPurchases().catch(() => null);
  if (Array.isArray(list)) { owned = list.some((p) => p.itemId === SKU); remember(owned); }
  return owned;
}

/** Opens the Store purchase dialog. Resolves true when Pro is owned afterwards. */
export async function buyPro() {
  if (!service) return false;
  const req = new PaymentRequest(
    [{ supportedMethods: BILLING, data: { sku: SKU } }],
    { total: { label: 'Total', amount: { currency: 'USD', value: '0' } } },
  );
  const res = await req.show();
  try { await res.complete('success'); } catch (e) { /* the Store may already have closed it */ }
  return refresh();
}

/** Lets a buyer get Pro back after reinstalling (the Store keeps the purchase). */
export async function restorePro() { return refresh(); }

// for testing in a browser: localStorage['docpeek-pro-live']='1' turns the Pro gate on before launch
export const _test = { set(v) { owned = !!v; remember(owned); }, state: () => ({ live: proLive(), owned, where: where(), price }) };

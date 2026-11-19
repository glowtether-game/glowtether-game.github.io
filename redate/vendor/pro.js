// Pro: a one-time Microsoft Store add-on. While `live` is false every feature is free,
// so the app can be published before the add-on exists.
const BILLING = 'https://store.microsoft.com/billing';
export function makePro({ sku, storeId, key, live = false }) {
  let service = null, owned = false, price = '';
  const remember = (v) => { try { localStorage.setItem(key, v ? '1' : '0'); } catch (e) {} };
  const recalled = () => { try { return localStorage.getItem(key) === '1'; } catch (e) { return false; } };
  const isLive = () => { if (live) return true; try { return localStorage.getItem(key + '-live') === '1'; } catch (e) { return false; } };
  async function refresh() {
    if (!service) return owned;
    const list = await service.listPurchases().catch(() => null);
    if (Array.isArray(list)) { owned = list.some((p) => p.itemId === sku); remember(owned); }
    return owned;
  }
  return {
    storeWeb: `https://apps.microsoft.com/detail/${storeId}?cid=web-pro`,
    storeApp: `ms-windows-store://pdp/?productid=${storeId}&cid=web-pro`,
    where: () => (service ? 'store' : 'web'),
    price: () => price,
    live: isLive,
    has: () => !isLive() || owned,
    async init() {
      owned = recalled();
      try {
        if ('getDigitalGoodsService' in window) {
          service = await window.getDigitalGoodsService(BILLING);
          if (service) {
            const [d] = await service.getDetails([sku]).catch(() => []);
            if (d && d.price) { try { price = new Intl.NumberFormat(navigator.language, { style: 'currency', currency: d.price.currency }).format(Number(d.price.value)); } catch (e) { price = d.price.value + ' ' + d.price.currency; } }
            await refresh();
          }
        }
      } catch (e) { service = null; }
      return owned;
    },
    async buy() {
      if (!service) return false;
      const res = await new PaymentRequest([{ supportedMethods: BILLING, data: { sku } }], { total: { label: 'Total', amount: { currency: 'USD', value: '0' } } }).show();
      try { await res.complete('success'); } catch (e) {}
      return refresh();
    },
    restore: refresh,
    _set(v) { owned = !!v; remember(owned); },
  };
}

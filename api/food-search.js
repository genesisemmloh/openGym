// Food search for the Wellbeing tab (fork): the server asks Open Food Facts' search service on the
// app's behalf. The browser cannot ask it directly (that service sends no CORS header for other
// origins), and asking from here also lets every user share one cache and one polite rate.
//
// Only the words typed in the search box go out, with a generic client name: never anything about
// the account. Answers are cached for an hour per (language, words).

const ENDPOINT = 'https://search.openfoodfacts.org/search';
const FIELDS = 'code,product_name,product_name_es,product_name_de,product_name_en,generic_name,brands,nutriments,serving_quantity';
const TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 500;
const TIMEOUT_MS = 8000;
const PER_MINUTE = 20;

/** Search words as the cache and the request use them, or null when they are not worth asking about. */
export function cleanQuery(q) {
  const s = String(q || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return s.length >= 2 ? s : null;
}
export const cleanLang = l => (/^[a-z]{2}$/.test(String(l || '')) ? l : 'en');

/** Only the fields the app reads, so an answer from outside never carries more than that. */
export function slimHit(h) {
  if (!h || typeof h !== 'object') return null;
  const n = h.nutriments && typeof h.nutriments === 'object' ? h.nutriments : {};
  const pick = ['energy-kcal_100g', 'energy_100g', 'energy-kj_100g', 'proteins_100g'];
  const nutriments = Object.fromEntries(pick.filter(k => Number.isFinite(+n[k])).map(k => [k, +n[k]]));
  const out = { nutriments };
  for (const k of ['code', 'product_name', 'product_name_es', 'product_name_de', 'product_name_en', 'generic_name']) {
    if (typeof h[k] === 'string' && h[k].trim()) out[k] = h[k].trim().slice(0, 120);
  }
  const brands = Array.isArray(h.brands) ? h.brands.join(',') : typeof h.brands === 'string' ? h.brands : '';
  if (brands) out.brands = brands.slice(0, 120);
  if (Number.isFinite(+h.serving_quantity)) out.serving_quantity = +h.serving_quantity;
  return out;
}

export function createFoodSearch({ fetchFn = globalThis.fetch, now = () => Date.now() } = {}) {
  const cache = new Map();
  const calls = new Map(); // uid -> [timestamps]

  function allowed(uid) {
    const t = now();
    const list = (calls.get(uid) || []).filter(x => t - x < 60000);
    if (list.length >= PER_MINUTE) { calls.set(uid, list); return false; }
    list.push(t);
    calls.set(uid, list);
    if (calls.size > 2000) calls.clear();
    return true;
  }

  /** { status, body }: 200 with { products }, 400 for no words, 429 when one user asks too often, 502 when the service fails. */
  async function search(uid, q, lang) {
    const query = cleanQuery(q);
    const l = cleanLang(lang);
    if (!query) return { status: 400, body: { error: 'search words required' } };
    const key = l + ':' + query.toLowerCase();
    const hit = cache.get(key);
    if (hit && now() - hit.at < TTL_MS) return { status: 200, body: { products: hit.products } };
    if (!allowed(uid)) return { status: 429, body: { error: 'too many searches, try again in a minute' } };
    const url = `${ENDPOINT}?q=${encodeURIComponent(query)}&langs=${l}&page_size=24&fields=${FIELDS}`;
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
      const res = await fetchFn(url, { headers: { Accept: 'application/json', 'User-Agent': 'openGym-selfhosted/1.0' }, signal: ctl.signal });
      clearTimeout(timer);
      if (!res.ok) return { status: 502, body: { error: 'food search unavailable' } };
      const json = await res.json();
      const products = (Array.isArray(json?.hits) ? json.hits : []).map(slimHit).filter(Boolean);
      cache.set(key, { at: now(), products });
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
      return { status: 200, body: { products } };
    } catch {
      return { status: 502, body: { error: 'food search unavailable' } };
    }
  }
  return { search };
}

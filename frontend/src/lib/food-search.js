// Food search for the Wellbeing tab, for products with a brand: Open Food Facts (openfoodfacts.org),
// the open food database, asked through our own server (GET /api/food/search, api/food-search.js),
// since its search service does not answer browsers on other sites. Only the words typed in the
// search box leave the server. Everyday foods come first from lib/basic-foods.js, offline.
//
// The sheet searches when you press Search, never on every keystroke, and remembers the answers.

const ENDPOINT = '/api/food/search'
const cache = new Map()

const num = v => (v === null || v === undefined || v === '' ? null : Number.isFinite(+v) ? +v : null)

/**
 * One product of an Open Food Facts answer as { code, name, brand, kcal100, protein100, carbs100, fat100, serving },
 * or null when it has no name or no energy per 100 g. kJ is turned into kcal when kcal is missing.
 */
export function parseProduct(p, lang = 'en') {
  if (!p || typeof p !== 'object') return null
  const name = String(p['product_name_' + lang] || p.product_name || p.product_name_en || p.generic_name || '').trim()
  if (!name) return null
  const n = p.nutriments || {}
  let kcal = num(n['energy-kcal_100g'])
  if (kcal == null) { const kj = num(n.energy_100g ?? n['energy-kj_100g']); if (kj != null) kcal = kj / 4.184 }
  if (kcal == null || kcal < 0 || kcal > 1000) return null
  const protein = num(n.proteins_100g)
  const carbs = num(n.carbohydrates_100g), fat = num(n.fat_100g)
  const g100 = v => (v != null && v >= 0 && v <= 100 ? Math.round(v * 10) / 10 : null)
  const serving = num(p.serving_quantity)
  return {
    code: /^\d{4,20}$/.test(String(p.code || '')) ? String(p.code) : null,
    name: name.slice(0, 60),
    brand: String(p.brands || '').split(',')[0].trim().slice(0, 40),
    kcal100: Math.round(kcal),
    protein100: g100(protein), carbs100: g100(carbs), fat100: g100(fat),
    serving: serving > 0 && serving < 2000 ? Math.round(serving) : null,
  }
}

/** The products of an answer, parsed, without doubles of the same name and brand. */
export function parseResults(json, lang = 'en') {
  const seen = new Set()
  const out = []
  for (const p of Array.isArray(json?.products) ? json.products : []) {
    const x = parseProduct(p, lang)
    if (!x) continue
    const key = (x.name + '|' + x.brand).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(x)
  }
  return out
}

/** Searches Open Food Facts for `q`. Resolves to parsed products; rejects on a network failure. */
export async function searchFoods(q, lang = 'en', fetchFn = globalThis.fetch) {
  const query = String(q || '').trim()
  if (query.length < 2) return []
  const key = lang + ':' + query.toLowerCase()
  if (cache.has(key)) return cache.get(key)
  const url = `${ENDPOINT}?q=${encodeURIComponent(query)}&lang=${encodeURIComponent(lang)}`
  const res = await fetchFn(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
  if (!res.ok) throw new Error('food search ' + res.status)
  const list = parseResults(await res.json(), lang)
  cache.set(key, list)
  return list
}

/**
 * The product with barcode `code`, parsed, or null when Open Food Facts does not know it (or it has
 * no energy value). Rejects on a network failure.
 */
export async function lookupCode(code, lang = 'en', fetchFn = globalThis.fetch) {
  const c = String(code || '').replace(/\s+/g, '')
  if (!/^\d{8,14}$/.test(c)) return null
  const key = 'code:' + c
  if (cache.has(key)) return cache.get(key)
  const res = await fetchFn(`/api/food/code?c=${c}`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
  if (!res.ok) throw new Error('food lookup ' + res.status)
  const json = await res.json()
  const p = json?.product ? parseProduct(json.product, lang) : null
  const out = p ? { ...p, code: p.code || c } : null
  cache.set(key, out)
  return out
}
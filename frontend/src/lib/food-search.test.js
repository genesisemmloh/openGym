import { describe, it, expect, vi } from 'vitest'
import { lookupCode, parseProduct, parseResults, searchFoods } from './food-search.js'

describe('food search', () => {
  it('reads kcal per 100 g, in the reader’s language first, and turns kJ into kcal', () => {
    expect(parseProduct({ code: '123456', product_name: 'Oats', product_name_es: 'Avena', brands: 'Brand A, Brand B', nutriments: { 'energy-kcal_100g': 389, proteins_100g: 16.9, carbohydrates_100g: 66.3, fat_100g: 6.9 }, serving_quantity: 40 }, 'es'))
      .toEqual({ code: '123456', name: 'Avena', brand: 'Brand A', kcal100: 389, protein100: 16.9, carbs100: 66.3, fat100: 6.9, serving: 40 })
    expect(parseProduct({ product_name: 'Juice', nutriments: { energy_100g: 184 } }).kcal100).toBe(44)
    expect(parseProduct({ product_name: 'No energy', nutriments: {} })).toBeNull()
    expect(parseProduct({ nutriments: { 'energy-kcal_100g': 10 } })).toBeNull()
  })
  it('drops doubles of the same name and brand', () => {
    const p = { product_name: 'Milk', brands: 'X', nutriments: { 'energy-kcal_100g': 64 } }
    expect(parseResults({ products: [p, p, { ...p, brands: 'Y' }] })).toHaveLength(2)
  })
  it('asks once per words and remembers the answer', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({ products: [{ product_name: 'Rice', nutriments: { 'energy-kcal_100g': 130 } }] }) }))
    const a = await searchFoods('cooked rice', 'en', fetchFn)
    const b = await searchFoods('Cooked Rice ', 'en', fetchFn)
    expect(a).toEqual(b)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(fetchFn.mock.calls[0][0]).toBe('/api/food/search?q=cooked%20rice&lang=en')
    expect(await searchFoods('x', 'en', fetchFn)).toEqual([])
  })
})

describe('food by barcode', () => {
  it('asks the server for the digits and parses the product, null when unknown', async () => {
    const asked = []
    const fetchFn = async url => {
      asked.push(url)
      return { ok: true, json: async () => (url.endsWith('0000000000000') ? { product: null } : { product: { product_name: 'Skyr', nutriments: { 'energy-kcal_100g': 63, proteins_100g: 11, carbohydrates_100g: 4, fat_100g: 0.2 } } }) }
    }
    expect(await lookupCode('4006381333931', 'en', fetchFn)).toMatchObject({ code: '4006381333931', name: 'Skyr', kcal100: 63, protein100: 11, carbs100: 4, fat100: 0.2 })
    expect(await lookupCode('0000000000000', 'en', fetchFn)).toBeNull()
    expect(await lookupCode('12ab', 'en', fetchFn)).toBeNull()
    expect(asked).toEqual(['/api/food/code?c=4006381333931', '/api/food/code?c=0000000000000'])
  })
})
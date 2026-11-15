import { describe, it, expect, vi } from 'vitest'
import { parseProduct, parseResults, searchFoods } from './food-search.js'

describe('food search', () => {
  it('reads kcal per 100 g, in the reader’s language first, and turns kJ into kcal', () => {
    expect(parseProduct({ code: '123456', product_name: 'Oats', product_name_es: 'Avena', brands: 'Brand A, Brand B', nutriments: { 'energy-kcal_100g': 389, proteins_100g: 16.9 }, serving_quantity: 40 }, 'es'))
      .toEqual({ code: '123456', name: 'Avena', brand: 'Brand A', kcal100: 389, protein100: 16.9, serving: 40 })
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

import { describe, it, expect } from 'vitest'
import { basicFoods, searchBasic } from './basic-foods.js'

describe('basic foods', () => {
  it('has a name in each language and sane values', () => {
    for (const lang of ['en', 'es', 'de']) for (const f of basicFoods(lang)) {
      expect(f.name).toBeTruthy()
      expect(f.kcal100).toBeGreaterThanOrEqual(0)
      expect(f.kcal100).toBeLessThanOrEqual(900)
      expect(f.serving).toBeGreaterThan(0)
    }
    const ids = basicFoods().map(f => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('finds by the start of words, in the reader’s language or in English, ignoring accents', () => {
    expect(searchBasic('platano', 'es')[0].name).toBe('Plátano')
    expect(searchBasic('pollo', 'es').map(f => f.id)).toContain('basic:chicken breast')
    expect(searchBasic('chicken', 'es').length).toBeGreaterThan(0)
    expect(searchBasic('arroz', 'es')[0].id).toMatch(/rice/)
    expect(searchBasic('haferfl', 'de')[0].id).toBe('basic:oats')
    expect(searchBasic('', 'es')).toEqual([])
  })
})

import { describe, it, expect, vi } from 'vitest'
import { groupOf, fetchGroup, placeOf } from './group.js'

describe('group', () => {
  it('reads the switch, the name and the area', () => {
    expect(groupOf({})).toEqual({ share: false, alias: '', area: '' })
    expect(groupOf({ group: { share: true, alias: 'Dominic', area: 'IT' } })).toEqual({ share: true, alias: 'Dominic', area: 'IT' })
  })
  it('shares a place on equal counts', () => {
    const m = [{ week: 4 }, { week: 4 }, { week: 2 }]
    expect([0, 1, 2].map(i => placeOf(m, i))).toEqual([1, 1, 3])
    expect(placeOf(m, 5)).toBe(0)
  })
  it('asks the server with today and fails loudly', async () => {
    const ok = vi.fn(async () => ({ ok: true, json: async () => ({ joined: false, count: 2 }) }))
    expect(await fetchGroup('2026-11-18', ok)).toEqual({ joined: false, count: 2 })
    expect(ok.mock.calls[0][0]).toBe('/api/group?today=2026-11-18')
    await expect(fetchGroup('2026-11-18', async () => ({ ok: false, status: 401 }))).rejects.toThrow()
  })
})

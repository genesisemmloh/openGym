import { describe, it, expect, vi } from 'vitest'
import { groupOf, fetchGroup, fetchGroups, groupAction, joinLink, showCode, placeOf } from './group.js'

describe('group', () => {
  it('reads the switch, the name, the area and the Home group', () => {
    expect(groupOf({})).toEqual({ share: false, alias: '', area: '', main: '' })
    expect(groupOf({ group: { share: true, alias: 'Dominic', area: 'IT', main: 'g1' } })).toEqual({ share: true, alias: 'Dominic', area: 'IT', main: 'g1' })
  })
  it('shares a place on equal counts', () => {
    const m = [{ week: 4, month: 9 }, { week: 4, month: 5 }, { week: 2, month: 5 }]
    expect([0, 1, 2].map(i => placeOf(m, i))).toEqual([1, 1, 3])
    expect([0, 1, 2].map(i => placeOf(m, i, x => x.month))).toEqual([1, 2, 2])
  })
  it('builds a join link and shows a code in two halves', () => {
    expect(joinLink('ABCDEFGH', 'https://gym.example')).toBe('https://gym.example/#/group?join=ABCDEFGH')
    expect(showCode('ABCDEFGH')).toBe('ABCD-EFGH')
  })
  it('asks the server and posts changes as JSON', async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => ({ groups: [{ id: 'g1' }] }) }))
    expect(await fetchGroups('2026-11-18', f)).toEqual([{ id: 'g1' }])
    expect(f.mock.calls[0][0]).toBe('/api/groups?today=2026-11-18')
    const p = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({ error: 'no group has that code' }) }))
    expect(await groupAction('join', { code: 'X' }, p)).toEqual({ ok: false, status: 404, body: { error: 'no group has that code' } })
    expect(p.mock.calls[0][0]).toBe('/api/groups/join')
    expect(JSON.parse(p.mock.calls[0][1].body)).toEqual({ code: 'X' })
    await expect(fetchGroup('2026-11-18', async () => ({ ok: false, status: 401 }))).rejects.toThrow()
  })
})

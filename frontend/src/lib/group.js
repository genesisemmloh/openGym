// The Group (fork module): a board of the people on this server who chose to share how often they
// train. The switch lives in the profile, S.group = { share, alias, area }, a plain setting that
// syncs like any other; the server (api/group.js, GET /api/group) reads it and answers counts only.

export const ALIAS_MAX = 24
export const AREA_MAX = 24

const clip = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').slice(0, n) : '')

/** { share, alias, area } of this profile. */
export function groupOf(S) {
  const g = S && typeof S.group === 'object' && S.group ? S.group : {}
  return { share: g.share === true, alias: clip(g.alias, ALIAS_MAX), area: clip(g.area, AREA_MAX) }
}

/** The board from the server: { joined, count, members, totals }. Throws when it cannot be reached. */
export async function fetchGroup(today, fetchFn = globalThis.fetch) {
  const res = await fetchFn(`/api/group?today=${encodeURIComponent(today)}`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
  if (!res.ok) throw new Error('group ' + res.status)
  return res.json()
}

/** Position on the board, 1-based, sharing a place on equal workouts this week; 0 when not on it. */
export function placeOf(members, i) {
  if (!members?.[i]) return 0
  let p = i
  while (p > 0 && members[p - 1].week === members[i].week) p--
  return p + 1
}

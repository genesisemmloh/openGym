// Groups (fork module "group"): people on this server who train together. Anyone can create a group
// and share its join code (or a link carrying it); you can be in several; joining a group is the
// consent to show it how often you train. The server keeps the groups (api/groups.js); the profile
// keeps only how you appear on the boards and whether you show on the whole server's board:
// S.group = { share, alias, area, main }, a plain setting that syncs like any other.

export const ALIAS_MAX = 24
export const AREA_MAX = 24
export const NAME_MAX = 40

const clip = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').slice(0, n) : '')

/** { share, alias, area, main } of this profile. `main` is the group the Home card shows. */
export function groupOf(S) {
  const g = S && typeof S.group === 'object' && S.group ? S.group : {}
  return { share: g.share === true, alias: clip(g.alias, ALIAS_MAX), area: clip(g.area, AREA_MAX), main: typeof g.main === 'string' ? g.main : '' }
}

const get = async (url, fetchFn) => {
  const res = await fetchFn(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
  if (!res.ok) throw new Error('group ' + res.status)
  return res.json()
}

/** The whole server's board (only for profiles that share): { joined, count, members, totals }. */
export const fetchGroup = (today, fetchFn = globalThis.fetch) => get(`/api/group?today=${encodeURIComponent(today)}`, fetchFn)

/** Your groups with their boards: [{ id, name, code, isOwner, count, members, totals }]. */
export async function fetchGroups(today, fetchFn = globalThis.fetch) {
  return (await get(`/api/groups?today=${encodeURIComponent(today)}`, fetchFn)).groups || []
}

/** One change to a group: 'create' | 'join' | 'leave' | 'rename' | 'code' | 'remove' | 'delete'. Resolves { ok, status, body }. */
export async function groupAction(action, body, fetchFn = globalThis.fetch) {
  const res = await fetchFn(`/api/groups/${action}`, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body || {}),
  })
  let data = {}
  try { data = await res.json() } catch { /* an empty answer */ }
  return { ok: res.ok, status: res.status, body: data }
}

/** The link that opens the app on "join this group". */
export const joinLink = (code, origin = globalThis.location?.origin || '') => `${origin}/#/group?join=${encodeURIComponent(code)}`

/** A code shown in two halves so it reads out loud: ABCD-EFGH. */
export const showCode = c => (String(c || '').length === 8 ? c.slice(0, 4) + '-' + c.slice(4) : String(c || ''))

/** Position on a board, 1-based, sharing a place on equal counts. */
export function placeOf(members, i, count = m => m.week) {
  if (!members?.[i]) return 0
  let p = i
  while (p > 0 && count(members[p - 1]) === count(members[i])) p--
  return p + 1
}

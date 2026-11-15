// The month of the Wellbeing tab read side by side with the training log: one row per day, a few
// totals, and the patterns worth a look ("your mood averaged 4.1 on days you trained, 3.2 on days
// you did not"). Pure, so the arithmetic is tested (wellbeing-insights.test.js).
//
// Patterns are associations, never causes, and the screen says so. Each one needs MIN_DAYS days on
// both sides of the comparison and a gap of at least MIN_GAP before it is shown, so two days of
// data never turn into advice.
import { workoutDay } from './history.js'
import { activitiesOf } from './activities.js'
import { moodOf, symptomsOf, habitsDoneOn, habitList, suppsTakenOn, suppList, dayTotals, kcalGoalOf, monthDays } from './wellbeing.js'

export const MIN_DAYS = 3
export const MIN_GAP = 0.5        // mood points (1 to 5)
export const MIN_SHARE_GAP = 0.25 // share of days with a symptom (0 to 1)

/** The days anything was trained, as a Set of ISO dates: gym workouts and other sport. */
export function trainedDays(S) {
  const out = new Set()
  for (const w of Array.isArray(S?.workouts) ? S.workouts : []) { const d = workoutDay(w); if (d) out.add(d) }
  for (const a of activitiesOf(S)) if (a.d) out.add(a.d)
  return out
}

/** One row per day of `ym` up to `today` (see rangeRows). */
export const monthRows = (S, ym, today) => rowsFor(S, monthDays(ym), today)

/** One row per day from `from` to `to` (inclusive) up to `today`. */
export const rangeRows = (S, from, to, today) => rowsFor(S, daysBetween(from, to), today)

/** The ISO days from `from` to `to`, inclusive (at most ten years, so a typo cannot spin). */
export function daysBetween(from, to) {
  const out = []
  const d = new Date(from + 'T12:00:00'), end = new Date(to + 'T12:00:00')
  for (let i = 0; d <= end && i < 3660; i++) {
    out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))
    d.setDate(d.getDate() + 1)
  }
  return out
}

/** One row per day of `days` up to `today`: { d, trained, mood, symptoms, worst, habits, supps, kcal, protein, foods }. */
function rowsFor(S, days, today) {
  const trained = trainedDays(S)
  return days.filter(d => !today || d <= today).map(d => {
    const m = moodOf(S, d)
    const s = symptomsOf(S, d)
    const tot = dayTotals(S, d)
    const sym = s ? s.s : {}
    return {
      d,
      trained: trained.has(d),
      mood: m ? m.mood : null,
      reasons: m ? m.reasons : [],
      symptoms: sym,
      worst: Object.values(sym).reduce((a, v) => Math.max(a, v), 0),
      habits: habitsDoneOn(S, d),
      supps: suppsTakenOn(S, d),
      kcal: tot.count ? tot.kcal : null,
      protein: tot.protein,
      foods: tot.count,
    }
  })
}

const avg = xs => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)

/** The month's totals: days logged, mood average, trained days, symptom counts, kcal average, habit rates. */
export function monthSummary(S, rows) {
  const moods = rows.map(r => r.mood).filter(v => v != null)
  const kcals = rows.map(r => r.kcal).filter(v => v != null)
  const symptomDays = {}
  for (const r of rows) for (const [id, v] of Object.entries(r.symptoms)) {
    const x = symptomDays[id] || (symptomDays[id] = { days: 0, severe: 0 })
    x.days++; if (v === 3) x.severe++
  }
  const habits = habitList(S).map(h => ({ id: h.id, name: h.name, std: !!h.std, days: rows.filter(r => r.habits.includes(h.id)).length }))
  const supps = suppList(S).map(x => ({ id: x.id, name: x.name, std: !!x.std, days: rows.filter(r => r.supps.includes(x.id)).length }))
  const goal = kcalGoalOf(S)
  const proteins = rows.map(r => r.protein).filter(v => v != null)
  const reasons = {}
  for (const r of rows) for (const id of r.reasons) reasons[id] = (reasons[id] || 0) + 1
  return {
    kcalTotal: kcals.reduce((a, b) => a + b, 0),
    protein: proteins.length ? Math.round(proteins.reduce((a, b) => a + b, 0) / proteins.length) : null,
    reasons: Object.entries(reasons).map(([id, days]) => ({ id, days })).sort((a, b) => b.days - a.days),
    moodDist: [1, 2, 3, 4, 5].map(v => moods.filter(m => m === v).length),
    days: rows.length,
    logged: rows.filter(r => r.mood != null || r.kcal != null || r.worst || r.habits.length || r.supps.length).length,
    trained: rows.filter(r => r.trained).length,
    mood: avg(moods), moodDays: moods.length,
    kcal: kcals.length ? Math.round(kcals.reduce((a, b) => a + b, 0) / kcals.length) : null, kcalDays: kcals.length,
    overGoal: goal ? kcals.filter(k => k > goal).length : null,
    symptoms: Object.entries(symptomDays).map(([id, x]) => ({ id, ...x })).sort((a, b) => b.days - a.days),
    habits,
    supps,
  }
}

/** Mood on the days `test` holds against the days it does not, or null when either side is thin. */
function moodSplit(rows, test) {
  const yes = [], no = []
  for (const r of rows) if (r.mood != null) (test(r) ? yes : no).push(r.mood)
  if (yes.length < MIN_DAYS || no.length < MIN_DAYS) return null
  const a = avg(yes), b = avg(no)
  return Math.abs(a - b) >= MIN_GAP ? { with: a, without: b, nWith: yes.length, nWithout: no.length } : null
}

/** Share of days with symptom `id` when `test` holds against when it does not. */
function symptomSplit(rows, id, test) {
  const yes = rows.filter(test), no = rows.filter(r => !test(r))
  if (yes.length < MIN_DAYS || no.length < MIN_DAYS) return null
  const share = xs => xs.filter(r => r.symptoms[id]).length / xs.length
  const a = share(yes), b = share(no)
  return Math.abs(a - b) >= MIN_SHARE_GAP ? { with: Math.round(a * 100), without: Math.round(b * 100), nWith: yes.length, nWithout: no.length } : null
}

/**
 * The patterns of the month, strongest first. Each is { kind, key?, ...numbers }:
 *   moodTraining   mood on trained days vs the rest
 *   moodHabit      mood on days habit `key` was kept vs not
 *   moodFood       mood on days at or under the kcal goal vs over it
 *   moodSymptom    mood on days with symptom `key` vs without
 *   symptomTraining  share of days with symptom `key` on trained days vs not
 *   symptomHabit   share of days with symptom `key` when habit `habit` was kept vs not
 * The view words them; this only finds them.
 */
export function monthInsights(S, rows) {
  const out = []
  const push = (kind, r, extra) => { if (r) out.push({ kind, ...extra, ...r, size: Math.abs(r.with - r.without) / (kind.startsWith('symptom') ? 100 : 4) }) }
  push('moodTraining', moodSplit(rows, r => r.trained))
  const habits = habitList(S)
  for (const h of habits) push('moodHabit', moodSplit(rows, r => r.habits.includes(h.id)), { key: h.id, name: h.name, std: !!h.std })
  for (const x of suppList(S)) push('moodSupp', moodSplit(rows, r => r.supps.includes(x.id)), { key: x.id, name: x.name, std: !!x.std })
  const goal = kcalGoalOf(S)
  if (goal) push('moodFood', moodSplit(rows.filter(r => r.kcal != null), r => r.kcal <= goal), { goal })
  const seen = [...new Set(rows.flatMap(r => Object.keys(r.symptoms)))]
  for (const id of seen) {
    push('moodSymptom', moodSplit(rows, r => !!r.symptoms[id]), { key: id })
    push('symptomTraining', symptomSplit(rows, id, r => r.trained), { key: id })
    for (const h of habits) push('symptomHabit', symptomSplit(rows, id, r => r.habits.includes(h.id)), { key: id, habit: h.id, name: h.name, std: !!h.std })
    for (const x of suppList(S)) push('symptomSupp', symptomSplit(rows, id, r => r.supps.includes(x.id)), { key: id, supp: x.id, name: x.name, std: !!x.std })
  }
  return out.sort((a, b) => b.size - a.size)
}

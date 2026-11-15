// Nutrition goals, the daily deficit and water (fork, Wellbeing → Food). Pure: no React, no store.
//
//   S.wbGoals = { [iso]: Goals }          the goals as set on that day; each day follows the newest
//                                          entry on or before it, so a goal is set once and carries on,
//                                          and changing it later leaves the days before as they were.
//   S.wbWater = { [iso]: { ml, _ts } }    water drunk that day.
//
//   Goals = { kcal: { min?, max? }, kcalRest?: { min?, max? }, maint?, protein?: { min?, max? },
//             carbs?: { min?, max? }, fat?: { min?, max? } (g),
//             perKg?: { min?, max?, w }, water?: { min?, max? } (ml), glass? (ml), quality?, _ts }
//
// `kcal` is the target on a training day and on any day when there is no `kcalRest`. A day counts
// as a training day when something was trained on it, and today or later also when the week plan
// has a routine on it. `maint` is what a normal day burns; the deficit is maint minus what was eaten.
// Both maps are stamped maps (lib/sync-merge.js STAMPED_MAPS), like the rest of Wellbeing.
import { dayTotals, habitList, habitsDoneOn, withHabitToggled, NOTE_MAX } from './wellbeing.js'

export const NUTRITION_MAPS = ['wbGoals', 'wbWater']
export const KCAL_PER_KG_FAT = 7700
export const GLASS_ML = 250
export const WATER_MAX = 15000

const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v)
const ISO = /^\d{4}-\d{2}-\d{2}$/
const mapOf = (S, k) => (isMap(S?.[k]) ? S[k] : {})
const num = (v, lo, hi) => {
  const n = Number(v)
  return v !== null && v !== '' && v !== undefined && Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n * 10) / 10 : null
}

/** A { min, max } range from anything, both ends optional, swapped if given the wrong way round. Null when empty. */
export function readRange(r, lo, hi) {
  if (!isMap(r)) return null
  let min = num(r.min, lo, hi), max = num(r.max, lo, hi)
  if (min != null && max != null && min > max) [min, max] = [max, min]
  if (min == null && max == null) return null
  return { ...(min != null ? { min } : {}), ...(max != null ? { max } : {}) }
}

/** Clean goals, or null when nothing in them is set. */
export function readGoals(e) {
  if (!isMap(e)) return null
  const out = {}
  const kcal = readRange(e.kcal, 500, 10000); if (kcal) out.kcal = kcal
  const rest = readRange(e.kcalRest, 500, 10000); if (rest) out.kcalRest = rest
  const maint = num(e.maint, 800, 10000); if (maint != null) out.maint = Math.round(maint)
  const protein = readRange(e.protein, 1, 1000); if (protein) out.protein = protein
  const carbs = readRange(e.carbs, 1, 1500); if (carbs) out.carbs = carbs
  const fat = readRange(e.fat, 1, 500); if (fat) out.fat = fat
  if (isMap(e.perKg)) {
    const r = readRange(e.perKg, 0.1, 5), w = num(e.perKg.w, 20, 400)
    if (r && w) out.perKg = { ...r, w }
  }
  const water = readRange(e.water, 100, WATER_MAX); if (water) out.water = water
  const glass = num(e.glass, 50, 2000); if (glass) out.glass = Math.round(glass)
  const q = typeof e.quality === 'string' ? e.quality.trim().slice(0, NOTE_MAX) : ''
  if (q) out.quality = q
  return Object.keys(out).length ? out : null
}

/**
 * The goals that hold on `iso`: the newest entry on or before it. Before any entry, the one plain
 * calorie goal of the first version (S.kcalGoal), read as a ceiling. Null when nothing is set.
 */
export function goalsOn(S, iso) {
  const map = mapOf(S, 'wbGoals')
  const keys = Object.keys(map).filter(k => ISO.test(k) && k <= iso).sort()
  for (let i = keys.length - 1; i >= 0; i--) {
    const g = readGoals(map[keys[i]])
    if (g) return g
    // An entry cleared on purpose ({ _ts } alone) means "no goals from here on".
    if (isMap(map[keys[i]]) && Object.keys(map[keys[i]]).every(k => k === '_ts')) return null
  }
  const legacy = num(S?.kcalGoal, 500, 10000)
  return legacy ? { kcal: { max: Math.round(legacy) } } : null
}

/** The goals as they stand today, for the editor. */
export const currentGoals = (S, today) => goalsOn(S, today)

/** S.wbGoals with the goals from `iso` on set to `goals` (null clears them from that day). */
export function withGoals(map, iso, goals, now = Date.now()) {
  const clean = goals ? readGoals(goals) : null
  return { ...(isMap(map) ? map : {}), [iso]: clean ? { ...clean, _ts: now } : { _ts: now } }
}

/** True when the week plan has a routine on the weekday of `iso`. */
export function plannedOn(S, iso) {
  const day = new Date(iso + 'T12:00:00').getDay()
  const v = isMap(S?.week) ? S.week[day] : null
  return [].concat(v ?? []).filter(Boolean).length > 0
}

/** Training day or not: trained on it, or (today and later) a routine planned for it. */
export function isTrainingDay(S, iso, today, trained) {
  if (trained && trained.has(iso)) return true
  return !!today && iso >= today && plannedOn(S, iso)
}

/** The calorie range of a day, from its goals and whether it is a training day. */
export const kcalTarget = (goals, training) => (goals ? (!training && goals.kcalRest) || goals.kcal || null : null)

/** Where `v` sits against a range: 'under', 'in', 'over', or null without a range or a value. */
export function rangeStatus(v, r) {
  if (v == null || !r) return null
  if (r.max != null && v > r.max) return 'over'
  if (r.min != null && v < r.min) return 'under'
  return 'in'
}

/* ---------------- water ---------------- */

export function waterOn(S, iso) {
  const e = mapOf(S, 'wbWater')[iso]
  return isMap(e) ? num(e.ml, 0, WATER_MAX) || 0 : 0
}

/** S.wbWater with `iso` set to `ml` (0 clears the day). */
export function withWater(map, iso, ml, now = Date.now()) {
  const v = Math.max(0, Math.min(WATER_MAX, Math.round(Number(ml) || 0)))
  return { ...(isMap(map) ? map : {}), [iso]: v ? { ml: v, _ts: now } : { _ts: now } }
}

export const glassOf = goals => goals?.glass || GLASS_ML

/** The water a day should reach: the goal's lower end, else its upper end, else 3 L (the built-in habit). */
export const waterAim = goals => goals?.water?.min ?? goals?.water?.max ?? 3000

/**
 * State `s` after setting the water of `iso` to `ml`. Crossing the aim ticks the "Drink water"
 * habit when it is on the list and not ticked yet; nothing ever unticks it, that stays yours.
 */
export function applyWater(s, iso, ml, today, now = Date.now()) {
  const before = waterOn(s, iso)
  s.wbWater = withWater(s.wbWater, iso, ml, now)
  const aim = waterAim(goalsOn(s, iso || today))
  const after = waterOn(s, iso)
  if (before < aim && after >= aim && habitList(s).some(h => h.id === 'water')) {
    const done = habitsDoneOn(s, iso)
    if (!done.includes('water')) s.wbHabits = withHabitToggled(s.wbHabits, iso, done, 'water', now)
  }
  return s
}

/* ---------------- one day ---------------- */

/**
 * Everything the Food and Water cards show for `iso`:
 *   { kcal, protein, count, water, goals, training, target, status, deficit, protein status, water status }
 * `deficit` is maintenance minus what was eaten (negative is a surplus), null without a maintenance
 * or without anything logged. `trained` is the Set of trained days (wellbeing-insights trainedDays).
 */
export function dayNutrition(S, iso, { today, trained } = {}) {
  const tot = dayTotals(S, iso)
  const goals = goalsOn(S, iso)
  const training = isTrainingDay(S, iso, today, trained)
  const target = kcalTarget(goals, training)
  const water = waterOn(S, iso)
  return {
    kcal: tot.kcal, protein: tot.protein, carbs: tot.carbs, fat: tot.fat, count: tot.count, foods: tot.foods, suppKcal: tot.suppKcal, water,
    goals, training, target,
    status: tot.count ? rangeStatus(tot.kcal, target) : null,
    deficit: goals?.maint && tot.count ? goals.maint - tot.kcal : null,
    proteinStatus: tot.protein != null ? rangeStatus(tot.protein, goals?.protein) : null,
    waterStatus: goals?.water ? rangeStatus(water, goals.water) : null,
  }
}

/* ---------------- a stretch of days ---------------- */

/**
 * The nutrition of `days` (ISO dates): how many days had food logged, how many landed inside the
 * calorie range, under or over it, the deficit added up over the days that have one, its average
 * and what it comes to in body fat, the days protein reached its goal, and water.
 */
export function periodNutrition(S, days, ctx = {}) {
  let food = 0, inT = 0, under = 0, over = 0, withTarget = 0
  let deficit = 0, deficitDays = 0, protMet = 0, protDays = 0, water = 0, waterDays = 0, waterMet = 0
  const perDay = []
  // Today is not over yet: its deficit would only say what has not been eaten so far.
  for (const d of days.filter(x => !ctx.today || x < ctx.today)) {
    const n = dayNutrition(S, d, ctx)
    if (n.water > 0) { water += n.water; waterDays++; if (n.water >= waterAim(n.goals)) waterMet++ }
    if (!n.count) { perDay.push({ d, deficit: null, status: null }); continue }
    food++
    if (n.status) { withTarget++; if (n.status === 'in') inT++; else if (n.status === 'under') under++; else over++ }
    if (n.deficit != null) { deficit += n.deficit; deficitDays++ }
    if (n.proteinStatus) { protDays++; if (n.proteinStatus !== 'under') protMet++ }
    perDay.push({ d, deficit: n.deficit, status: n.status, kcal: n.kcal })
  }
  return {
    foodDays: food, withTarget, inTarget: inT, under, over,
    deficit: deficitDays ? deficit : null, deficitDays,
    avgDeficit: deficitDays ? Math.round(deficit / deficitDays) : null,
    fatKg: deficitDays ? Math.round(deficit / KCAL_PER_KG_FAT * 100) / 100 : null,
    proteinMet: protMet, proteinDays: protDays,
    water: waterDays ? Math.round(water / waterDays) : null, waterDays, waterMet,
    perDay,
  }
}

/* ---------------- helpers for the editor ---------------- */

/** Body weight in kg for the g/kg protein goal: the target weight if set, else the last weigh-in. */
export function weightKg(S) {
  const list = Array.isArray(S?.bodyweight) ? S.bodyweight : []
  const w = Number(S?.targetW) > 0 ? Number(S.targetW) : Number(list[list.length - 1]?.w) || null
  if (!w) return null
  return Math.round((S?.unit === 'lb' ? w * 0.45359237 : w) * 10) / 10
}

/** Grams of protein for `perKg` g/kg at `w` kg. */
export const proteinFromKg = (perKg, w) => (Number(perKg) > 0 && Number(w) > 0 ? Math.round(perKg * w) : null)

/** A rough maintenance: about 31 kcal per kg for someone who trains a few times a week. */
export const maintEstimate = w => (Number(w) > 0 ? Math.round(w * 31 / 10) * 10 : null)

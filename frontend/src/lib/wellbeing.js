// Wellbeing (fork module, Settings → Modules → Wellbeing): what you ate, how you felt, which
// symptoms showed up and which habits you kept, day by day, so the month can be read next to the
// training log. Pure: no React, no store, no i18n. Labels are English source strings, translated
// where they are shown (views/Wellbeing.jsx).
//
// Every map below is a stamped map (lib/sync-merge.js STAMPED_MAPS, and api/sync-stamps.js): each
// entry carries `_ts`, the time it was last written, so a phone and a laptop that each logged
// something keep both, and the same entry keeps the later edit. A removal is a stamped empty entry
// (`{ _ts }`), never a deleted key, or the other device's copy would bring it back.
//
//   S.wbFood     = { [id]:   { d, name, kcal, grams?, kcal100?, protein?, carbs?, fat?, meal, src?, code?, _ts } }  one per food eaten
//   S.wbMood     = { [iso]:  { mood: 1..5, reasons: [..], note?, _ts } }                       one per day
//   S.wbSymptoms = { [iso]:  { s: { [symptomId]: 1..3 }, note?, _ts } }                        one per day
//   S.wbHabits   = { [iso]:  { done: [habitId, ..], _ts } }                                    one per day
//   S.wbHabitDefs   = { [habitId]: { name, order, _ts } }                                     the habits you track
//   S.wbSymptomDefs = { [symptomId]: { name, _ts } }                                          symptoms of your own
//   S.kcalGoal   = number | null                                                               a plain setting

export const WB_MAPS = ['wbFood', 'wbMood', 'wbSymptoms', 'wbHabits', 'wbHabitDefs', 'wbSymptomDefs', 'wbSupps', 'wbSuppDefs', 'wbFoodFavs', 'wbReasonDefs', 'wbGoals', 'wbWater']

export const MOODS = [1, 2, 3, 4, 5]
export const MOOD_LABEL = { 1: 'Very bad', 2: 'Bad', 3: 'Okay', 4: 'Good', 5: 'Very good' }
export const MOOD_FACE = { 1: '😞', 2: '🙁', 3: '😐', 4: '🙂', 5: '😄' }

export const MOOD_REASONS = ['work', 'sleep', 'training', 'family', 'partner', 'friends', 'health', 'money', 'food', 'weather']
export const REASON_LABEL = {
  work: 'Work', sleep: 'Sleep', training: 'Training', family: 'Family', partner: 'Partner',
  friends: 'Friends', health: 'Health', money: 'Money', food: 'Food', weather: 'Weather',
}

export const SYMPTOMS = ['headache', 'muscle', 'joint', 'back', 'fatigue', 'stress', 'anxiety', 'insomnia', 'digestive', 'nausea', 'dizziness', 'cold']
export const SYMPTOM_LABEL = {
  headache: 'Headache', muscle: 'Muscle pain', joint: 'Joint pain', back: 'Back pain', fatigue: 'Fatigue',
  stress: 'Stress', anxiety: 'Anxiety', insomnia: 'Poor sleep', digestive: 'Stomach trouble', nausea: 'Nausea',
  dizziness: 'Dizziness', cold: 'Cold or flu',
}
export const SEVERITIES = [1, 2, 3]
export const SEVERITY_LABEL = { 1: 'Mild', 2: 'Moderate', 3: 'Severe' }

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack']
export const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' }

// The lists of habits and supplements start with these, shown until you edit the list (nothing is
// stored for them till then). Names are English source strings: an item that came from here keeps
// `std: true` once stored, so it is still shown in the reader's language.
export const HABIT_DEFAULTS = [
  { id: 'water', name: 'Drink 3 L of water' }, { id: 'sleep7', name: 'Sleep 7 hours or more' },
  { id: 'noalcohol', name: 'No alcohol' }, { id: 'meditate', name: 'Meditate or breathe 5 min' },
  { id: 'protein', name: 'Enough protein' }, { id: 'steps', name: '10,000 steps' },
  { id: 'noscreens', name: 'No screens before bed' },
]
export const HABIT_IDEAS = HABIT_DEFAULTS.map(h => h.name)

export const NAME_MAX = 60
export const NOTE_MAX = 280
export const KCAL_MAX = 10000

const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v)
const ISO = /^\d{4}-\d{2}-\d{2}$/
export const isISO = v => ISO.test(String(v || ''))
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const num = (v, lo, hi) => {
  const n = Number(v)
  return v !== null && v !== '' && Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n * 10) / 10 : null
}
const mapOf = (S, k) => (isMap(S?.[k]) ? S[k] : {})
const stamp = (map, key, entry) => ({ ...(isMap(map) ? map : {}), [key]: entry })

/* ---------------- mood ---------------- */

export function readMood(e) {
  if (!isMap(e)) return null
  const mood = MOODS.includes(e.mood) ? e.mood : null
  if (!mood) return null
  // Built-in reasons and your own ones (ids from S.wbReasonDefs, which the screen resolves).
  const reasons = Array.isArray(e.reasons) ? [...new Set(e.reasons.filter(r => MOOD_REASONS.includes(r) || REASON_ID.test(String(r))))] : []
  const note = str(e.note, NOTE_MAX)
  return { mood, reasons, note }
}
export const moodOf = (S, iso) => readMood(mapOf(S, 'wbMood')[iso])
const REASON_ID = /^own-[\w-]{1,40}$/

/**
 * The reasons a mood can have, as { id, label, own }: the built-in ones you kept, then your own.
 * Stored like the symptoms list: S.wbReasonDefs = { [builtInId]: { hidden: true }, [ownId]: { name } }.
 */
export function reasonList(S) {
  const defs = mapOf(S, 'wbReasonDefs')
  const own = Object.entries(defs)
    .filter(([id]) => !MOOD_REASONS.includes(id))
    .map(([id, e]) => ({ id, name: str(e?.name, NAME_MAX), _ts: Number(e?._ts) || 0 }))
    .filter(x => x.name).sort((a, b) => a._ts - b._ts)
  return [
    ...MOOD_REASONS.filter(id => defs[id]?.hidden !== true).map(id => ({ id, label: REASON_LABEL[id], own: false })),
    ...own.map(x => ({ id: x.id, label: x.name, own: true })),
  ]
}
export const hiddenReasons = S => MOOD_REASONS.filter(id => mapOf(S, 'wbReasonDefs')[id]?.hidden === true)
export const withReasonShown = (map, id, shown, now = Date.now()) => stamp(map, id, shown ? { _ts: now } : { hidden: true, _ts: now })
export function withOwnReason(map, id, name, now = Date.now()) {
  const n = str(name, NAME_MAX)
  return stamp(map, id, n ? { name: n, _ts: now } : { _ts: now })
}

/** S.wbMood with `iso` set to `m` ({ mood, reasons, note }), stamped `now`. No mood clears the day. */
export function withMood(map, iso, m, now = Date.now()) {
  const clean = readMood(m)
  if (!clean) return stamp(map, iso, { _ts: now })
  return stamp(map, iso, { mood: clean.mood, ...(clean.reasons.length ? { reasons: clean.reasons } : {}), ...(clean.note ? { note: clean.note } : {}), _ts: now })
}

/* ---------------- symptoms ---------------- */

/**
 * Every symptom you can pick, as { id, label, own }: the built-in ones you did not take off the list,
 * then your own. A built-in one taken off is stored as { hidden: true } under its own id.
 */
export function symptomList(S) {
  const defs = mapOf(S, 'wbSymptomDefs')
  const own = Object.entries(defs)
    .filter(([id]) => !SYMPTOMS.includes(id))
    .map(([id, e]) => ({ id, name: str(e?.name, NAME_MAX), _ts: Number(e?._ts) || 0 }))
    .filter(x => x.name).sort((a, b) => a._ts - b._ts)
  return [
    ...SYMPTOMS.filter(id => defs[id]?.hidden !== true).map(id => ({ id, label: SYMPTOM_LABEL[id], own: false })),
    ...own.map(x => ({ id: x.id, label: x.name, own: true })),
  ]
}

/** The built-in symptoms taken off the list: ids, to offer back in the editor. */
export const hiddenSymptoms = S => SYMPTOMS.filter(id => mapOf(S, 'wbSymptomDefs')[id]?.hidden === true)

/** S.wbSymptomDefs with built-in symptom `id` taken off the list or put back. */
export function withSymptomShown(map, id, shown, now = Date.now()) {
  return stamp(map, id, shown ? { _ts: now } : { hidden: true, _ts: now })
}

export function readSymptoms(e) {
  if (!isMap(e) || !isMap(e.s)) return null
  const s = {}
  for (const [id, v] of Object.entries(e.s)) if (SEVERITIES.includes(v) && id) s[id] = v
  const note = str(e.note, NOTE_MAX)
  return Object.keys(s).length || note ? { s, note } : null
}
export const symptomsOf = (S, iso) => readSymptoms(mapOf(S, 'wbSymptoms')[iso])

/** S.wbSymptoms with `iso` set to `{ s, note }`. Nothing left clears the day. */
export function withSymptoms(map, iso, value, now = Date.now()) {
  const clean = readSymptoms({ s: value?.s || {}, note: value?.note })
  if (!clean) return stamp(map, iso, { _ts: now })
  return stamp(map, iso, { s: clean.s, ...(clean.note ? { note: clean.note } : {}), _ts: now })
}

/** The next severity a tap gives: none → mild → moderate → severe → none. */
export const nextSeverity = v => (v === 3 ? 0 : (SEVERITIES.includes(v) ? v : 0) + 1)

/** S.wbSymptomDefs with a symptom of your own added (id from the caller), or renamed. */
export function withOwnSymptom(map, id, name, now = Date.now()) {
  const n = str(name, NAME_MAX)
  return stamp(map, id, n ? { name: n, _ts: now } : { _ts: now })
}

/* ---------------- habits ---------------- */

/**
 * A list stored in `map` as { [id]: { name, dose?, std?, order, _ts } }, in order. An empty map (never
 * edited) is the defaults. `std` marks a name that is an English source string, shown translated.
 */
const pick = d => (d ? { ...(d.kcal ? { kcal: d.kcal } : {}), ...(d.protein ? { protein: d.protein } : {}) } : {})
function listOf(map, defaults, withDose) {
  const entries = Object.entries(isMap(map) ? map : {})
  const extra = e => (withDose ? suppExtra(e) : {})
  if (!entries.length) return defaults.map((x, i) => ({ id: x.id, name: x.name, ...extra(x), std: true, order: i }))
  return entries
    // A suggested supplement stored before kinds existed takes the suggestion's kcal and protein.
    .map(([id, e]) => ({ id, name: str(e?.name, NAME_MAX), ...extra(withDose && e?.std === true && !e.kind ? { ...pick(defaults.find(d => d.id === id)), ...e } : e), std: e?.std === true, order: Number(e?.order) || 0, _ts: Number(e?._ts) || 0 }))
    .filter(x => x.name)
    .sort((a, b) => a.order - b.order || a._ts - b._ts)
    .map(({ _ts, ...x }) => x)
}
const defOf = (n, d, std, order, now, times = 1, more = null) => ({
  name: n, ...(d ? { dose: d } : {}), ...(timesOf(times) > 1 ? { times: timesOf(times) } : {}), ...(more ? cleanSuppMore(more) : {}),
  ...(std ? { std: true } : {}), order: Number(order) || 0, _ts: now,
})

/**
 * `map` with the list as it shows now written out item by item: done before the first edit of a
 * list that still shows its defaults, so the edit lands on a list that is stored.
 */
export function materialize(map, list, now = Date.now()) {
  if (isMap(map) && Object.keys(map).length) return map
  const out = {}
  for (const x of list) out[x.id] = defOf(x.name, x.dose, x.std, x.order, now, x.times, x.kind ? x : null)
  return out
}

/** How many times a day something is taken: a whole number from 1 to TIMES_MAX, 1 when unset. */
export const TIMES_MAX = 6
export const timesOf = v => (Number.isInteger(+v) && +v >= 1 ? Math.min(TIMES_MAX, +v) : 1)

/** The habits you track, in their order: [{ id, name, std, order }]. */
export const habitList = S => listOf(S?.wbHabitDefs, HABIT_DEFAULTS, false)

/** S.wbHabitDefs with habit `id` named `name` (empty removes it), at `order`. */
export function withHabitDef(map, id, name, order, now = Date.now(), std = false) {
  const n = str(name, NAME_MAX)
  const base = materialize(map, listOf(map, HABIT_DEFAULTS, false), now)
  return stamp(base, id, n ? defOf(n, '', std, order, now) : { _ts: now })
}

/** The ids of the habits done on `iso` (only habits that still exist). */
export function habitsDoneOn(S, iso) {
  const e = mapOf(S, 'wbHabits')[iso]
  const live = new Set(habitList(S).map(h => h.id))
  return isMap(e) && Array.isArray(e.done) ? [...new Set(e.done.filter(id => live.has(id)))] : []
}

/** S.wbHabits with habit `id` ticked or unticked on `iso`. `done` is what the day had before. */
export function withHabitToggled(map, iso, done, id, now = Date.now()) {
  const set = new Set(Array.isArray(done) ? done : [])
  if (set.has(id)) set.delete(id); else set.add(id)
  return stamp(map, iso, set.size ? { done: [...set], _ts: now } : { _ts: now })
}

/* ---------------- supplements ---------------- */

// Supplements and medicine, each with a dose (an amount and its unit: 30 g, 2000 IU, 1 tablet) and
// how many times a day it is taken. Every tap on a day adds one intake; the day is complete at
// `times`, and one more tap starts it over (a mistap is one tap away from undone).
// A supplement may carry kcal and protein per intake (a protein shake); each intake taken counts
// toward the day's food (dayTotals). A medicine never does.
//   S.wbSuppDefs = { [suppId]: { name, kind?, amount?, unit?, dose?, kcal?, protein?, times?, order, _ts } }
//   S.wbSupps    = { [iso]: { counts: { [suppId]: n }, _ts } }   (older days: { taken: [suppId] }, read as complete)
// `dose` is the text of the first version ("30 g"); an entry without `amount` is read from it.

export const SUPP_KINDS = ['supp', 'med']
export const DOSE_UNITS = ['g', 'mg', 'µg', 'ml', 'IU', 'tablet', 'capsule', 'drops', 'scoop']
export const UNIT_LABEL = { tablet: 'tablet', capsule: 'capsule', drops: 'drops', scoop: 'scoop' }

/** The supplements list starts with these; SUPP_MORE are offered in the editor. English source strings. */
export const SUPP_DEFAULTS = [
  { id: 'vitd', name: 'Vitamin D', amount: 2000, unit: 'IU' }, { id: 'magnesium', name: 'Magnesium', amount: 300, unit: 'mg' },
  { id: 'creatine', name: 'Creatine', amount: 5, unit: 'g' }, { id: 'protein', name: 'Protein powder', amount: 30, unit: 'g', kcal: 120, protein: 24 },
  { id: 'omega3', name: 'Omega-3', amount: 1, unit: 'g' }, { id: 'multi', name: 'Multivitamin', amount: 1, unit: 'tablet' },
].map(x => ({ kind: 'supp', ...x }))
export const SUPP_MORE = [
  { id: 'zinc', name: 'Zinc', amount: 15, unit: 'mg' }, { id: 'vitc', name: 'Vitamin C', amount: 500, unit: 'mg' },
].map(x => ({ kind: 'supp', ...x }))
export const SUPP_IDEAS = [...SUPP_DEFAULTS, ...SUPP_MORE]
export const DOSE_MAX = 30

/** "30 g" → { amount: 30, unit: 'g' }; anything else → { amount: null, unit: null }. */
export function parseDose(s) {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*([^\d\s].*)?$/.exec(String(s || ''))
  if (!m) return { amount: null, unit: null }
  const amount = Number(m[1].replace(',', '.'))
  const raw = (m[2] || '').trim().toLowerCase()
  const unit = DOSE_UNITS.find(u => u.toLowerCase() === raw) || (raw === 'ui' ? 'IU' : raw === 'mcg' || raw === 'ug' ? 'µg' : /^tab/.test(raw) ? 'tablet' : /^cap/.test(raw) ? 'capsule' : null)
  return { amount: Number.isFinite(amount) ? amount : null, unit }
}

/** The fields of a supplement beyond its name, cleaned: kind, amount, unit, kcal, protein. */
function cleanSuppMore(e) {
  const out = {}
  if (SUPP_KINDS.includes(e.kind)) out.kind = e.kind
  const amount = num(e.amount, 0, 100000); if (amount != null && amount > 0) out.amount = amount
  if (DOSE_UNITS.includes(e.unit)) out.unit = e.unit
  if (out.kind !== 'med') {
    const kcal = num(e.kcal, 0, 5000); if (kcal) out.kcal = Math.round(kcal)
    const protein = num(e.protein, 0, 500); if (protein) out.protein = protein
  }
  return out
}

/** The dose as text: amount and unit, else the text of the first version. */
export const doseText = (x, tr = s => s) => (x.amount ? `${x.amount} ${UNIT_LABEL[x.unit] ? tr(UNIT_LABEL[x.unit]) : x.unit || ''}`.trim() : x.dose || '')

function suppExtra(e) {
  const more = cleanSuppMore(e || {})
  const parsed = more.amount ? {} : parseDose(e?.dose)
  return {
    kind: more.kind || 'supp',
    amount: more.amount ?? parsed.amount ?? null, unit: more.unit ?? parsed.unit ?? null,
    dose: str(e?.dose, DOSE_MAX), kcal: more.kcal ?? null, protein: more.protein ?? null, times: timesOf(e?.times),
  }
}

/** Your supplements, in their order: [{ id, name, dose, std, order }]. */
export const suppList = S => listOf(S?.wbSuppDefs, SUPP_DEFAULTS, true)

/**
 * S.wbSuppDefs with supplement `id` set (an empty name removes it), taken `times` a day. `more` is
 * { kind, amount, unit, kcal, protein }; given an amount, the dose text is written from it.
 */
export function withSuppDef(map, id, name, dose, order, now = Date.now(), std = false, times = 1, more = null) {
  const n = str(name, NAME_MAX)
  const m = more ? cleanSuppMore(more) : null
  const d = m?.amount ? doseText(m) : str(dose, DOSE_MAX)
  const base = materialize(map, listOf(map, SUPP_DEFAULTS, true), now)
  return stamp(base, id, n ? defOf(n, d, std, order, now, times, m) : { _ts: now })
}

/** kcal and protein the supplements of `iso` add to the day: each intake taken, supplements only. */
export function suppNutritionOn(S, iso) {
  const counts = suppCountsOn(S, iso)
  let kcal = 0, protein = 0, items = 0
  for (const x of suppList(S)) {
    const n = counts[x.id] || 0
    if (!n || x.kind === 'med' || (!x.kcal && !x.protein)) continue
    kcal += n * (x.kcal || 0); protein += n * (x.protein || 0); items++
  }
  return { kcal: Math.round(kcal), protein: Math.round(protein * 10) / 10, items }
}

/** How many intakes of each supplement `iso` has: { [suppId]: n }, only ones that still exist, capped at their times. */
export function suppCountsOn(S, iso) {
  const e = mapOf(S, 'wbSupps')[iso]
  const out = {}
  if (!isMap(e)) return out
  for (const x of suppList(S)) {
    const n = isMap(e.counts) && Number.isInteger(e.counts[x.id]) ? e.counts[x.id]
      : Array.isArray(e.taken) && e.taken.includes(x.id) ? x.times : 0
    if (n > 0) out[x.id] = Math.min(n, x.times)
  }
  return out
}

/** The ids of the supplements taken in full on `iso`: every intake of the day. */
export function suppsTakenOn(S, iso) {
  const counts = suppCountsOn(S, iso)
  return suppList(S).filter(x => (counts[x.id] || 0) >= x.times).map(x => x.id)
}

/** The next count a tap gives: one more intake, and from complete back to none. */
export const nextIntake = (n, times) => ((n || 0) >= timesOf(times) ? 0 : (n || 0) + 1)

/** S.wbSupps with one tap on supplement `id` on `iso`. `counts` is what the day had before (suppCountsOn). */
export function withSuppTap(map, iso, counts, id, times, now = Date.now()) {
  const next = { ...(isMap(counts) ? counts : {}) }
  const n = nextIntake(next[id], times)
  if (n) next[id] = n; else delete next[id]
  return stamp(map, iso, Object.keys(next).length ? { counts: next, _ts: now } : { _ts: now })
}

/* ---------------- food ---------------- */

export function readFood(e) {
  if (!isMap(e) || !isISO(e.d)) return null
  const name = str(e.name, NAME_MAX)
  const kcal = num(e.kcal, 0, KCAL_MAX)
  if (!name || kcal == null) return null
  const out = { d: e.d, name, kcal: Math.round(kcal), meal: MEALS.includes(e.meal) ? e.meal : 'snack' }
  const grams = num(e.grams, 0, 5000); if (grams) out.grams = grams
  const k100 = num(e.kcal100, 0, 1000); if (k100 != null) out.kcal100 = k100
  const protein = num(e.protein, 0, 1000); if (protein != null) out.protein = protein
  const carbs = num(e.carbs, 0, 1000); if (carbs != null) out.carbs = carbs
  const fat = num(e.fat, 0, 1000); if (fat != null) out.fat = fat
  if (e.src === 'off' || e.src === 'manual' || e.src === 'basic') out.src = e.src
  if (typeof e.code === 'string' && /^\d{4,20}$/.test(e.code)) out.code = e.code
  return out
}

/** S.wbFood with entry `id` set to `food` (null removes it), stamped `now`. */
export function withFood(map, id, food, now = Date.now()) {
  const clean = food ? readFood(food) : null
  return stamp(map, id, clean ? { ...clean, _ts: now } : { _ts: now })
}

/** Everything eaten on `iso`: [{ id, ...food }], in meal order then as logged. */
export function foodsOn(S, iso) {
  const out = []
  for (const [id, e] of Object.entries(mapOf(S, 'wbFood'))) {
    if (e?.d !== iso) continue
    const f = readFood(e)
    if (f) out.push({ id, ...f, _ts: Number(e._ts) || 0 })
  }
  return out.sort((a, b) => MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal) || a._ts - b._ts)
}

/**
 * { kcal, protein, count, foods, suppKcal, suppProtein } of a day: the foods eaten plus the
 * supplements taken that carry kcal or protein. `count` is both together (what makes a day "logged"),
 * `foods` the foods alone. Protein is null when nothing logged carries it.
 */
export function dayTotals(S, iso) {
  const foods = foodsOn(S, iso)
  const sup = suppNutritionOn(S, iso)
  const kcal = foods.reduce((a, f) => a + f.kcal, 0) + sup.kcal
  const withP = foods.filter(f => f.protein != null)
  const protein = withP.length || sup.protein ? Math.round(withP.reduce((a, f) => a + f.protein, 0) + sup.protein) : null
  // Carbohydrates and fat, like protein: null until something logged carries them.
  const sumOf = k => { const xs = foods.filter(f => f[k] != null); return xs.length ? Math.round(xs.reduce((a, f) => a + f[k], 0)) : null }
  return { kcal, protein, carbs: sumOf('carbs'), fat: sumOf('fat'), count: foods.length + sup.items, foods: foods.length, suppKcal: sup.kcal, suppProtein: sup.protein }
}

/**
 * S.wbFood with `foods` (from foodsOn) logged again on `toDay`, each as a new entry in the same
 * meal, or in `meal` when one is given. `newId` makes the ids (uid in the app).
 */
export function withFoodsCopied(map, foods, toDay, { meal = null, now = Date.now(), newId } = {}) {
  let out = isMap(map) ? map : {}
  let i = 0
  for (const f of Array.isArray(foods) ? foods : []) {
    const { id, _ts, ...food } = f
    out = withFood(out, newId ? newId() : `f-copy-${now}-${i}`, { ...food, d: toDay, meal: meal || food.meal }, now + i)
    i++
  }
  return out
}

/** kcal from a per-100 g value and grams, rounded. */
export const kcalFor = (kcal100, grams) => (Number(kcal100) >= 0 && Number(grams) > 0 ? Math.round(Number(kcal100) * Number(grams) / 100) : null)

/**
 * Foods you logged before, most used first, one per name: the quick picks of the food sheet.
 * Each keeps the last way it was logged (grams, per-100 g value), so a tap logs it the same again.
 */
export function recentFoods(S, limit = 12) {
  const by = new Map()
  for (const e of Object.values(mapOf(S, 'wbFood'))) {
    const f = readFood(e)
    if (!f) continue
    const key = f.name.toLowerCase()
    const prev = by.get(key)
    const ts = Number(e._ts) || 0
    if (!prev) by.set(key, { food: f, n: 1, ts })
    else { prev.n++; if (ts > prev.ts) { prev.food = f; prev.ts = ts } }
  }
  return [...by.values()].sort((a, b) => b.n - a.n || b.ts - a.ts).slice(0, limit).map(x => x.food)
}

/* ---------------- favourite foods ---------------- */

// Foods you keep at hand: S.wbFoodFavs = { [favId]: { name, kcal100?, protein100?, carbs100?, fat100?, grams?, kcal?, protein?, carbs?, fat?, src?, _ts } }.
// A food is either per 100 g (kcal100, with the grams you usually eat) or a fixed portion (kcal).
// The id comes from the name, so the same food starred on two devices is one favourite.

const foldName = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
export const favIdOf = name => 'fav:' + foldName(name).slice(0, NAME_MAX)

export function readFav(e) {
  if (!isMap(e)) return null
  const name = str(e.name, NAME_MAX)
  const kcal100 = num(e.kcal100, 0, 1000)
  const kcal = num(e.kcal, 0, KCAL_MAX)
  if (!name || (kcal100 == null && kcal == null)) return null
  const out = { name }
  if (kcal100 != null) out.kcal100 = kcal100; else out.kcal = Math.round(kcal)
  for (const k of ['protein', 'carbs', 'fat']) {
    const per100 = num(e[k + '100'], 0, 100); if (per100 != null) out[k + '100'] = per100
    const v = num(e[k], 0, 1000); if (v != null) out[k] = v
  }
  const grams = num(e.grams, 0, 5000); if (grams) out.grams = grams
  if (['off', 'manual', 'basic'].includes(e.src)) out.src = e.src
  return out
}

/** Your favourite foods, as starred (newest last): [{ id, ...fav }]. */
export function favFoods(S) {
  return Object.entries(mapOf(S, 'wbFoodFavs'))
    .map(([id, e]) => { const f = readFav(e); return f ? { id, ...f, _ts: Number(e._ts) || 0 } : null })
    .filter(Boolean).sort((a, b) => a._ts - b._ts)
}

export const isFavFood = (S, name) => !!readFav(mapOf(S, 'wbFoodFavs')[favIdOf(name)])

/** S.wbFoodFavs with `food` starred (null or a name alone takes the star off). */
export function withFav(map, name, food, now = Date.now()) {
  const clean = food ? readFav({ ...food, name }) : null
  return stamp(map, favIdOf(name), clean ? { ...clean, _ts: now } : { _ts: now })
}

/** Favourites and recent foods whose name holds every word of `q`, favourites first, one per name. */
export function myFoodsMatching(S, q, limit = 8) {
  const words = foldName(q).split(' ').filter(Boolean)
  const seen = new Set()
  const out = []
  for (const [f, fav] of [...favFoods(S).map(f => [f, true]), ...recentFoods(S, 50).map(f => [f, false])]) {
    const key = foldName(f.name)
    if (seen.has(key) || !words.every(w => key.includes(w))) continue
    seen.add(key)
    out.push({ ...f, fav })
    if (out.length >= limit) break
  }
  return out
}

/** The daily kcal goal, or null. */
export const kcalGoalOf = S => num(S?.kcalGoal, 500, KCAL_MAX)

/* ---------------- the month ---------------- */

/** The ISO days of month `ym` ('2026-11'). */
export function monthDays(ym) {
  const [y, m] = String(ym).split('-').map(Number)
  if (!y || !m) return []
  const n = new Date(y, m, 0).getDate()
  return Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)
}

/** 'YYYY-MM' moved by `delta` months. */
export function shiftMonth(ym, delta) {
  const [y, m] = String(ym).split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
}

/** 'YYYY-MM-DD' moved by `delta` days. */
export function shiftDay(iso, delta) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + delta)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

/* ---------------- periods for the Detail view ---------------- */

const isoDay = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')

/**
 * The days a period covers around `anchor` (an ISO day): 'week' runs Monday to Sunday (or Sunday to
 * Saturday with weekStart 0), 'month' and 'year' are calendar ones. { from, to }.
 */
export function periodRange(kind, anchor, weekStart = 1) {
  const d = new Date(anchor + 'T12:00:00')
  if (kind === 'week') {
    const back = (d.getDay() - weekStart + 7) % 7
    const from = new Date(d); from.setDate(d.getDate() - back)
    const to = new Date(from); to.setDate(from.getDate() + 6)
    return { from: isoDay(from), to: isoDay(to) }
  }
  if (kind === 'year') return { from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31` }
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { from: isoDay(new Date(d.getFullYear(), d.getMonth(), 1)), to: isoDay(last) }
}

/** `anchor` moved by one period of `kind`, forwards (1) or back (-1). */
export function shiftPeriod(kind, anchor, dir) {
  const d = new Date(anchor + 'T12:00:00')
  if (kind === 'week') d.setDate(d.getDate() + 7 * dir)
  else if (kind === 'year') d.setFullYear(d.getFullYear() + dir, 0, 1)
  else d.setMonth(d.getMonth() + dir, 1)
  return isoDay(d)
}

// Wellbeing as spreadsheets (fork), next to the workouts and body CSVs (lib/export-csv.js):
//   wellbeingCSV  one row per day that has anything logged: mood, reasons, note, calories,
//                 protein, symptoms with their severity, each supplement or medicine as
//                 "intakes/times", each habit as 1 or 0, and whether you trained.
//   foodsCSV      one row per food eaten.
// Names go through `tr`, so built-in labels come out in the reader's language; your own names as
// typed. Pure, so the layout is tested (wellbeing-csv.test.js).
import { csvField } from './export-csv.js'
import { trainedDays } from './wellbeing-insights.js'
import {
  MOOD_LABEL, MEAL_LABEL, SEVERITY_LABEL, moodOf, reasonList, symptomList, symptomsOf, suppList, suppCountsOn,
  habitList, habitsDoneOn, foodsOn, dayTotals,
} from './wellbeing.js'

const line = cells => cells.map(csvField).join(',')
// The BOM is for Excel, which reads UTF-8 without one as the system code page.
const csvText = (header, rows) => '﻿' + [line(header), ...rows.map(line)].join('\r\n') + '\r\n'
const num = v => (Number.isFinite(+v) && v !== '' && v != null ? String(Math.round(+v * 10) / 10) : '')
const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v)

/** The days anything Wellbeing was logged on, inside [from, to] (either may be null), oldest first. */
export function wellbeingDays(S, { from = null, to = null } = {}) {
  const days = new Set()
  const add = d => { if (/^\d{4}-\d{2}-\d{2}$/.test(d || '') && (!from || d >= from) && (!to || d <= to)) days.add(d) }
  for (const k of ['wbMood', 'wbSymptoms', 'wbHabits', 'wbSupps']) for (const d of Object.keys(isMap(S?.[k]) ? S[k] : {})) add(d)
  for (const e of Object.values(isMap(S?.wbFood) ? S.wbFood : {})) add(e?.d)
  // A key can be a cleared day ({ _ts }); keep only days that still hold something.
  return [...days].sort().filter(d => moodOf(S, d) || symptomsOf(S, d) || habitsDoneOn(S, d).length
    || Object.keys(suppCountsOn(S, d)).length || dayTotals(S, d).count)
}

/** One row per logged day. `tr` translates an English source string (the app's t). */
export function wellbeingCSV(S, range = {}, tr = s => s) {
  const days = wellbeingDays(S, range)
  const named = x => (x.std ? tr(x.name) : x.name)
  const reasons = new Map(reasonList(S).map(r => [r.id, r.own ? r.label : tr(r.label)]))
  const symptoms = new Map(symptomList(S).map(s => [s.id, s.own ? s.label : tr(s.label)]))
  const supps = suppList(S)
  const habits = habitList(S)
  const trained = trainedDays(S)
  const header = ['date', 'trained', 'mood', 'mood_label', 'mood_reasons', 'mood_note', 'kcal', 'protein_g', 'foods', 'symptoms',
    ...supps.map(x => 'supplement: ' + named(x) + (x.dose ? ` (${x.dose})` : '') + (x.times > 1 ? ` x${x.times}` : '')),
    ...habits.map(h => 'habit: ' + named(h))]
  const rows = days.map(d => {
    const m = moodOf(S, d)
    const tot = dayTotals(S, d)
    const sym = symptomsOf(S, d)?.s || {}
    const counts = suppCountsOn(S, d)
    const done = habitsDoneOn(S, d)
    return [
      d, trained.has(d) ? 1 : 0,
      m ? m.mood : '', m ? tr(MOOD_LABEL[m.mood]) : '',
      m ? m.reasons.map(r => reasons.get(r) || r).join('; ') : '', m?.note || '',
      tot.count ? tot.kcal : '', num(tot.protein), tot.count || '',
      Object.entries(sym).map(([id, v]) => `${symptoms.get(id) || id}: ${tr(SEVERITY_LABEL[v])}`).join('; '),
      ...supps.map(x => (counts[x.id] ? `${counts[x.id]}/${x.times}` : `0/${x.times}`)),
      ...habits.map(h => (done.includes(h.id) ? 1 : 0)),
    ]
  })
  return csvText(header, rows)
}

/** One row per food eaten inside the range. */
export function foodsCSV(S, range = {}, tr = s => s) {
  const header = ['date', 'meal', 'food', 'grams', 'kcal', 'kcal_per_100g', 'protein_g']
  const rows = []
  for (const d of wellbeingDays(S, range)) for (const f of foodsOn(S, d)) {
    rows.push([d, tr(MEAL_LABEL[f.meal]), f.name, num(f.grams), f.kcal, num(f.kcal100), num(f.protein)])
  }
  return csvText(header, rows)
}

/** What the two files would hold: logged days and foods. */
export function wellbeingCounts(S, range = {}) {
  const days = wellbeingDays(S, range)
  return { days: days.length, foods: days.reduce((n, d) => n + foodsOn(S, d).length, 0) }
}

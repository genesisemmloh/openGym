import { describe, it, expect } from 'vitest'
import { wellbeingCSV, foodsCSV, wellbeingDays, wellbeingCounts } from './wellbeing-csv.js'
import { withGoals, withWater } from './nutrition.js'
import { withMood, withSymptoms, withFood, withSuppDef, withSuppTap, withHabitDef, withHabitToggled } from './wellbeing.js'

const D1 = '2026-11-10', D2 = '2026-11-11', D3 = '2026-11-12'
const rowsOf = text => text.replace(/^﻿/, '').trim().split('\r\n')

function sample() {
  const S = {
    workouts: [{ d: D1, start: Date.parse(D1 + 'T10:00:00'), end: Date.parse(D1 + 'T11:00:00') }],
    wbSuppDefs: withSuppDef({ p: { name: 'Pain pill', dose: '1 tablet', times: 3, order: 0, _ts: 1 } }, 'w', 'Whey', '30 g', 1, 1),
    wbHabitDefs: withHabitDef({ water: { name: 'Water', order: 0, _ts: 1 } }, 'read', 'Read', 1, 1),
  }
  S.wbMood = withMood({}, D1, { mood: 4, reasons: ['work', 'sleep'], note: 'Good, day' }, 1)
  S.wbSymptoms = withSymptoms({}, D2, { s: { headache: 3 } }, 1)
  S.wbFood = withFood(withFood({}, 'a', { d: D1, name: 'Oats', kcal: 190, grams: 50, kcal100: 379, protein: 6.5, meal: 'breakfast' }, 1), 'b', { d: D1, name: '=cmd', kcal: 100, meal: 'snack' }, 2)
  S.wbSupps = withSuppTap({}, D1, {}, 'p', 3, 1)
  S.wbHabits = withHabitToggled({}, D1, [], 'water', 1)
  S.wbMood = withMood(S.wbMood, D3, null, 5) // a cleared day is not a logged day
  S.wbGoals = withGoals({}, D1, { kcal: { min: 1800, max: 2200 }, maint: 2500 }, 1)
  S.wbWater = withWater({}, D2, 1500, 1)
  return S
}

describe('wellbeing CSV', () => {
  it('lists only days that still hold something, inside the range', () => {
    const S = sample()
    expect(wellbeingDays(S)).toEqual([D1, D2])
    expect(wellbeingDays(S, { from: D2, to: null })).toEqual([D2])
    expect(wellbeingCounts(S)).toEqual({ days: 2, foods: 2 })
  })

  it('writes one row per day with mood, reasons, food, symptoms, intakes and habits', () => {
    const rows = rowsOf(wellbeingCSV(sample(), {}, s => (s === 'Good' ? 'Bien' : s)))
    expect(rows[0]).toBe('date,trained,mood,mood_label,mood_reasons,mood_note,kcal,protein_g,foods,kcal_target,maintenance,deficit_kcal,water_ml,symptoms,supplement: Pain pill (1 tablet) x3,supplement: Whey (30 g),habit: Water,habit: Read')
    expect(rows[1]).toBe('2026-11-10,1,4,Bien,Work; Sleep,"Good, day",290,7,2,1800-2200,2500,2210,,,1/3,0/1,1,0')
    expect(rows[2]).toBe('2026-11-11,0,,,,,,,,1800-2200,2500,,1500,Headache: Severe,0/3,0/1,0,0')
  })

  it('writes one row per food and keeps a formula-looking name as text', () => {
    const rows = rowsOf(foodsCSV(sample()))
    expect(rows[0]).toBe('date,meal,food,grams,kcal,kcal_per_100g,protein_g')
    expect(rows[1]).toBe('2026-11-10,Breakfast,Oats,50,190,379,6.5')
    expect(rows[2]).toBe("2026-11-10,Snacks,'=cmd,,100,,")
  })
})

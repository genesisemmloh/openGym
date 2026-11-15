import { describe, it, expect } from 'vitest'
import {
  readGoals, goalsOn, withGoals, isTrainingDay, kcalTarget, rangeStatus, waterOn, withWater, applyWater,
  dayNutrition, periodNutrition, weightKg, proteinFromKg, maintEstimate, waterAim,
} from './nutrition.js'
import {
  withFood, foodsOn, withFoodsCopied, withHabitDef, habitsDoneOn, parseDose, withSuppDef, suppList, doseText, withSuppTap, suppNutritionOn, dayTotals,
} from './wellbeing.js'

const D1 = '2026-11-09', D2 = '2026-11-10', D3 = '2026-11-11' // a Monday, Tuesday, Wednesday

describe('nutrition goals', () => {
  it('cleans goals and drops what is out of range', () => {
    expect(readGoals({ kcal: { min: 2250, max: 1850 }, maint: 2600, protein: { min: 170, max: 180 }, water: { min: 3000, max: 4000 }, quality: '  Lean meats  ' }))
      .toEqual({ kcal: { min: 1850, max: 2250 }, maint: 2600, protein: { min: 170, max: 180 }, water: { min: 3000, max: 4000 }, quality: 'Lean meats' })
    expect(readGoals({ kcal: { min: 10 }, maint: 'x' })).toBeNull()
    expect(readGoals({ perKg: { min: 1.8, max: 2, w: 90 } })).toEqual({ perKg: { min: 1.8, max: 2, w: 90 } })
  })

  it('carries a goal forward from the day it was set, and keeps older days on the older goal', () => {
    let map = withGoals({}, D1, { kcal: { max: 2000 } }, 1)
    map = withGoals(map, D3, { kcal: { max: 2200 } }, 2)
    const S = { wbGoals: map }
    expect(goalsOn(S, '2026-11-01')).toBeNull()
    expect(goalsOn(S, D1).kcal.max).toBe(2000)
    expect(goalsOn(S, D2).kcal.max).toBe(2000)
    expect(goalsOn(S, D3).kcal.max).toBe(2200)
    expect(goalsOn(S, '2027-01-01').kcal.max).toBe(2200)
  })

  it('reads the plain calorie goal of the first version as a ceiling, and a cleared day as no goals', () => {
    expect(goalsOn({ kcalGoal: 2100 }, D1)).toEqual({ kcal: { max: 2100 } })
    const S = { kcalGoal: 2100, wbGoals: withGoals(withGoals({}, D1, { kcal: { max: 1900 } }, 1), D2, null, 2) }
    expect(goalsOn(S, D1).kcal.max).toBe(1900)
    expect(goalsOn(S, D3)).toBeNull()
  })

  it('uses the rest-day range on a rest day and the training range when trained or planned', () => {
    const g = { kcal: { min: 2050, max: 2250 }, kcalRest: { min: 1850, max: 2000 } }
    expect(kcalTarget(g, true)).toEqual(g.kcal)
    expect(kcalTarget(g, false)).toEqual(g.kcalRest)
    expect(kcalTarget({ kcal: g.kcal }, false)).toEqual(g.kcal)
    const S = { week: { 1: ['r1'] } }
    expect(isTrainingDay(S, D2, D1, new Set([D2]))).toBe(true)  // trained
    expect(isTrainingDay(S, D1, D1, new Set())).toBe(true)        // today, planned on Monday
    expect(isTrainingDay(S, D1, D2, new Set())).toBe(false)       // a past Monday not trained
    expect(isTrainingDay(S, D3, D1, new Set())).toBe(false)       // nothing planned on Wednesday
  })

  it('places a value under, inside or over a range', () => {
    expect(rangeStatus(1800, { min: 1850, max: 2250 })).toBe('under')
    expect(rangeStatus(2000, { min: 1850, max: 2250 })).toBe('in')
    expect(rangeStatus(2300, { min: 1850, max: 2250 })).toBe('over')
    expect(rangeStatus(1000, { max: 2000 })).toBe('in')
    expect(rangeStatus(null, { max: 2000 })).toBeNull()
  })
})

describe('water', () => {
  it('stores millilitres per day and clears at zero', () => {
    let m = withWater({}, D1, 750, 1)
    expect(waterOn({ wbWater: m }, D1)).toBe(750)
    m = withWater(m, D1, -5, 2)
    expect(waterOn({ wbWater: m }, D1)).toBe(0)
    expect(m[D1]).toEqual({ _ts: 2 })
  })

  it('ticks the water habit when the day reaches the aim, once', () => {
    const s = { wbGoals: withGoals({}, D1, { water: { min: 3000, max: 4000 } }, 1) }
    applyWater(s, D1, 2750, D1, 2)
    expect(habitsDoneOn(s, D1)).toEqual([])
    applyWater(s, D1, 3000, D1, 3)
    expect(habitsDoneOn(s, D1)).toEqual(['water'])
    applyWater(s, D1, 3250, D1, 4)
    expect(habitsDoneOn(s, D1)).toEqual(['water'])
    expect(waterAim(null)).toBe(3000)
  })

  it('leaves the habits alone when the water habit is not on the list', () => {
    const s = { wbHabitDefs: withHabitDef({}, 'water', '', 0, 1) } // taken off the list
    applyWater(s, D1, 3500, D1, 2)
    expect(s.wbHabits).toBeUndefined()
  })
})

describe('a day and a period', () => {
  const S = {
    wbGoals: withGoals({}, D1, { kcal: { min: 1850, max: 2250 }, maint: 2600, protein: { min: 170, max: 180 }, water: { min: 3000 } }, 1),
    wbFood: [
      [D1, 2000, 175], [D2, 2400, 120], [D3, 1700, 180],
    ].reduce((m, [d, kcal, protein], i) => withFood(m, 'f' + i, { d, name: 'Meal', kcal, protein, meal: 'lunch' }, i + 1), {}),
    wbWater: withWater({}, D1, 3250, 1),
  }

  it('works out the status and the deficit of a day', () => {
    const n = dayNutrition(S, D1, { today: D3, trained: new Set() })
    expect(n).toMatchObject({ kcal: 2000, status: 'in', deficit: 600, proteinStatus: 'in', water: 3250, waterStatus: 'in' })
    expect(dayNutrition(S, D2, { today: D3 })).toMatchObject({ status: 'over', deficit: 200, proteinStatus: 'under' })
    expect(dayNutrition(S, '2026-11-12', { today: D3 })).toMatchObject({ count: 0, status: null, deficit: null })
  })

  it('adds a stretch of days up', () => {
    const p = periodNutrition(S, [D1, D2, D3, '2026-11-12'], { today: '2026-11-12' })
    expect(p).toMatchObject({ foodDays: 3, withTarget: 3, inTarget: 1, over: 1, under: 1, deficit: 600 + 200 + 900, deficitDays: 3, avgDeficit: 567, proteinMet: 2, proteinDays: 3, water: 3250, waterMet: 1 })
    expect(p.fatKg).toBe(0.22)
    expect(p.perDay.map(x => x.deficit)).toEqual([600, 200, 900])
    expect(periodNutrition(S, [D1, '2026-11-12'], {}).perDay.map(x => x.deficit)).toEqual([600, null])
    // A day still going is left out until it is over.
    expect(periodNutrition(S, [D1, D2, D3], { today: D3 })).toMatchObject({ foodDays: 2, deficit: 800 })
  })
})

describe('supplements in the day', () => {
  it('splits a dose into amount and unit', () => {
    expect(parseDose('30 g')).toEqual({ amount: 30, unit: 'g' })
    expect(parseDose('2000 UI')).toEqual({ amount: 2000, unit: 'IU' })
    expect(parseDose('1 tablet')).toEqual({ amount: 1, unit: 'tablet' })
    expect(parseDose('2,5 ml')).toEqual({ amount: 2.5, unit: 'ml' })
    expect(parseDose('a spoon')).toEqual({ amount: null, unit: null })
  })

  it('counts each intake of a supplement with kcal, never a medicine', () => {
    let defs = withSuppDef({}, 'shake', 'Shake', '', 0, 1, false, 2, { kind: 'supp', amount: 30, unit: 'g', kcal: 120, protein: 24 })
    defs = withSuppDef(defs, 'syrup', 'Cough syrup', '', 1, 1, false, 1, { kind: 'med', amount: 10, unit: 'ml', kcal: 40 })
    const x = suppList({ wbSuppDefs: defs }).find(s => s.id === 'shake')
    expect(x).toMatchObject({ kind: 'supp', amount: 30, unit: 'g', kcal: 120, protein: 24, times: 2 })
    expect(doseText(x)).toBe('30 g')
    expect(suppList({ wbSuppDefs: defs }).find(s => s.id === 'syrup').kcal).toBeNull()
    let taken = withSuppTap({}, D1, {}, 'shake', 2, 1)
    taken = withSuppTap(taken, D1, { shake: 1 }, 'shake', 2, 2)
    taken = withSuppTap(taken, D1, { shake: 2 }, 'syrup', 1, 3)
    const S = { wbSuppDefs: defs, wbSupps: taken, wbFood: withFood({}, 'a', { d: D1, name: 'Rice', kcal: 300, protein: 6, meal: 'lunch' }, 1) }
    expect(suppNutritionOn(S, D1)).toEqual({ kcal: 240, protein: 48, items: 1 })
    expect(dayTotals(S, D1)).toMatchObject({ kcal: 540, protein: 54, count: 2, foods: 1, suppKcal: 240 })
  })

  it('gives a suggested protein powder stored before kinds existed its kcal', () => {
    const S = { wbSuppDefs: { protein: { name: 'Protein powder', dose: '30 g', std: true, order: 0, _ts: 1 } } }
    expect(suppList(S)[0]).toMatchObject({ kind: 'supp', amount: 30, unit: 'g', kcal: 120, protein: 24 })
    const mine = { wbSuppDefs: { protein: { name: 'Protein powder', kind: 'supp', amount: 25, unit: 'g', kcal: 100, std: true, order: 0, _ts: 1 } } }
    expect(suppList(mine)[0]).toMatchObject({ amount: 25, kcal: 100, protein: null })
  })
})

describe('copying food', () => {
  it('logs a meal or a day again on another day, as new entries', () => {
    let m = withFood({}, 'a', { d: D1, name: 'Oats', kcal: 190, grams: 50, kcal100: 379, protein: 6.5, carbs: 33, fat: 3.5, meal: 'breakfast' }, 1)
    m = withFood(m, 'b', { d: D1, name: 'Rice', kcal: 230, meal: 'lunch' }, 2)
    const S = { wbFood: m }
    const breakfast = foodsOn(S, D1).filter(f => f.meal === 'breakfast')
    let n = 0
    const copied = withFoodsCopied(m, breakfast, D2, { now: 10, newId: () => 'c' + n++ })
    expect(foodsOn({ wbFood: copied }, D2)).toMatchObject([{ id: 'c0', name: 'Oats', kcal: 190, grams: 50, carbs: 33, fat: 3.5, meal: 'breakfast' }])
    expect(foodsOn({ wbFood: copied }, D1)).toHaveLength(2)
    const day = withFoodsCopied(m, foodsOn(S, D1), D3, { now: 20, newId: () => 'd' + n++ })
    expect(dayTotals({ wbFood: day }, D3)).toMatchObject({ kcal: 420, carbs: 33, fat: 4, foods: 2 })
    const asSnack = withFoodsCopied(m, breakfast, D2, { now: 30, meal: 'snack', newId: () => 'e' })
    expect(foodsOn({ wbFood: asSnack }, D2)[0].meal).toBe('snack')
  })
})

describe('editor helpers', () => {
  it('takes the target weight, else the last weigh-in, in kg', () => {
    expect(weightKg({ unit: 'kg', bodyweight: [{ w: 92 }, { w: 90 }] })).toBe(90)
    expect(weightKg({ unit: 'kg', targetW: 85, bodyweight: [{ w: 90 }] })).toBe(85)
    expect(weightKg({ unit: 'lb', bodyweight: [{ w: 200 }] })).toBe(90.7)
    expect(weightKg({ bodyweight: [] })).toBeNull()
  })

  it('turns g/kg into grams and estimates a maintenance', () => {
    expect(proteinFromKg(1.9, 90)).toBe(171)
    expect(maintEstimate(90)).toBe(2790)
    expect(maintEstimate(null)).toBeNull()
  })
})

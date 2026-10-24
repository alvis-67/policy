import {
  TERM10_FEMALE_NSM,
  TERM10_FEMALE_STD,
  TERM10_MALE_NSM,
  TERM10_MALE_STD,
  TERM20_FEMALE_NSM,
  TERM20_FEMALE_STD,
  TERM20_MALE_NSM,
  TERM20_MALE_STD,
} from './manutermRates'

export const POLICY_FEE = 200
export const MIN_ANNUAL_PREMIUM = 800
export const MIN_SUM_ASSURED = 320_000

const BANDS = [
  { band: 1 as const, min: 320_000, max: 999_999 },
  { band: 2 as const, min: 1_000_000, max: 7_999_999 },
  { band: 3 as const, min: 8_000_000, max: 15_999_999 },
  { band: 4 as const, min: 16_000_000, max: Number.POSITIVE_INFINITY },
]

const TABLES = {
  10: {
    male: { std: TERM10_MALE_STD, nsm: TERM10_MALE_NSM },
    female: { std: TERM10_FEMALE_STD, nsm: TERM10_FEMALE_NSM },
  },
  20: {
    male: { std: TERM20_MALE_STD, nsm: TERM20_MALE_NSM },
    female: { std: TERM20_FEMALE_STD, nsm: TERM20_FEMALE_NSM },
  },
} as const

export type TermPlan = 10 | 20
export type TermSex = 'male' | 'female'

export interface TermFill {
  plan: TermPlan
  sumAssured: number
  premium: number
  rate: number
  band: 1 | 2 | 3 | 4
  raisedToMinimumSum: boolean
  raisedToMinimumPremium: boolean
}

export interface BudgetCover {
  plan: TermPlan
  sumAssured: number
  premium: number
  rate: number
  band: 1 | 2 | 3 | 4
}

export function termPlansForAge(age: number): TermPlan[] {
  if (!Number.isInteger(age) || age < 16 || age > 65) return []
  return age <= 55 ? [10, 20] : [10]
}

export function manutermRate(plan: TermPlan, sex: TermSex, smoker: boolean, age: number, band: 1 | 2 | 3 | 4) {
  if (!termPlansForAge(age).includes(plan)) return null
  const row = TABLES[plan][sex][smoker ? 'std' : 'nsm'][age - 16]
  return row?.[band - 1] ?? null
}

export function premiumToFill(input: { age: number; sex: TermSex; smoker: boolean; plan: TermPlan; gap: number }): TermFill | null {
  if (!(input.gap > 0)) return null
  const sumAssured = input.gap < MIN_SUM_ASSURED ? MIN_SUM_ASSURED : input.gap
  const band = bandFor(sumAssured)
  if (!band) return null
  const rate = manutermRate(input.plan, input.sex, input.smoker, input.age, band.band)
  if (rate == null) return null
  const raw = (sumAssured / 1000) * rate + POLICY_FEE
  return {
    plan: input.plan,
    sumAssured,
    premium: raw < MIN_ANNUAL_PREMIUM ? MIN_ANNUAL_PREMIUM : roundCents(raw),
    rate,
    band: band.band,
    raisedToMinimumSum: input.gap < MIN_SUM_ASSURED,
    raisedToMinimumPremium: raw < MIN_ANNUAL_PREMIUM,
  }
}

export function coverForBudget(input: { age: number; sex: TermSex; smoker: boolean; plan: TermPlan; budget: number }): BudgetCover | null {
  if (!(input.budget >= MIN_ANNUAL_PREMIUM)) return null
  let best: BudgetCover | null = null
  for (const band of BANDS) {
    const rate = manutermRate(input.plan, input.sex, input.smoker, input.age, band.band)
    if (rate == null) continue
    const sumAssured = affordableSum(input.budget, rate, band.min, band.max)
    if (sumAssured == null) continue
    const raw = (sumAssured / 1000) * rate + POLICY_FEE
    const premium = raw < MIN_ANNUAL_PREMIUM ? MIN_ANNUAL_PREMIUM : roundCents(raw)
    if (premium > input.budget + 0.001) continue
    if (!best || sumAssured > best.sumAssured) {
      best = { plan: input.plan, sumAssured, premium, rate, band: band.band }
    }
  }
  return best
}

function bandFor(sum: number) {
  return BANDS.find((band) => sum >= band.min && sum <= band.max) ?? null
}

function affordableSum(budget: number, rate: number, min: number, max: number) {
  const spend = budget - POLICY_FEE
  if (spend <= 0) return null
  let sum = Math.floor(spend / rate + 1e-6) * 1000
  if (!Number.isFinite(sum)) return null
  if (sum > max) sum = Math.floor(max / 1000) * 1000
  for (let guard = 0; guard < 8 && sum >= min; guard += 1) {
    const raw = (sum / 1000) * rate + POLICY_FEE
    const premium = raw < MIN_ANNUAL_PREMIUM ? MIN_ANNUAL_PREMIUM : roundCents(raw)
    if (premium <= budget + 0.001 && sum <= max) return sum
    sum -= 1000
  }
  return null
}

function roundCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

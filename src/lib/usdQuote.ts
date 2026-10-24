import {
  YOUYUE_PAY10_FEMALE_NSM,
  YOUYUE_PAY10_FEMALE_STD,
  YOUYUE_PAY10_MALE_NSM,
  YOUYUE_PAY10_MALE_STD,
  YOUYUE_PAY20_FEMALE_NSM,
  YOUYUE_PAY20_FEMALE_STD,
  YOUYUE_PAY20_MALE_NSM,
  YOUYUE_PAY20_MALE_STD,
  YOUYUE_PAY25_FEMALE_NSM,
  YOUYUE_PAY25_FEMALE_STD,
  YOUYUE_PAY25_MALE_NSM,
  YOUYUE_PAY25_MALE_STD,
  YOUYUE_PAY5_FEMALE_NSM,
  YOUYUE_PAY5_FEMALE_STD,
  YOUYUE_PAY5_MALE_NSM,
  YOUYUE_PAY5_MALE_STD,
  YOUYUE_SINGLE_FEMALE_NSM,
  YOUYUE_SINGLE_FEMALE_STD,
  YOUYUE_SINGLE_MALE_NSM,
  YOUYUE_SINGLE_MALE_STD,
} from './youyueRates'
import {
  YING_PAY10_FEMALE,
  YING_PAY10_MALE,
  YING_PAY5_FEMALE,
  YING_PAY5_MALE,
  YING_SINGLE_FEMALE,
  YING_SINGLE_MALE,
} from './yingchuanRates'

export const HKD_PER_USD = 8

const YOUYUE_FEE = 25
const YOUYUE_MIN_PREMIUM = 160
const YOUYUE_MIN_SUM = 20_000
const YING_MIN_SUM = 250_000

const YOUYUE_SINGLE_BANDS = [
  { band: 1, min: 20_000, max: 34_999 },
  { band: 2, min: 35_000, max: 49_999 },
  { band: 3, min: 50_000, max: 99_999 },
  { band: 4, min: 100_000, max: 249_999 },
  { band: 5, min: 250_000, max: Number.POSITIVE_INFINITY },
]
const YOUYUE_LEVEL_BANDS = [
  { band: 1, min: 20_000, max: 249_999 },
  { band: 2, min: 250_000, max: Number.POSITIVE_INFINITY },
]

const YOUYUE = {
  single: {
    male: { std: YOUYUE_SINGLE_MALE_STD, nsm: YOUYUE_SINGLE_MALE_NSM },
    female: { std: YOUYUE_SINGLE_FEMALE_STD, nsm: YOUYUE_SINGLE_FEMALE_NSM },
  },
  5: {
    male: { std: YOUYUE_PAY5_MALE_STD, nsm: YOUYUE_PAY5_MALE_NSM },
    female: { std: YOUYUE_PAY5_FEMALE_STD, nsm: YOUYUE_PAY5_FEMALE_NSM },
  },
  10: {
    male: { std: YOUYUE_PAY10_MALE_STD, nsm: YOUYUE_PAY10_MALE_NSM },
    female: { std: YOUYUE_PAY10_FEMALE_STD, nsm: YOUYUE_PAY10_FEMALE_NSM },
  },
  20: {
    male: { std: YOUYUE_PAY20_MALE_STD, nsm: YOUYUE_PAY20_MALE_NSM },
    female: { std: YOUYUE_PAY20_FEMALE_STD, nsm: YOUYUE_PAY20_FEMALE_NSM },
  },
  25: {
    male: { std: YOUYUE_PAY25_MALE_STD, nsm: YOUYUE_PAY25_MALE_NSM },
    female: { std: YOUYUE_PAY25_FEMALE_STD, nsm: YOUYUE_PAY25_FEMALE_NSM },
  },
} as const

const YING = {
  single: { male: YING_SINGLE_MALE, female: YING_SINGLE_FEMALE },
  5: { male: YING_PAY5_MALE, female: YING_PAY5_FEMALE },
  10: { male: YING_PAY10_MALE, female: YING_PAY10_FEMALE },
} as const

export type UsdTerm = 5 | 10 | 20 | 25 | 'single'
export type UsdProduct = 'youyue' | 'yingchuan'
export type UsdSex = 'male' | 'female'
export type UsdSkip = 'term' | 'age' | 'juvenile-smoker'

export interface UsdQuote {
  product: UsdProduct
  term: UsdTerm
  usdNotional: number
  hkdNotional: number
  premiumUsd: number
  premiumHkd: number
  rate: number
  band: number | null
  raisedToMinimumSum: boolean
  raisedToMinimumPremium: boolean
}

export function usdMaxAge(product: UsdProduct, term: UsdTerm) {
  if (product === 'yingchuan' && (term === 20 || term === 25)) return null
  if (term === 'single') return 75
  if (term === 5) return product === 'youyue' ? 75 : 70
  if (term === 25) return 65
  return 70
}

export function usdSkip(product: UsdProduct, term: UsdTerm, age: number, smoker: boolean): UsdSkip | null {
  if (usdMaxAge(product, term) == null) return 'term'
  if (!Number.isInteger(age) || age < 0 || age > (usdMaxAge(product, term) as number)) return 'age'
  if (product === 'yingchuan' && smoker && age < 18) return 'juvenile-smoker'
  return null
}

export function usdFill(input: {
  product: UsdProduct
  term: UsdTerm
  age: number
  sex: UsdSex
  smoker: boolean
  hkdGap: number
}): UsdQuote | null {
  if (!(input.hkdGap > 0) || usdSkip(input.product, input.term, input.age, input.smoker)) return null
  const minimum = minSum(input.product)
  const rawNotional = input.hkdGap / HKD_PER_USD
  const usdNotional = rawNotional < minimum ? minimum : rawNotional
  const priced = price(input.product, input.term, input.age, input.sex, input.smoker, usdNotional)
  if (!priced) return null
  return toQuote(input.product, input.term, priced, rawNotional < minimum)
}

export function usdCover(input: {
  product: UsdProduct
  term: UsdTerm
  age: number
  sex: UsdSex
  smoker: boolean
  hkdBudget: number
}): UsdQuote | null {
  if (input.term === 'single' || usdSkip(input.product, input.term, input.age, input.smoker)) return null
  const budgetUsd = input.hkdBudget / HKD_PER_USD
  const fee = policyFee(input.product, input.term)
  const floor = minPremium(input.product, input.term)
  if (budgetUsd + 0.001 < floor) return null
  let best: { sum: number; premium: number; rate: number; band: number | null } | null = null
  for (const band of bandsFor(input.product, input.term)) {
    const rate = rateFor(input.product, input.term, input.age, input.sex, input.smoker, band.band)
    if (rate == null) continue
    const bought = affordable(budgetUsd, rate, band.min, band.max, fee, floor)
    if (!bought) continue
    if (!best || bought.sum > best.sum) best = { ...bought, rate, band: input.product === 'yingchuan' ? null : band.band }
  }
  if (!best) return null
  return toQuote(input.product, input.term, { ...best, usdNotional: best.sum }, false)
}

function price(product: UsdProduct, term: UsdTerm, age: number, sex: UsdSex, smoker: boolean, usdNotional: number) {
  const band = bandsFor(product, term).find((item) => usdNotional >= item.min && usdNotional <= item.max)
  if (!band) return null
  const rate = rateFor(product, term, age, sex, smoker, band.band)
  if (rate == null) return null
  const fee = policyFee(product, term)
  const raw = (usdNotional / 1000) * rate + fee
  const floor = minPremium(product, term)
  return {
    usdNotional,
    premium: raw < floor ? floor : roundCents(raw),
    rate,
    band: product === 'yingchuan' ? null : band.band,
    raisedToMinimumPremium: raw < floor,
  }
}

function toQuote(
  product: UsdProduct,
  term: UsdTerm,
  priced: { usdNotional: number; premium: number; rate: number; band: number | null; raisedToMinimumPremium?: boolean },
  raisedToMinimumSum: boolean,
): UsdQuote {
  return {
    product,
    term,
    usdNotional: roundCents(priced.usdNotional),
    hkdNotional: roundCents(priced.usdNotional * HKD_PER_USD),
    premiumUsd: priced.premium,
    premiumHkd: roundCents(priced.premium * HKD_PER_USD),
    rate: priced.rate,
    band: priced.band,
    raisedToMinimumSum,
    raisedToMinimumPremium: priced.raisedToMinimumPremium ?? false,
  }
}

function rateFor(product: UsdProduct, term: UsdTerm, age: number, sex: UsdSex, smoker: boolean, band: number) {
  if (product === 'youyue') {
    if (term !== 'single' && term !== 5 && term !== 10 && term !== 20 && term !== 25) return null
    const row = YOUYUE[term][sex][smoker ? 'std' : 'nsm'][age]
    return row?.[band - 1] ?? null
  }
  if (term !== 'single' && term !== 5 && term !== 10) return null
  const row = YING[term][sex][age]
  const value = row?.[smoker ? 5 : 3]
  return value == null ? null : value
}

function bandsFor(product: UsdProduct, term: UsdTerm) {
  if (product === 'yingchuan') return [{ band: 1, min: YING_MIN_SUM, max: Number.POSITIVE_INFINITY }]
  return term === 'single' ? YOUYUE_SINGLE_BANDS : YOUYUE_LEVEL_BANDS
}

function minSum(product: UsdProduct) {
  return product === 'yingchuan' ? YING_MIN_SUM : YOUYUE_MIN_SUM
}

function policyFee(product: UsdProduct, term: UsdTerm) {
  return product === 'youyue' && term !== 'single' ? YOUYUE_FEE : 0
}

function minPremium(product: UsdProduct, term: UsdTerm) {
  return product === 'youyue' && term !== 'single' ? YOUYUE_MIN_PREMIUM : 0
}

function affordable(budget: number, rate: number, min: number, max: number, fee: number, floor: number) {
  const spend = budget - fee
  if (spend <= 0) return null
  let sum = Math.floor(spend / rate + 1e-6) * 1000
  if (!Number.isFinite(sum)) return null
  if (sum > max) sum = Math.floor(max / 1000) * 1000
  for (let guard = 0; guard < 8 && sum >= min; guard += 1) {
    const raw = (sum / 1000) * rate + fee
    const premium = raw < floor ? floor : roundCents(raw)
    if (premium <= budget + 0.001 && sum <= max) return { sum, premium }
    sum -= 1000
  }
  return null
}

function roundCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

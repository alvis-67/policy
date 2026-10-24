import { MIN_SUM_ASSURED, coverForBudget, premiumToFill, termPlansForAge, type BudgetCover, type TermFill, type TermPlan } from './manutermQuote'
import { HKD_PER_USD, usdCover, usdFill, usdSkip, type UsdProduct, type UsdQuote, type UsdSex, type UsdTerm } from './usdQuote'

export type BudgetMix =
  | { kind: 'mix'; termPlan: TermPlan; term: TermFill; whole: UsdQuote }
  | { kind: 'term-only'; termPlan: TermPlan; term: TermFill }
  | { kind: 'whole-only'; whole: UsdQuote }
  | { kind: 'short'; termPlan: TermPlan | null; term: BudgetCover | null; whole: UsdQuote | null }

const MIN_USD = { youyue: 20_000, yingchuan: 250_000 } as const

export function mixBudget(input: {
  age: number
  sex: UsdSex
  smoker: boolean
  hkdGap: number
  hkdBudget: number
  product: UsdProduct
  term: UsdTerm
}): BudgetMix | null {
  if (!(input.hkdGap > 0) || !(input.hkdBudget > 0) || input.term === 'single') return null
  if (usdSkip(input.product, input.term, input.age, input.smoker)) return null
  const termPlan = companionTerm(input.age, input.term)
  const wholeOnly = usdFill({ ...input, hkdGap: input.hkdGap })
  if (wholeOnly && wholeOnly.premiumHkd <= input.hkdBudget + 0.01) return { kind: 'whole-only', whole: wholeOnly }

  const mix = termPlan ? largestWholeLife(input, termPlan) : null
  if (mix) return mix

  const termOnly = termPlan ? premiumToFill({ age: input.age, sex: input.sex, smoker: input.smoker, plan: termPlan, gap: input.hkdGap }) : null
  if (termPlan && termOnly && !termOnly.raisedToMinimumSum && termOnly.premium <= input.hkdBudget + 0.01) {
    return { kind: 'term-only', termPlan, term: termOnly }
  }

  return {
    kind: 'short',
    termPlan,
    term: termPlan ? coverForBudget({ age: input.age, sex: input.sex, smoker: input.smoker, plan: termPlan, budget: input.hkdBudget }) : null,
    whole: usdCover({ ...input, hkdBudget: input.hkdBudget }),
  }
}

function companionTerm(age: number, term: UsdTerm): TermPlan | null {
  const plans = termPlansForAge(age)
  if ((term === 20 || term === 25) && plans.includes(20)) return 20
  return plans.includes(10) ? 10 : null
}

function largestWholeLife(input: { age: number; sex: UsdSex; smoker: boolean; hkdGap: number; hkdBudget: number; product: UsdProduct; term: UsdTerm }, termPlan: TermPlan) {
  const minUsd = MIN_USD[input.product]
  const maxUsd = Math.floor(input.hkdGap / HKD_PER_USD / 1000) * 1000
  if (maxUsd < minUsd) return null
  let low = minUsd / 1000
  let high = maxUsd / 1000
  let best: Extract<BudgetMix, { kind: 'mix' }> | null = null
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const attempt = quoteMix(input, termPlan, mid * 1000)
    if (attempt) {
      best = attempt
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return best
}

function quoteMix(
  input: { age: number; sex: UsdSex; smoker: boolean; hkdGap: number; hkdBudget: number; product: UsdProduct; term: UsdTerm },
  termPlan: TermPlan,
  usdNotional: number,
): Extract<BudgetMix, { kind: 'mix' }> | null {
  const whole = usdFill({ ...input, hkdGap: usdNotional * HKD_PER_USD })
  if (!whole || whole.raisedToMinimumSum || whole.usdNotional + 0.01 < usdNotional) return null
  const remainder = Math.round((input.hkdGap - whole.hkdNotional) * 100) / 100
  if (remainder < MIN_SUM_ASSURED) return null
  const term = premiumToFill({ age: input.age, sex: input.sex, smoker: input.smoker, plan: termPlan, gap: remainder })
  if (!term || term.raisedToMinimumSum) return null
  if (term.premium + whole.premiumHkd > input.hkdBudget + 0.01) return null
  return { kind: 'mix', termPlan, term, whole }
}

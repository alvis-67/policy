export type RetirementInput = {
  currentAge: number
  retireAge: number
  monthlyExpense: number
  mpfBalance: number
  mpfMonthly: number
  otherAssets: number
  untilAge: number
  inflationRate: number
  returnBefore: number
  returnAfter: number
  expenseRatio: number
}

export type RetirementResult = {
  yearsToRetire: number
  yearsInRetirement: number
  monthlyAtRetirement: number
  capitalNeeded: number
  mpfFuture: number
  otherFuture: number
  assetsFuture: number
  gap: number
  surplus: number
  monthlyTopUp: number | null
}

export function retirementError(input: RetirementInput) {
  if (!Number.isInteger(input.currentAge) || input.currentAge < 20 || input.currentAge > 70) {
    return '現時年齡須為 20 至 70 歲。'
  }
  if (!Number.isInteger(input.retireAge) || input.retireAge < 50 || input.retireAge > 75 || input.retireAge < input.currentAge) {
    return '目標退休年齡須為 50 至 75 歲，而且不可小於現時年齡。'
  }
  if (input.monthlyExpense < 5000 || input.monthlyExpense > 80000) {
    return '每月開支須為 5,000 至 80,000 港元。'
  }
  if (!Number.isInteger(input.untilAge) || input.untilAge < 70 || input.untilAge > 110 || input.untilAge <= input.retireAge) {
    return '計算歲數須大於目標退休年齡，範圍 70 至 110 歲。'
  }
  if (input.inflationRate < 0 || input.inflationRate > 10) return '通脹須為 0 至 10%。'
  if (input.returnBefore < 0 || input.returnBefore > 15 || input.returnAfter < 0 || input.returnAfter > 15) {
    return '回報須為 0 至 15%。'
  }
  if (input.expenseRatio < 0 || input.expenseRatio > 200) return '退休開支比例須為 0 至 200%。'
  if ([input.mpfBalance, input.mpfMonthly, input.otherAssets].some((amount) => amount < 0 || amount > 1_000_000_000_000)) {
    return '金額不正確。'
  }
  return null
}

export function calculateRetirement(input: RetirementInput): RetirementResult {
  const yearsToRetire = Math.max(0, input.retireAge - input.currentAge)
  const yearsInRetirement = Math.max(0, input.untilAge - input.retireAge)
  const monthlyAtRetirement = dollars(input.monthlyExpense * (input.expenseRatio / 100) * (1 + input.inflationRate / 100) ** yearsToRetire)
  const capitalNeeded = nestEgg(monthlyAtRetirement * 12, yearsInRetirement, input.inflationRate, input.returnAfter)
  const mpfFuture = grow(input.mpfBalance, input.mpfMonthly, input.returnBefore, yearsToRetire)
  const otherFuture = grow(input.otherAssets, 0, input.returnBefore, yearsToRetire)
  const assetsFuture = dollars(mpfFuture + otherFuture)
  const rawGap = dollars(capitalNeeded - assetsFuture)
  const gap = rawGap > 0 ? rawGap : 0
  return {
    yearsToRetire,
    yearsInRetirement,
    monthlyAtRetirement,
    capitalNeeded,
    mpfFuture,
    otherFuture,
    assetsFuture,
    gap,
    surplus: rawGap < 0 ? dollars(-rawGap) : 0,
    monthlyTopUp: gap > 0 ? monthlyToFill(gap, input.returnBefore, yearsToRetire) : 0,
  }
}

export function assetSeries(input: RetirementInput) {
  const years = Math.max(0, input.retireAge - input.currentAge)
  const points: number[] = []
  for (let year = 0; year <= years; year += 1) {
    points.push(dollars(grow(input.mpfBalance, input.mpfMonthly, input.returnBefore, year) + grow(input.otherAssets, 0, input.returnBefore, year)))
  }
  return points
}

function nestEgg(annual: number, years: number, inflationPercent: number, returnPercent: number) {
  if (years <= 0 || annual <= 0) return 0
  const growth = inflationPercent / 100
  const rate = returnPercent / 100
  if (Math.abs(rate - growth) < 1e-10) return dollars(annual * years)
  const ratio = (1 + growth) / (1 + rate)
  return dollars((annual * (1 + rate) * (1 - ratio ** years)) / (rate - growth))
}

function grow(present: number, monthly: number, annualPercent: number, years: number) {
  const months = Math.round(years * 12)
  if (months <= 0) return dollars(present)
  const rate = monthlyRate(annualPercent)
  const compounded = (1 + rate) ** months
  const contributions = rate === 0 ? monthly * months : (monthly * (compounded - 1)) / rate
  return dollars(present * compounded + contributions)
}

function monthlyToFill(gap: number, annualPercent: number, years: number) {
  const months = Math.round(years * 12)
  if (months <= 0) return null
  const rate = monthlyRate(annualPercent)
  if (rate === 0) return dollars(gap / months)
  const compounded = (1 + rate) ** months
  return dollars((gap * rate) / (compounded - 1))
}

function dollars(amount: number) {
  return Math.round(amount)
}

function monthlyRate(annualPercent: number) {
  if (annualPercent <= 0) return 0
  return (1 + annualPercent / 100) ** (1 / 12) - 1
}

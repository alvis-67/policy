import assert from 'node:assert/strict'
import { analyzeClient } from '../src/lib/analysis'
import { calculateLifeNeed, supportYears, validateDraft } from '../src/lib/lifeNeed'
import { assetSeries, calculateRetirement, retirementError, type RetirementInput } from '../src/lib/retirement'
import { toAnnualPremium, toMonthlyPremium } from '../src/lib/format'
import { coverExtendsPast75, documentsForProduct, suggestManulifeLife } from '../src/lib/lifeProduct'
import { coverForBudget, manutermRate, premiumToFill } from '../src/lib/manutermQuote'
import { mixBudget } from '../src/lib/budgetMix'
import { usdCover, usdFill, usdSkip } from '../src/lib/usdQuote'
import { manulifeFileError, storageFileName } from '../src/lib/manulifeFileRules'
import { formatAmountInput } from '../src/lib/parse'
import { summarizePolicies } from './stats'
import { validateClient, validatePolicy } from './validate'
import type { Client, Policy, PolicyWrite } from '../src/types'

assert.equal(toAnnualPremium(1500, 'monthly'), 18000)
assert.equal(toAnnualPremium(18000, 'yearly'), 18000)
assert.equal(toMonthlyPremium(18000, 'yearly'), 1500)
assert.equal(toMonthlyPremium(10000, 'yearly'), 833.33)
assert.equal(formatAmountInput('1000000'), '1,000,000')
assert.equal(formatAmountInput('1,000.50'), '1,000.50')
assert.equal(formatAmountInput('1000.'), '1,000.')
assert.equal(manulifeFileError('小冊子.pdf', 1200), null)
assert.equal(manulifeFileError('保費.txt', 1200), '只可以上傳 PDF、圖片或試算表。')
assert.equal(storageFileName('C:\\檔案\\盈傳 小冊子.pdf'), 'file.pdf')
assert.equal(storageFileName('卓越終身保（優越終身保）- 產品手冊.pdf'), 'file.pdf')

const emptyPlan = {
  funeralCost: 0,
  siblingCount: 1,
  inflationRate: 0,
  childUntil: 22,
  parentUntil: 88,
  reserveAmount: 0,
  spouse: null,
  members: [],
  debts: [],
  assets: [],
}
assert.equal(suggestManulifeLife({ age: 35, gap: 1_000_000, coverPast75: false }).picks[0]?.name, '精選定期壽險')
assert.equal(suggestManulifeLife({ age: 60, gap: 1_000_000, coverPast75: true }).picks[0]?.name, '優越終身保')
assert.equal(suggestManulifeLife({ age: 80, gap: 1, coverPast75: false }).picks.length, 0)
assert.equal(suggestManulifeLife({ age: 40, gap: 0, coverPast75: false }).picks[0]?.name, '盈傳創富保障計劃3')
assert.equal(
  coverExtendsPast75(60, { ...emptyPlan, members: [{ id: '1', role: 'parent', name: '', age: 70, monthlyCost: 3000 }] }),
  true,
)
assert.equal(
  coverExtendsPast75(40, { ...emptyPlan, members: [{ id: '1', role: 'child', name: '', age: 10, monthlyCost: 3000 }] }),
  false,
)
assert.equal(documentsForProduct('優越終身保', [{ productName: '卓越終身保', fileName: '優越終身保 - 保費率表.pdf' }]).length, 1)
assert.equal(documentsForProduct('卓越終身保', [{ productName: '卓越終身保', fileName: '優越終身保 - 保費率表.pdf' }]).length, 0)
assert.equal(documentsForProduct('卓越終身保', [{ productName: '卓越終身保', fileName: '卓越終身保 _ 優越終身保 - 產品手冊.pdf' }]).length, 1)
assert.equal(documentsForProduct('精選定期壽險', [{ productName: '盈傳創富保障計劃3', fileName: '率表.pdf' }]).length, 0)
assert.equal(manutermRate(10, 'male', false, 35, 1), 0.99)
assert.equal(manutermRate(10, 'female', false, 35, 1), 0.97)
assert.equal(manutermRate(20, 'male', false, 35, 1), 1.53)
assert.equal(manutermRate(10, 'male', false, 66, 1), null)
const filled = premiumToFill({ age: 35, sex: 'male', smoker: false, plan: 10, gap: 1_000_000 })
assert.equal(filled?.premium, 1170)
assert.equal(filled?.band, 2)
assert.equal(filled?.rate, 0.97)
const minimum = premiumToFill({ age: 35, sex: 'male', smoker: false, plan: 10, gap: 100_000 })
assert.equal(minimum?.sumAssured, 320_000)
assert.equal(minimum?.premium, 800)
assert.equal(minimum?.raisedToMinimumSum, true)
const bought = coverForBudget({ age: 35, sex: 'male', smoker: false, plan: 10, budget: 1170 })
assert.equal(bought?.sumAssured, 1_000_000)
assert.equal(coverForBudget({ age: 35, sex: 'male', smoker: false, plan: 10, budget: 500 }), null)
assert.equal(premiumToFill({ age: 35, sex: 'male', smoker: false, plan: 10, gap: 0 }), null)
const youyue = usdFill({ product: 'youyue', term: 10, age: 35, sex: 'male', smoker: false, hkdGap: 8_000_000 })
assert.equal(youyue?.usdNotional, 1_000_000)
assert.equal(youyue?.band, 2)
assert.equal(youyue?.rate, 37.82)
assert.equal(youyue?.premiumUsd, 37845)
assert.equal(youyue?.premiumHkd, 302_760)
const ying = usdFill({ product: 'yingchuan', term: 10, age: 35, sex: 'male', smoker: false, hkdGap: 8_000_000 })
assert.equal(ying?.rate, 17.74)
assert.equal(ying?.premiumUsd, 17_740)
assert.equal(ying?.premiumHkd, 141_920)
assert.equal(usdCover({ product: 'youyue', term: 10, age: 35, sex: 'male', smoker: false, hkdBudget: 302_760 })?.usdNotional, 1_000_000)
assert.equal(usdSkip('yingchuan', 20, 35, false), 'term')
assert.equal(usdSkip('yingchuan', 10, 10, true), 'juvenile-smoker')
assert.equal(usdFill({ product: 'yingchuan', term: 'single', age: 10, sex: 'male', smoker: false, hkdGap: 8_000_000 })?.rate, 125.38)
const mix = mixBudget({ age: 35, sex: 'male', smoker: false, hkdGap: 3_120_000, hkdBudget: 30_000, product: 'youyue', term: 20 })
assert.equal(mix?.kind, 'mix')
if (mix?.kind === 'mix') {
  assert.equal(mix.termPlan, 20)
  assert.ok(mix.term.premium + mix.whole.premiumHkd <= 30_000.01)
  assert.ok(Math.abs(mix.term.sumAssured + mix.whole.hkdNotional - 3_120_000) < 1)
  assert.ok(mix.whole.hkdNotional > mix.term.sumAssured * 0.4)
  assert.ok(mix.term.sumAssured > 1_000_000)
}
assert.equal(mixBudget({ age: 35, sex: 'male', smoker: false, hkdGap: 3_120_000, hkdBudget: 100_000, product: 'youyue', term: 20 })?.kind, 'whole-only')
assert.equal(mixBudget({ age: 35, sex: 'male', smoker: false, hkdGap: 3_120_000, hkdBudget: 3_000, product: 'youyue', term: 20 })?.kind, 'short')

const client = validateClient({
  chineseName: '  陳大文 ',
  englishName: 'Chan Tai Man',
  gender: 'male',
  dateOfBirth: '1988-01-02',
  phone: '9123 4567',
  email: '',
  hkid: 'a1234567',
  occupation: '會計',
  maritalStatus: 'married',
  dependents: 2,
  monthlyIncome: 45000,
  address: '',
  notes: '',
})
assert.equal(client.chineseName, '陳大文')
assert.equal(client.hkid, 'A1234567')
assert.equal(client.dependents, 2)

assert.throws(() =>
  validateClient({
    chineseName: ' ',
    englishName: '',
    phone: '91234567',
  }),
)

const life = validatePolicy({
  insurer: '友邦 AIA',
  policyName: '加裕智倍保',
  policyNumber: 'P123',
  policyType: 'life',
  currency: 'HKD',
  sumAssured: 3000000,
  issueDate: '2020-05-01',
  premiumAmount: 1500,
  premiumFrequency: 'monthly',
  premiumTerm: '20年',
  status: 'inforce',
  notes: '',
})

const totals = summarizePolicies([
  policy('1', life),
  policy('2', { ...life, status: 'lapsed', premiumAmount: 999, policyNumber: 'OLD' }),
  policy('3', {
    ...life,
    policyType: 'critical',
    currency: 'USD',
    sumAssured: 200000,
    premiumAmount: 2000,
    premiumFrequency: 'yearly',
    policyNumber: 'US1',
  }),
  policy('4', {
    ...life,
    policyType: 'medical',
    status: 'paidup',
    premiumAmount: 0,
    sumAssured: null,
    roomLevel: 'semi',
    deductible: 0,
    fullCover: true,
    policyNumber: 'MED',
  }),
])

assert.equal(totals.policyCount, 4)
assert.equal(totals.activeCount, 3)
assert.equal(totals.annualPremium.HKD, 18000)
assert.equal(totals.annualPremium.USD, 2000)
assert.equal(totals.monthlyEquivalent.HKD, 1500)
assert.equal(totals.monthlyEquivalent.USD, 166.67)
assert.equal(totals.byType.life.sumAssured.HKD, 3000000)
assert.equal(totals.byType.life.count, 1)
assert.equal(totals.byType.critical.sumAssured.USD, 200000)
assert.equal(totals.byType.medical.sumAssured.HKD, undefined)
const medical = validatePolicy({
  insurer: '宏利 Manulife',
  policyName: '宏利晉悅自願醫保靈活計劃',
  policyNumber: '',
  policyType: 'medical',
  currency: 'HKD',
  sumAssured: null,
  roomLevel: 'private',
  deductible: 0,
  fullCover: false,
  issueDate: '2024-01-01',
  premiumAmount: 800,
  premiumFrequency: 'monthly',
  premiumTerm: '',
  status: 'inforce',
  notes: '',
})
assert.equal(medical.sumAssured, null)
assert.equal(medical.roomLevel, 'private')
assert.equal(medical.deductible, 0)
assert.equal(medical.fullCover, false)
assert.throws(() => validatePolicy({ ...medical, roomLevel: '', fullCover: null }))
assert.equal(totals.byType.medical.annualPremium.HKD, undefined)
assert.equal(totals.byType.accident.count, 0)

const family = sampleClient({ monthlyIncome: 80000, maritalStatus: 'married', dependents: 2 })
const familyCover = analyzeClient(family, [
  policy('life-hk', { ...life, sumAssured: 1000000, premiumAmount: 20000, premiumFrequency: 'yearly' }),
  policy('ci-hk', { ...life, policyType: 'critical', sumAssured: 500000, premiumAmount: 20000, premiumFrequency: 'yearly', policyNumber: 'CI' }),
  policy('old', { ...life, status: 'lapsed', sumAssured: 9000000, policyNumber: 'OLD2' }),
  policy('med', { ...medical, fullCover: true }),
])
const lifeGap = familyCover.findings.find((item) => item.type === 'life')
const criticalGap = familyCover.findings.find((item) => item.type === 'critical')
const medicalGap = familyCover.findings.find((item) => item.type === 'medical')
const accidentGap = familyCover.findings.find((item) => item.type === 'accident')
assert.equal(lifeGap?.hkdNeed, 9600000)
assert.equal(lifeGap?.hkdGap, 8600000)
assert.equal(lifeGap?.verdict, 'short')
assert.equal(criticalGap?.hkdNeed, 4800000)
assert.equal(criticalGap?.hkdGap, 4300000)
assert.equal(medicalGap?.verdict, 'enough')
assert.equal(accidentGap?.verdict, 'short')
assert.equal(accidentGap?.hkdGap, 4800000)

const usdOnly = analyzeClient(family, [policy('usd', { ...life, currency: 'USD', sumAssured: 200000, policyNumber: 'US2' })])
assert.equal(usdOnly.findings.find((item) => item.type === 'life')?.hkdHave, 0)
assert.equal(usdOnly.findings.find((item) => item.type === 'life')?.hkdGap, 9600000)
assert.match(usdOnly.findings.find((item) => item.type === 'life')?.note ?? '', /沒有兌換/)

const single = analyzeClient(sampleClient({ maritalStatus: 'single', dependents: 0, monthlyIncome: 20000 }), [])
assert.equal(single.findings.find((item) => item.type === 'life')?.hkdNeed, 1200000)
assert.equal(single.lifeYears, 5)

const ward = analyzeClient(family, [policy('ward', { ...medical, roomLevel: 'ward', fullCover: true, policyNumber: 'W' })])
assert.equal(ward.findings.find((item) => item.type === 'medical')?.verdict, 'raise')

const partial = analyzeClient(family, [policy('part', medical)])
assert.equal(partial.findings.find((item) => item.type === 'medical')?.verdict, 'raise')

const noIncome = analyzeClient(sampleClient({ monthlyIncome: null }), [policy('life2', life)])
assert.equal(noIncome.findings.find((item) => item.type === 'life')?.verdict, 'unknown')
assert.equal(noIncome.annualIncome, null)

assert.equal(supportYears('child', 0), 22)
assert.equal(supportYears('child', 10), 12)
assert.equal(supportYears('child', 22), 0)
assert.equal(supportYears('parent', 65), 23)
assert.equal(supportYears('parent', 88), 0)

const lifeNeed = calculateLifeNeed(
  {
    funeralCost: 80000,
    siblingCount: 3,
    inflationRate: 0,
    childUntil: 22,
    parentUntil: 88,
    reserveAmount: 0,
    spouse: null,
    members: [
      { id: 'child', role: 'child', name: '兒子', age: 0, monthlyCost: 10000 },
      { id: 'parent', role: 'parent', name: '媽媽', age: 65, monthlyCost: 9000 },
    ],
    debts: [
      { id: 'mortgage', name: '房貸', amount: 2000000 },
      { id: 'loan', name: '私人貸款', amount: 100000 },
    ],
    assets: [
      { id: 'cash', name: '現金', amount: 500000 },
      { id: 'mpf', name: '強積金', amount: 200000 },
    ],
  },
  [
    policy('need-life', { ...life, sumAssured: 1000000, policyNumber: 'NEED' }),
    policy('need-usd', { ...life, currency: 'USD', sumAssured: 50000, policyNumber: 'NEED-USD' }),
    policy('need-old', { ...life, status: 'lapsed', sumAssured: 9000000, policyNumber: 'NEED-OLD' }),
  ],
)
assert.equal(lifeNeed.childTotal, 2640000)
assert.equal(lifeNeed.parentTotal, 828000)
assert.equal(lifeNeed.familyTotal, 3468000)
assert.equal(lifeNeed.grossNeed, 5648000)
assert.equal(lifeNeed.lifeHkd, 1000000)
assert.equal(lifeNeed.gap, 3948000)
assert.equal(lifeNeed.gapWithoutInflation, 3948000)
assert.match(lifeNeed.foreignLife, /US\$50,000|USD/)

const inflated = calculateLifeNeed(
  {
    funeralCost: 0,
    siblingCount: 1,
    inflationRate: 3,
    childUntil: 22,
    parentUntil: 88,
    reserveAmount: 0,
    spouse: null,
    members: [{ id: 'child', role: 'child', name: '兒子', age: 0, monthlyCost: 10000 }],
    debts: [],
    assets: [],
  },
  [],
)
const inflatedFactor = (Math.pow(1.03, 22) - 1) / 0.03
assert.equal(inflated.childTotal, Math.round(120000 * inflatedFactor * 100) / 100)
assert.ok(inflated.gap > inflated.gapWithoutInflation)
assert.equal(inflated.gapWithoutInflation, 2640000)

const adjusted = calculateLifeNeed(
  {
    funeralCost: 0,
    siblingCount: 1,
    inflationRate: 0,
    childUntil: 18,
    parentUntil: 90,
    reserveAmount: 200000,
    spouse: { age: 40, monthlyCost: 20000, untilAge: 65 },
    members: [
      { id: 'child', role: 'child', name: '女兒', age: 10, monthlyCost: 5000 },
      { id: 'parent', role: 'parent', name: '父親', age: 65, monthlyCost: 3000 },
    ],
    debts: [],
    assets: [{ id: 'cash', name: '現金', amount: 500000 }],
  },
  [],
)
assert.equal(adjusted.lines.find((line) => line.role === 'child')?.years, 8)
assert.equal(adjusted.lines.find((line) => line.role === 'parent')?.years, 25)
assert.equal(adjusted.spouseTotal, 6000000)
assert.equal(adjusted.deductibleAssets, 300000)
assert.equal(adjusted.gap, adjusted.grossNeed - 300000)

const invalidPlan = validateDraft({
  funeralCost: '',
  siblingCount: '0',
  inflationRate: '0',
  childUntil: '22',
  parentUntil: '88',
  reserveAmount: '',
  spouseAge: '',
  spouseMonthly: '',
  spouseUntil: '',
  members: [],
  debts: [],
  assets: [],
})
assert.ok('error' in invalidPlan)

const quiet = retirementCase({ inflationRate: 0, returnBefore: 0, returnAfter: 0, mpfBalance: 100000, mpfMonthly: 1000, otherAssets: 0, monthlyExpense: 10000, currentAge: 60, retireAge: 65, untilAge: 70 })
assert.equal(quiet.capitalNeeded, 600000)
assert.equal(quiet.mpfFuture, 160000)
assert.equal(quiet.gap, 440000)
assert.equal(quiet.monthlyTopUp, 7333)
const quietSeries = assetSeries(retirementCaseInput({ inflationRate: 0, returnBefore: 0, returnAfter: 0, mpfBalance: 100000, mpfMonthly: 1000, otherAssets: 0, monthlyExpense: 10000, currentAge: 60, retireAge: 65, untilAge: 70 }))
assert.equal(quietSeries.length, 6)
assert.equal(quietSeries[0], 100000)
assert.equal(quietSeries[5], 160000)

const invested = retirementCase({ currentAge: 64, retireAge: 65, untilAge: 67, monthlyExpense: 1000, inflationRate: 0, returnBefore: 0, returnAfter: 10, mpfBalance: 0, mpfMonthly: 0, otherAssets: 0 })
assert.equal(invested.capitalNeeded, 22909)
assert.equal(invested.gap, 22909)

const surplus = retirementCase({ otherAssets: 20000000, mpfBalance: 0, mpfMonthly: 0, inflationRate: 0, returnBefore: 0, returnAfter: 0 })
assert.equal(surplus.gap, 0)
assert.ok(surplus.surplus > 0)
assert.equal(retirementError(retirementCaseInput({ retireAge: 50, currentAge: 60 })), '目標退休年齡須為 50 至 75 歲，而且不可小於現時年齡。')

console.log('selfcheck ok')

function sampleClient(patch: Partial<Client>): Client {
  return {
    id: 'c',
    chineseName: '陳大文',
    englishName: '',
    gender: 'male',
    dateOfBirth: '1980-06-07',
    phone: '',
    email: '',
    hkid: '',
    occupation: '',
    maritalStatus: 'married',
    dependents: 2,
    monthlyIncome: 80000,
    address: '',
    notes: '',
    createdAt: '',
    updatedAt: '',
    ...patch,
  }
}

function retirementCase(patch: Partial<RetirementInput>) {
  return calculateRetirement(retirementCaseInput(patch))
}

function retirementCaseInput(patch: Partial<RetirementInput>): RetirementInput {
  return {
    currentAge: 35,
    retireAge: 65,
    monthlyExpense: 20000,
    mpfBalance: 300000,
    mpfMonthly: 3000,
    otherAssets: 500000,
    untilAge: 90,
    inflationRate: 3,
    returnBefore: 5,
    returnAfter: 3,
    expenseRatio: 100,
    ...patch,
  }
}

function policy(id: string, input: PolicyWrite): Policy {
  return {
    id,
    clientId: 'client',
    ...input,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

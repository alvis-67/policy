import assert from 'node:assert/strict'
import { analyzeClient } from '../src/lib/analysis'
import { calculateLifeNeed, supportYears, validateDraft } from '../src/lib/lifeNeed'
import { toAnnualPremium, toMonthlyPremium } from '../src/lib/format'
import { summarizePolicies } from './stats'
import { validateClient, validatePolicy } from './validate'
import type { Client, Policy, PolicyWrite } from '../src/types'

assert.equal(toAnnualPremium(1500, 'monthly'), 18000)
assert.equal(toAnnualPremium(18000, 'yearly'), 18000)
assert.equal(toMonthlyPremium(18000, 'yearly'), 1500)
assert.equal(toMonthlyPremium(10000, 'yearly'), 833.33)

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
assert.match(lifeNeed.foreignLife, /US\$50,000|USD/)

const invalidPlan = validateDraft({
  funeralCost: '',
  siblingCount: '0',
  members: [],
  debts: [],
  assets: [],
})
assert.ok('error' in invalidPlan)

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

function policy(id: string, input: PolicyWrite): Policy {
  return {
    id,
    clientId: 'client',
    ...input,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

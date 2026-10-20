import assert from 'node:assert/strict'
import { toAnnualPremium, toMonthlyPremium } from '../src/lib/format'
import { summarizePolicies } from './stats'
import { validateClient, validatePolicy } from './validate'
import type { Policy, PolicyWrite } from '../src/types'

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
    sumAssured: 500000,
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
assert.equal(totals.byType.medical.sumAssured.HKD, 500000)
assert.equal(totals.byType.medical.annualPremium.HKD, undefined)
assert.equal(totals.byType.accident.count, 0)

console.log('selfcheck ok')

function policy(id: string, input: PolicyWrite): Policy {
  return {
    id,
    clientId: 'client',
    ...input,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

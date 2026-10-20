import { addMoney, toAnnualPremium, toMonthlyPremium } from './format'
import { countsAsCover, POLICY_TYPES, type PolicyType } from './labels'
import type { CoverageTypeStat, Policy, PolicyTotals } from '../types'

function blankTypes(): Record<PolicyType, CoverageTypeStat> {
  const byType = {} as Record<PolicyType, CoverageTypeStat>
  for (const type of POLICY_TYPES) {
    byType[type.value] = { count: 0, sumAssured: {}, annualPremium: {} }
  }
  return byType
}

export function summarizePolicies(policies: Policy[]): PolicyTotals {
  const byType = blankTypes()
  const annualPremium: PolicyTotals['annualPremium'] = {}
  const monthlyEquivalent: PolicyTotals['monthlyEquivalent'] = {}
  let activeCount = 0

  for (const policy of policies) {
    if (!countsAsCover(policy.status)) continue
    activeCount += 1
    const annual = toAnnualPremium(policy.premiumAmount, policy.premiumFrequency)
    const monthly = toMonthlyPremium(policy.premiumAmount, policy.premiumFrequency)
    addMoney(annualPremium, policy.currency, annual)
    addMoney(monthlyEquivalent, policy.currency, monthly)
    const stat = byType[policy.policyType]
    if (!stat) continue
    stat.count += 1
    addMoney(stat.sumAssured, policy.currency, policy.sumAssured)
    addMoney(stat.annualPremium, policy.currency, annual)
  }

  return {
    policyCount: policies.length,
    activeCount,
    annualPremium,
    monthlyEquivalent,
    byType,
  }
}

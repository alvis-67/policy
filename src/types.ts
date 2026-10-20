import type { MoneyBag } from './lib/format'
import type {
  Currency,
  Gender,
  MaritalStatus,
  PolicyStatus,
  PolicyType,
  PremiumFrequency,
} from './lib/labels'

export interface Client {
  id: string
  chineseName: string
  englishName: string
  gender: Gender
  dateOfBirth: string
  phone: string
  email: string
  hkid: string
  occupation: string
  maritalStatus: MaritalStatus
  dependents: number | null
  monthlyIncome: number | null
  address: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type ClientWrite = Omit<Client, 'id' | 'createdAt' | 'updatedAt'>

export interface Policy {
  id: string
  clientId: string
  insurer: string
  policyName: string
  policyNumber: string
  policyType: PolicyType
  currency: Currency
  sumAssured: number
  issueDate: string
  premiumAmount: number
  premiumFrequency: PremiumFrequency
  premiumTerm: string
  status: PolicyStatus
  notes: string
  createdAt: string
  updatedAt: string
}

export type PolicyWrite = Omit<Policy, 'id' | 'clientId' | 'createdAt' | 'updatedAt'>

export interface CoverageTypeStat {
  count: number
  sumAssured: MoneyBag
  annualPremium: MoneyBag
}

export interface PolicyTotals {
  policyCount: number
  activeCount: number
  annualPremium: MoneyBag
  monthlyEquivalent: MoneyBag
  byType: Record<PolicyType, CoverageTypeStat>
}

export interface ClientListItem {
  id: string
  chineseName: string
  englishName: string
  phone: string
  dateOfBirth: string
  gender: Gender
  updatedAt: string
  policyCount: number
  activeCount: number
  annualPremium: MoneyBag
}

export interface ClientDetailResponse {
  client: Client
  policies: Policy[]
  totals: PolicyTotals
}

export interface Summary {
  clientCount: number
  policyCount: number
  activePolicyCount: number
  annualPremium: MoneyBag
  byType: Record<PolicyType, CoverageTypeStat>
  recentClients: ClientListItem[]
}

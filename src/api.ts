import { validateClient, validatePolicy } from '../server/validate'
import type { LifeMember, LifeMoneyItem, LifePlanInput } from './lib/lifeNeed'
import { summarizePolicies } from './lib/stats'
import { supabase } from './lib/supabase'
import {
  CURRENCIES,
  GENDER_OPTIONS,
  MARITAL_OPTIONS,
  POLICY_STATUSES,
  POLICY_TYPES,
  PREMIUM_FREQUENCIES,
  ROOM_LEVELS,
} from './lib/labels'
import type { Client, ClientDetailResponse, ClientListItem, ClientWrite, Policy, PolicyWrite, Summary } from './types'

export interface SavedLifePlan extends LifePlanInput {
  clientId: string
  updatedAt: string
}

interface ClientRow {
  id: string
  chinese_name: string
  english_name: string
  gender: string
  date_of_birth: string | null
  phone: string
  email: string
  hkid: string
  occupation: string
  marital_status: string
  dependents: number | string | null
  monthly_income: number | string | null
  address: string
  notes: string
  created_at: string
  updated_at: string
}

interface PolicyRow {
  id: string
  client_id: string
  insurer: string
  policy_name: string
  policy_number: string
  policy_type: string
  currency: string
  sum_assured: number | string | null
  room_level: string | null
  deductible: number | string | null
  full_cover: boolean | null
  issue_date: string
  premium_amount: number | string
  premium_frequency: string
  premium_term: string
  status: string
  notes: string
  created_at: string
  updated_at: string
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '系統暫時無法處理，請再試一次。'
}

function optionalEnum<T extends string>(value: string, options: readonly { value: T }[]): T | '' {
  return options.find((option) => option.value === value)?.value ?? ''
}

function requiredEnum<T extends string>(value: string, options: readonly { value: T }[], fallback: T): T {
  return options.find((option) => option.value === value)?.value ?? fallback
}

function optionalNumber(value: number | string | null): number | null {
  if (value == null || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function requiredNumber(value: number | string): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : 0
}

function mapClient(row: ClientRow): Client {
  return {
    id: row.id,
    chineseName: row.chinese_name,
    englishName: row.english_name,
    gender: optionalEnum(row.gender, GENDER_OPTIONS),
    dateOfBirth: row.date_of_birth ?? '',
    phone: row.phone,
    email: row.email,
    hkid: row.hkid,
    occupation: row.occupation,
    maritalStatus: optionalEnum(row.marital_status, MARITAL_OPTIONS),
    dependents: optionalNumber(row.dependents),
    monthlyIncome: optionalNumber(row.monthly_income),
    address: row.address,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapPolicy(row: PolicyRow): Policy {
  return {
    id: row.id,
    clientId: row.client_id,
    insurer: row.insurer,
    policyName: row.policy_name,
    policyNumber: row.policy_number,
    policyType: requiredEnum(row.policy_type, POLICY_TYPES, 'other'),
    currency: requiredEnum(row.currency, CURRENCIES, 'HKD'),
    sumAssured: row.sum_assured == null || row.sum_assured === '' ? null : requiredNumber(row.sum_assured),
    roomLevel: optionalEnum(row.room_level ?? '', ROOM_LEVELS),
    deductible: optionalNumber(row.deductible),
    fullCover: row.full_cover == null ? null : row.full_cover === true,
    issueDate: row.issue_date,
    premiumAmount: requiredNumber(row.premium_amount),
    premiumFrequency: requiredEnum(row.premium_frequency, PREMIUM_FREQUENCIES, 'yearly'),
    premiumTerm: row.premium_term,
    status: requiredEnum(row.status, POLICY_STATUSES, 'inforce'),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function fail(error: { message: string; code?: string } | null, fallback = '系統暫時無法處理，請再試一次。'): never {
  if (error?.code === 'PGRST116') throw new Error('找不到這項紀錄')
  if (error?.message.toLowerCase().includes('jwt')) throw new Error('請重新登入')
  const message = (error?.message ?? '').toLowerCase()
  if (/room_level|deductible|full_cover|sum_assured/.test(message)) {
    throw new Error('醫療欄位尚未建立。請到 Supabase SQL Editor 執行 supabase/medical.sql，然後再儲存。')
  }
  if (message.includes('life_plans')) {
    throw new Error('理財分析尚未建立。請到 Supabase SQL Editor 執行 supabase/life.sql，然後再儲存。')
  }
  throw new Error(fallback)
}

async function loadBook() {
  const clientsResult = await supabase.from('clients').select('*').returns<ClientRow[]>()
  if (clientsResult.error) fail(clientsResult.error, '讀取客戶失敗，請再試一次。')
  const policiesResult = await supabase.from('policies').select('*').returns<PolicyRow[]>()
  if (policiesResult.error) fail(policiesResult.error, '讀取保單失敗，請再試一次。')
  return {
    clients: (clientsResult.data ?? []).map(mapClient),
    policies: (policiesResult.data ?? []).map(mapPolicy),
  }
}

function policiesFor(policies: Policy[], clientId: string) {
  return policies
    .filter((policy) => policy.clientId === clientId)
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.createdAt.localeCompare(a.createdAt))
}

function toListItem(client: Client, policies: Policy[]): ClientListItem {
  const totals = summarizePolicies(policies)
  return {
    id: client.id,
    chineseName: client.chineseName,
    englishName: client.englishName,
    phone: client.phone,
    dateOfBirth: client.dateOfBirth,
    gender: client.gender,
    updatedAt: client.updatedAt,
    policyCount: totals.policyCount,
    activeCount: totals.activeCount,
    annualPremium: totals.annualPremium,
  }
}

function matchesQuery(client: Client, policies: Policy[], query: string) {
  const haystack = [
    client.chineseName,
    client.englishName,
    client.phone,
    client.email,
    client.hkid,
    client.occupation,
    client.notes,
    ...policies.flatMap((policy) => [policy.insurer, policy.policyName, policy.policyNumber, policy.notes]),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query.toLowerCase())
}

function clientPayload(input: ClientWrite) {
  return {
    chinese_name: input.chineseName,
    english_name: input.englishName,
    gender: input.gender,
    date_of_birth: input.dateOfBirth || null,
    phone: input.phone,
    email: input.email,
    hkid: input.hkid,
    occupation: input.occupation,
    marital_status: input.maritalStatus,
    dependents: input.dependents,
    monthly_income: input.monthlyIncome,
    address: input.address,
    notes: input.notes,
  }
}

function policyPayload(input: PolicyWrite, clientId?: string) {
  return {
    ...(clientId ? { client_id: clientId } : {}),
    insurer: input.insurer,
    policy_name: input.policyName,
    policy_number: input.policyNumber,
    policy_type: input.policyType,
    currency: input.currency,
    sum_assured: input.sumAssured,
    room_level: input.roomLevel || null,
    deductible: input.deductible,
    full_cover: input.fullCover,
    issue_date: input.issueDate,
    premium_amount: input.premiumAmount,
    premium_frequency: input.premiumFrequency,
    premium_term: input.premiumTerm,
    status: input.status,
    notes: input.notes,
  }
}

export const api = {
  async summary(): Promise<Summary> {
    const { clients, policies } = await loadBook()
    const totals = summarizePolicies(policies)
    const recentClients = clients
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6)
      .map((client) => toListItem(client, policiesFor(policies, client.id)))
    return {
      clientCount: clients.length,
      policyCount: totals.policyCount,
      activePolicyCount: totals.activeCount,
      annualPremium: totals.annualPremium,
      byType: totals.byType,
      recentClients,
    }
  },

  async clients(query: string): Promise<ClientListItem[]> {
    const { clients, policies } = await loadBook()
    const needle = query.trim()
    return clients
      .filter((client) => !needle || matchesQuery(client, policiesFor(policies, client.id), needle))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((client) => toListItem(client, policiesFor(policies, client.id)))
  },

  async client(id: string): Promise<ClientDetailResponse> {
    const { clients, policies } = await loadBook()
    const client = clients.find((item) => item.id === id)
    if (!client) throw new Error('找不到這位客戶')
    const ownPolicies = policiesFor(policies, id)
    return { client, policies: ownPolicies, totals: summarizePolicies(ownPolicies) }
  },

  async createClient(body: ClientWrite): Promise<Client> {
    const input = validateClient(body)
    const result = await supabase.from('clients').insert(clientPayload(input)).select('*').single()
    if (result.error || !result.data) fail(result.error, '儲存客戶失敗，請再試一次。')
    return mapClient(result.data as ClientRow)
  },

  async updateClient(id: string, body: ClientWrite): Promise<Client> {
    const input = validateClient(body)
    const result = await supabase.from('clients').update(clientPayload(input)).eq('id', id).select('*').single()
    if (result.error || !result.data) fail(result.error, '更新客戶失敗，請再試一次。')
    return mapClient(result.data as ClientRow)
  },

  async deleteClient(id: string): Promise<{ ok: true }> {
    const result = await supabase.from('clients').delete().eq('id', id)
    if (result.error) fail(result.error, '刪除客戶失敗，請再試一次。')
    return { ok: true }
  },

  async createPolicy(clientId: string, body: PolicyWrite): Promise<Policy> {
    const input = validatePolicy(body)
    const result = await supabase.from('policies').insert(policyPayload(input, clientId)).select('*').single()
    if (result.error || !result.data) fail(result.error, '儲存保單失敗，請再試一次。')
    return mapPolicy(result.data as PolicyRow)
  },

  async updatePolicy(id: string, body: PolicyWrite): Promise<Policy> {
    const input = validatePolicy(body)
    const result = await supabase.from('policies').update(policyPayload(input)).eq('id', id).select('*').single()
    if (result.error || !result.data) fail(result.error, '更新保單失敗，請再試一次。')
    return mapPolicy(result.data as PolicyRow)
  },

  async deletePolicy(id: string): Promise<{ ok: true }> {
    const result = await supabase.from('policies').delete().eq('id', id)
    if (result.error) fail(result.error, '刪除保單失敗，請再試一次。')
    return { ok: true }
  },

  async backup(): Promise<{ clients: Client[]; policies: Policy[] }> {
    return loadBook()
  },

  async lifePlans(): Promise<{ ready: boolean; plans: SavedLifePlan[] }> {
    const result = await supabase.from('life_plans').select('*')
    if (result.error) {
      if (missingLifeTable(result.error)) return { ready: false, plans: [] }
      fail(result.error, '讀取理財分析失敗，請再試一次。')
    }
    return { ready: true, plans: ((result.data ?? []) as LifePlanRow[]).map(mapLifePlan) }
  },

  async lifePlan(clientId: string): Promise<{ ready: boolean; plan: SavedLifePlan | null }> {
    const result = await supabase.from('life_plans').select('*').eq('client_id', clientId).maybeSingle()
    if (result.error) {
      if (missingLifeTable(result.error)) return { ready: false, plan: null }
      fail(result.error, '讀取理財分析失敗，請再試一次。')
    }
    return { ready: true, plan: result.data ? mapLifePlan(result.data as LifePlanRow) : null }
  },

  async saveLifePlan(clientId: string, plan: LifePlanInput): Promise<SavedLifePlan> {
    const result = await supabase
      .from('life_plans')
      .upsert(
        {
          client_id: clientId,
          funeral_cost: plan.funeralCost,
          sibling_count: plan.siblingCount,
          inflation_rate: plan.inflationRate,
          child_until: plan.childUntil,
          parent_until: plan.parentUntil,
          reserve_amount: plan.reserveAmount,
          spouse_age: plan.spouse?.age ?? null,
          spouse_monthly: plan.spouse?.monthlyCost ?? null,
          spouse_until: plan.spouse?.untilAge ?? null,
          members: plan.members,
          debts: plan.debts,
          assets: plan.assets,
        },
        { onConflict: 'client_id' },
      )
      .select('*')
      .single()
    if (result.error || !result.data) fail(result.error, '儲存理財分析失敗，請再試一次。')
    return mapLifePlan(result.data as LifePlanRow)
  },

  async policyChoices(): Promise<Array<{ insurer: string; policyType: Policy['policyType']; policyName: string }>> {
    const { policies } = await loadBook()
    const seen = new Set<string>()
    const choices: Array<{ insurer: string; policyType: Policy['policyType']; policyName: string }> = []
    const ordered = policies.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    for (const policy of ordered) {
      const key = `${policy.insurer}\0${policy.policyType}\0${policy.policyName}`
      if (seen.has(key)) continue
      seen.add(key)
      choices.push({ insurer: policy.insurer, policyType: policy.policyType, policyName: policy.policyName })
    }
    return choices
  },
}

interface LifePlanRow {
  client_id: string
  funeral_cost: number | string | null
  sibling_count: number | string | null
  inflation_rate?: number | string | null
  child_until?: number | string | null
  parent_until?: number | string | null
  reserve_amount?: number | string | null
  spouse_age?: number | string | null
  spouse_monthly?: number | string | null
  spouse_until?: number | string | null
  members: unknown
  debts: unknown
  assets: unknown
  updated_at: string
}

function missingLifeTable(error: { message?: string; code?: string }) {
  const message = (error.message ?? '').toLowerCase()
  return error.code === 'PGRST205' || error.code === '42P01' || message.includes('life_plans')
}

function mapLifePlan(row: LifePlanRow): SavedLifePlan {
  const siblingCount = optionalNumber(row.sibling_count) ?? 1
  return {
    clientId: row.client_id,
    funeralCost: Math.max(0, optionalNumber(row.funeral_cost) ?? 0),
    siblingCount: Math.min(20, Math.max(1, Math.round(siblingCount))),
    inflationRate: Math.min(20, Math.max(0, optionalNumber(row.inflation_rate ?? null) ?? 0)),
    childUntil: bounded(row.child_until, 22, 1, 40),
    parentUntil: bounded(row.parent_until, 88, 50, 120),
    reserveAmount: Math.max(0, optionalNumber(row.reserve_amount ?? null) ?? 0),
    spouse: readSpouse(row),
    members: readMembers(row.members),
    debts: readMoneyItems(row.debts, '債務'),
    assets: readMoneyItems(row.assets, '資金'),
    updatedAt: row.updated_at,
  }
}

function readMembers(value: unknown): LifeMember[] {
  if (!Array.isArray(value)) return []
  const members: LifeMember[] = []
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') return
    const row = item as Record<string, unknown>
    const role = row.role === 'parent' ? 'parent' : row.role === 'child' ? 'child' : null
    const age = optionalNumber(asNumber(row.age))
    const monthlyCost = optionalNumber(asNumber(row.monthlyCost))
    if (!role || age == null || monthlyCost == null || age < 0 || age > 120 || monthlyCost < 0) return
    members.push({
      id: typeof row.id === 'string' && row.id ? row.id : `member-${index}`,
      role,
      name: typeof row.name === 'string' ? row.name.slice(0, 40) : '',
      age: Math.round(age),
      monthlyCost,
    })
  })
  return members
}

function readMoneyItems(value: unknown, fallback: string): LifeMoneyItem[] {
  if (!Array.isArray(value)) return []
  const items: LifeMoneyItem[] = []
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') return
    const row = item as Record<string, unknown>
    const amount = optionalNumber(asNumber(row.amount))
    if (amount == null || amount < 0) return
    items.push({
      id: typeof row.id === 'string' && row.id ? row.id : `item-${index}`,
      name: typeof row.name === 'string' && row.name.trim() ? row.name.trim().slice(0, 40) : fallback,
      amount,
    })
  })
  return items
}

function readSpouse(row: LifePlanRow): LifePlanInput['spouse'] {
  const age = optionalNumber(row.spouse_age ?? null)
  const monthlyCost = optionalNumber(row.spouse_monthly ?? null)
  const untilAge = optionalNumber(row.spouse_until ?? null)
  if (age == null || monthlyCost == null || untilAge == null) return null
  if (age < 0 || age > 120 || monthlyCost < 0 || untilAge < 1 || untilAge > 120) return null
  return { age: Math.round(age), monthlyCost, untilAge: Math.round(untilAge) }
}

function bounded(value: number | string | null | undefined, fallback: number, min: number, max: number) {
  const number = optionalNumber(value ?? null)
  if (number == null) return fallback
  const rounded = Math.round(number)
  return rounded < min || rounded > max ? fallback : rounded
}

function asNumber(value: unknown): number | string | null {
  return typeof value === 'number' || typeof value === 'string' ? value : null
}

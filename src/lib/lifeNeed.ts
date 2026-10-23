import { addMoney, formatMoney, moneyParts, roundMoney, type MoneyBag } from './format'
import { countsAsCover, type Currency } from './labels'
import type { Policy } from '../types'

export const CHILD_UNTIL = 22
export const PARENT_UNTIL = 88

export type LifeRole = 'child' | 'parent'

export interface LifeMember {
  id: string
  role: LifeRole
  name: string
  age: number
  monthlyCost: number
}

export interface LifeMoneyItem {
  id: string
  name: string
  amount: number
}

export interface LifePlanInput {
  funeralCost: number
  siblingCount: number
  members: LifeMember[]
  debts: LifeMoneyItem[]
  assets: LifeMoneyItem[]
}

export interface LifeDraftMember {
  id: string
  role: LifeRole
  name: string
  age: string
  monthlyCost: string
}

export interface LifeDraftItem {
  id: string
  name: string
  amount: string
}

export interface LifeDraft {
  funeralCost: string
  siblingCount: string
  members: LifeDraftMember[]
  debts: LifeDraftItem[]
  assets: LifeDraftItem[]
}

export interface LifeSupportLine {
  id: string
  role: LifeRole
  name: string
  age: number
  years: number
  monthlyCost: number
  share: number
  amount: number
}

export interface LifeNeedResult {
  lines: LifeSupportLine[]
  childTotal: number
  parentTotal: number
  familyTotal: number
  debtTotal: number
  funeralCost: number
  grossNeed: number
  assetTotal: number
  lifeHkd: number
  lifeCount: number
  foreignLife: string
  gap: number
}

export function emptyDraft(): LifeDraft {
  return { funeralCost: '', siblingCount: '1', members: [], debts: [], assets: [] }
}

export function draftFromPlan(plan: LifePlanInput): LifeDraft {
  return {
    funeralCost: plan.funeralCost ? String(plan.funeralCost) : '',
    siblingCount: String(plan.siblingCount),
    members: plan.members.map((member) => ({
      id: member.id,
      role: member.role,
      name: member.name,
      age: String(member.age),
      monthlyCost: String(member.monthlyCost),
    })),
    debts: plan.debts.map(itemToDraft),
    assets: plan.assets.map(itemToDraft),
  }
}

export function supportYears(role: LifeRole, age: number) {
  const until = role === 'child' ? CHILD_UNTIL : PARENT_UNTIL
  return Math.max(0, until - age)
}

export function calculateLifeNeed(plan: LifePlanInput, policies: Policy[]): LifeNeedResult {
  const share = plan.siblingCount >= 1 ? plan.siblingCount : 1
  const lines = plan.members.map((member) => memberLine(member, share))
  const childTotal = roundMoney(sum(lines.filter((line) => line.role === 'child').map((line) => line.amount)))
  const parentTotal = roundMoney(sum(lines.filter((line) => line.role === 'parent').map((line) => line.amount)))
  const familyTotal = roundMoney(childTotal + parentTotal)
  const debtTotal = roundMoney(sum(plan.debts.map((item) => item.amount)))
  const funeralCost = roundMoney(Math.max(0, plan.funeralCost))
  const grossNeed = roundMoney(familyTotal + debtTotal + funeralCost)
  const assetTotal = roundMoney(sum(plan.assets.map((item) => item.amount)))
  const life = existingLife(policies)
  const gap = roundMoney(grossNeed - assetTotal - life.hkd)
  return {
    lines,
    childTotal,
    parentTotal,
    familyTotal,
    debtTotal,
    funeralCost,
    grossNeed,
    assetTotal,
    lifeHkd: life.hkd,
    lifeCount: life.count,
    foreignLife: life.foreign,
    gap,
  }
}

export function validateDraft(draft: LifeDraft): { plan: LifePlanInput } | { error: string } {
  const siblingCount = parseInteger(draft.siblingCount)
  if (siblingCount == null || siblingCount < 1 || siblingCount > 20) return { error: '兄弟姊妹人數請填 1 至 20，並連同客人自己。' }
  const funeral = parseMoney(draft.funeralCost)
  if (funeral === 'invalid') return { error: '身後費用請填 0 或正數。' }
  const members: LifeMember[] = []
  for (const member of draft.members) {
    if (blankMember(member)) continue
    const age = parseInteger(member.age)
    const monthlyCost = parseMoney(member.monthlyCost)
    if (age == null || age > 120) return { error: '請填 0 至 120 的年齡。' }
    if (monthlyCost === 'invalid' || monthlyCost == null) return { error: '請填每月照顧費。' }
    members.push({ id: member.id, role: member.role, name: member.name.trim().slice(0, 40), age, monthlyCost })
  }
  const debts = readItems(draft.debts, '債務')
  if ('error' in debts) return debts
  const assets = readItems(draft.assets, '資金')
  if ('error' in assets) return assets
  return { plan: { funeralCost: funeral ?? 0, siblingCount, members, debts, assets } }
}

export function previewDraft(draft: LifeDraft): LifePlanInput {
  const sibling = parseInteger(draft.siblingCount)
  const funeral = parseMoney(draft.funeralCost)
  return {
    funeralCost: funeral == null || funeral === 'invalid' ? 0 : funeral,
    siblingCount: sibling != null && sibling >= 1 && sibling <= 20 ? sibling : 1,
    members: draft.members.flatMap((member) => {
      const age = parseInteger(member.age)
      const monthlyCost = parseMoney(member.monthlyCost)
      if (age == null || age > 120 || monthlyCost == null || monthlyCost === 'invalid') return []
      return [{ id: member.id, role: member.role, name: member.name.trim(), age, monthlyCost }]
    }),
    debts: draft.debts.flatMap((item) => {
      const amount = parseMoney(item.amount)
      if (amount == null || amount === 'invalid') return []
      return [{ id: item.id, name: item.name.trim() || '債務', amount }]
    }),
    assets: draft.assets.flatMap((item) => {
      const amount = parseMoney(item.amount)
      if (amount == null || amount === 'invalid') return []
      return [{ id: item.id, name: item.name.trim() || '資金', amount }]
    }),
  }
}

export function planHasInputs(plan: LifePlanInput) {
  return plan.members.length > 0 || plan.debts.length > 0 || plan.assets.length > 0 || plan.funeralCost > 0
}

function memberLine(member: LifeMember, siblingCount: number): LifeSupportLine {
  const years = supportYears(member.role, member.age)
  const share = member.role === 'parent' ? siblingCount : 1
  return {
    id: member.id,
    role: member.role,
    name: member.name,
    age: member.age,
    years,
    monthlyCost: member.monthlyCost,
    share,
    amount: roundMoney((member.monthlyCost / share) * 12 * years),
  }
}

function existingLife(policies: Policy[]) {
  const bag: MoneyBag = {}
  let hkd = 0
  let count = 0
  for (const policy of policies) {
    if (policy.policyType !== 'life' || !countsAsCover(policy.status) || policy.sumAssured == null) continue
    count += 1
    if (policy.currency === 'HKD') hkd = roundMoney(hkd + policy.sumAssured)
    else addMoney(bag, policy.currency as Currency, policy.sumAssured)
  }
  return { hkd, count, foreign: moneyParts(bag).join(' · ') }
}

function itemToDraft(item: LifeMoneyItem): LifeDraftItem {
  return { id: item.id, name: item.name, amount: String(item.amount) }
}

function blankMember(member: LifeDraftMember) {
  return !member.name.trim() && !member.age.trim() && !member.monthlyCost.trim()
}

function readItems(items: LifeDraftItem[], label: string): LifeMoneyItem[] | { error: string } {
  const next: LifeMoneyItem[] = []
  for (const item of items) {
    if (!item.name.trim() && !item.amount.trim()) continue
    const amount = parseMoney(item.amount)
    if (!item.name.trim()) return { error: `請填${label}名稱。` }
    if (amount === 'invalid' || amount == null) return { error: `請填${label}金額。` }
    next.push({ id: item.id, name: item.name.trim().slice(0, 40), amount })
  }
  return next
}

function parseInteger(raw: string) {
  const text = raw.trim()
  if (!/^\d+$/.test(text)) return null
  const value = Number(text)
  return Number.isSafeInteger(value) ? value : null
}

function parseMoney(raw: string): number | null | 'invalid' {
  const text = raw.trim().replace(/,/g, '')
  if (!text) return null
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return 'invalid'
  const value = Number(text)
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000_000) return 'invalid'
  return roundMoney(value)
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

export function formatNeed(amount: number) {
  return formatMoney(amount, 'HKD')
}

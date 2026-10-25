import { addMoney, formatMoney, moneyParts, roundMoney, type MoneyBag } from './format'
import { formatAmountInput } from './parse'
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

export interface LifeSpouse {
  age: number
  monthlyCost: number
  untilAge: number
}

export interface LifePlanInput {
  funeralCost: number
  siblingCount: number
  inflationRate: number
  childUntil: number
  parentUntil: number
  reserveAmount: number
  spouse: LifeSpouse | null
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
  inflationRate: string
  childUntil: string
  parentUntil: string
  reserveAmount: string
  spouseAge: string
  spouseMonthly: string
  spouseUntil: string
  members: LifeDraftMember[]
  debts: LifeDraftItem[]
  assets: LifeDraftItem[]
}

export interface LifeSupportLine {
  id: string
  role: LifeRole | 'spouse'
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
  reserveAmount: number
  deductibleAssets: number
  spouseTotal: number
  lifeHkd: number
  lifeCount: number
  foreignLife: string
  gap: number
  inflationRate: number
  familyWithoutInflation: number
  gapWithoutInflation: number
}

export function emptyDraft(): LifeDraft {
  return {
    funeralCost: '',
    siblingCount: '1',
    inflationRate: '0',
    childUntil: String(CHILD_UNTIL),
    parentUntil: String(PARENT_UNTIL),
    reserveAmount: '',
    spouseAge: '',
    spouseMonthly: '',
    spouseUntil: '',
    members: [],
    debts: [],
    assets: [],
  }
}

export function draftFromPlan(plan: LifePlanInput): LifeDraft {
  return {
    funeralCost: plan.funeralCost ? formatAmountInput(String(plan.funeralCost)) : '',
    siblingCount: String(plan.siblingCount),
    inflationRate: String(plan.inflationRate || 0),
    childUntil: String(plan.childUntil || CHILD_UNTIL),
    parentUntil: String(plan.parentUntil || PARENT_UNTIL),
    reserveAmount: plan.reserveAmount ? formatAmountInput(String(plan.reserveAmount)) : '',
    spouseAge: plan.spouse ? String(plan.spouse.age) : '',
    spouseMonthly: plan.spouse ? formatAmountInput(String(plan.spouse.monthlyCost)) : '',
    spouseUntil: plan.spouse ? String(plan.spouse.untilAge) : '',
    members: plan.members.map((member) => ({
      id: member.id,
      role: member.role,
      name: member.name,
      age: String(member.age),
      monthlyCost: formatAmountInput(String(member.monthlyCost)),
    })),
    debts: plan.debts.map(itemToDraft),
    assets: plan.assets.map(itemToDraft),
  }
}

export function supportYears(role: LifeRole, age: number, until?: number) {
  return yearsUntil(age, until ?? (role === 'child' ? CHILD_UNTIL : PARENT_UNTIL))
}

export function yearsUntil(age: number, until: number) {
  return Math.max(0, until - age)
}

export function calculateLifeNeed(plan: LifePlanInput, policies: Policy[]): LifeNeedResult {
  const share = plan.siblingCount >= 1 ? plan.siblingCount : 1
  const rate = plan.inflationRate > 0 ? plan.inflationRate : 0
  const childUntil = plan.childUntil > 0 ? plan.childUntil : CHILD_UNTIL
  const parentUntil = plan.parentUntil > 0 ? plan.parentUntil : PARENT_UNTIL
  const lines = [
    ...plan.members.map((member) => memberLine(member, share, rate, member.role === 'child' ? childUntil : parentUntil)),
    ...(plan.spouse ? [spouseLine(plan.spouse, rate)] : []),
  ]
  const flatLines = [
    ...plan.members.map((member) => memberLine(member, share, 0, member.role === 'child' ? childUntil : parentUntil)),
    ...(plan.spouse ? [spouseLine(plan.spouse, 0)] : []),
  ]
  const childTotal = roundDollar(sum(lines.filter((line) => line.role === 'child').map((line) => line.amount)))
  const parentTotal = roundDollar(sum(lines.filter((line) => line.role === 'parent').map((line) => line.amount)))
  const spouseTotal = roundDollar(sum(lines.filter((line) => line.role === 'spouse').map((line) => line.amount)))
  const familyTotal = childTotal + parentTotal + spouseTotal
  const familyWithoutInflation = roundDollar(sum(flatLines.map((line) => line.amount)))
  const debtTotal = roundDollar(sum(plan.debts.map((item) => item.amount)))
  const funeralCost = roundDollar(Math.max(0, plan.funeralCost))
  const grossNeed = familyTotal + debtTotal + funeralCost
  const assetTotal = roundDollar(sum(plan.assets.map((item) => item.amount)))
  const reserveAmount = roundDollar(Math.max(0, plan.reserveAmount))
  const deductibleAssets = Math.max(0, assetTotal - reserveAmount)
  const life = existingLife(policies)
  const lifeHkd = roundDollar(life.hkd)
  const gap = grossNeed - deductibleAssets - lifeHkd
  const gapWithoutInflation = familyWithoutInflation + debtTotal + funeralCost - deductibleAssets - lifeHkd
  return {
    lines,
    childTotal,
    parentTotal,
    familyTotal,
    debtTotal,
    funeralCost,
    grossNeed,
    assetTotal,
    reserveAmount,
    deductibleAssets,
    spouseTotal,
    lifeHkd,
    lifeCount: life.count,
    foreignLife: life.foreign,
    gap,
    inflationRate: rate,
    familyWithoutInflation,
    gapWithoutInflation,
  }
}

export function validateDraft(draft: LifeDraft): { plan: LifePlanInput } | { error: string } {
  const siblingCount = parseInteger(draft.siblingCount)
  if (siblingCount == null || siblingCount < 1 || siblingCount > 20) return { error: '兄弟姊妹人數請填 1 至 20，並連同客人自己。' }
  const funeral = parseMoney(draft.funeralCost)
  if (funeral === 'invalid') return { error: '身後費用請填 0 或正數。' }
  const inflationRate = parseRate(draft.inflationRate)
  if (inflationRate === 'invalid') return { error: '通脹請填 0 至 20，最多兩位小數。' }
  const childUntil = parseBound(draft.childUntil, 22, 1, 40)
  if (childUntil === 'invalid') return { error: '子女照顧至幾歲請填 1 至 40。' }
  const parentUntil = parseBound(draft.parentUntil, 88, 50, 120)
  if (parentUntil === 'invalid') return { error: '父母照顧至幾歲請填 50 至 120。' }
  const reserve = parseMoney(draft.reserveAmount)
  if (reserve === 'invalid') return { error: '保留應急資金請填 0 或正數。' }
  const spouse = readSpouse(draft)
  if ('error' in spouse) return spouse
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
  return {
    plan: {
      funeralCost: funeral ?? 0,
      siblingCount,
      inflationRate: inflationRate ?? 0,
      childUntil,
      parentUntil,
      reserveAmount: reserve ?? 0,
      spouse: spouse.spouse,
      members,
      debts,
      assets,
    },
  }
}

export function previewDraft(draft: LifeDraft): LifePlanInput {
  const sibling = parseInteger(draft.siblingCount)
  const funeral = parseMoney(draft.funeralCost)
  const inflationRate = parseRate(draft.inflationRate, true)
  const childUntil = parseBound(draft.childUntil, 22, 1, 40)
  const parentUntil = parseBound(draft.parentUntil, 88, 50, 120)
  const reserve = parseMoney(draft.reserveAmount)
  const spouse = readSpouse(draft)
  return {
    funeralCost: funeral == null || funeral === 'invalid' ? 0 : funeral,
    siblingCount: sibling != null && sibling >= 1 && sibling <= 20 ? sibling : 1,
    inflationRate: inflationRate === 'invalid' || inflationRate == null ? 0 : inflationRate,
    childUntil: childUntil === 'invalid' ? 22 : childUntil,
    parentUntil: parentUntil === 'invalid' ? 88 : parentUntil,
    reserveAmount: reserve == null || reserve === 'invalid' ? 0 : reserve,
    spouse: 'error' in spouse ? null : spouse.spouse,
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
  return plan.members.length > 0 || plan.spouse != null || plan.debts.length > 0 || plan.assets.length > 0 || plan.funeralCost > 0 || plan.reserveAmount > 0
}

function memberLine(member: LifeMember, siblingCount: number, inflationRate: number, untilAge: number): LifeSupportLine {
  const years = yearsUntil(member.age, untilAge)
  const share = member.role === 'parent' ? siblingCount : 1
  const annual = (member.monthlyCost / share) * 12
  return {
    id: member.id,
    role: member.role,
    name: member.name,
    age: member.age,
    years,
    monthlyCost: member.monthlyCost,
    share,
    amount: inflatedTotal(annual, years, inflationRate),
  }
}

function spouseLine(spouse: LifeSpouse, inflationRate: number): LifeSupportLine {
  const years = yearsUntil(spouse.age, spouse.untilAge)
  return {
    id: 'spouse',
    role: 'spouse',
    name: '配偶',
    age: spouse.age,
    years,
    monthlyCost: spouse.monthlyCost,
    share: 1,
    amount: inflatedTotal(spouse.monthlyCost * 12, years, inflationRate),
  }
}

function inflatedTotal(annual: number, years: number, rate: number) {
  if (years <= 0 || annual <= 0) return 0
  if (rate <= 0) return roundDollar(annual * years)
  const growth = rate / 100
  return roundDollar((annual * (Math.pow(1 + growth, years) - 1)) / growth)
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
  return { id: item.id, name: item.name, amount: formatAmountInput(String(item.amount)) }
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

function readSpouse(draft: LifeDraft): { spouse: LifeSpouse | null } | { error: string } {
  const blank = !draft.spouseAge.trim() && !draft.spouseMonthly.trim() && !draft.spouseUntil.trim()
  if (blank) return { spouse: null }
  const age = parseInteger(draft.spouseAge)
  const monthlyCost = parseMoney(draft.spouseMonthly)
  const untilAge = parseInteger(draft.spouseUntil)
  if (age == null || age > 120) return { error: '請填配偶歲數，0 至 120。' }
  if (monthlyCost === 'invalid' || monthlyCost == null) return { error: '請填配偶每月仍短缺的生活費。' }
  if (untilAge == null || untilAge < 1 || untilAge > 120) return { error: '配偶照顧至幾歲請填 1 至 120。' }
  return { spouse: { age, monthlyCost, untilAge } }
}

function parseBound(raw: string, fallback: number, min: number, max: number): number | 'invalid' {
  const text = raw.trim()
  if (!text) return fallback
  if (!/^\d+$/.test(text)) return 'invalid'
  const value = Number(text)
  if (value < min || value > max) return 'invalid'
  return value
}

function parseRate(raw: string, loose = false): number | null | 'invalid' {
  let text = raw.trim()
  if (!text) return 0
  if (loose && text.endsWith('.')) text = text.slice(0, -1)
  if (!text) return 0
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return 'invalid'
  const value = Number(text)
  if (!Number.isFinite(value) || value < 0 || value > 20) return 'invalid'
  return roundMoney(value)
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

function roundDollar(amount: number) {
  return Math.sign(amount) * Math.round(Math.abs(amount))
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

export function formatNeed(amount: number) {
  return formatMoney(amount, 'HKD')
}

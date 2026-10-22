import { addMoney, formatMoney, moneyParts, roundMoney, type MoneyBag } from './format'
import { countsAsCover, labelOf, PRIMARY_COVER_TYPES, ROOM_LEVELS, type PolicyType, type RoomLevel } from './labels'
import type { Client, Policy } from '../types'

export type AnalysisType = 'life' | 'critical' | 'medical' | 'accident'
export type Verdict = 'enough' | 'short' | 'raise' | 'unknown'

export const VERDICT_LABEL: Record<Verdict, string> = {
  enough: '足夠',
  short: '不足',
  raise: '可提升',
  unknown: '未有收入',
}

export interface CoverFinding {
  type: AnalysisType
  label: string
  verdict: Verdict
  currentText: string
  targetText: string
  gapText: string
  note: string
  hkdNeed: number | null
  hkdHave: number | null
  hkdGap: number | null
}

export interface ClientAnalysis {
  annualIncome: number | null
  lifeYears: number
  lifeBasis: string
  findings: CoverFinding[]
  opportunities: string[]
  otherPolicyCount: number
}

const ROOM_RANK: Record<RoomLevel, number> = { ward: 1, semi: 2, private: 3 }
const LABELS: Record<AnalysisType, string> = { life: '人壽', critical: '危疾', medical: '醫療', accident: '意外' }

export function lifeBasis(client: Client) {
  const hasFamily = (client.dependents != null && client.dependents > 0) || client.maritalStatus === 'married'
  if (hasFamily) return { years: 10, text: '有家庭責任，按 10 年收入' }
  if (client.dependents === 0) return { years: 5, text: '沒有受養人，按 5 年收入' }
  return { years: 10, text: '未填受養人數，暫按 10 年收入' }
}

export function analyzeClient(client: Client, policies: Policy[]): ClientAnalysis {
  const basis = lifeBasis(client)
  const income = usableIncome(client.monthlyIncome)
  const annualIncome = income == null ? null : roundMoney(income * 12)
  const findings = [
    sumFinding('life', basis.years, basis.text, income, policies),
    sumFinding('critical', 5, '按 5 年收入', income, policies),
    medicalFinding(income, policies),
    sumFinding('accident', 5, '按 5 年收入', income, policies),
  ]
  return {
    annualIncome,
    lifeYears: basis.years,
    lifeBasis: basis.text,
    findings,
    opportunities: findings.flatMap(opportunityLine),
    otherPolicyCount: policies.filter((policy) => countsAsCover(policy.status) && !PRIMARY_COVER_TYPES.includes(policy.policyType)).length,
  }
}

export function gapScore(analysis: ClientAnalysis) {
  return analysis.findings.reduce((score, finding) => score + (finding.verdict === 'short' ? 2 : finding.verdict === 'raise' ? 1 : 0), 0)
}

function usableIncome(income: number | null) {
  if (income == null || income <= 0) return null
  return income
}

function activePolicies(policies: Policy[], type: PolicyType) {
  return policies.filter((policy) => policy.policyType === type && countsAsCover(policy.status))
}

function hkdCover(rows: Policy[]) {
  return roundMoney(rows.reduce((sum, policy) => sum + (policy.currency === 'HKD' && policy.sumAssured != null ? policy.sumAssured : 0), 0))
}

function foreignText(rows: Policy[]) {
  const bag: MoneyBag = {}
  for (const policy of rows) {
    if (policy.currency === 'HKD' || policy.sumAssured == null) continue
    addMoney(bag, policy.currency, policy.sumAssured)
  }
  return moneyParts(bag).join(' · ')
}

function sumFinding(type: AnalysisType, years: number, basis: string, income: number | null, policies: Policy[]): CoverFinding {
  const rows = activePolicies(policies, type)
  const have = hkdCover(rows)
  const foreign = foreignText(rows)
  const currentText = [have > 0 ? formatMoney(have, 'HKD') : '', foreign].filter(Boolean).join(' · ') || '未有'
  const label = LABELS[type]
  if (income == null) {
    return {
      type,
      label,
      verdict: 'unknown',
      currentText,
      targetText: '需要每月收入',
      gapText: '—',
      note: '未有每月收入，未能按年收入估算。',
      hkdNeed: null,
      hkdHave: have,
      hkdGap: null,
    }
  }
  const need = roundMoney(income * 12 * years)
  const gap = roundMoney(Math.max(0, need - have))
  return {
    type,
    label,
    verdict: gap > 0 ? 'short' : 'enough',
    currentText,
    targetText: `${formatMoney(need, 'HKD')}（${basis}）`,
    gapText: gap > 0 ? formatMoney(gap, 'HKD') : '沒有差額',
    note: foreign ? `另有${foreign}，沒有兌換，亦沒有從港幣差額扣除。` : '',
    hkdNeed: need,
    hkdHave: have,
    hkdGap: gap,
  }
}

function medicalFinding(income: number | null, policies: Policy[]): CoverFinding {
  const rows = activePolicies(policies, 'medical')
  const target = roomTarget(income)
  const base = {
    type: 'medical' as const,
    label: LABELS.medical,
    hkdNeed: null,
    hkdHave: null,
    hkdGap: null,
  }
  if (rows.length === 0) {
    return {
      ...base,
      verdict: 'short',
      currentText: '未有',
      targetText: target.text,
      gapText: '未有醫療保障',
      note: '',
    }
  }
  const currentText = medicalCurrent(rows)
  const best = bestRoom(rows)
  if (!target.room || !best) {
    return {
      ...base,
      verdict: 'enough',
      currentText,
      targetText: target.text,
      gapText: '沒有差額',
      note: best ? '未有收入，只確認已有醫療保障。' : '已有醫療保單，但未有病房資料。',
    }
  }
  if (ROOM_RANK[best] < ROOM_RANK[target.room]) {
    return {
      ...base,
      verdict: 'raise',
      currentText,
      targetText: target.text,
      gapText: `現時${labelOf(ROOM_LEVELS, best)}，建議${target.text}`,
      note: '',
    }
  }
  const atTarget = rows.filter((policy) => policy.roomLevel === best)
  if (atTarget.length > 0 && atTarget.every((policy) => policy.fullCover === false)) {
    return {
      ...base,
      verdict: 'raise',
      currentText,
      targetText: target.text,
      gapText: '可考慮全包賠償',
      note: '病房已達到建議，但紀錄是非全包。',
    }
  }
  return {
    ...base,
    verdict: 'enough',
    currentText,
    targetText: target.text,
    gapText: '沒有差額',
    note: '',
  }
}

function roomTarget(income: number | null) {
  if (income == null) return { room: null as RoomLevel | null, text: '未有收入，只看有沒有醫療' }
  if (income >= 80000) return { room: 'private' as RoomLevel, text: '私家房' }
  if (income >= 30000) return { room: 'semi' as RoomLevel, text: '半私家房' }
  return { room: 'ward' as RoomLevel, text: '大房' }
}

function bestRoom(rows: Policy[]) {
  let best: RoomLevel | null = null
  for (const policy of rows) {
    if (!policy.roomLevel) continue
    if (!best || ROOM_RANK[policy.roomLevel] > ROOM_RANK[best]) best = policy.roomLevel
  }
  return best
}

function medicalCurrent(rows: Policy[]) {
  const rooms = [...new Set(rows.map((policy) => policy.roomLevel).filter((room): room is RoomLevel => room !== ''))].sort(
    (a, b) => ROOM_RANK[b] - ROOM_RANK[a],
  )
  const roomText = rooms.map((room) => labelOf(ROOM_LEVELS, room)).join('、') || '已有紀錄'
  const full = rows.some((policy) => policy.fullCover === true)
  const partial = rows.some((policy) => policy.fullCover === false)
  const cover = full && partial ? '部分全包' : full ? '全包' : partial ? '非全包' : ''
  return [roomText, cover].filter(Boolean).join(' · ')
}

function opportunityLine(finding: CoverFinding) {
  if (finding.verdict === 'short') {
    if (finding.type === 'medical') {
      const room = finding.targetText.startsWith('未有') ? '' : `，建議${finding.targetText}`
      return [`未有醫療保障${room}。`]
    }
    return [`${finding.label}不足，港幣差額 ${finding.gapText}。`]
  }
  if (finding.verdict === 'raise') return [`${finding.label}可以提升：${finding.gapText}。`]
  return []
}

import type { Client, Policy } from '../types'
import { analyzeClient, lifeBasis, type AnalysisType } from './analysis'
import { formatMoney } from './format'
import { countsAsCover, labelOf, POLICY_STATUSES, ROOM_LEVELS } from './labels'

export interface CoverAmountBlock {
  type: 'life' | 'critical' | 'accident'
  label: string
  currentText: string
  referenceText: string
  basis: string
  foreignNote: string
}

export interface MedicalStatementLine {
  id: string
  insurer: string
  policyName: string
  policyNumber: string
  detail: string
  counted: boolean
}

export interface CoverStatementModel {
  blocks: CoverAmountBlock[]
  medical: MedicalStatementLine[]
  otherPolicyCount: number
}

const SUM_TYPES: Array<'life' | 'critical' | 'accident'> = ['life', 'critical', 'accident']

export function buildCoverStatement(client: Client, policies: Policy[]): CoverStatementModel {
  const analysis = analyzeClient(client, policies)
  const basis = lifeBasis(client)
  const blocks = SUM_TYPES.map((type) => {
    const finding = analysis.findings.find((item) => item.type === type)
    const yearsBasis = type === 'life' ? basis.text : '按 5 年收入'
    return {
      type,
      label: finding?.label ?? labelOfType(type),
      currentText: finding?.currentText || '未有',
      referenceText: finding?.hkdNeed == null ? '未有每月收入，不列參考額' : formatMoney(finding.hkdNeed, 'HKD'),
      basis: yearsBasis,
      foreignNote: finding?.note ?? '',
    }
  })
  const medical = policies
    .filter((policy) => policy.policyType === 'medical')
    .sort((a, b) => Number(countsAsCover(b.status)) - Number(countsAsCover(a.status)) || b.issueDate.localeCompare(a.issueDate))
    .map((policy) => ({
      id: policy.id,
      insurer: policy.insurer,
      policyName: policy.policyName,
      policyNumber: policy.policyNumber,
      detail: medicalDetail(policy),
      counted: countsAsCover(policy.status),
    }))
  return {
    blocks,
    medical,
    otherPolicyCount: analysis.otherPolicyCount,
  }
}

function medicalDetail(policy: Policy) {
  return [
    policy.roomLevel ? labelOf(ROOM_LEVELS, policy.roomLevel) : '病房未有紀錄',
    policy.deductible == null ? '自付額未有紀錄' : `自付額 ${formatMoney(policy.deductible, policy.currency)}`,
    policy.fullCover == null ? '全包未有紀錄' : policy.fullCover ? '全包' : '非全包',
    policy.currency,
    labelOf(POLICY_STATUSES, policy.status),
  ].join(' · ')
}

function labelOfType(type: AnalysisType) {
  if (type === 'life') return '人壽'
  if (type === 'critical') return '危疾'
  if (type === 'accident') return '意外'
  return '醫療'
}

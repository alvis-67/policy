import { formatMoney } from './format'
import { formatNeed } from './lifeNeed'
import type { UsdProduct, UsdTerm } from './usdQuote'

export type QuotePurpose = 'fill' | 'budget'

export type QuoteSlip =
  | {
      kind: 'term'
      purpose: QuotePurpose
      plan: 10 | 20
      sumAssured: number
      premium: number
      raisedToMinimumSum: boolean
      raisedToMinimumPremium: boolean
    }
  | {
      kind: 'whole'
      purpose: QuotePurpose
      product: UsdProduct
      payTerm: UsdTerm
      usdNotional: number
      hkdNotional: number
      premiumUsd: number
      premiumHkd: number
      raisedToMinimumSum: boolean
      raisedToMinimumPremium: boolean
    }
  | {
      kind: 'mix'
      termPlan: 10 | 20
      termSumAssured: number
      termPremium: number
      product: UsdProduct
      payTerm: 5 | 10 | 20 | 25
      usdNotional: number
      hkdNotional: number
      premiumUsd: number
      premiumHkd: number
    }

export interface SavedQuote {
  clientId: string
  smoker: boolean
  payTerm: UsdTerm
  annualBudget: number | null
  hkdGap: number
  age: number | null
  sex: '' | 'male' | 'female'
  slip: QuoteSlip
  updatedAt: string
}

export interface QuoteSlipView {
  title: string
  rows: Array<{ label: string; value: string }>
  notes: string[]
}

const PRODUCT_NAME: Record<UsdProduct, string> = {
  youyue: '優越終身保',
  yingchuan: '盈傳創富保障計劃 3',
}

export function parseQuoteSlip(value: unknown): QuoteSlip | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (row.kind === 'term') return parseTerm(row)
  if (row.kind === 'whole') return parseWhole(row)
  if (row.kind === 'mix') return parseMix(row)
  return null
}

export function quoteSlipView(quote: SavedQuote): QuoteSlipView {
  const slip = quote.slip
  const notes = assumptionNotes(quote)
  if (slip.kind === 'term') {
    notes.push('精選定期壽險用港幣率表，2024 年 1 月，已加每年保單費 200。只計首段水平保費，之後續保未計。保障至 75 歲。')
    if (slip.raisedToMinimumSum) notes.push('少於最低保額，以上按 320,000 計算。')
    if (slip.raisedToMinimumPremium) notes.push('低於最低每年保費，以上按 800 計算。')
    return {
      title: `精選定期壽險 · ${slip.plan} 年水平保費`,
      rows: [
        { label: '保額', value: formatNeed(slip.sumAssured) },
        { label: '每年保費', value: formatNeed(slip.premium) },
        { label: '用途', value: purposeText(slip.purpose, quote.annualBudget) },
      ],
      notes: closeNotes(notes),
    }
  }
  if (slip.kind === 'whole') {
    usdNotes(notes, slip.product, slip.payTerm)
    if (slip.raisedToMinimumSum) notes.push('換成美元後少於最低名義金額，以上按該最低名義金額計算。')
    if (slip.raisedToMinimumPremium) notes.push('低於最低每年保費 160 美元，以上按這個下限計算。')
    return {
      title: `${PRODUCT_NAME[slip.product]} · ${slip.payTerm === 'single' ? '整付' : `${slip.payTerm} 年繳`}`,
      rows: [
        { label: '名義金額', value: formatMoney(slip.usdNotional, 'USD') },
        { label: '約港幣', value: formatNeed(slip.hkdNotional) },
        { label: slip.payTerm === 'single' ? '一次過保費' : '每年保費', value: `${formatNeed(slip.premiumHkd)}（${formatMoney(slip.premiumUsd, 'USD')}）` },
        { label: '用途', value: purposeText(slip.purpose, quote.annualBudget) },
      ],
      notes: closeNotes(notes),
    }
  }
  usdNotes(notes, slip.product, slip.payTerm)
  notes.push('兩款保額加起來等於當日尚欠的港幣人壽保障。精選只保障到 75 歲，終身計劃的名義金額其後仍然有效。')
  return {
    title: `精選定期壽險 ${slip.termPlan} 年，以及${PRODUCT_NAME[slip.product]}`,
    rows: [
      { label: '精選保額', value: formatNeed(slip.termSumAssured) },
      { label: '精選每年保費', value: formatNeed(slip.termPremium) },
      { label: '終身名義金額', value: `${formatMoney(slip.usdNotional, 'USD')}（約 ${formatNeed(slip.hkdNotional)}）` },
      { label: '終身每年保費', value: `${formatNeed(slip.premiumHkd)}（${formatMoney(slip.premiumUsd, 'USD')}）` },
      { label: '用途', value: quote.annualBudget == null ? '按每年預算分拆' : `按每年預算 ${formatNeed(quote.annualBudget)} 分拆` },
    ],
    notes: closeNotes(notes),
  }
}

function purposeText(purpose: QuotePurpose, budget: number | null) {
  if (purpose === 'fill') return '填補當日尚欠的港幣人壽保障'
  if (budget == null) return '按每年預算可買'
  return `按每年預算 ${formatNeed(budget)} 可買`
}

function assumptionNotes(quote: SavedQuote) {
  const sex = quote.sex === 'male' ? '男' : quote.sex === 'female' ? '女' : '未填性別'
  const age = quote.age == null ? '未有出生日期' : `${quote.age} 歲`
  return [
    `當日尚欠人壽保障 ${formatNeed(quote.hkdGap)}。計算所用投保年齡 ${age}，${sex}，${quote.smoker ? '吸煙' : '非吸煙'}。`,
  ]
}

function usdNotes(notes: string[], product: UsdProduct, payTerm: UsdTerm) {
  notes.push('美元計劃按固定匯率 HKD 8 = USD 1 換算，這不是市場匯率。美元名義金額沒有從港幣缺口扣除。')
  if (product === 'youyue' && payTerm !== 'single') notes.push('優越終身保的分期保費另加每年保單費 25 美元。')
  if (product === 'yingchuan') notes.push('盈傳創富保障計劃 3 用標準風險級別、居住地編碼 A。')
}

function closeNotes(notes: string[]) {
  notes.push('準確保費以保險公司建議書為準。最終購買由顧問判斷。')
  return notes
}

function parseTerm(row: Record<string, unknown>): QuoteSlip | null {
  const plan = row.plan === 10 || row.plan === 20 ? row.plan : null
  const purpose = parsePurpose(row.purpose)
  const sumAssured = money(row.sumAssured)
  const premium = money(row.premium)
  const raisedToMinimumSum = flag(row.raisedToMinimumSum)
  const raisedToMinimumPremium = flag(row.raisedToMinimumPremium)
  if (plan == null || !purpose || sumAssured == null || premium == null || raisedToMinimumSum == null || raisedToMinimumPremium == null) return null
  return { kind: 'term', purpose, plan, sumAssured, premium, raisedToMinimumSum, raisedToMinimumPremium }
}

function parseWhole(row: Record<string, unknown>): QuoteSlip | null {
  const product = parseProduct(row.product)
  const payTerm = parseUsdTerm(row.payTerm)
  const purpose = parsePurpose(row.purpose)
  const usdNotional = money(row.usdNotional)
  const hkdNotional = money(row.hkdNotional)
  const premiumUsd = money(row.premiumUsd)
  const premiumHkd = money(row.premiumHkd)
  const raisedToMinimumSum = flag(row.raisedToMinimumSum)
  const raisedToMinimumPremium = flag(row.raisedToMinimumPremium)
  if (!product || !payTerm || !purpose || usdNotional == null || hkdNotional == null || premiumUsd == null || premiumHkd == null || raisedToMinimumSum == null || raisedToMinimumPremium == null) {
    return null
  }
  return { kind: 'whole', purpose, product, payTerm, usdNotional, hkdNotional, premiumUsd, premiumHkd, raisedToMinimumSum, raisedToMinimumPremium }
}

function parseMix(row: Record<string, unknown>): QuoteSlip | null {
  const termPlan = row.termPlan === 10 || row.termPlan === 20 ? row.termPlan : null
  const product = parseProduct(row.product)
  const payTerm = row.payTerm === 5 || row.payTerm === 10 || row.payTerm === 20 || row.payTerm === 25 ? row.payTerm : null
  const termSumAssured = money(row.termSumAssured)
  const termPremium = money(row.termPremium)
  const usdNotional = money(row.usdNotional)
  const hkdNotional = money(row.hkdNotional)
  const premiumUsd = money(row.premiumUsd)
  const premiumHkd = money(row.premiumHkd)
  if (termPlan == null || !product || !payTerm || termSumAssured == null || termPremium == null || usdNotional == null || hkdNotional == null || premiumUsd == null || premiumHkd == null) {
    return null
  }
  return { kind: 'mix', termPlan, termSumAssured, termPremium, product, payTerm, usdNotional, hkdNotional, premiumUsd, premiumHkd }
}

function parsePurpose(value: unknown): QuotePurpose | null {
  return value === 'fill' || value === 'budget' ? value : null
}

function parseProduct(value: unknown): UsdProduct | null {
  return value === 'youyue' || value === 'yingchuan' ? value : null
}

function parseUsdTerm(value: unknown): UsdTerm | null {
  return value === 5 || value === 10 || value === 20 || value === 25 || value === 'single' ? value : null
}

function money(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000_000_000) return null
  return value
}

function flag(value: unknown) {
  return typeof value === 'boolean' ? value : null
}

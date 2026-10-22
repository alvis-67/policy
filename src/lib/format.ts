import { CURRENCIES, ROOM_LEVELS, labelOf, type Currency, type PremiumFrequency } from './labels'

export type MoneyBag = Partial<Record<Currency, number>>

export function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100
}

export function toAnnualPremium(amount: number, frequency: PremiumFrequency) {
  return roundMoney(frequency === 'monthly' ? amount * 12 : amount)
}

export function toMonthlyPremium(amount: number, frequency: PremiumFrequency) {
  return roundMoney(frequency === 'monthly' ? amount : amount / 12)
}

export function addMoney(bag: MoneyBag, currency: Currency, amount: number) {
  if (!amount) return
  bag[currency] = roundMoney((bag[currency] ?? 0) + amount)
}

export function formatMoney(amount: number, currency: Currency) {
  if (!Number.isFinite(amount)) return '—'
  const digits = Number.isInteger(roundMoney(amount)) ? 0 : 2
  return new Intl.NumberFormat('zh-HK', {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount)
}

export function formatCover(policy: {
  policyType: string
  currency: Currency
  sumAssured: number | null
  roomLevel: string
  deductible: number | null
  fullCover: boolean | null
}) {
  if (policy.policyType !== 'medical') return policy.sumAssured == null ? '—' : formatMoney(policy.sumAssured, policy.currency)
  const parts = [
    policy.roomLevel ? labelOf(ROOM_LEVELS, policy.roomLevel) : '',
    policy.deductible == null ? '' : `自付費 ${formatMoney(policy.deductible, policy.currency)}`,
    policy.fullCover == null ? '' : policy.fullCover ? '全包賠償' : '非全包',
  ].filter(Boolean)
  if (parts.length > 0) return parts.join(' · ')
  return policy.sumAssured == null ? '—' : formatMoney(policy.sumAssured, policy.currency)
}

export function moneyParts(bag: MoneyBag) {
  const parts: string[] = []
  for (const currency of CURRENCIES) {
    const amount = bag[currency.value]
    if (amount == null) continue
    parts.push(formatMoney(amount, currency.value))
  }
  return parts
}

export function todayISO(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function formatDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return '—'
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`
}

export function calcAge(iso: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const [year, month, day] = iso.split('-').map(Number)
  let age = now.getFullYear() - year
  const nowMonth = now.getMonth() + 1
  if (nowMonth < month || (nowMonth === month && now.getDate() < day)) age -= 1
  if (age < 0 || age > 120) return null
  return age
}

export function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 8) return `${digits.slice(0, 4)} ${digits.slice(4)}`
  if (digits.length === 11 && digits.startsWith('852')) {
    return `+852 ${digits.slice(3, 7)} ${digits.slice(7)}`
  }
  return phone
}

export function maskHkid(hkid: string) {
  const compact = hkid.replace(/\s/g, '')
  if (compact.length <= 4) return '••••'
  return `${compact.slice(0, 2)}••••${compact.slice(-2)}`
}

export function displayName(person: { chineseName: string; englishName: string }) {
  const chinese = person.chineseName.trim()
  const english = person.englishName.trim()
  if (chinese && english) return `${chinese} ${english}`
  return chinese || english || '未命名客戶'
}

export function nameInitial(person: { chineseName: string; englishName: string }) {
  const chinese = person.chineseName.trim()
  if (chinese) return chinese.slice(0, 1)
  const english = person.englishName.trim()
  return english ? english.slice(0, 1).toUpperCase() : '客'
}

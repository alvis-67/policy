export const GENDER_OPTIONS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
] as const

export type Gender = '' | (typeof GENDER_OPTIONS)[number]['value']

export const MARITAL_OPTIONS = [
  { value: 'single', label: '單身' },
  { value: 'married', label: '已婚' },
  { value: 'divorced', label: '離婚' },
  { value: 'widowed', label: '喪偶' },
] as const

export type MaritalStatus = '' | (typeof MARITAL_OPTIONS)[number]['value']

export const POLICY_TYPES = [
  { value: 'life', label: '人壽' },
  { value: 'critical', label: '危疾' },
  { value: 'medical', label: '醫療' },
  { value: 'accident', label: '意外' },
  { value: 'savings', label: '儲蓄' },
  { value: 'ilas', label: '投資相連' },
  { value: 'annuity', label: '年金' },
  { value: 'other', label: '其他' },
] as const

export type PolicyType = (typeof POLICY_TYPES)[number]['value']

export const PRIMARY_COVER_TYPES: readonly PolicyType[] = ['life', 'critical', 'medical', 'accident']

export const CURRENCIES = [
  { value: 'HKD', label: '港幣 HKD' },
  { value: 'USD', label: '美元 USD' },
  { value: 'CNY', label: '人民幣 CNY' },
] as const

export type Currency = (typeof CURRENCIES)[number]['value']

export const PREMIUM_FREQUENCIES = [
  { value: 'monthly', label: '每月' },
  { value: 'yearly', label: '每年' },
] as const

export type PremiumFrequency = (typeof PREMIUM_FREQUENCIES)[number]['value']

export const POLICY_STATUSES = [
  { value: 'inforce', label: '生效中' },
  { value: 'paidup', label: '已繳清' },
  { value: 'lapsed', label: '已失效' },
  { value: 'surrendered', label: '已退保' },
] as const

export type PolicyStatus = (typeof POLICY_STATUSES)[number]['value']

export const INSURERS = [
  '友邦 AIA',
  '保誠 Prudential',
  '宏利 Manulife',
  '安盛 AXA',
  '富衛 FWD',
  '永明金融 Sun Life',
  '滙豐保險 HSBC Life',
  '中銀人壽 BOC Life',
  '中國人壽 China Life',
  '周大福人壽 CTF Life',
  '萬通保險 YF Life',
  '安達 Chubb',
  '信諾 Cigna',
  '保柏 Bupa',
  '藍十字 Blue Cross',
  '忠意 Generali',
  '太平人壽 Taiping',
  '立橋人壽 Well Link',
]

export function countsAsCover(status: PolicyStatus) {
  return status === 'inforce' || status === 'paidup'
}

export function labelOf(options: readonly { value: string; label: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value
}

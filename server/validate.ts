import { roundMoney, todayISO } from '../src/lib/format'
import {
  CURRENCIES,
  GENDER_OPTIONS,
  MARITAL_OPTIONS,
  POLICY_STATUSES,
  POLICY_TYPES,
  PREMIUM_FREQUENCIES,
  type Currency,
  type Gender,
  type MaritalStatus,
  type PolicyStatus,
  type PolicyType,
  type PremiumFrequency,
} from '../src/lib/labels'
import type { ClientWrite, PolicyWrite } from '../src/types'

export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

function asRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, '資料格式不正確')
  }
  return body as Record<string, unknown>
}

function readString(value: unknown, label: string) {
  if (value == null) return ''
  if (typeof value !== 'string') throw new HttpError(400, `請檢查${label}`)
  return value
}

function line(value: unknown, max: number, label: string) {
  const text = readString(value, label).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (text.length > max) throw new HttpError(400, `${label}太長`)
  return text
}

function text(value: unknown, max: number, label: string) {
  const trimmed = readString(value, label).trim()
  if (trimmed.length > max) throw new HttpError(400, `${label}太長`)
  return trimmed
}

function oneOf<T extends string>(value: unknown, options: readonly { value: T }[], label: string): T {
  if (typeof value === 'string' && options.some((option) => option.value === value)) {
    return value as T
  }
  throw new HttpError(400, `請選擇${label}`)
}

function oneOfOrEmpty<T extends string>(
  value: unknown,
  options: readonly { value: T }[],
  label: string,
): T | '' {
  if (value == null || value === '') return ''
  return oneOf(value, options, label)
}

function isISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

function requiredMoney(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000_000_000) {
    throw new HttpError(400, `請檢查${label}`)
  }
  return roundMoney(value)
}

function optionalMoney(value: unknown, label: string) {
  if (value == null || value === '') return null
  return requiredMoney(value, label)
}

function optionalInt(value: unknown, label: string, max: number) {
  if (value == null || value === '') return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) {
    throw new HttpError(400, `請檢查${label}`)
  }
  return value
}

export function validateClient(body: unknown): ClientWrite {
  const input = asRecord(body)
  const chineseName = line(input.chineseName, 40, '中文姓名')
  const englishName = line(input.englishName, 80, '英文姓名')
  if (!chineseName && !englishName) throw new HttpError(400, '請填寫中文或英文姓名')

  const phone = line(input.phone, 30, '聯絡電話')
  if ((phone.match(/\d/g) || []).length < 8) throw new HttpError(400, '請填寫有效的聯絡電話')

  const email = line(input.email, 80, '電郵')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, '請檢查電郵')

  const dateOfBirth = line(input.dateOfBirth, 10, '出生日期')
  if (dateOfBirth && (!isISODate(dateOfBirth) || dateOfBirth < '1900-01-01' || dateOfBirth > todayISO())) {
    throw new HttpError(400, '請檢查出生日期')
  }

  return {
    chineseName,
    englishName,
    gender: oneOfOrEmpty(input.gender, GENDER_OPTIONS, '性別') as Gender,
    dateOfBirth,
    phone,
    email,
    hkid: line(input.hkid, 20, '身份證號碼').toUpperCase(),
    occupation: line(input.occupation, 60, '職業'),
    maritalStatus: oneOfOrEmpty(input.maritalStatus, MARITAL_OPTIONS, '婚姻狀況') as MaritalStatus,
    dependents: optionalInt(input.dependents, '受養人數', 30),
    monthlyIncome: optionalMoney(input.monthlyIncome, '每月收入'),
    address: line(input.address, 200, '地址'),
    notes: text(input.notes, 2000, '備註'),
  }
}

export function validatePolicy(body: unknown): PolicyWrite {
  const input = asRecord(body)
  const insurer = line(input.insurer, 60, '保險公司')
  const policyName = line(input.policyName, 80, '保單名稱')
  if (!insurer) throw new HttpError(400, '請填寫保險公司')
  if (!policyName) throw new HttpError(400, '請填寫保單名稱')

  const issueDate = line(input.issueDate, 10, '簽發日期')
  if (!isISODate(issueDate) || issueDate < '1970-01-01' || issueDate > '2100-12-31') {
    throw new HttpError(400, '請檢查簽發日期')
  }

  return {
    insurer,
    policyName,
    policyNumber: line(input.policyNumber, 40, '保單號碼'),
    policyType: oneOf(input.policyType, POLICY_TYPES, '保障類別') as PolicyType,
    currency: oneOf(input.currency, CURRENCIES, '貨幣') as Currency,
    sumAssured: requiredMoney(input.sumAssured, '保障額'),
    issueDate,
    premiumAmount: requiredMoney(input.premiumAmount, '保費'),
    premiumFrequency: oneOf(input.premiumFrequency, PREMIUM_FREQUENCIES, '保費週期') as PremiumFrequency,
    premiumTerm: line(input.premiumTerm, 40, '供款年期'),
    status: oneOf(input.status, POLICY_STATUSES, '保單狀態') as PolicyStatus,
    notes: text(input.notes, 2000, '備註'),
  }
}

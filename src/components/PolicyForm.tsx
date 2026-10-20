import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../api'
import { formatMoney, toAnnualPremium, toMonthlyPremium } from '../lib/format'
import {
  CURRENCIES,
  INSURERS,
  POLICY_STATUSES,
  POLICY_TYPES,
  PREMIUM_FREQUENCIES,
} from '../lib/labels'
import { parseOptionalNumber, parseRequiredNumber } from '../lib/parse'
import type { Policy, PolicyWrite } from '../types'
import { Field } from './Field'

interface PolicyFormState {
  insurer: string
  policyName: string
  policyNumber: string
  policyType: string
  currency: string
  sumAssured: string
  issueDate: string
  premiumAmount: string
  premiumFrequency: string
  premiumTerm: string
  status: string
  notes: string
}

function emptyState(): PolicyFormState {
  return {
    insurer: '',
    policyName: '',
    policyNumber: '',
    policyType: '',
    currency: 'HKD',
    sumAssured: '',
    issueDate: '',
    premiumAmount: '',
    premiumFrequency: 'monthly',
    premiumTerm: '',
    status: 'inforce',
    notes: '',
  }
}

function fromPolicy(policy: Policy): PolicyFormState {
  return {
    insurer: policy.insurer,
    policyName: policy.policyName,
    policyNumber: policy.policyNumber,
    policyType: policy.policyType,
    currency: policy.currency,
    sumAssured: String(policy.sumAssured),
    issueDate: policy.issueDate,
    premiumAmount: String(policy.premiumAmount),
    premiumFrequency: policy.premiumFrequency,
    premiumTerm: policy.premiumTerm,
    status: policy.status,
    notes: policy.notes,
  }
}

export function PolicyForm({ initial, onSubmit }: { initial?: Policy | null; onSubmit: (input: PolicyWrite) => Promise<void> }) {
  const [form, setForm] = useState<PolicyFormState>(() => (initial ? fromPolicy(initial) : emptyState()))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const errorRef = useRef<HTMLDivElement>(null)
  const lock = useRef(false)

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest' })
  }, [error])

  function onChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const amount = parseOptionalNumber(form.premiumAmount)
  const currency = CURRENCIES.find((item) => item.value === form.currency)?.value
  const equivalent =
    amount == null || amount === 'invalid' || !currency
      ? null
      : form.premiumFrequency === 'monthly'
        ? `折合每年 ${formatMoney(toAnnualPremium(amount, 'monthly'), currency)}`
        : `折合每月 ${formatMoney(toMonthlyPremium(amount, 'yearly'), currency)}`

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (lock.current) return
    const insurer = form.insurer.trim()
    const policyName = form.policyName.trim()
    if (!insurer) {
      setError('請填寫保險公司')
      return
    }
    if (!policyName) {
      setError('請填寫保單名稱')
      return
    }
    const policyType = POLICY_TYPES.find((item) => item.value === form.policyType)?.value
    if (!policyType) {
      setError('請選擇保障類別')
      return
    }
    const selectedCurrency = CURRENCIES.find((item) => item.value === form.currency)?.value
    if (!selectedCurrency) {
      setError('請選擇貨幣')
      return
    }
    if (!form.issueDate) {
      setError('請填寫簽發日期')
      return
    }
    const sumAssured = parseRequiredNumber(form.sumAssured)
    if (sumAssured === 'invalid') {
      setError('請填寫有效的保障額')
      return
    }
    const premiumAmount = parseRequiredNumber(form.premiumAmount)
    if (premiumAmount === 'invalid') {
      setError('請填寫有效的保費。已繳清保單可以填 0。')
      return
    }
    const premiumFrequency = PREMIUM_FREQUENCIES.find((item) => item.value === form.premiumFrequency)?.value
    const status = POLICY_STATUSES.find((item) => item.value === form.status)?.value
    if (!premiumFrequency || !status) {
      setError('請選擇保費週期及保單狀態')
      return
    }

    const input: PolicyWrite = {
      insurer,
      policyName,
      policyNumber: form.policyNumber.trim(),
      policyType,
      currency: selectedCurrency,
      sumAssured,
      issueDate: form.issueDate,
      premiumAmount,
      premiumFrequency,
      premiumTerm: form.premiumTerm.trim(),
      status,
      notes: form.notes.trim(),
    }

    lock.current = true
    setBusy(true)
    setError(null)
    try {
      await onSubmit(input)
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return (
    <form className="stack" autoComplete="off" spellCheck={false} onSubmit={handleSubmit}>
      {error ? (
        <div ref={errorRef} className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
      <div className="form-grid">
        <Field label="保險公司" htmlFor="insurer" required>
          <input id="insurer" name="insurer" list="insurer-list" value={form.insurer} onChange={onChange} autoFocus placeholder="友邦 AIA" />
          <datalist id="insurer-list">
            {INSURERS.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Field>
        <Field label="保單號碼" htmlFor="policyNumber" hint="選填，方便分辨同一公司的保單">
          <input id="policyNumber" name="policyNumber" value={form.policyNumber} onChange={onChange} />
        </Field>
        <div className="span-2">
          <Field label="保單名稱" htmlFor="policyName" required>
            <input id="policyName" name="policyName" value={form.policyName} onChange={onChange} placeholder="例如：加裕智倍保" />
          </Field>
        </div>
        <Field label="保障類別" htmlFor="policyType" required hint="日後會按類別判斷保障是否足夠">
          <select id="policyType" name="policyType" value={form.policyType} onChange={onChange}>
            <option value="">請選擇</option>
            {POLICY_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="保單狀態" htmlFor="status" hint="只有生效中及已繳清會計入保障額">
          <select id="status" name="status" value={form.status} onChange={onChange}>
            {POLICY_STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="貨幣" htmlFor="currency" required>
          <select id="currency" name="currency" value={form.currency} onChange={onChange}>
            {CURRENCIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="簽發日期" htmlFor="issueDate" required>
          <input id="issueDate" name="issueDate" type="date" value={form.issueDate} onChange={onChange} />
        </Field>
        <Field label="保障額" htmlFor="sumAssured" required hint="人壽、危疾、意外填保額；醫療可填每年限額">
          <input id="sumAssured" name="sumAssured" inputMode="decimal" value={form.sumAssured} onChange={onChange} placeholder="1000000" />
        </Field>
        <Field label="供款年期" htmlFor="premiumTerm" hint="選填，例如 20年 或 至65歲">
          <input id="premiumTerm" name="premiumTerm" value={form.premiumTerm} onChange={onChange} />
        </Field>
        <div className="span-2">
          <Field label="保費" htmlFor="premiumAmount" required>
            <input id="premiumAmount" name="premiumAmount" inputMode="decimal" value={form.premiumAmount} onChange={onChange} placeholder="1500" />
          </Field>
        </div>
        <div className="span-2">
          <div className="seg-label">
            保費週期<span className="req">*</span>
          </div>
          <div className="seg" role="group" aria-label="保費週期">
            {PREMIUM_FREQUENCIES.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={form.premiumFrequency === option.value}
                onClick={() => setForm((current) => ({ ...current, premiumFrequency: option.value }))}
              >
                {option.label}
              </button>
            ))}
          </div>
          {equivalent ? <p className="hint block">{equivalent}</p> : null}
        </div>
        <div className="span-2">
          <Field label="備註" htmlFor="policyNotes">
            <textarea id="policyNotes" name="notes" value={form.notes} onChange={onChange} />
          </Field>
        </div>
      </div>
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? '儲存中…' : '儲存保單'}
        </button>
      </div>
    </form>
  )
}

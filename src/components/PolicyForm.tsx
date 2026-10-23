import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../api'
import { loadCatalog, rememberChoice, type CatalogBook } from '../lib/catalog'
import { formatMoney, toAnnualPremium, toMonthlyPremium } from '../lib/format'
import {
  CURRENCIES,
  INSURERS,
  POLICY_STATUSES,
  POLICY_TYPES,
  PREMIUM_FREQUENCIES,
  ROOM_LEVELS,
} from '../lib/labels'
import { amountCaret, formatAmountInput, parseOptionalNumber, parseRequiredNumber } from '../lib/parse'
import { catalogProducts } from '../lib/products'
import type { Policy, PolicyWrite } from '../types'
import { Field } from './Field'

const OTHER_INSURER = '__other__'
const NEW_POLICY_NAME = '__new__'

interface PolicyFormState {
  insurerSelect: string
  insurerCustom: string
  policyNameSelect: string
  policyNameCustom: string
  policyNumber: string
  policyType: string
  currency: string
  sumAssured: string
  roomLevel: string
  deductible: string
  fullCover: '' | 'yes' | 'no'
  issueDate: string
  premiumAmount: string
  premiumFrequency: string
  premiumTerm: string
  status: string
  notes: string
}

function unique(values: Array<string | undefined>) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const name = value?.trim() ?? ''
    if (!name || seen.has(name)) continue
    seen.add(name)
    result.push(name)
  }
  return result
}

function emptyState(): PolicyFormState {
  return {
    insurerSelect: '',
    insurerCustom: '',
    policyNameSelect: '',
    policyNameCustom: '',
    policyNumber: '',
    policyType: '',
    currency: 'HKD',
    sumAssured: '',
    roomLevel: '',
    deductible: '',
    fullCover: '',
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
    insurerSelect: policy.insurer,
    insurerCustom: '',
    policyNameSelect: policy.policyName,
    policyNameCustom: '',
    policyNumber: policy.policyNumber,
    policyType: policy.policyType,
    currency: policy.currency,
    sumAssured: policy.sumAssured == null ? '' : formatAmountInput(String(policy.sumAssured)),
    roomLevel: policy.roomLevel,
    deductible: policy.deductible == null ? '' : formatAmountInput(String(policy.deductible)),
    fullCover: policy.fullCover == null ? '' : policy.fullCover ? 'yes' : 'no',
    issueDate: policy.issueDate,
    premiumAmount: formatAmountInput(String(policy.premiumAmount)),
    premiumFrequency: policy.premiumFrequency,
    premiumTerm: policy.premiumTerm,
    status: policy.status,
    notes: policy.notes,
  }
}

function insurerNameOf(form: PolicyFormState) {
  return form.insurerSelect === OTHER_INSURER ? form.insurerCustom.trim() : form.insurerSelect.trim()
}

function namesFor(book: CatalogBook | null, insurer: string, policyType: string, extra?: string) {
  const listed = book
    ? book.products.filter((item) => item.insurerName === insurer && item.policyType === policyType).map((item) => item.name)
    : catalogProducts(insurer, policyType)
  return unique([...listed, extra])
}

function insurersFor(book: CatalogBook | null, extra?: string) {
  const listed = book?.insurers.length ? book.insurers.map((item) => item.name) : [...INSURERS]
  return unique([...listed, extra])
}

export function PolicyForm({ initial, onSubmit }: { initial?: Policy | null; onSubmit: (input: PolicyWrite) => Promise<void> }) {
  const [form, setForm] = useState<PolicyFormState>(() => (initial ? fromPolicy(initial) : emptyState()))
  const [book, setBook] = useState<CatalogBook | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const errorRef = useRef<HTMLDivElement>(null)
  const lock = useRef(false)

  useEffect(() => {
    let active = true
    loadCatalog().then(
      (next) => {
        if (active) setBook(next)
      },
      () => {},
    )
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest' })
  }, [error])

  const insurerName = insurerNameOf(form)
  const keptName =
    initial && initial.insurer === insurerName && initial.policyType === form.policyType ? initial.policyName : undefined
  const nameOptions = namesFor(book, insurerName, form.policyType, keptName)
  const insurerOptions = insurersFor(book, initial?.insurer)
  const namesReady = Boolean(insurerName && form.policyType)

  function onChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target
    const amountField = name === 'sumAssured' || name === 'deductible' || name === 'premiumAmount'
    if (amountField && event.target instanceof HTMLInputElement) {
      const formatted = formatAmountInput(value)
      const caret = amountCaret(value, formatted, event.target.selectionStart ?? formatted.length)
      const input = event.target
      setForm((current) => ({ ...current, [name]: formatted }))
      requestAnimationFrame(() => input.setSelectionRange(caret, caret))
      return
    }
    setForm((current) => ({ ...current, [name]: value }))
  }

  function keepName(current: PolicyFormState, insurer: string, policyType: string) {
    const extra = initial && initial.insurer === insurer && initial.policyType === policyType ? initial.policyName : undefined
    const options = namesFor(book, insurer, policyType, extra)
    if (current.policyNameSelect === NEW_POLICY_NAME || options.includes(current.policyNameSelect)) return current
    return { ...current, policyNameSelect: '', policyNameCustom: '' }
  }

  function onInsurerSelect(value: string) {
    setForm((current) => {
      const next = { ...current, insurerSelect: value, insurerCustom: value === OTHER_INSURER ? current.insurerCustom : '' }
      const insurer = value === OTHER_INSURER ? next.insurerCustom.trim() : value.trim()
      return keepName(next, insurer, next.policyType)
    })
  }

  function onInsurerCustom(value: string) {
    setForm((current) => {
      const next = { ...current, insurerCustom: value }
      return keepName(next, value.trim(), next.policyType)
    })
  }

  function onPolicyType(value: string) {
    setForm((current) => keepName({ ...current, policyType: value }, insurerNameOf(current), value))
  }

  function onPolicyNameSelect(value: string) {
    setForm((current) => ({
      ...current,
      policyNameSelect: value,
      policyNameCustom: value === NEW_POLICY_NAME ? current.policyNameCustom : '',
    }))
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
    const insurer = insurerName
    const policyName = (form.policyNameSelect === NEW_POLICY_NAME ? form.policyNameCustom : form.policyNameSelect).trim()
    if (!form.insurerSelect) {
      setError('請選擇保險公司')
      return
    }
    if (!insurer) {
      setError('請輸入保險公司名稱')
      return
    }
    const policyType = POLICY_TYPES.find((item) => item.value === form.policyType)?.value
    if (!policyType) {
      setError('請選擇保障類別')
      return
    }
    if (!form.policyNameSelect) {
      setError('請選擇保單名稱')
      return
    }
    if (!policyName) {
      setError('請輸入保單名稱')
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
    const medical = policyType === 'medical'
    const roomLevel = ROOM_LEVELS.find((item) => item.value === form.roomLevel)?.value
    if (medical && !roomLevel) {
      setError('請選擇病房')
      return
    }
    const deductible = medical ? parseRequiredNumber(form.deductible) : null
    if (deductible === 'invalid') {
      setError('請填寫有效的自付費。沒有自付費可以填 0。')
      return
    }
    if (medical && !form.fullCover) {
      setError('請選擇是否全包賠償')
      return
    }
    const sumAssured = medical ? null : parseRequiredNumber(form.sumAssured)
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
      roomLevel: medical && roomLevel ? roomLevel : '',
      deductible: medical ? deductible : null,
      fullCover: medical ? form.fullCover === 'yes' : null,
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
      void rememberChoice(insurer, policyType, policyName)
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
        <Field label="保險公司" htmlFor="insurer" required hint="清單沒有的公司可選「其他」。儲存保單後，該名稱會出現在選單。">
          <select id="insurer" value={form.insurerSelect} onChange={(event) => onInsurerSelect(event.target.value)} autoFocus>
            <option value="">請選擇</option>
            {insurerOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value={OTHER_INSURER}>其他</option>
          </select>
          {form.insurerSelect === OTHER_INSURER ? (
            <input
              className="field-extra"
              id="insurerCustom"
              value={form.insurerCustom}
              onChange={(event) => onInsurerCustom(event.target.value)}
              placeholder="輸入保險公司名稱"
              aria-label="保險公司名稱"
            />
          ) : null}
        </Field>
        <Field label="保障類別" htmlFor="policyType" required hint="日後會按類別判斷保障是否足夠">
          <select id="policyType" value={form.policyType} onChange={(event) => onPolicyType(event.target.value)}>
            <option value="">請選擇</option>
            {POLICY_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="span-2">
          <Field
            label="保單名稱"
            htmlFor="policyName"
            required
            hint={namesReady ? '清單沒有的保單可選「新增其他」。儲存保單後，該名稱會出現在選單。' : '請先選擇保險公司及保障類別'}
          >
            <select
              id="policyName"
              value={namesReady ? form.policyNameSelect : ''}
              onChange={(event) => onPolicyNameSelect(event.target.value)}
              disabled={!namesReady}
            >
              <option value="">{namesReady ? '請選擇' : '請先選擇保險公司及保障類別'}</option>
              {namesReady
                ? nameOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))
                : null}
              {namesReady ? <option value={NEW_POLICY_NAME}>新增其他</option> : null}
            </select>
            {namesReady && form.policyNameSelect === NEW_POLICY_NAME ? (
              <input
                className="field-extra"
                id="policyNameCustom"
                value={form.policyNameCustom}
                onChange={(event) => setForm((current) => ({ ...current, policyNameCustom: event.target.value }))}
                placeholder="輸入保單名稱"
                aria-label="保單名稱"
              />
            ) : null}
          </Field>
        </div>
        <Field label="保單號碼" htmlFor="policyNumber" hint="選填，方便分辨同一公司的保單">
          <input id="policyNumber" name="policyNumber" value={form.policyNumber} onChange={onChange} />
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
        {form.policyType === 'medical' ? (
          <>
            <div className="span-2">
              <div className="seg-label">
                病房<span className="req">*</span>
              </div>
              <div className="seg" role="group" aria-label="病房">
                {ROOM_LEVELS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={form.roomLevel === option.value}
                    onClick={() => setForm((current) => ({ ...current, roomLevel: option.value }))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <Field label="自付費" htmlFor="deductible" required hint="沒有自付費可填 0">
              <input id="deductible" name="deductible" inputMode="decimal" value={form.deductible} onChange={onChange} placeholder="0" />
            </Field>
            <div>
              <div className="seg-label">
                全包賠償<span className="req">*</span>
              </div>
              <div className="seg" role="group" aria-label="是否全包賠償">
                <button type="button" aria-pressed={form.fullCover === 'yes'} onClick={() => setForm((current) => ({ ...current, fullCover: 'yes' }))}>
                  是
                </button>
                <button type="button" aria-pressed={form.fullCover === 'no'} onClick={() => setForm((current) => ({ ...current, fullCover: 'no' }))}>
                  否
                </button>
              </div>
            </div>
          </>
        ) : (
          <Field label="保障額" htmlFor="sumAssured" required hint="人壽、危疾、意外填保額">
            <input id="sumAssured" name="sumAssured" inputMode="decimal" value={form.sumAssured} onChange={onChange} placeholder="1,000,000" />
          </Field>
        )}
        <Field label="供款年期" htmlFor="premiumTerm" hint="選填，例如 20年 或 至65歲">
          <input id="premiumTerm" name="premiumTerm" value={form.premiumTerm} onChange={onChange} />
        </Field>
        <div className="span-2">
          <Field label="保費" htmlFor="premiumAmount" required>
            <input id="premiumAmount" name="premiumAmount" inputMode="decimal" value={form.premiumAmount} onChange={onChange} placeholder="1,500" />
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

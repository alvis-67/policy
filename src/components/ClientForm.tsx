import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../api'
import { todayISO } from '../lib/format'
import { GENDER_OPTIONS, MARITAL_OPTIONS, type Gender, type MaritalStatus } from '../lib/labels'
import { parseOptionalNumber } from '../lib/parse'
import type { Client, ClientWrite } from '../types'
import { Field } from './Field'

interface ClientFormState {
  chineseName: string
  englishName: string
  gender: string
  dateOfBirth: string
  phone: string
  email: string
  hkid: string
  occupation: string
  maritalStatus: string
  dependents: string
  monthlyIncome: string
  address: string
  notes: string
}

function emptyState(): ClientFormState {
  return {
    chineseName: '',
    englishName: '',
    gender: '',
    dateOfBirth: '',
    phone: '',
    email: '',
    hkid: '',
    occupation: '',
    maritalStatus: '',
    dependents: '',
    monthlyIncome: '',
    address: '',
    notes: '',
  }
}

function fromClient(client: Client): ClientFormState {
  return {
    chineseName: client.chineseName,
    englishName: client.englishName,
    gender: client.gender,
    dateOfBirth: client.dateOfBirth,
    phone: client.phone,
    email: client.email,
    hkid: client.hkid,
    occupation: client.occupation,
    maritalStatus: client.maritalStatus,
    dependents: client.dependents == null ? '' : String(client.dependents),
    monthlyIncome: client.monthlyIncome == null ? '' : String(client.monthlyIncome),
    address: client.address,
    notes: client.notes,
  }
}

export function ClientForm({ initial, onSubmit }: { initial?: Client; onSubmit: (input: ClientWrite) => Promise<void> }) {
  const [form, setForm] = useState<ClientFormState>(() => (initial ? fromClient(initial) : emptyState()))
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (lock.current) return
    const chineseName = form.chineseName.trim()
    const englishName = form.englishName.trim()
    if (!chineseName && !englishName) {
      setError('請填寫中文或英文姓名')
      return
    }
    if ((form.phone.match(/\d/g) || []).length < 8) {
      setError('請填寫有效的聯絡電話')
      return
    }
    const dependents = parseOptionalNumber(form.dependents, true)
    if (dependents === 'invalid') {
      setError('請填寫有效的受養人數')
      return
    }
    const monthlyIncome = parseOptionalNumber(form.monthlyIncome)
    if (monthlyIncome === 'invalid') {
      setError('請填寫有效的每月收入')
      return
    }
    const gender = (GENDER_OPTIONS.find((option) => option.value === form.gender)?.value ?? '') as Gender
    const maritalStatus = (MARITAL_OPTIONS.find((option) => option.value === form.maritalStatus)?.value ??
      '') as MaritalStatus
    if (form.gender && !gender) {
      setError('請選擇性別')
      return
    }
    if (form.maritalStatus && !maritalStatus) {
      setError('請選擇婚姻狀況')
      return
    }

    const input: ClientWrite = {
      chineseName,
      englishName,
      gender,
      dateOfBirth: form.dateOfBirth,
      phone: form.phone.trim(),
      email: form.email.trim(),
      hkid: form.hkid.trim(),
      occupation: form.occupation.trim(),
      maritalStatus,
      dependents,
      monthlyIncome,
      address: form.address.trim(),
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
        <Field label="中文姓名" htmlFor="chineseName" required hint="中文或英文姓名至少填一項">
          <input id="chineseName" name="chineseName" value={form.chineseName} onChange={onChange} autoFocus placeholder="例如：陳大文" />
        </Field>
        <Field label="英文姓名" htmlFor="englishName">
          <input id="englishName" name="englishName" value={form.englishName} onChange={onChange} placeholder="例如：Chan Tai Man" />
        </Field>
        <Field label="性別" htmlFor="gender">
          <select id="gender" name="gender" value={form.gender} onChange={onChange}>
            <option value="">請選擇</option>
            {GENDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="出生日期" htmlFor="dateOfBirth" hint="用來計算年齡，日後保障分析會用到">
          <input id="dateOfBirth" name="dateOfBirth" type="date" max={todayISO()} value={form.dateOfBirth} onChange={onChange} />
        </Field>
        <Field label="聯絡電話" htmlFor="phone" required>
          <input id="phone" name="phone" inputMode="tel" value={form.phone} onChange={onChange} placeholder="91234567" />
        </Field>
        <Field label="電郵" htmlFor="email">
          <input id="email" name="email" type="email" value={form.email} onChange={onChange} />
        </Field>
        <div className="span-2">
          <Field label="身份證號碼" htmlFor="hkid" hint="選填。只儲存在這部電腦，客戶列表不會顯示。">
            <input id="hkid" name="hkid" value={form.hkid} onChange={onChange} />
          </Field>
        </div>
        <div className="form-section span-2">
          <strong>家庭與收入</strong>
          <p className="hint">這些資料會用於日後的保障分析。未填代表未知，受養人數填 0 代表沒有受養人。</p>
        </div>
        <Field label="婚姻狀況" htmlFor="maritalStatus">
          <select id="maritalStatus" name="maritalStatus" value={form.maritalStatus} onChange={onChange}>
            <option value="">請選擇</option>
            {MARITAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="受養人數" htmlFor="dependents">
          <input id="dependents" name="dependents" inputMode="numeric" value={form.dependents} onChange={onChange} placeholder="0" />
        </Field>
        <Field label="職業" htmlFor="occupation">
          <input id="occupation" name="occupation" value={form.occupation} onChange={onChange} />
        </Field>
        <Field label="每月收入" htmlFor="monthlyIncome" hint="以港幣計算">
          <input id="monthlyIncome" name="monthlyIncome" inputMode="decimal" value={form.monthlyIncome} onChange={onChange} placeholder="45000" />
        </Field>
        <div className="span-2">
          <Field label="地址" htmlFor="address">
            <input id="address" name="address" value={form.address} onChange={onChange} />
          </Field>
        </div>
        <div className="span-2">
          <Field label="備註" htmlFor="notes">
            <textarea id="notes" name="notes" value={form.notes} onChange={onChange} />
          </Field>
        </div>
      </div>
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? '儲存中…' : '儲存客戶'}
        </button>
      </div>
    </form>
  )
}

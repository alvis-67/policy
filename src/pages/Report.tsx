import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { MoneyText } from '../components/MoneyText'
import { displayName, formatCover, formatDate, formatMoney, formatPhone, moneyParts, todayISO, toAnnualPremium } from '../lib/format'
import {
  POLICY_STATUSES,
  POLICY_TYPES,
  PREMIUM_FREQUENCIES,
  PRIMARY_COVER_TYPES,
  ROOM_LEVELS,
  countsAsCover,
  labelOf,
  type PolicyType,
} from '../lib/labels'
import type { Client, Policy, PolicyTotals } from '../types'
import { APP_VERSION } from '../version'

export function Report() {
  const { id = '' } = useParams()
  const [client, setClient] = useState<Client | null>(null)
  const [policies, setPolicies] = useState<Policy[]>([])
  const [totals, setTotals] = useState<PolicyTotals | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const issuedOn = todayISO()

  useEffect(() => {
    let active = true
    setLoading(true)
    api
      .client(id)
      .then((detail) => {
        if (!active) return
        setClient(detail.client)
        setPolicies(detail.policies)
        setTotals(detail.totals)
        setLoading(false)
      })
      .catch((reason) => {
        if (!active) return
        setError(errorMessage(reason))
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])

  useEffect(() => {
    const previous = document.title
    document.title = client ? `${displayName(client)} 保單報告書 ${issuedOn}` : '保單報告書'
    return () => {
      document.title = previous
    }
  }, [client, issuedOn])

  const active = policies.filter((policy) => countsAsCover(policy.status))
  const inactive = policies.filter((policy) => !countsAsCover(policy.status))
  const monthly = totals ? moneyParts(totals.monthlyEquivalent) : []

  return (
    <div className="report-screen">
      <div className="report-toolbar">
        <Link className="btn btn-ghost" to={id ? `/clients/${id}` : '/clients'}>
          返回客戶
        </Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={loading || !!error || !client}>
          儲存為 PDF
        </button>
      </div>
      {error ? (
        <div className="error-banner report-banner" role="alert">
          {error}
        </div>
      ) : null}
      {loading ? <p className="report-wait">正在整理報告…</p> : null}
      {!loading && !error && client && totals ? (
        <article className="report-sheet">
          <header className="report-mast">
            <div className="report-mast-row">
              <p className="report-kicker">Policy Statement</p>
              <p className="report-date">
                報告日期
                <strong>{formatDate(issuedOn)}</strong>
              </p>
            </div>
            <h1>保單報告書</h1>
            <p className="report-person">{client.chineseName.trim() || client.englishName.trim() || '未命名客戶'}</p>
            {client.englishName.trim() && client.chineseName.trim() ? <p className="report-person-en">{client.englishName.trim()}</p> : null}
            <p className="report-contact-line">
              {[client.phone.trim() ? formatPhone(client.phone) : '', client.email.trim(), client.occupation.trim()]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </header>

          <section>
            <h2>保障概覽</h2>
            <div className="report-cover-grid">
              {POLICY_TYPES.filter((type) => PRIMARY_COVER_TYPES.includes(type.value)).map((type) => (
                <div key={type.value}>
                  <span>{type.label}</span>
                  <strong>{coverHeadline(type.value, policies, totals)}</strong>
                </div>
              ))}
            </div>
            <p className="report-premium-line">
              {[
                `每年保費 ${moneyParts(totals.annualPremium).join(' · ') || '—'}`,
                `折合每月 ${monthly.join(' · ') || '—'}`,
                `${totals.activeCount} 張計入保障`,
              ].join(' · ')}
            </p>
          </section>

          <PolicyGroups title="生效保單" policies={active} empty="未有生效中或已繳清的保單。" />
          {inactive.length > 0 ? <PolicyGroups title="未計入保障" policies={inactive} note="已失效或已退保，不計入上方保障額及保費。" /> : null}

          <footer className="report-foot">
            <p>本報告書根據保單紀錄編製，供這位客戶查閱，並不取代保險合約。不同貨幣分開列示，不會自動兌換。</p>
            <p>保冊 · {APP_VERSION}</p>
          </footer>
        </article>
      ) : null}
    </div>
  )
}

function coverHeadline(type: PolicyType, policies: Policy[], totals: PolicyTotals) {
  if (type === 'medical') {
    const rooms = policies
      .filter((policy) => policy.policyType === 'medical' && countsAsCover(policy.status) && policy.roomLevel)
      .map((policy) => labelOf(ROOM_LEVELS, policy.roomLevel))
    const unique = [...new Set(rooms)]
    return unique.length > 0 ? unique.join('、') : totals.byType.medical.count ? '已有紀錄' : '未有'
  }
  return <MoneyText bag={totals.byType[type].sumAssured} empty="未有" />
}

function PolicyGroups({ title, policies, empty, note }: { title: string; policies: Policy[]; empty?: string; note?: string }) {
  const rows = [...policies].sort((a, b) => {
    const byType = POLICY_TYPES.findIndex((type) => type.value === a.policyType) - POLICY_TYPES.findIndex((type) => type.value === b.policyType)
    return byType || b.issueDate.localeCompare(a.issueDate)
  })

  return (
    <section className="report-schedule">
      <h2>{title}</h2>
      {note ? <p className="report-note">{note}</p> : null}
      {rows.length === 0 ? <p className="report-empty">{empty}</p> : null}
      {rows.length > 0 ? (
        <div className="report-list">
          <div className="report-row report-row-head">
            <span>類別</span>
            <span>保單</span>
            <span>保障</span>
            <span>保費</span>
          </div>
          {rows.map((policy) => (
            <div key={policy.id} className="report-row">
              <span className="report-type">{labelOf(POLICY_TYPES, policy.policyType)}</span>
              <div>
                <p>
                  <strong>{policy.insurer}</strong> {policy.policyName}
                </p>
                <p className="report-meta">{policyMeta(policy)}</p>
                {policy.notes.trim() ? <p className="report-meta">{policy.notes}</p> : null}
              </div>
              <span>{coverLine(policy)}</span>
              <span>{premiumLine(policy)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function policyMeta(policy: Policy) {
  return [
    policy.policyNumber,
    formatDate(policy.issueDate),
    policy.premiumTerm ? `供款 ${policy.premiumTerm}` : '',
    policy.status === 'inforce' ? '' : labelOf(POLICY_STATUSES, policy.status),
  ]
    .filter(Boolean)
    .join(' · ')
}

function coverLine(policy: Policy) {
  if (policy.policyType !== 'medical') return formatCover(policy)
  return [
    policy.roomLevel ? labelOf(ROOM_LEVELS, policy.roomLevel) : '',
    policy.deductible == null ? '' : `自付 ${formatMoney(policy.deductible, policy.currency)}`,
    policy.fullCover == null ? '' : policy.fullCover ? '全包' : '非全包',
  ]
    .filter(Boolean)
    .join(' · ') || '—'
}

function premiumLine(policy: Policy) {
  const amount = `${formatMoney(policy.premiumAmount, policy.currency)} ${labelOf(PREMIUM_FREQUENCIES, policy.premiumFrequency)}`
  if (policy.premiumFrequency !== 'monthly') return amount
  return `${amount}（每年 ${formatMoney(toAnnualPremium(policy.premiumAmount, 'monthly'), policy.currency)}）`
}

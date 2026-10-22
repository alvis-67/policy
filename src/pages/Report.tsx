import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { MoneyText } from '../components/MoneyText'
import {
  calcAge,
  displayName,
  formatCover,
  formatDate,
  formatMoney,
  formatPhone,
  moneyParts,
  todayISO,
  toAnnualPremium,
} from '../lib/format'
import {
  GENDER_OPTIONS,
  MARITAL_OPTIONS,
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

  const age = client?.dateOfBirth ? calcAge(client.dateOfBirth) : null
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
            <p className="report-identity">
              {[
                client.gender ? labelOf(GENDER_OPTIONS, client.gender) : '',
                age == null ? '' : `${age}歲`,
                client.dateOfBirth ? formatDate(client.dateOfBirth) : '',
                client.maritalStatus ? labelOf(MARITAL_OPTIONS, client.maritalStatus) : '',
                client.dependents != null ? `受養 ${client.dependents} 人` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <dl className="report-contact">
              <div>
                <dt>電話</dt>
                <dd>{formatPhone(client.phone)}</dd>
              </div>
              {client.email ? (
                <div>
                  <dt>電郵</dt>
                  <dd>{client.email}</dd>
                </div>
              ) : null}
              {client.occupation.trim() ? (
                <div>
                  <dt>職業</dt>
                  <dd>{client.occupation}</dd>
                </div>
              ) : null}
            </dl>
          </header>

          <section>
            <h2>保障概覽</h2>
            <div className="report-cover-grid">
              {POLICY_TYPES.filter((type) => PRIMARY_COVER_TYPES.includes(type.value)).map((type) => (
                <div key={type.value}>
                  <span>{type.label}</span>
                  <strong>{coverHeadline(type.value, policies, totals)}</strong>
                  <em>{totals.byType[type.value].count ? `${totals.byType[type.value].count} 張計入` : '未有紀錄'}</em>
                </div>
              ))}
            </div>
            <div className="report-premium">
              <div>
                <span>每年保費</span>
                <strong>{moneyParts(totals.annualPremium).join(' · ') || '—'}</strong>
              </div>
              <div>
                <span>折合每月</span>
                <strong>{monthly.join(' · ') || '—'}</strong>
              </div>
              <div>
                <span>計入保障</span>
                <strong>{totals.activeCount} 張</strong>
              </div>
            </div>
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
  const groups = POLICY_TYPES.map((type) => ({
    type,
    rows: policies.filter((policy) => policy.policyType === type.value).sort((a, b) => b.issueDate.localeCompare(a.issueDate)),
  })).filter((group) => group.rows.length > 0)

  return (
    <section className="report-schedule">
      <h2>{title}</h2>
      {note ? <p className="report-note">{note}</p> : null}
      {groups.length === 0 ? <p className="report-empty">{empty}</p> : null}
      {groups.map((group) => (
        <div key={group.type.value} className="report-group">
          <h3>{group.type.label}</h3>
          {group.rows.map((policy) => (
            <article key={policy.id} className="report-policy">
              <header>
                <div>
                  <p>{policy.insurer}</p>
                  <h4>{policy.policyName}</h4>
                  {policy.policyNumber ? <p className="report-sub">保單號碼 {policy.policyNumber}</p> : null}
                </div>
                <span className="report-status">{labelOf(POLICY_STATUSES, policy.status)}</span>
              </header>
              <dl>
                {policy.policyType === 'medical' ? (
                  <>
                    <div>
                      <dt>病房</dt>
                      <dd>{policy.roomLevel ? labelOf(ROOM_LEVELS, policy.roomLevel) : '—'}</dd>
                    </div>
                    <div>
                      <dt>自付費</dt>
                      <dd>{policy.deductible == null ? '—' : formatMoney(policy.deductible, policy.currency)}</dd>
                    </div>
                    <div>
                      <dt>賠償</dt>
                      <dd>{policy.fullCover == null ? '—' : policy.fullCover ? '全包' : '非全包'}</dd>
                    </div>
                  </>
                ) : (
                  <div>
                    <dt>保障額</dt>
                    <dd>{formatCover(policy)}</dd>
                  </div>
                )}
                <div>
                  <dt>簽發日期</dt>
                  <dd>{formatDate(policy.issueDate)}</dd>
                </div>
                <div>
                  <dt>保費</dt>
                  <dd>
                    {formatMoney(policy.premiumAmount, policy.currency)} · {labelOf(PREMIUM_FREQUENCIES, policy.premiumFrequency)}
                    {policy.premiumFrequency === 'monthly' ? (
                      <span className="report-sub"> 折合每年 {formatMoney(toAnnualPremium(policy.premiumAmount, 'monthly'), policy.currency)}</span>
                    ) : null}
                  </dd>
                </div>
                {policy.premiumTerm ? (
                  <div>
                    <dt>供款年期</dt>
                    <dd>{policy.premiumTerm}</dd>
                  </div>
                ) : null}
              </dl>
              {policy.notes.trim() ? <p className="report-note">{policy.notes}</p> : null}
            </article>
          ))}
        </div>
      ))}
    </section>
  )
}

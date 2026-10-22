import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { MoneyText } from '../components/MoneyText'
import { summarizePolicies } from '../lib/stats'
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
import { countsAsCover, labelOf, POLICY_STATUSES, POLICY_TYPES, PREMIUM_FREQUENCIES } from '../lib/labels'
import type { Client, Policy } from '../types'
import { APP_VERSION } from '../version'

export function Report() {
  const [clients, setClients] = useState<Client[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const issuedOn = todayISO()

  useEffect(() => {
    const previous = document.title
    document.title = `保冊保單報告-${issuedOn}`
    return () => {
      document.title = previous
    }
  }, [issuedOn])

  useEffect(() => {
    let active = true
    api
      .backup()
      .then((book) => {
        if (!active) return
        setClients(book.clients)
        setPolicies(book.policies)
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
  }, [])

  const totals = summarizePolicies(policies)
  const breakdown = POLICY_TYPES.filter((type) => totals.byType[type.value].count > 0)
  const sections = clients
    .slice()
    .sort((a, b) => displayName(a).localeCompare(displayName(b), 'zh-Hant'))
    .map((client) => ({
      client,
      policies: policies
        .filter((policy) => policy.clientId === client.id)
        .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.createdAt.localeCompare(a.createdAt)),
    }))

  return (
    <div className="report-screen">
      <div className="report-toolbar">
        <Link className="btn btn-ghost" to="/">
          返回總覽
        </Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={loading || !!error}>
          儲存為 PDF
        </button>
      </div>
      {error ? (
        <div className="error-banner report-banner" role="alert">
          {error}
        </div>
      ) : null}
      {loading ? <p className="report-wait">正在整理報告…</p> : null}
      {!loading && !error ? (
        <article className="report-sheet">
          <header className="report-mast">
            <p className="report-kicker">Policy Report</p>
            <div className="report-mast-row">
              <div>
                <h1>保單報告</h1>
                <p className="report-brand">保冊</p>
              </div>
              <p className="report-date">
                報告日期
                <strong>{formatDate(issuedOn)}</strong>
              </p>
            </div>
          </header>

          <section className="report-summary">
            <h2>概覽</h2>
            <div className="report-metrics">
              <div>
                <span>客戶</span>
                <strong>{clients.length}</strong>
              </div>
              <div>
                <span>保單</span>
                <strong>{policies.length}</strong>
              </div>
              <div>
                <span>計入保障</span>
                <strong>{totals.activeCount}</strong>
              </div>
              <div>
                <span>每年保費</span>
                <strong>{moneyParts(totals.annualPremium).join(' · ') || '—'}</strong>
              </div>
            </div>
            {breakdown.length > 0 ? (
              <table className="report-table">
                <thead>
                  <tr>
                    <th>類別</th>
                    <th className="num">張數</th>
                    <th className="num">保障額</th>
                    <th className="num">每年保費</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((type) => {
                    const stat = totals.byType[type.value]
                    return (
                      <tr key={type.value}>
                        <td>{type.label}</td>
                        <td className="num">{stat.count}</td>
                        <td className="num">
                          <MoneyText bag={stat.sumAssured} empty={type.value === 'medical' ? '按病房' : '—'} />
                        </td>
                        <td className="num">
                          <MoneyText bag={stat.annualPremium} empty="—" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : null}
          </section>

          <section className="report-book">
            <h2>客戶保單</h2>
            {sections.length === 0 ? <p className="report-empty">目前未有客戶或保單。</p> : null}
            {sections.map(({ client, policies: rows }) => {
              const age = calcAge(client.dateOfBirth)
              const facts = [
                client.englishName.trim(),
                age == null ? '' : `${age}歲`,
                client.phone ? formatPhone(client.phone) : '',
                client.occupation.trim(),
              ].filter(Boolean)
              return (
                <section key={client.id} className="report-client">
                  <header>
                    <h3>{client.chineseName.trim() || client.englishName.trim() || '未命名客戶'}</h3>
                    {facts.length > 0 ? <p>{facts.join(' · ')}</p> : null}
                  </header>
                  {rows.length === 0 ? (
                    <p className="report-empty">未有保單</p>
                  ) : (
                    <table className="report-table">
                      <thead>
                        <tr>
                          <th>保險公司</th>
                          <th>保單</th>
                          <th>類別</th>
                          <th>保障</th>
                          <th>簽發</th>
                          <th className="num">保費</th>
                          <th>狀態</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((policy) => (
                          <tr key={policy.id} className={countsAsCover(policy.status) ? undefined : 'is-inactive'}>
                            <td>{policy.insurer}</td>
                            <td>
                              <div>{policy.policyName}</div>
                              {policy.policyNumber ? <div className="report-sub">{policy.policyNumber}</div> : null}
                            </td>
                            <td>{labelOf(POLICY_TYPES, policy.policyType)}</td>
                            <td>{formatCover(policy)}</td>
                            <td>{formatDate(policy.issueDate)}</td>
                            <td className="num">
                              <div>{formatMoney(policy.premiumAmount, policy.currency)}</div>
                              <div className="report-sub">
                                {labelOf(PREMIUM_FREQUENCIES, policy.premiumFrequency)}
                                {policy.premiumFrequency === 'monthly'
                                  ? ` · 每年 ${formatMoney(toAnnualPremium(policy.premiumAmount, 'monthly'), policy.currency)}`
                                  : ''}
                              </div>
                            </td>
                            <td>{labelOf(POLICY_STATUSES, policy.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              )
            })}
          </section>

          <footer className="report-foot">
            <p>已失效及已退保的保單仍列於報告，但不計入上方合計。不同貨幣分開列示，不會自動兌換。</p>
            <p>保冊 · {APP_VERSION} · 只供帳號持有人使用</p>
          </footer>
        </article>
      ) : null}
    </div>
  )
}

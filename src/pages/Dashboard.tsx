import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { EmptyState } from '../components/EmptyState'
import { MoneyText } from '../components/MoneyText'
import { PageHeader } from '../components/PageHeader'
import { Stat } from '../components/Stat'
import { formatPhone, nameInitial } from '../lib/format'
import { labelOf, POLICY_TYPES } from '../lib/labels'
import type { Summary } from '../types'

export function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    document.title = '總覽 · 保冊'
  }, [])

  useEffect(() => {
    let cancel = false
    setLoading(true)
    api
      .summary()
      .then((next) => {
        if (cancel) return
        setSummary(next)
        setError(null)
        setLoading(false)
      })
      .catch((reason) => {
        if (cancel) return
        setError(errorMessage(reason))
        setLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [version])

  const breakdown = summary ? POLICY_TYPES.filter((type) => summary.byType[type.value].count > 0) : []

  return (
    <div className="stack-lg">
      <PageHeader
        title="總覽"
        description="客戶與保單放在同一個紀錄。日後的保障分析會直接使用這些資料。"
        action={
          <Link className="btn btn-primary" to="/clients?new=1">
            新增客戶
          </Link>
        }
      />
      {error ? (
        <div className="error-banner" role="alert">
          {error}
          <button type="button" className="linkish" style={{ marginLeft: '0.75rem' }} onClick={() => setVersion((value) => value + 1)}>
            再試一次
          </button>
        </div>
      ) : null}
      {loading && !summary ? <p className="muted">載入中…</p> : null}
      {summary ? (
        <>
          <div className="grid-stats">
            <Stat label="客戶">{summary.clientCount}</Stat>
            <Stat
              label="計入保障的保單"
              hint={
                summary.policyCount > summary.activePolicyCount
                  ? `另有 ${summary.policyCount - summary.activePolicyCount} 張已失效或已退保`
                  : '包括生效中及已繳清'
              }
            >
              {summary.activePolicyCount}
            </Stat>
            <Stat label="每年保費" hint="生效及已繳清保單。不同貨幣分開計算，不會自動兌換。">
              <MoneyText bag={summary.annualPremium} empty="—" />
            </Stat>
          </div>
          {summary.clientCount === 0 ? (
            <EmptyState
              title="尚未有客戶紀錄"
              body="新增客戶並輸入現有保單後，這些資料會直接用於日後的保障分析。"
              action={
                <Link className="btn btn-primary" to="/clients?new=1">
                  新增第一位客戶
                </Link>
              }
            />
          ) : (
            <section className="stack">
              <h2 className="section-title">最近更新</h2>
              <div className="card">
                {summary.recentClients.map((client) => (
                  <Link key={client.id} className="list-row" to={`/clients/${client.id}`}>
                    <span className="row">
                      <span className="avatar sm">{nameInitial(client)}</span>
                      <span>
                        <span className="name-link">{client.chineseName || client.englishName}</span>
                        <span className="subline">
                          {formatPhone(client.phone)} · {client.policyCount} 張保單
                        </span>
                      </span>
                    </span>
                    <MoneyText bag={client.annualPremium} empty="未有保費" />
                  </Link>
                ))}
              </div>
            </section>
          )}
          {breakdown.length > 0 ? (
            <section className="stack">
              <h2 className="section-title">保障分佈</h2>
              <div className="card scroll">
                <table className="sheet">
                  <thead>
                    <tr>
                      <th>類別</th>
                      <th>張數</th>
                      <th>保障額</th>
                      <th>每年保費</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((type) => {
                      const stat = summary.byType[type.value]
                      return (
                        <tr key={type.value}>
                          <td>{labelOf(POLICY_TYPES, type.value)}</td>
                          <td className="num">{stat.count}</td>
                          <td>
                            <MoneyText bag={stat.sumAssured} empty={type.value === 'medical' ? '按病房' : '—'} />
                          </td>
                          <td>
                            <MoneyText bag={stat.annualPremium} empty="—" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
          <section className="notice">保障分析尚未推出。推出時會用同一套客戶及保單資料，看人壽、危疾、醫療及意外保障是否足夠。</section>
        </>
      ) : null}
    </div>
  )
}

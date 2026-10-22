import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { analyzeClient, gapScore, VERDICT_LABEL, type ClientAnalysis, type Verdict } from '../lib/analysis'
import { displayName, formatMoney, nameInitial } from '../lib/format'
import type { Client, Policy } from '../types'

const RULES =
  '參考準則：有家庭責任的人壽按 10 年收入，沒有受養人按 5 年收入。危疾和意外按 5 年收入。醫療方面，每月收入 8 萬或以上建議私家房，3 萬至 8 萬建議半私家房，3 萬以下建議大房。港幣、美元和人民幣分開計算，不會兌換。已失效和已退保不計入。'

export function Analysis() {
  const [rows, setRows] = useState<Array<{ client: Client; analysis: ClientAnalysis }>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [onlyGaps, setOnlyGaps] = useState(false)

  useEffect(() => {
    document.title = '保障分析 · 保冊'
  }, [])

  useEffect(() => {
    let cancel = false
    setLoading(true)
    api
      .backup()
      .then((book) => {
        if (cancel) return
        setRows(buildRows(book.clients, book.policies))
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
  }, [])

  const visible = onlyGaps ? rows.filter((row) => gapScore(row.analysis) > 0) : rows
  const gapClients = rows.filter((row) => gapScore(row.analysis) > 0).length

  return (
    <div className="stack-lg">
      <PageHeader
        title="保障分析"
        description="用現有客戶和保單，看人壽、危疾、醫療和意外夠不夠。不足的地方可以跟進。"
        action={
          rows.length > 0 ? (
            <button type="button" className="btn btn-ghost" onClick={() => setOnlyGaps((value) => !value)}>
              {onlyGaps ? '顯示全部' : '只看有缺口'}
            </button>
          ) : null
        }
      />
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
      {loading ? <p className="muted">載入中…</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState
          title="尚未有客戶紀錄"
          body="新增客戶並輸入現有保單後，就可以在這裡看保障夠不夠。"
          action={
            <Link className="btn btn-primary" to="/clients?new=1">
              新增客戶
            </Link>
          }
        />
      ) : null}
      {!loading && rows.length > 0 ? (
        <>
          <section className="notice">{RULES}</section>
          <p className="subline">
            {rows.length} 位客戶 · {gapClients} 位有可以跟進的缺口
          </p>
          {visible.length === 0 ? <p className="muted">這批客戶暫時沒有缺口。</p> : null}
          <div className="card">
            {visible.map(({ client, analysis }) => (
              <Link key={client.id} className="list-row" to={`/analysis/${client.id}`}>
                <span className="row">
                  <span className="avatar sm">{nameInitial(client)}</span>
                  <span>
                    <span className="name-link">{displayName(client)}</span>
                    <span className="subline">{rowSummary(analysis)}</span>
                  </span>
                </span>
                <span className="analysis-pills">
                  {analysis.findings.map((finding) => (
                    <span key={finding.type} className={`pill ${finding.verdict}`}>
                      {finding.label} {VERDICT_LABEL[finding.verdict]}
                    </span>
                  ))}
                </span>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

export function AnalysisDetail() {
  const { id = '' } = useParams()
  const [client, setClient] = useState<Client | null>(null)
  const [analysis, setAnalysis] = useState<ClientAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    api
      .client(id)
      .then((detail) => {
        if (cancel) return
        setClient(detail.client)
        setAnalysis(analyzeClient(detail.client, detail.policies))
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
  }, [id])

  useEffect(() => {
    document.title = client ? `${displayName(client)} · 保障分析` : '保障分析 · 保冊'
  }, [client])

  if (loading) return <p className="muted">載入中…</p>
  if (error || !client || !analysis) {
    return (
      <div className="stack">
        <div className="error-banner" role="alert">
          {error ?? '找不到這位客戶'}
        </div>
        <Link className="back-link" to="/analysis">
          ← 返回保障分析
        </Link>
      </div>
    )
  }

  return (
    <div className="stack-lg">
      <Link className="back-link" to="/analysis">
        ← 保障分析
      </Link>
      <PageHeader
        title={client.chineseName.trim() || client.englishName.trim() || '未命名客戶'}
        description={client.chineseName.trim() && client.englishName.trim() ? client.englishName.trim() : undefined}
        action={
          <Link className="btn btn-ghost" to={`/clients/${client.id}`}>
            查看保單
          </Link>
        }
      />
      <p className="subline">
        {analysis.annualIncome == null ? '未有每月收入' : `每年收入 ${formatMoney(analysis.annualIncome, 'HKD')}`}
        {' · '}
        {analysis.lifeBasis}
      </p>
      <section className="notice">{RULES}</section>
      <div className="grid-cover">
        {analysis.findings.map((finding) => (
          <article key={finding.type} className={`card pad analysis-card is-${finding.verdict}`}>
            <div className="row-between">
              <h2 className="section-title">{finding.label}</h2>
              <VerdictPill verdict={finding.verdict} />
            </div>
            <dl className="analysis-facts">
              <div>
                <dt>現有</dt>
                <dd>{finding.currentText}</dd>
              </div>
              <div>
                <dt>建議</dt>
                <dd>{finding.targetText}</dd>
              </div>
              <div>
                <dt>差額</dt>
                <dd>{finding.gapText}</dd>
              </div>
            </dl>
            {finding.note ? <p className="hint">{finding.note}</p> : null}
          </article>
        ))}
      </div>
      {analysis.opportunities.length > 0 ? (
        <section className="card pad">
          <h2 className="section-title">可以跟進</h2>
          <ul className="analysis-follow">
            {analysis.opportunities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : analysis.findings.some((finding) => finding.verdict === 'unknown') ? (
        <section className="notice">未有每月收入，人壽、危疾和意外未能判斷。請先在客戶資料填上收入。</section>
      ) : (
        <section className="notice">四項保障都達到參考準則。</section>
      )}
      {analysis.otherPolicyCount > 0 ? (
        <p className="hint">另有 {analysis.otherPolicyCount} 張儲蓄、投資相連、年金或其他保單。這次沒有用來判斷夠不夠。</p>
      ) : null}
    </div>
  )
}

function rowSummary(analysis: ClientAnalysis) {
  if (analysis.opportunities.length > 0) return `${analysis.opportunities.length} 項可以跟進`
  if (analysis.findings.some((finding) => finding.verdict === 'unknown')) return '未有收入，未能判斷金額'
  return '四項都達到參考準則'
}

function VerdictPill({ verdict }: { verdict: Verdict }) {
  return <span className={`pill ${verdict}`}>{VERDICT_LABEL[verdict]}</span>
}

function buildRows(clients: Client[], policies: Policy[]) {
  return clients
    .map((client) => ({
      client,
      analysis: analyzeClient(
        client,
        policies.filter((policy) => policy.clientId === client.id),
      ),
    }))
    .sort((a, b) => gapScore(b.analysis) - gapScore(a.analysis) || displayName(a.client).localeCompare(displayName(b.client), 'zh-HK'))
}

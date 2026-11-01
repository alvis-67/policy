import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { buildCoverStatement, type CoverStatementModel } from '../lib/coverStatement'
import { displayName, formatDate, formatPhone, todayISO } from '../lib/format'
import type { Client } from '../types'
import { APP_VERSION } from '../version'

export function CoverStatement() {
  const { id = '' } = useParams()
  const [client, setClient] = useState<Client | null>(null)
  const [model, setModel] = useState<CoverStatementModel | null>(null)
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
        setModel(buildCoverStatement(detail.client, detail.policies))
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
    document.title = client ? `${displayName(client)} 保障現況說明 ${issuedOn}` : '保障現況說明'
    return () => {
      document.title = previous
    }
  }, [client, issuedOn])

  const counted = model?.medical.filter((line) => line.counted) ?? []
  const inactive = model?.medical.filter((line) => !line.counted) ?? []

  return (
    <div className="report-screen">
      <div className="report-toolbar">
        <Link className="btn btn-ghost" to={id ? `/analysis/${id}` : '/analysis'}>
          返回保障分析
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
      {loading ? <p className="report-wait">正在整理說明…</p> : null}
      {!loading && !error && client && model ? (
        <article className="report-sheet">
          <header className="report-mast">
            <p className="report-brand">保冊</p>
            <div className="report-mast-row">
              <p className="report-kicker">Cover note</p>
              <p className="report-date">
                說明日期
                <strong>{formatDate(issuedOn)}</strong>
              </p>
            </div>
            <h1>保障現況說明</h1>
            <p className="report-person">{client.chineseName.trim() || client.englishName.trim() || '未命名客戶'}</p>
            {client.englishName.trim() && client.chineseName.trim() ? <p className="report-person-en">{client.englishName.trim()}</p> : null}
            <p className="report-contact-line">{[client.phone.trim() ? formatPhone(client.phone) : '', client.email.trim()].filter(Boolean).join(' · ')}</p>
          </header>

          <section>
            <h2>人壽、危疾、意外</h2>
            <div className="report-list">
              {model.blocks.map((block) => (
                <div key={block.type} className="report-row report-pair">
                  <span className="report-type">{block.label}</span>
                  <div>
                    <p>
                      現有 <strong>{block.currentText}</strong>
                    </p>
                    <p className="report-meta">
                      參考額 {block.referenceText} · {block.basis}
                    </p>
                    {block.foreignNote ? <p className="report-meta">{block.foreignNote}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2>醫療</h2>
            {counted.length === 0 ? <p className="report-empty">未有生效中或已繳清的醫療保單。</p> : null}
            {counted.map((line) => (
              <p key={line.id} className="life-report-item">
                <span>
                  {line.insurer} {line.policyName}
                  {line.policyNumber ? ` · ${line.policyNumber}` : ''}
                  <br />
                  <span className="report-meta">{line.detail}</span>
                </span>
              </p>
            ))}
            {inactive.length > 0 ? <p className="report-note">未計入的醫療保單</p> : null}
            {inactive.map((line) => (
              <p key={line.id} className="life-report-item">
                <span>
                  {line.insurer} {line.policyName}
                  <br />
                  <span className="report-meta">{line.detail}</span>
                </span>
              </p>
            ))}
          </section>

          {model.otherPolicyCount > 0 ? (
            <p className="report-note">另有 {model.otherPolicyCount} 張儲蓄、投資相連、年金或其他保單。這份說明沒有把它們的保障額算進上面三項。</p>
          ) : null}

          <footer className="report-foot">
            <p>
              收入倍數只作參考，並不是需要結論。人壽需要以人壽需要報告書的公式為準。港幣、美元和人民幣沒有兌換，外幣保障沒有從港幣參考額扣除。已失效和已退保的保單不計入現有保障。本說明供這位客戶查閱，並不取代保險合約。
            </p>
            <p>保冊 · {APP_VERSION}</p>
          </footer>
        </article>
      ) : null}
    </div>
  )
}

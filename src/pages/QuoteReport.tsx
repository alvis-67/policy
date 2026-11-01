import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { displayName, formatDate, formatPhone, todayISO } from '../lib/format'
import { quoteSlipView, type SavedQuote } from '../lib/quoteSlip'
import type { Client } from '../types'
import { APP_VERSION } from '../version'

export function QuoteReport() {
  const { id = '' } = useParams()
  const [client, setClient] = useState<Client | null>(null)
  const [quote, setQuote] = useState<SavedQuote | null>(null)
  const [ready, setReady] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const issuedOn = todayISO()

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([api.client(id), api.lifeQuote(id)])
      .then(([detail, saved]) => {
        if (!active) return
        setClient(detail.client)
        setQuote(saved.quote)
        setReady(saved.ready)
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
    document.title = client ? `${displayName(client)} 今次估算單 ${issuedOn}` : '今次估算單'
    return () => {
      document.title = previous
    }
  }, [client, issuedOn])

  const view = quote ? quoteSlipView(quote) : null

  return (
    <div className="report-screen">
      <div className="report-toolbar">
        <Link className="btn btn-ghost" to={id ? `/finance/${id}` : '/finance'}>
          返回理財分析
        </Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={loading || !!error || !view}>
          儲存為 PDF
        </button>
      </div>
      {error ? (
        <div className="error-banner report-banner" role="alert">
          {error}
        </div>
      ) : null}
      {loading ? <p className="report-wait">正在整理估算單…</p> : null}
      {!loading && !error && !ready ? <p className="report-wait">估算單尚未建立。請到 Supabase SQL Editor 執行 supabase/meeting.sql。</p> : null}
      {!loading && !error && ready && client && !view ? <p className="report-wait">尚未儲存今次估算。請在專業理財分析揀一條，再按列入今次估算單。</p> : null}
      {!loading && !error && client && view && quote ? (
        <article className="report-sheet">
          <header className="report-mast">
            <p className="report-brand">保冊</p>
            <div className="report-mast-row">
              <p className="report-kicker">Illustration note</p>
              <p className="report-date">
                估算日期
                <strong>{formatDate(quote.updatedAt.slice(0, 10) || issuedOn)}</strong>
              </p>
            </div>
            <h1>今次估算單</h1>
            <p className="report-person">{client.chineseName.trim() || client.englishName.trim() || '未命名客戶'}</p>
            {client.englishName.trim() && client.chineseName.trim() ? <p className="report-person-en">{client.englishName.trim()}</p> : null}
            <p className="report-contact-line">{[client.phone.trim() ? formatPhone(client.phone) : '', client.email.trim()].filter(Boolean).join(' · ')}</p>
          </header>
          <section>
            <h2>{view.title}</h2>
            <div className="report-list">
              {view.rows.map((row) => (
                <div key={row.label} className="report-row report-quote">
                  <span className="report-type">{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </section>
          <footer className="report-foot">
            {view.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
            <p>保冊 · {APP_VERSION}</p>
          </footer>
        </article>
      ) : null}
    </div>
  )
}

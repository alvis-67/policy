import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { ClientForm } from '../components/ClientForm'
import { Drawer } from '../components/Drawer'
import { EmptyState } from '../components/EmptyState'
import { MoneyText } from '../components/MoneyText'
import { PageHeader } from '../components/PageHeader'
import { calcAge, formatDate, formatPhone, nameInitial } from '../lib/format'
import type { ClientListItem } from '../types'

export function Clients() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [rows, setRows] = useState<ClientListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    document.title = '客戶 · 保冊'
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 200)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (searchParams.get('new') === '1') setCreating(true)
  }, [searchParams])

  useEffect(() => {
    let cancel = false
    setLoading(true)
    api
      .clients(debounced)
      .then((next) => {
        if (cancel) return
        setRows(next)
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
  }, [debounced, version])

  function closeCreate() {
    setCreating(false)
    if (searchParams.get('new') === '1') {
      const next = new URLSearchParams(searchParams)
      next.delete('new')
      setSearchParams(next, { replace: true })
    }
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="客戶"
        description="搜尋客戶，或新增客戶後再記錄其現有保單。"
        action={
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            新增客戶
          </button>
        }
      />
      <div className="toolbar">
        <div className="search">
          <input
            aria-label="搜尋客戶"
            placeholder="搜尋姓名、電話、保險公司或保單"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      {error ? (
        <div className="error-banner" role="alert">
          {error}
          <button type="button" className="linkish" style={{ marginLeft: '0.75rem' }} onClick={() => setVersion((value) => value + 1)}>
            再試一次
          </button>
        </div>
      ) : null}
      {loading && rows.length === 0 ? <p className="muted">載入中…</p> : null}
      {!loading && !error && rows.length === 0 && !debounced ? (
        <EmptyState
          title="尚未有客戶"
          body="先新增客戶的個人資料。儲存後可以立即加入這位客戶現有的保單。"
          action={
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              新增第一位客戶
            </button>
          }
        />
      ) : null}
      {!loading && !error && rows.length === 0 && debounced ? (
        <div className="card empty">
          <h2 className="section-title">找不到符合的客戶</h2>
          <p className="lede">可以試試其他姓名、電話、保險公司或保單號碼。</p>
        </div>
      ) : null}
      {rows.length > 0 ? (
        <div className="card scroll">
          <table className="sheet wide">
            <thead>
              <tr>
                <th>客戶</th>
                <th>電話</th>
                <th>年齡</th>
                <th>保單</th>
                <th>每年保費</th>
                <th>更新</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((client) => {
                const age = client.dateOfBirth ? calcAge(client.dateOfBirth) : null
                return (
                  <tr key={client.id} className="clickable" onClick={() => navigate(`/clients/${client.id}`)}>
                    <td>
                      <span className="row">
                        <span className="avatar sm">{nameInitial(client)}</span>
                        <span>
                          <Link className="name-link" to={`/clients/${client.id}`} onClick={(event) => event.stopPropagation()}>
                            {client.chineseName || client.englishName}
                          </Link>
                          {client.chineseName && client.englishName ? <span className="subline">{client.englishName}</span> : null}
                        </span>
                      </span>
                    </td>
                    <td className="num">{formatPhone(client.phone)}</td>
                    <td>{age == null ? <span className="muted">—</span> : `${age}歲`}</td>
                    <td>
                      <div className="num">{client.policyCount}</div>
                      {client.policyCount !== client.activeCount ? (
                        <div className="subline">{client.activeCount} 張計入保障</div>
                      ) : null}
                    </td>
                    <td>
                      <MoneyText bag={client.annualPremium} empty="—" />
                    </td>
                    <td>{formatDate(client.updatedAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {creating ? (
        <Drawer title="新增客戶" onClose={closeCreate}>
          <ClientForm
            onSubmit={async (input) => {
              const created = await api.createClient(input)
              navigate(`/clients/${created.id}`)
            }}
          />
        </Drawer>
      ) : null}
    </div>
  )
}

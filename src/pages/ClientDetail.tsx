import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { ClientForm } from '../components/ClientForm'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Drawer } from '../components/Drawer'
import { EmptyState } from '../components/EmptyState'
import { MoneyText } from '../components/MoneyText'
import { PolicyForm } from '../components/PolicyForm'
import { Stat } from '../components/Stat'
import { Toast } from '../components/Toast'
import { calcAge, displayName, formatDate, formatMoney, formatPhone, maskHkid, moneyParts, nameInitial, toAnnualPremium } from '../lib/format'
import { GENDER_OPTIONS, labelOf, MARITAL_OPTIONS, POLICY_STATUSES, POLICY_TYPES, PREMIUM_FREQUENCIES, PRIMARY_COVER_TYPES, ROOM_LEVELS } from '../lib/labels'
import type { Client, ClientDetailResponse, CoverageTypeStat, Policy, PolicyTotals } from '../types'

export function ClientDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [version, setVersion] = useState(0)
  const [data, setData] = useState<ClientDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [creatingPolicy, setCreatingPolicy] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null)
  const [pending, setPending] = useState<null | { type: 'client' } | { type: 'policy'; policy: Policy }>(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showId, setShowId] = useState(false)
  const toastTimer = useRef<number | null>(null)

  function flash(message: string) {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2400)
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  useEffect(() => {
    setEditing(false)
    setCreatingPolicy(false)
    setEditingPolicy(null)
    setPending(null)
    setShowId(false)
    window.scrollTo(0, 0)
  }, [id])

  useEffect(() => {
    let cancel = false
    setLoading(true)
    setError(null)
    api
      .client(id)
      .then((next) => {
        if (cancel) return
        setData(next)
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
  }, [id, version])

  useEffect(() => {
    if (data?.client.id === id) document.title = `${displayName(data.client)} · 保冊`
    return () => {
      document.title = '保冊 · 保單管理'
    }
  }, [data, id])

  async function confirmDelete() {
    if (!pending || !data) return
    setDeleting(true)
    try {
      if (pending.type === 'client') {
        await api.deleteClient(data.client.id)
        navigate('/clients')
        return
      }
      await api.deletePolicy(pending.policy.id)
      setPending(null)
      flash('已刪除保單')
      setVersion((value) => value + 1)
    } catch (reason) {
      setActionError(errorMessage(reason))
      setPending(null)
    } finally {
      setDeleting(false)
    }
  }

  if (!data || data.client.id !== id) {
    return (
      <div className="stack">
        {error ? (
          <>
            <div className="error-banner" role="alert">
              {error}
            </div>
            <Link className="back-link" to="/clients">
              ← 返回客戶
            </Link>
          </>
        ) : (
          <p className="muted">{loading ? '載入中…' : '找不到這位客戶'}</p>
        )}
      </div>
    )
  }

  const client = data.client
  const age = client.dateOfBirth ? calcAge(client.dateOfBirth) : null
  const identity = [
    client.gender ? labelOf(GENDER_OPTIONS, client.gender) : '',
    age != null ? `${age}歲` : '',
    client.maritalStatus ? labelOf(MARITAL_OPTIONS, client.maritalStatus) : '',
    client.dependents != null ? `受養 ${client.dependents} 人` : '',
  ].filter(Boolean)
  const missing = readinessHints(client, data.policies.length)
  const inactive = data.totals.policyCount - data.totals.activeCount
  const monthly = moneyParts(data.totals.monthlyEquivalent)

  return (
    <div className="stack-lg">
      <Link className="back-link" to="/clients">
        ← 客戶
      </Link>
      <div className="row-between">
        <div className="row">
          <span className="avatar">{nameInitial(client)}</span>
          <div>
            <h1 className="page-title">{client.chineseName || client.englishName || '未命名客戶'}</h1>
            {client.chineseName && client.englishName ? <p className="lede">{client.englishName}</p> : null}
            {identity.length > 0 ? <p className="subline">{identity.join(' · ')}</p> : null}
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
            編輯資料
          </button>
          <button type="button" className="btn btn-danger" onClick={() => setPending({ type: 'client' })}>
            刪除客戶
          </button>
        </div>
      </div>
      {actionError ? (
        <div className="error-banner" role="alert">
          {actionError}
        </div>
      ) : null}
      {missing.length > 0 ? (
        <div className="notice">要準確做保障分析，建議再補上：{missing.join('、')}。</div>
      ) : null}
      <section className="card pad">
        <h2 className="section-title">個人資料</h2>
        <dl className="profile-grid" style={{ marginTop: '1rem' }}>
          <div>
            <dt className="dt">電話</dt>
            <dd className="dd num">{formatPhone(client.phone)}</dd>
          </div>
          {client.email ? (
            <div>
              <dt className="dt">電郵</dt>
              <dd className="dd">{client.email}</dd>
            </div>
          ) : null}
          {client.dateOfBirth ? (
            <div>
              <dt className="dt">出生日期</dt>
              <dd className="dd">{age != null ? `${age}歲 · ${formatDate(client.dateOfBirth)}` : formatDate(client.dateOfBirth)}</dd>
            </div>
          ) : null}
          {client.occupation ? (
            <div>
              <dt className="dt">職業</dt>
              <dd className="dd">{client.occupation}</dd>
            </div>
          ) : null}
          {client.monthlyIncome != null ? (
            <div>
              <dt className="dt">每月收入</dt>
              <dd className="dd num">{formatMoney(client.monthlyIncome, 'HKD')}</dd>
            </div>
          ) : null}
          {client.hkid ? (
            <div>
              <dt className="dt">身份證號碼</dt>
              <dd className="dd">
                <span className="num">{showId ? client.hkid : maskHkid(client.hkid)}</span>
                <button type="button" className="linkish" style={{ marginLeft: '0.6rem' }} onClick={() => setShowId((value) => !value)}>
                  {showId ? '隱藏' : '顯示'}
                </button>
              </dd>
            </div>
          ) : null}
          {client.address ? (
            <div className="span-2">
              <dt className="dt">地址</dt>
              <dd className="dd">{client.address}</dd>
            </div>
          ) : null}
        </dl>
      </section>
      {client.notes ? (
        <section className="card pad">
          <h2 className="section-title">備註</h2>
          <p className="dd" style={{ whiteSpace: 'pre-wrap' }}>
            {client.notes}
          </p>
        </section>
      ) : null}
      {data.policies.length > 0 ? (
        <>
          <div className="grid-stats">
            <Stat label="保單">{data.totals.policyCount}</Stat>
            <Stat label="計入保障" hint="生效中及已繳清">
              {data.totals.activeCount}
            </Stat>
            <Stat label="每年保費" hint={monthly.length > 0 ? `折合每月 ${monthly.join(' · ')}` : '生效及已繳清保單'}>
              <MoneyText bag={data.totals.annualPremium} />
            </Stat>
          </div>
          <CoverCards totals={data.totals} />
        </>
      ) : null}
      <section className="stack">
        <div className="row-between">
          <h2 className="section-title">保單</h2>
          {data.policies.length > 0 ? (
            <button type="button" className="btn btn-primary" onClick={() => { setEditingPolicy(null); setCreatingPolicy(true) }}>
              新增保單
            </button>
          ) : null}
        </div>
        {inactive > 0 ? <p className="hint">有 {inactive} 張已失效或已退保，不計入保障額及保費。</p> : null}
        {data.policies.length === 0 ? (
          <EmptyState
            title="未有保單"
            body="記錄這位客戶現有的保單。保障額會按類別加總，方便你之後判斷保障是否足夠。"
            action={
              <button type="button" className="btn btn-primary" onClick={() => setCreatingPolicy(true)}>
                新增保單
              </button>
            }
          />
        ) : (
          <div className="card scroll">
            <table className="sheet wide">
              <thead>
                <tr>
                  <th>保險公司</th>
                  <th>保單</th>
                  <th>類別</th>
                  <th>保障</th>
                  <th>簽發日期</th>
                  <th>保費</th>
                  <th>狀態</th>
                  <th className="right"> </th>
                </tr>
              </thead>
              <tbody>
                {data.policies.map((policy) => {
                  const meta = [policy.policyNumber, policy.premiumTerm].filter(Boolean).join(' · ')
                  return (
                    <tr key={policy.id}>
                      <td>{policy.insurer}</td>
                      <td>
                        <div>{policy.policyName}</div>
                        {meta ? <div className="subline">{meta}</div> : null}
                      </td>
                      <td>{labelOf(POLICY_TYPES, policy.policyType)}</td>
                      <td className="num">{coverLabel(policy)}</td>
                      <td>{formatDate(policy.issueDate)}</td>
                      <td>
                        <div className="num">{formatMoney(policy.premiumAmount, policy.currency)}</div>
                        <div className="subline">
                          {labelOf(PREMIUM_FREQUENCIES, policy.premiumFrequency)}
                          {policy.premiumFrequency === 'monthly'
                            ? ` · 每年 ${formatMoney(toAnnualPremium(policy.premiumAmount, 'monthly'), policy.currency)}`
                            : ''}
                        </div>
                      </td>
                      <td>
                        <span className={`pill ${policy.status}`}>{labelOf(POLICY_STATUSES, policy.status)}</span>
                      </td>
                      <td className="right">
                        <div className="inline-actions">
                          <button type="button" className="linkish" onClick={() => { setCreatingPolicy(false); setEditingPolicy(policy) }}>
                            編輯
                          </button>
                          <button type="button" className="linkish danger" onClick={() => setPending({ type: 'policy', policy })}>
                            刪除
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing ? (
        <Drawer title="編輯客戶" onClose={() => setEditing(false)}>
          <ClientForm
            initial={client}
            onSubmit={async (input) => {
              await api.updateClient(client.id, input)
              setEditing(false)
              flash('已更新客戶資料')
              setVersion((value) => value + 1)
            }}
          />
        </Drawer>
      ) : null}
      {creatingPolicy || editingPolicy ? (
        <Drawer title={editingPolicy ? '編輯保單' : '新增保單'} onClose={() => { setCreatingPolicy(false); setEditingPolicy(null) }}>
          <PolicyForm
            key={editingPolicy?.id ?? 'new'}
            initial={editingPolicy}
            onSubmit={async (input) => {
              if (editingPolicy) await api.updatePolicy(editingPolicy.id, input)
              else await api.createPolicy(client.id, input)
              setCreatingPolicy(false)
              setEditingPolicy(null)
              flash(editingPolicy ? '已更新保單' : '已新增保單')
              setVersion((value) => value + 1)
            }}
          />
        </Drawer>
      ) : null}
      {pending ? (
        <ConfirmDialog
          title={pending.type === 'client' ? '刪除客戶' : '刪除保單'}
          body={
            pending.type === 'client'
              ? '會一併刪除這位客戶的全部保單紀錄，而且無法還原。'
              : `「${pending.policy.policyName}」會從紀錄中移除，無法還原。`
          }
          confirmLabel={pending.type === 'client' ? '刪除客戶' : '刪除保單'}
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => {
            if (!deleting) setPending(null)
          }}
        />
      ) : null}
      <Toast message={toast} />
    </div>
  )
}

function readinessHints(client: Client, policyCount: number) {
  const missing: string[] = []
  if (!client.dateOfBirth) missing.push('出生日期')
  if (client.monthlyIncome == null) missing.push('每月收入')
  if (client.dependents == null) missing.push('受養人數')
  if (policyCount === 0) missing.push('現有保單')
  return missing
}

function CoverCards({ totals }: { totals: PolicyTotals }) {
  const primary = POLICY_TYPES.filter((type) => PRIMARY_COVER_TYPES.includes(type.value))
  const secondary = POLICY_TYPES.filter((type) => !PRIMARY_COVER_TYPES.includes(type.value) && totals.byType[type.value].count > 0)
  return (
    <div className="stack">
      <div className="grid-cover">
        {primary.map((type) => (
          <CoverCard
            key={type.value}
            label={type.label}
            stat={totals.byType[type.value]}
            empty={type.value === 'medical' ? '按病房' : undefined}
          />
        ))}
      </div>
      {secondary.length > 0 ? (
        <div className="grid-cover">
          {secondary.map((type) => (
            <CoverCard key={type.value} label={type.label} stat={totals.byType[type.value]} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function coverLabel(policy: Policy) {
  if (policy.policyType !== 'medical') return policy.sumAssured == null ? '—' : formatMoney(policy.sumAssured, policy.currency)
  const parts = [
    policy.roomLevel ? labelOf(ROOM_LEVELS, policy.roomLevel) : '',
    policy.deductible == null ? '' : `自付費 ${formatMoney(policy.deductible, policy.currency)}`,
    policy.fullCover == null ? '' : policy.fullCover ? '全包賠償' : '非全包',
  ].filter(Boolean)
  if (parts.length > 0) return parts.join(' · ')
  return policy.sumAssured == null ? '—' : formatMoney(policy.sumAssured, policy.currency)
}

function CoverCard({ label, stat, empty }: { label: string; stat: CoverageTypeStat; empty?: string }) {
  return (
    <article className={stat.count ? 'card card-on pad' : 'card pad'}>
      <div className="dt">{label}</div>
      <div className="cover-value">
        <MoneyText bag={stat.sumAssured} empty={empty ?? (stat.count ? 'HK$0' : '未有')} />
      </div>
      <p className="hint">{stat.count ? `${stat.count} 張計入保障` : '未有紀錄'}</p>
    </article>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, errorMessage, type SavedLifePlan } from '../api'
import { EmptyState } from '../components/EmptyState'
import { Field } from '../components/Field'
import { PageHeader } from '../components/PageHeader'
import { calcAge, displayName, formatMoney, formatPhone, nameInitial } from '../lib/format'
import { GENDER_OPTIONS, labelOf, MARITAL_OPTIONS } from '../lib/labels'
import {
  calculateLifeNeed,
  draftFromPlan,
  emptyDraft,
  formatNeed,
  planHasInputs,
  previewDraft,
  supportYears,
  validateDraft,
  type LifeDraft,
  type LifeDraftItem,
  type LifeDraftMember,
  type LifeNeedResult,
  type LifeRole,
} from '../lib/lifeNeed'
import type { Client, Policy } from '../types'

const SQL_NOTICE = '請到 Supabase 的 SQL Editor 執行 supabase/life.sql。完成後就可以儲存這份分析。'

export function LifePlans() {
  const [clients, setClients] = useState<Client[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [plans, setPlans] = useState<SavedLifePlan[]>([])
  const [ready, setReady] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = '專業理財分析 · 保冊'
  }, [])

  useEffect(() => {
    let cancel = false
    setLoading(true)
    Promise.all([api.backup(), api.lifePlans()])
      .then(([book, saved]) => {
        if (cancel) return
        setClients(book.clients)
        setPolicies(book.policies)
        setPlans(saved.plans)
        setReady(saved.ready)
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

  const rows = clients
    .map((client) => {
      const plan = plans.find((item) => item.clientId === client.id) ?? null
      const ownPolicies = policies.filter((policy) => policy.clientId === client.id)
      const result = plan ? calculateLifeNeed(plan, ownPolicies) : null
      return { client, result }
    })
    .sort((a, b) => (b.result?.gap ?? -1) - (a.result?.gap ?? -1) || displayName(a.client).localeCompare(displayName(b.client), 'zh-HK'))

  return (
    <div className="stack-lg">
      <PageHeader title="專業理財分析" description="按家庭負擔、債務和現有資金，計出這位客人真正需要多少人壽保障。" />
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
      {!ready ? <section className="notice">{SQL_NOTICE}</section> : null}
      {loading ? <p className="muted">載入中…</p> : null}
      {!loading && !error && clients.length === 0 ? (
        <EmptyState
          title="尚未有客戶紀錄"
          body="新增客戶後，就可以為他計算人壽需要。"
          action={
            <Link className="btn btn-primary" to="/clients?new=1">
              新增客戶
            </Link>
          }
        />
      ) : null}
      {!loading && clients.length > 0 ? (
        <div className="card">
          {rows.map(({ client, result }) => (
            <Link key={client.id} className="list-row" to={`/finance/${client.id}`}>
              <span className="row">
                <span className="avatar sm">{nameInitial(client)}</span>
                <span>
                  <span className="name-link">{displayName(client)}</span>
                  <span className="subline">{result ? (result.gap > 0 ? '尚須補足人壽保障' : '現有資源已足夠') : '尚未開始分析'}</span>
                </span>
              </span>
              <span className="life-gap">{result ? (result.gap > 0 ? formatNeed(result.gap) : '已足夠') : '—'}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function LifePlanDetail() {
  const { id = '' } = useParams()
  const [client, setClient] = useState<Client | null>(null)
  const [policies, setPolicies] = useState<Policy[]>([])
  const [draft, setDraft] = useState<LifeDraft>(emptyDraft())
  const [ready, setReady] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    Promise.all([api.client(id), api.lifePlan(id)])
      .then(([detail, savedPlan]) => {
        if (cancel) return
        setClient(detail.client)
        setPolicies(detail.policies)
        setDraft(savedPlan.plan ? draftFromPlan(savedPlan.plan) : emptyDraft())
        setReady(savedPlan.ready)
        setSaved(savedPlan.plan != null)
        setDirty(false)
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
    document.title = client ? `${displayName(client)} · 專業理財分析` : '專業理財分析 · 保冊'
  }, [client])

  const preview = useMemo(() => previewDraft(draft), [draft])
  const result = useMemo(() => calculateLifeNeed(preview, policies), [preview, policies])

  function update(next: LifeDraft) {
    setDraft(next)
    setSaved(false)
    setDirty(true)
  }

  async function save() {
    if (!client) return
    const checked = validateDraft(draft)
    if ('error' in checked) {
      setError(checked.error)
      setSaved(false)
      return
    }
    setSaving(true)
    try {
      await api.saveLifePlan(client.id, checked.plan)
      setError(null)
      setSaved(true)
      setDirty(false)
    } catch (reason) {
      setError(errorMessage(reason))
      setSaved(false)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="muted">載入中…</p>
  if (error && !client) {
    return (
      <div className="stack">
        <div className="error-banner" role="alert">
          {error}
        </div>
        <Link className="back-link" to="/finance">
          ← 返回專業理財分析
        </Link>
      </div>
    )
  }
  if (!client) return null

  const age = client.dateOfBirth ? calcAge(client.dateOfBirth) : null
  const annual = client.monthlyIncome == null ? null : client.monthlyIncome * 12
  const children = draft.members.filter((member) => member.role === 'child')
  const parents = draft.members.filter((member) => member.role === 'parent')

  return (
    <div className="stack-lg">
      <Link className="back-link" to="/finance">
        ← 專業理財分析
      </Link>
      <PageHeader
        title={client.chineseName.trim() || client.englishName.trim() || '未命名客戶'}
        description={client.chineseName.trim() && client.englishName.trim() ? client.englishName.trim() : undefined}
        action={
          <div className="actions">
            <Link className="btn btn-ghost" to={`/clients/${client.id}`}>
              查看保單
            </Link>
            {dirty ? (
              <button type="button" className="btn btn-primary" onClick={() => setError('請先儲存分析，報告會用已儲存的內容。')}>
                匯出報告
              </button>
            ) : (
              <Link className="btn btn-primary" to={`/finance/${client.id}/report`}>
                匯出報告
              </Link>
            )}
          </div>
        }
      />
      {!ready ? <section className="notice">{SQL_NOTICE}</section> : null}
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
      <div className="life-layout">
        <div className="stack">
          <section className="card pad">
            <p className="life-kicker">
              <span>01</span>個人資料
            </p>
            <dl className="profile-grid" style={{ marginTop: '1rem' }}>
              <Info label="年齡" value={age == null ? '未有出生日期' : `${age}歲`} />
              <Info label="性別" value={client.gender ? labelOf(GENDER_OPTIONS, client.gender) : '未有'} />
              <Info label="婚姻" value={client.maritalStatus ? labelOf(MARITAL_OPTIONS, client.maritalStatus) : '未有'} />
              <Info label="職業" value={client.occupation.trim() || '未有'} />
              <Info label="電話" value={formatPhone(client.phone)} />
              <Info label="每年收入" value={annual == null ? '未有每月收入' : formatMoney(annual, 'HKD')} />
            </dl>
            <p className="hint" style={{ marginTop: '0.8rem' }}>
              年收入只作參考，不會加進人壽需要。家庭開支以每月照顧費為準。
            </p>
          </section>

          <section className="card pad stack">
            <div className="row-between">
              <p className="life-kicker">
                <span>02</span>子女
              </p>
              <button type="button" className="btn btn-ghost" onClick={() => update(addMember(draft, 'child'))}>
                加子女
              </button>
            </div>
            <p className="hint">0 歲照顧到 22 歲大學畢業。已滿 22 歲不再計照顧費。</p>
            {children.length === 0 ? <p className="muted">未有子女。</p> : null}
            {children.map((member) => (
              <MemberRow key={member.id} member={member} onChange={(next) => update(replaceMember(draft, next))} onRemove={() => update(removeMember(draft, member.id))} />
            ))}
          </section>

          <section className="card pad stack">
            <div className="row-between">
              <p className="life-kicker">
                <span>03</span>父母
              </p>
              <button type="button" className="btn btn-ghost" onClick={() => update(addMember(draft, 'parent'))}>
                加父母
              </button>
            </div>
            <Field label="兄弟姊妹人數" htmlFor="siblingCount" hint="連同客人自己。三兄弟就填 3，父母每月費用會除以 3。">
              <input
                id="siblingCount"
                inputMode="numeric"
                value={draft.siblingCount}
                onChange={(event) => update({ ...draft, siblingCount: event.target.value })}
              />
            </Field>
            <p className="hint">由現在照顧到 88 歲。</p>
            {parents.length === 0 ? <p className="muted">未有父母。</p> : null}
            {parents.map((member) => (
              <MemberRow key={member.id} member={member} onChange={(next) => update(replaceMember(draft, next))} onRemove={() => update(removeMember(draft, member.id))} />
            ))}
          </section>

          <MoneySection
            index="04"
            title="債務"
            hint="房貸、私人貸款等尚未還清的金額。"
            rows={draft.debts}
            presets={['房貸', '私人貸款']}
            onChange={(debts) => update({ ...draft, debts })}
          />
          <section className="card pad">
            <p className="life-kicker">
              <span>05</span>身後費用
            </p>
            <Field label="殯葬及其他一次過開支" htmlFor="funeralCost" hint="這筆費用會加進人壽需要。">
              <input
                id="funeralCost"
                inputMode="decimal"
                value={draft.funeralCost}
                placeholder="0"
                onChange={(event) => update({ ...draft, funeralCost: event.target.value })}
              />
            </Field>
          </section>
          <MoneySection
            index="06"
            title="現有資金"
            hint="現金、投資、強積金和儲蓄會從人壽需要扣除。"
            rows={draft.assets}
            presets={['現金', '投資', '強積金', '儲蓄']}
            onChange={(assets) => update({ ...draft, assets })}
          />
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
              {saving ? '儲存中…' : '儲存分析'}
            </button>
            {saved ? <span className="hint">已儲存</span> : null}
          </div>
        </div>
        <NeedResult result={result} started={planHasInputs(preview)} />
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="dt">{label}</dt>
      <dd className="dd">{value}</dd>
    </div>
  )
}

function MemberRow({ member, onChange, onRemove }: { member: LifeDraftMember; onChange: (member: LifeDraftMember) => void; onRemove: () => void }) {
  const age = /^\d+$/.test(member.age.trim()) ? Number(member.age) : null
  const years = age == null || age > 120 ? null : supportYears(member.role, age)
  return (
    <div className="life-row">
      <Field label="稱呼" htmlFor={`name-${member.id}`}>
        <input id={`name-${member.id}`} value={member.name} placeholder={member.role === 'child' ? '兒子' : '母親'} onChange={(event) => onChange({ ...member, name: event.target.value })} />
      </Field>
      <Field label="歲數" htmlFor={`age-${member.id}`}>
        <input id={`age-${member.id}`} inputMode="numeric" value={member.age} placeholder="0" onChange={(event) => onChange({ ...member, age: event.target.value })} />
      </Field>
      <Field label="每月照顧費" htmlFor={`cost-${member.id}`}>
        <input
          id={`cost-${member.id}`}
          inputMode="decimal"
          value={member.monthlyCost}
          placeholder="10000"
          onChange={(event) => onChange({ ...member, monthlyCost: event.target.value })}
        />
      </Field>
      <div className="life-row-side">
        <p className="hint">{years == null ? '填歲數後計年期' : `照顧 ${years} 年`}</p>
        <button type="button" className="linkish danger" onClick={onRemove}>
          移除
        </button>
      </div>
    </div>
  )
}

function MoneySection({
  index,
  title,
  hint,
  rows,
  presets,
  onChange,
}: {
  index: string
  title: string
  hint: string
  rows: LifeDraftItem[]
  presets: string[]
  onChange: (rows: LifeDraftItem[]) => void
}) {
  return (
    <section className="card pad stack">
      <div className="row-between">
        <p className="life-kicker">
          <span>{index}</span>
          {title}
        </p>
        <button type="button" className="btn btn-ghost" onClick={() => onChange([...rows, blankItem('')])}>
          加一項
        </button>
      </div>
      <p className="hint">{hint}</p>
      <div className="actions" style={{ justifyContent: 'flex-start' }}>
        {presets.map((name) => (
          <button key={name} type="button" className="btn btn-ghost" onClick={() => onChange([...rows, { ...blankItem(name), name }])}>
            {name}
          </button>
        ))}
      </div>
      {rows.length === 0 ? <p className="muted">尚未加入。</p> : null}
      {rows.map((row) => (
        <div key={row.id} className="life-money">
          <Field label="名稱" htmlFor={`item-name-${row.id}`}>
            <input id={`item-name-${row.id}`} value={row.name} onChange={(event) => onChange(rows.map((item) => (item.id === row.id ? { ...item, name: event.target.value } : item)))} />
          </Field>
          <Field label="金額" htmlFor={`item-amount-${row.id}`}>
            <input
              id={`item-amount-${row.id}`}
              inputMode="decimal"
              value={row.amount}
              placeholder="0"
              onChange={(event) => onChange(rows.map((item) => (item.id === row.id ? { ...item, amount: event.target.value } : item)))}
            />
          </Field>
          <button type="button" className="linkish danger" onClick={() => onChange(rows.filter((item) => item.id !== row.id))}>
            移除
          </button>
        </div>
      ))}
    </section>
  )
}

function NeedResult({ result, started }: { result: LifeNeedResult; started: boolean }) {
  const shortfall = Math.max(0, result.gap)
  const shown = useAnimatedAmount(shortfall)
  const covered = result.assetTotal + result.lifeHkd
  const ratio = result.grossNeed > 0 ? Math.min(1, covered / result.grossNeed) : 0
  return (
    <aside className="life-result">
      <div className="life-result-head">
        <p className="dt">尚欠人壽保障</p>
        <p className="life-total">{formatNeed(shown)}</p>
        {result.gap < 0 ? <p className="hint">現有資金和人壽多於需要 {formatNeed(-result.gap)}。</p> : null}
        {!started ? <p className="hint">填上照顧費、債務或資金後，這個數字會即時更新。</p> : <p className="hint">現有資源已覆蓋需要的 {Math.round(ratio * 100)}%。</p>}
        <div className="life-meter" aria-hidden="true">
          <span style={{ width: `${Math.round(ratio * 100)}%` }} />
        </div>
      </div>
      <div className="life-result-body">
        <dl className="analysis-facts">
          <Fact label="子女照顧" value={formatNeed(result.childTotal)} />
          <Fact label="父母照顧" value={formatNeed(result.parentTotal)} />
          <Fact label="債務" value={formatNeed(result.debtTotal)} />
          <Fact label="身後費用" value={formatNeed(result.funeralCost)} />
          <Fact label="需要合計" value={formatNeed(result.grossNeed)} />
          <Fact label="現有資金" value={formatNeed(result.assetTotal)} />
          <Fact label="現有人壽" value={`${formatNeed(result.lifeHkd)} · ${result.lifeCount} 張`} />
        </dl>
        {result.foreignLife ? <p className="hint">另有{result.foreignLife}人壽，沒有兌換，亦沒有從港幣差額扣除。</p> : null}
      </div>
    </aside>
  )
}

function useAnimatedAmount(value: number) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = value
      setShown(value)
      return
    }
    const start = from.current
    const began = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - began) / 680)
      const eased = 1 - (1 - progress) ** 3
      setShown(Math.round(start + (value - start) * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
      else from.current = value
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return shown
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function addMember(draft: LifeDraft, role: LifeRole): LifeDraft {
  return { ...draft, members: [...draft.members, { id: newId(), role, name: '', age: '', monthlyCost: '' }] }
}

function replaceMember(draft: LifeDraft, member: LifeDraftMember): LifeDraft {
  return { ...draft, members: draft.members.map((item) => (item.id === member.id ? member : item)) }
}

function removeMember(draft: LifeDraft, id: string): LifeDraft {
  return { ...draft, members: draft.members.filter((item) => item.id !== id) }
}

function blankItem(name: string): LifeDraftItem {
  return { id: newId(), name, amount: '' }
}

function newId() {
  return crypto.randomUUID()
}

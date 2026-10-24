import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, errorMessage, type SavedLifePlan } from '../api'
import { EmptyState } from '../components/EmptyState'
import { Field } from '../components/Field'
import { PageHeader } from '../components/PageHeader'
import { calcAge, displayName, formatMoney, formatPhone, nameInitial } from '../lib/format'
import { amountCaret, formatAmountInput, parseOptionalNumber } from '../lib/parse'
import { GENDER_OPTIONS, labelOf, MARITAL_OPTIONS } from '../lib/labels'
import { coverExtendsPast75, documentsForProduct, suggestManulifeLife, type LifePick } from '../lib/lifeProduct'
import { coverForBudget, premiumToFill, termPlansForAge, type TermSex } from '../lib/manutermQuote'
import { usdCover, usdFill, usdSkip, type UsdTerm } from '../lib/usdQuote'
import { listManulifeDocuments, openManulifeDocument, type ManulifeDocument } from '../lib/manulifeFiles'
import {
  calculateLifeNeed,
  draftFromPlan,
  emptyDraft,
  formatNeed,
  planHasInputs,
  previewDraft,
  validateDraft,
  yearsUntil,
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
  const [files, setFiles] = useState<ManulifeDocument[]>([])
  const [smoker, setSmoker] = useState(false)
  const [budget, setBudget] = useState('')
  const [payTerm, setPayTerm] = useState<UsdTerm>(10)
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

  useEffect(() => {
    let cancel = false
    listManulifeDocuments()
      .then((result) => {
        if (!cancel) setFiles(result.documents.filter((row) => row.policyType === 'life'))
      })
      .catch(() => {
        if (!cancel) setFiles([])
      })
    return () => {
      cancel = true
    }
  }, [])

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
            <Field label="照顧至幾歲" htmlFor="childUntil" hint="預設 22 歲，一般是大學畢業。每月只計生活費，供樓餘額請放在債務。歲數需每年更新一次。">
              <input id="childUntil" inputMode="numeric" value={draft.childUntil} onChange={(event) => update({ ...draft, childUntil: event.target.value })} />
            </Field>
            {children.length === 0 ? <p className="muted">未有子女。</p> : null}
            {children.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                until={shownUntil(draft.childUntil, 22, 1, 40)}
                onChange={(next) => update(replaceMember(draft, next))}
                onRemove={() => update(removeMember(draft, member.id))}
              />
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
            <Field label="照顧至幾歲" htmlFor="parentUntil" hint="預設 88 歲。每月只計生活費，供樓餘額請放在債務。歲數需每年更新一次。">
              <input id="parentUntil" inputMode="numeric" value={draft.parentUntil} onChange={(event) => update({ ...draft, parentUntil: event.target.value })} />
            </Field>
            {parents.length === 0 ? <p className="muted">未有父母。</p> : null}
            {parents.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                until={shownUntil(draft.parentUntil, 88, 50, 120)}
                onChange={(next) => update(replaceMember(draft, next))}
                onRemove={() => update(removeMember(draft, member.id))}
              />
            ))}
          </section>

          <section className="card pad stack">
            <p className="life-kicker">
              <span>04</span>配偶
            </p>
            <p className="hint">可留空。只填配偶每月仍短缺的生活費，不要填客人的全部收入。</p>
            <div className="life-row">
              <Field label="歲數" htmlFor="spouseAge">
                <input id="spouseAge" inputMode="numeric" value={draft.spouseAge} placeholder="40" onChange={(event) => update({ ...draft, spouseAge: event.target.value })} />
              </Field>
              <Field label="每月短缺" htmlFor="spouseMonthly">
                <input
                  id="spouseMonthly"
                  inputMode="decimal"
                  value={draft.spouseMonthly}
                  placeholder="15,000"
                  onChange={(event) => onAmount(event, (spouseMonthly) => update({ ...draft, spouseMonthly }))}
                />
              </Field>
              <Field label="照顧至幾歲" htmlFor="spouseUntil">
                <input id="spouseUntil" inputMode="numeric" value={draft.spouseUntil} placeholder="65" onChange={(event) => update({ ...draft, spouseUntil: event.target.value })} />
              </Field>
            </div>
          </section>

          <MoneySection
            index="05"
            title="債務"
            hint="房貸、私人貸款等尚未還清的金額。"
            rows={draft.debts}
            presets={['房貸', '私人貸款']}
            onChange={(debts) => update({ ...draft, debts })}
          />
          <section className="card pad">
            <p className="life-kicker">
              <span>06</span>身後費用
            </p>
            <Field label="殯葬及其他一次過開支" htmlFor="funeralCost" hint="這筆費用會加進人壽需要。">
              <input
                id="funeralCost"
                inputMode="decimal"
                value={draft.funeralCost}
                placeholder="0"
                onChange={(event) => onAmount(event, (funeralCost) => update({ ...draft, funeralCost }))}
              />
            </Field>
          </section>
          <MoneySection
            index="07"
            title="現有資金"
            hint="現金、投資、強積金和儲蓄會用來扣減人壽需要。儲蓄保單和投資相連不會自動扣除。"
            rows={draft.assets}
            presets={['現金', '投資', '強積金', '儲蓄']}
            onChange={(assets) => update({ ...draft, assets })}
            extra={
              <Field label="保留應急資金" htmlFor="reserveAmount" hint="預設 0。這筆錢留在家裡，不會從人壽需要扣除。">
                <input
                  id="reserveAmount"
                  inputMode="decimal"
                  value={draft.reserveAmount}
                  placeholder="0"
                  onChange={(event) => onAmount(event, (reserveAmount) => update({ ...draft, reserveAmount }))}
                />
              </Field>
            }
          />
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
              {saving ? '儲存中…' : '儲存分析'}
            </button>
            {saved ? <span className="hint">已儲存</span> : null}
          </div>
        </div>
        <NeedResult
          result={result}
          started={planHasInputs(preview)}
          rateText={draft.inflationRate}
          onRate={(inflationRate) => update({ ...draft, inflationRate })}
          age={age}
          sex={client.gender === 'male' || client.gender === 'female' ? client.gender : ''}
          smoker={smoker}
          onSmoker={setSmoker}
          budget={budget}
          onBudget={setBudget}
          payTerm={payTerm}
          onPayTerm={setPayTerm}
        />
      </div>
      <ManulifePicks
        suggestion={suggestManulifeLife({
          age,
          gap: result.gap,
          coverPast75: coverExtendsPast75(age, preview),
        })}
        files={files}
        onOpen={(path) => {
          openManulifeDocument(path).catch((reason) => setError(errorMessage(reason)))
        }}
      />
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

function MemberRow({
  member,
  until,
  onChange,
  onRemove,
}: {
  member: LifeDraftMember
  until: number
  onChange: (member: LifeDraftMember) => void
  onRemove: () => void
}) {
  const age = /^\d+$/.test(member.age.trim()) ? Number(member.age) : null
  const years = age == null || age > 120 ? null : yearsUntil(age, until)
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
          placeholder="10,000"
          onChange={(event) => onAmount(event, (monthlyCost) => onChange({ ...member, monthlyCost }))}
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
  extra,
  onChange,
}: {
  index: string
  title: string
  hint: string
  rows: LifeDraftItem[]
  presets: string[]
  extra?: ReactNode
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
      {extra}
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
              onChange={(event) => onAmount(event, (amount) => onChange(rows.map((item) => (item.id === row.id ? { ...item, amount } : item))))}
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

function NeedResult({
  result,
  started,
  rateText,
  onRate,
  age,
  sex,
  smoker,
  onSmoker,
  budget,
  onBudget,
  payTerm,
  onPayTerm,
}: {
  result: LifeNeedResult
  started: boolean
  rateText: string
  onRate: (rate: string) => void
  age: number | null
  sex: TermSex | ''
  smoker: boolean
  onSmoker: (smoker: boolean) => void
  budget: string
  onBudget: (budget: string) => void
  payTerm: UsdTerm
  onPayTerm: (term: UsdTerm) => void
}) {
  const shortfall = Math.max(0, result.gap)
  const shown = useAnimatedAmount(shortfall)
  const covered = result.deductibleAssets + result.lifeHkd
  const ratio = result.grossNeed > 0 ? Math.min(1, covered / result.grossNeed) : 0
  const extra = Math.max(0, result.gap - result.gapWithoutInflation)
  return (
    <aside className="life-result">
      <div className="life-result-head">
        <p className="dt">尚欠人壽保障</p>
        <p className="life-total">{formatNeed(shown)}</p>
        {result.gap < 0 ? <p className="hint">現有資金和人壽多於需要 {formatNeed(-result.gap)}。</p> : null}
        {!started ? <p className="hint">填上照顧費、債務或資金後，這個數字會即時更新。</p> : <p className="hint">現有資源已覆蓋需要的 {Math.round(ratio * 100)}%。</p>}
        {result.inflationRate > 0 ? (
          <p className="hint">
            通脹 0% 時尚欠 {formatNeed(Math.max(0, result.gapWithoutInflation))}，每年 {result.inflationRate}% 令需要多 {formatNeed(extra)}。
          </p>
        ) : (
          <p className="hint">照顧費未計通脹。可試 1%、2%、3%。</p>
        )}
        <div className="life-rates">
          {['0', '1', '2', '3'].map((rate) => (
            <button key={rate} type="button" className={Number(rateText || '0') === Number(rate) ? 'is-on' : ''} onClick={() => onRate(rate)}>
              {rate}%
            </button>
          ))}
          <input aria-label="每年通脹" inputMode="decimal" value={rateText} onChange={(event) => onRate(event.target.value)} />
        </div>
        <div className="life-meter" aria-hidden="true">
          <span style={{ width: `${Math.round(ratio * 100)}%` }} />
        </div>
      </div>
      <div className="life-result-body">
        <dl className="analysis-facts">
          <Fact label="子女照顧" value={formatNeed(result.childTotal)} />
          <Fact label="父母照顧" value={formatNeed(result.parentTotal)} />
          <Fact label="配偶生活" value={formatNeed(result.spouseTotal)} />
          <Fact label="債務" value={formatNeed(result.debtTotal)} />
          <Fact label="身後費用" value={formatNeed(result.funeralCost)} />
          <Fact label="需要合計" value={formatNeed(result.grossNeed)} />
          <Fact label="現有資金" value={formatNeed(result.assetTotal)} />
          <Fact label="保留應急" value={formatNeed(result.reserveAmount)} />
          <Fact label="現有人壽" value={`${formatNeed(result.lifeHkd)} · ${result.lifeCount} 張`} />
        </dl>
        {result.foreignLife ? <p className="hint">另有{result.foreignLife}人壽，沒有兌換，亦沒有從港幣差額扣除。</p> : null}
      </div>
      <TermEstimate
        age={age}
        sex={sex}
        smoker={smoker}
        onSmoker={onSmoker}
        budget={budget}
        onBudget={onBudget}
        gap={result.gap}
        started={started}
        payTerm={payTerm}
        onPayTerm={onPayTerm}
      />
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

function ManulifePicks({
  suggestion,
  files,
  onOpen,
}: {
  suggestion: { lead: string; picks: LifePick[] }
  files: ManulifeDocument[]
  onOpen: (path: string) => void
}) {
  return (
    <section className="card pad stack life-picks">
      <p className="life-kicker">
        <span>08</span>可以考慮的宏利人壽
      </p>
      <p className="hint">{suggestion.lead}</p>
      {suggestion.picks.length === 0 ? null : (
        <div className="life-pick-list">
          {suggestion.picks.map((pick) => {
            const docs = documentsForProduct(pick.name, files)
            return (
              <article key={pick.name} className="life-pick">
                <p className="life-pick-fit">{pick.fit}</p>
                <h3>{pick.name}</h3>
                <p>{pick.reason}</p>
                {docs.length > 0 ? (
                  <div className="actions">
                    {docs.map((doc) => (
                      <button key={doc.id} type="button" className="btn btn-ghost" onClick={() => onOpen(doc.storagePath)}>
                        {fileLabel(doc)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="hint">尚未上傳這款的小冊子或保費率表。</p>
                )}
              </article>
            )
          })}
        </div>
      )}
      <p className="hint">最終購買由顧問判斷。精選定期壽險的港幣估算，以及美元計劃按 HKD 8 = USD 1 的換算，見上方。</p>
    </section>
  )
}

function fileLabel(doc: ManulifeDocument) {
  const name = doc.fileName
  if (/手冊|小冊/.test(name)) return '小冊子'
  if (/保費|率表/.test(name)) return '保費率表'
  return doc.fileKind === 'brochure' ? '小冊子' : '保費率表'
}

function TermEstimate({
  age,
  sex,
  smoker,
  onSmoker,
  budget,
  onBudget,
  gap,
  started,
  payTerm,
  onPayTerm,
}: {
  age: number | null
  sex: TermSex | ''
  smoker: boolean
  onSmoker: (smoker: boolean) => void
  budget: string
  onBudget: (budget: string) => void
  gap: number
  started: boolean
  payTerm: UsdTerm
  onPayTerm: (term: UsdTerm) => void
}) {
  const plans = age == null || sex === '' ? [] : termPlansForAge(age)
  const parsedBudget = parseOptionalNumber(budget)
  return (
    <div className="life-quote">
      <p className="dt">精選定期壽險 · 港幣</p>
      <div className="life-quote-choices">
        <button type="button" className={!smoker ? 'is-on' : ''} onClick={() => onSmoker(false)}>
          非吸煙
        </button>
        <button type="button" className={smoker ? 'is-on' : ''} onClick={() => onSmoker(true)}>
          吸煙
        </button>
      </div>
      {age == null || sex === '' ? (
        <p className="hint">客戶資料未有出生日期或性別，未能用率表估算。</p>
      ) : plans.length === 0 ? (
        <p className="hint">投保年齡是 16 至 65 歲，這位客人未能用這張率表估算。</p>
      ) : !started || gap <= 0 ? (
        <p className="hint">{started ? '缺口已經補上，不必為填補差額而計保費。' : '填上照顧費、債務或資金後，這裡會算出填補缺口的每年保費。'}</p>
      ) : (
        plans.map((plan) => {
          const fill = premiumToFill({ age, sex, smoker, plan, gap })
          if (!fill) return null
          return (
            <div key={plan} className="life-quote-plan">
              <p className="life-quote-name">{plan === 10 ? '10 年水平保費' : '20 年水平保費'}</p>
              <p className="life-quote-label">填補缺口每年</p>
              <p className="life-total">{formatNeed(fill.premium)}</p>
              <p className="hint">
                保額 {formatNeed(fill.sumAssured)} · 組別 {fill.band} · 每 1,000 保費率 {fill.rate.toFixed(2)}
                {fill.raisedToMinimumSum ? '。缺口少於最低保額 320,000，以上按最低保額計算。' : ''}
                {fill.raisedToMinimumPremium ? '。低於最低每年保費 800，以上按 800 計算。' : ''}
              </p>
            </div>
          )
        })
      )}
      <Field label="每年預算" htmlFor="lifeBudget" hint="用來估算這個預算可以買到幾大保額。">
        <input id="lifeBudget" inputMode="decimal" value={budget} placeholder="30,000" onChange={(event) => onAmount(event, onBudget)} />
      </Field>
      {plans.length > 0 && parsedBudget === 'invalid' ? <p className="hint">請輸入有效的每年預算。</p> : null}
      {age != null && sex !== '' && plans.length > 0 && typeof parsedBudget === 'number' ? (
        <BudgetCoverLines age={age} sex={sex} smoker={smoker} budget={parsedBudget} plans={plans} />
      ) : null}
      <p className="hint">率表是港幣，2024 年 1 月。已加每年保單費 200。只計首段水平保費，之後續保未計。</p>
      <UsdPlans age={age} sex={sex} smoker={smoker} budget={parsedBudget} gap={gap} started={started} payTerm={payTerm} onPayTerm={onPayTerm} />
      <p className="hint">匯率固定為 HKD 8 = USD 1。美元名義金額是港幣金額除以 8。優越終身保的分期保費另加每年保單費 25 美元。盈傳用標準風險級別、居住地編碼 A。卓越終身保未有自己的保費率表。最終保費以建議書為準。</p>
    </div>
  )
}

function UsdPlans({
  age,
  sex,
  smoker,
  budget,
  gap,
  started,
  payTerm,
  onPayTerm,
}: {
  age: number | null
  sex: TermSex | ''
  smoker: boolean
  budget: number | 'invalid' | null
  gap: number
  started: boolean
  payTerm: UsdTerm
  onPayTerm: (term: UsdTerm) => void
}) {
  const terms: UsdTerm[] = [10, 20, 25, 5, 'single']
  const ready = age != null && sex !== ''
  return (
    <div className="life-quote-usd">
      <p className="dt">美元終身計劃</p>
      <div className="life-quote-choices">
        {terms.map((term) => (
          <button key={term} type="button" className={payTerm === term ? 'is-on' : ''} onClick={() => onPayTerm(term)}>
            {term === 'single' ? '整付' : `${term} 年`}
          </button>
        ))}
      </div>
      {!ready ? <p className="hint">客戶資料未有出生日期或性別，未能用率表估算。</p> : null}
      {ready && (!started || gap <= 0) ? (
        <p className="hint">{started ? '缺口已經補上，不必為填補差額而計保費。' : '填上照顧費、債務或資金後，這裡會算出填補缺口的保費。'}</p>
      ) : null}
      {ready
        ? (['youyue', 'yingchuan'] as const).map((product) => {
            const name = product === 'youyue' ? '優越終身保' : '盈傳創富保障計劃 3'
            const skip = usdSkip(product, payTerm, age, smoker)
            const fill = !skip && started && gap > 0 ? usdFill({ product, term: payTerm, age, sex, smoker, hkdGap: gap }) : null
            const cover = !skip && payTerm !== 'single' && typeof budget === 'number' ? usdCover({ product, term: payTerm, age, sex, smoker, hkdBudget: budget }) : null
            if (skip && (!started || gap <= 0) && typeof budget !== 'number') return null
            return (
              <div key={product} className="life-quote-plan">
                <p className="life-quote-name">
                  {name} · {payTerm === 'single' ? '整付' : `${payTerm} 年繳`}
                </p>
                {skip ? <p className="hint">{usdSkipText(skip)}</p> : null}
                {fill ? (
                  <>
                    <p className="life-quote-label">{payTerm === 'single' ? '填補缺口一次過' : '填補缺口每年'}</p>
                    <p className="life-total">{formatNeed(fill.premiumHkd)}</p>
                    <p className="hint">
                      {formatMoney(fill.premiumUsd, 'USD')} · 名義金額 {formatMoney(fill.usdNotional, 'USD')}
                      {fill.band ? ` · 組別 ${fill.band}` : ' · 標準風險級別'} · 每 1,000 保費率 {fill.rate.toFixed(2)}
                      {fill.raisedToMinimumSum ? `。換成美元後少於最低名義金額，以上按 ${formatMoney(fill.usdNotional, 'USD')} 計算。` : ''}
                      {fill.raisedToMinimumPremium ? '。低於最低每年保費 160 美元，以上按這個下限計算。' : ''}
                    </p>
                  </>
                ) : null}
                {cover ? (
                  <p className="hint">
                    每年預算可買名義金額 {formatMoney(cover.usdNotional, 'USD')}（約 {formatNeed(cover.hkdNotional)}），每年保費 {formatNeed(cover.premiumHkd)}（{formatMoney(cover.premiumUsd, 'USD')}）
                    {cover.band ? `，組別 ${cover.band}` : ''}。
                  </p>
                ) : null}
                {!skip && payTerm !== 'single' && typeof budget === 'number' && !cover ? <p className="hint">這個預算未夠買最低名義金額。</p> : null}
              </div>
            )
          })
        : null}
      {payTerm === 'single' ? <p className="hint">整付是一次過保費。每年預算不會用來估算整付保額。</p> : null}
    </div>
  )
}

function usdSkipText(skip: 'term' | 'age' | 'juvenile-smoker') {
  if (skip === 'term') return '這款沒有這個繳付期。'
  if (skip === 'age') return '這個繳付期不適用這位客人的年齡。'
  return '0 至 17 歲只適用標準非吸煙，未能按吸煙計算。'
}

function BudgetCoverLines({
  age,
  sex,
  smoker,
  budget,
  plans,
}: {
  age: number
  sex: TermSex
  smoker: boolean
  budget: number
  plans: Array<10 | 20>
}) {
  const covers = plans.map((plan) => ({ plan, cover: coverForBudget({ age, sex, smoker, plan, budget }) }))
  if (covers.every((item) => item.cover == null)) {
    return <p className="hint">{budget < 800 ? '每年預算低於最低保費 800。' : '這個預算未夠買最低保額 320,000。'}</p>
  }
  return (
    <>
      {covers.map(({ plan, cover }) => (
        <p key={plan} className="hint">
          {cover
            ? `${plan} 年水平保費：可買保額 ${formatNeed(cover.sumAssured)}，每年保費 ${formatNeed(cover.premium)}，組別 ${cover.band}。`
            : `${plan} 年水平保費：這個預算未夠買最低保額 320,000。`}
        </p>
      ))}
    </>
  )
}

function onAmount(event: ChangeEvent<HTMLInputElement>, apply: (value: string) => void) {
  const formatted = formatAmountInput(event.target.value)
  const caret = amountCaret(event.target.value, formatted, event.target.selectionStart ?? formatted.length)
  const input = event.target
  apply(formatted)
  requestAnimationFrame(() => input.setSelectionRange(caret, caret))
}

function shownUntil(raw: string, fallback: number, min: number, max: number) {
  if (!/^\d+$/.test(raw.trim())) return fallback
  const value = Number(raw)
  return value < min || value > max ? fallback : value
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

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { calcAge, displayName, formatDate, formatMoney, formatPhone, todayISO } from '../lib/format'
import { GENDER_OPTIONS, MARITAL_OPTIONS, countsAsCover, labelOf } from '../lib/labels'
import { calculateLifeNeed, formatNeed, type LifeNeedResult, type LifePlanInput } from '../lib/lifeNeed'
import type { Client, Policy } from '../types'
import { APP_VERSION } from '../version'

const EMPTY_PLAN: LifePlanInput = {
  funeralCost: 0,
  siblingCount: 1,
  inflationRate: 0,
  childUntil: 22,
  parentUntil: 88,
  reserveAmount: 0,
  spouse: null,
  members: [],
  debts: [],
  assets: [],
}

export function LifeReport() {
  const { id = '' } = useParams()
  const [client, setClient] = useState<Client | null>(null)
  const [policies, setPolicies] = useState<Policy[]>([])
  const [plan, setPlan] = useState<LifePlanInput>(EMPTY_PLAN)
  const [hasPlan, setHasPlan] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const issuedOn = todayISO()

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([api.client(id), api.lifePlan(id)])
      .then(([detail, saved]) => {
        if (!active) return
        setClient(detail.client)
        setPolicies(detail.policies)
        setPlan(saved.plan ?? EMPTY_PLAN)
        setHasPlan(saved.plan != null)
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
    document.title = client ? `${displayName(client)} 人壽需要報告書 ${issuedOn}` : '人壽需要報告書'
    return () => {
      document.title = previous
    }
  }, [client, issuedOn])

  const result = calculateLifeNeed(plan, policies)
  const age = client?.dateOfBirth ? calcAge(client.dateOfBirth) : null
  const annual = client?.monthlyIncome == null ? null : (client?.monthlyIncome ?? 0) * 12
  const lifePolicies = policies.filter((policy) => policy.policyType === 'life' && countsAsCover(policy.status))

  return (
    <div className="report-screen">
      <div className="report-toolbar">
        <Link className="btn btn-ghost" to={id ? `/finance/${id}` : '/finance'}>
          返回分析
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
      {!loading && !error && client ? (
        <article className="report-sheet">
          <header className="report-mast">
            <div className="report-mast-row">
              <p className="report-kicker">Life Needs Analysis</p>
              <p className="report-date">
                報告日期
                <strong>{formatDate(issuedOn)}</strong>
              </p>
            </div>
            <h1>人壽需要報告書</h1>
            <p className="report-person">{client.chineseName.trim() || client.englishName.trim() || '未命名客戶'}</p>
            {client.englishName.trim() && client.chineseName.trim() ? <p className="report-person-en">{client.englishName.trim()}</p> : null}
            <p className="report-contact-line">
              {[
                client.gender ? labelOf(GENDER_OPTIONS, client.gender) : '',
                age == null ? '' : `${age}歲`,
                client.maritalStatus ? labelOf(MARITAL_OPTIONS, client.maritalStatus) : '',
                client.occupation.trim(),
                client.phone.trim() ? formatPhone(client.phone) : '',
                annual == null ? '' : `每年收入 ${formatMoney(annual, 'HKD')}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </header>

          <section className="life-report-conclusion">
            <p>尚欠人壽保障</p>
            <strong>{formatNeed(Math.max(0, result.gap))}</strong>
            {result.gap < 0 ? <span>現有資金和人壽多於需要 {formatNeed(-result.gap)}</span> : <span>扣除現有資金及生效人壽後，仍須補足的保障。</span>}
            {result.inflationRate > 0 ? (
              <span>
                照顧費按每年 {result.inflationRate}% 通脹計算。通脹為 0% 時尚欠 {formatNeed(Math.max(0, result.gapWithoutInflation))}，現多{' '}
                {formatNeed(Math.max(0, result.gap - result.gapWithoutInflation))}。
              </span>
            ) : (
              <span>照顧費未計通脹。</span>
            )}
          </section>

          {!hasPlan ? <p className="report-note">尚未儲存家庭負擔、債務或資金。以下只反映現有人壽。</p> : null}

          <section>
            <h2>需要與扣減</h2>
            <div className="report-list">
              <Waterfall result={result} />
            </div>
          </section>

          {result.lines.length > 0 ? (
            <section>
              <h2>家庭負擔</h2>
              <div className="report-list">
                <div className="report-row report-row-head">
                  <span>對象</span>
                  <span>照顧</span>
                  <span>每月</span>
                  <span>金額</span>
                </div>
                {result.lines.map((line) => (
                  <div key={line.id} className="report-row">
                    <span>
                    {line.role === 'child' ? '子女' : line.role === 'parent' ? '父母' : '配偶'}
                    {line.role === 'spouse' ? '' : line.name ? ` ${line.name}` : ''}
                    </span>
                    <span>
                      {line.age}歲 · {line.years} 年{line.role === 'parent' ? ` · ${line.share} 人分擔` : ''}
                    </span>
                    <span>{formatNeed(line.monthlyCost)}</span>
                    <span>{formatNeed(line.amount)}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {plan.debts.length > 0 || plan.assets.length > 0 ? (
            <section className="life-report-split">
              <div>
                <h2>債務</h2>
                {plan.debts.length === 0 ? <p className="report-empty">未有債務。</p> : null}
                {plan.debts.map((item) => (
                  <p key={item.id} className="life-report-item">
                    <span>{item.name}</span>
                    <strong>{formatNeed(item.amount)}</strong>
                  </p>
                ))}
              </div>
              <div>
                <h2>現有資金</h2>
                {plan.assets.length === 0 ? <p className="report-empty">未有資金。</p> : null}
                {plan.assets.map((item) => (
                  <p key={item.id} className="life-report-item">
                    <span>{item.name}</span>
                    <strong>{formatNeed(item.amount)}</strong>
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h2>已計入的人壽</h2>
            {lifePolicies.length === 0 ? <p className="report-empty">未有生效中或已繳清的人壽。</p> : null}
            {lifePolicies.map((policy) => (
              <p key={policy.id} className="life-report-item">
                <span>
                  {policy.insurer} {policy.policyName}
                </span>
                <strong>{policy.sumAssured == null ? '—' : formatMoney(policy.sumAssured, policy.currency)}</strong>
              </p>
            ))}
          </section>

          <footer className="report-foot">
            <p>
              子女照顧至 {plan.childUntil} 歲，父母照顧至 {plan.parentUntil} 歲。配偶按所填歲數計算每月仍短缺的生活費。每月照顧費只計生活費，供樓餘額放在債務。父母費用按兄弟姊妹人數分擔，人數連同本人。保留應急資金留在家裡，不從需要扣除。通脹只加在照顧費，沒有假設賠償金有投資回報。年收入只作參考。港幣、美元和人民幣沒有兌換，外幣人壽沒有從港幣差額扣除。已失效和已退保的保單不計。歲數需每年更新。
            </p>
            <p>本報告書根據已儲存的分析編製，供這位客戶查閱，並不取代保險合約。保冊 · {APP_VERSION}</p>
          </footer>
        </article>
      ) : null}
    </div>
  )
}

function Waterfall({ result }: { result: LifeNeedResult }) {
  const rows = [
    ['子女照顧', result.childTotal, false],
    ['父母照顧', result.parentTotal, false],
    ['配偶生活', result.spouseTotal, false],
    ['債務', result.debtTotal, false],
    ['身後費用', result.funeralCost, false],
    ['需要合計', result.grossNeed, false],
    ['現有資金', result.deductibleAssets, true],
    [`現有人壽 · ${result.lifeCount} 張`, result.lifeHkd, true],
  ] as const
  return (
    <>
      {rows.map(([label, amount, minus]) => (
        <div key={label} className={minus ? 'report-row life-report-minus' : label === '需要合計' ? 'report-row life-report-sum' : 'report-row'}>
          <span className="life-report-label">{minus ? `減 ${label}` : label}</span>
          <strong>{formatNeed(amount)}</strong>
        </div>
      ))}
      <div className="life-report-gap">
        <span>尚欠人壽</span>
        <strong>{formatNeed(Math.max(0, result.gap))}</strong>
      </div>
      {result.reserveAmount > 0 ? (
        <p className="report-note">
          現有資金 {formatNeed(result.assetTotal)}，已保留應急 {formatNeed(result.reserveAmount)}，用以扣減 {formatNeed(result.deductibleAssets)}。
        </p>
      ) : null}
      {result.foreignLife ? <p className="report-note">另有{result.foreignLife}人壽，沒有從上面的港幣差額扣除。</p> : null}
    </>
  )
}

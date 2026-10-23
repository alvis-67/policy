import { useState, type ChangeEvent, type FormEvent } from 'react'
import { formatMoney } from '../lib/format'
import { amountCaret, formatAmountInput, parseOptionalNumber } from '../lib/parse'
import { calculateRetirement, retirementError, type RetirementResult } from '../lib/retirement'

export function Retirement() {
  const [currentAge, setCurrentAge] = useState(35)
  const [retireAge, setRetireAge] = useState(65)
  const [monthlyExpense, setMonthlyExpense] = useState(20000)
  const [mpfWan, setMpfWan] = useState('30')
  const [mpfMonthly, setMpfMonthly] = useState('3,000')
  const [otherWan, setOtherWan] = useState('50')
  const [untilAge, setUntilAge] = useState('90')
  const [inflation, setInflation] = useState('3')
  const [returnBefore, setReturnBefore] = useState('5')
  const [returnAfter, setReturnAfter] = useState('3')
  const [ratio, setRatio] = useState('100')
  const [error, setError] = useState('')
  const [result, setResult] = useState<RetirementResult | null>(null)
  const [used, setUsed] = useState({ untilAge: '90', inflation: '3', returnBefore: '5', returnAfter: '3', ratio: '100' })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const mpfBalance = readWan(mpfWan)
    const monthly = parseOptionalNumber(mpfMonthly)
    const other = readWan(otherWan)
    const until = readNumber(untilAge, true)
    const inflationRate = readNumber(inflation, false)
    const before = readNumber(returnBefore, false)
    const after = readNumber(returnAfter, false)
    const expenseRatio = readNumber(ratio, false)
    if (mpfBalance == null || monthly === 'invalid' || other == null || until == null || inflationRate == null || before == null || after == null || expenseRatio == null) {
      setError('請檢查金額同進階假設。')
      setResult(null)
      return
    }
    const input = {
      currentAge,
      retireAge,
      monthlyExpense,
      mpfBalance,
      mpfMonthly: monthly ?? 0,
      otherAssets: other,
      untilAge: until,
      inflationRate,
      returnBefore: before,
      returnAfter: after,
      expenseRatio,
    }
    const problem = retirementError(input)
    if (problem) {
      setError(problem)
      setResult(null)
      return
    }
    setError('')
    setUsed({ untilAge, inflation, returnBefore, returnAfter, ratio })
    setResult(calculateRetirement(input))
  }

  const covered = result && result.capitalNeeded > 0 ? Math.min(100, Math.round((result.assetsFuture / result.capitalNeeded) * 100)) : result ? 100 : 0

  return (
    <div className="retire">
      <header className="retire-hero">
        <div className="retire-wrap">
          <p className="retire-brand">
            <LeafIcon />
            退休規劃計算器
          </p>
          <h1>30秒知你夠唔夠退休</h1>
          <p>專業認可退休顧問為你計算</p>
        </div>
      </header>
      <form className="retire-card" onSubmit={onSubmit}>
        <h2>
          <FormIcon />
          輸入你嘅資料
        </h2>
        <Slider
          label="現時年齡"
          value={currentAge}
          min={20}
          max={70}
          step={1}
          display={`${currentAge}歲`}
          minLabel="20歲"
          maxLabel="70歲"
          onChange={setCurrentAge}
        />
        <Slider
          label="目標退休年齡"
          value={retireAge}
          min={50}
          max={75}
          step={1}
          display={`${retireAge}歲`}
          minLabel="50歲"
          maxLabel="75歲"
          onChange={setRetireAge}
        />
        <Slider
          label="現時每月基本開支（包括住屋、飲食、交通、娛樂等）"
          value={monthlyExpense}
          min={5000}
          max={80000}
          step={1000}
          display={formatMoney(monthlyExpense, 'HKD')}
          minLabel="HK$5,000"
          maxLabel="HK$80,000"
          onChange={setMonthlyExpense}
        />
        <div className="retire-split">
          <MoneyField label="現時 MPF 結餘" value={mpfWan} suffix="萬" onChange={setMpfWan} />
          <MoneyField label="每月 MPF 總供款" value={mpfMonthly} prefix="$" hint="自己+公司" onChange={setMpfMonthly} />
        </div>
        <MoneyField label="現有現金 / 投資儲備" value={otherWan} suffix="萬" hint="股票、基金、定存等" onChange={setOtherWan} />
        <details className="retire-advanced">
          <summary>進階假設參數</summary>
          <div className="retire-advanced-grid">
            <label>
              計算至幾歲
              <input inputMode="numeric" value={untilAge} onChange={(event) => setUntilAge(event.target.value.replace(/[^\d]/g, '').slice(0, 3))} />
            </label>
            <label>
              每年通脹 %
              <input inputMode="decimal" value={inflation} onChange={(event) => setInflation(event.target.value)} />
            </label>
            <label>
              退休前回報 %
              <input inputMode="decimal" value={returnBefore} onChange={(event) => setReturnBefore(event.target.value)} />
            </label>
            <label>
              退休後回報 %
              <input inputMode="decimal" value={returnAfter} onChange={(event) => setReturnAfter(event.target.value)} />
            </label>
            <label>
              退休開支比例 %
              <input inputMode="decimal" value={ratio} onChange={(event) => setRatio(event.target.value)} />
            </label>
          </div>
          <p className="retire-hint">預設計到 90 歲、通脹 3%、退休前 5%、退休後 3%。開支比例 100 表示退休後維持現時基本開支，供完樓可以調低。</p>
        </details>
        {error ? <p className="retire-error">{error}</p> : null}
        <button type="submit" className="retire-go">
          立即計算我嘅退休缺口 →
        </button>
        {result ? <Result result={result} covered={covered} untilAge={used.untilAge} inflation={used.inflation} returnBefore={used.returnBefore} returnAfter={used.returnAfter} ratio={used.ratio} /> : null}
      </form>
      <footer className="retire-foot">
        <strong>Alvis Yau</strong>
        <p>資深保險經紀 | 認可退休顧問 (QRA)</p>
        <p>保險經紀牌照號碼：IE8956</p>
        <p>
          <a href="tel:+85292259485">9225 9485</a>
        </p>
      </footer>
    </div>
  )
}

function Result({
  result,
  covered,
  untilAge,
  inflation,
  returnBefore,
  returnAfter,
  ratio,
}: {
  result: RetirementResult
  covered: number
  untilAge: string
  inflation: string
  returnBefore: string
  returnAfter: string
  ratio: string
}) {
  const enough = result.gap <= 0
  return (
    <section id="retire-result" className={enough ? 'retire-result enough' : 'retire-result'} aria-live="polite">
      <p className="retire-kicker">{enough ? '預計足夠' : '退休缺口'}</p>
      <p className="retire-gap num">{formatMoney(enough ? result.surplus : result.gap, 'HKD')}</p>
      <p className="retire-gap-note">
        {enough ? `滾存到退休後仍然多出這筆錢。計 ${result.yearsInRetirement} 年，至 ${untilAge} 歲。` : `距離退休還有 ${result.yearsToRetire} 年。現有資金只覆蓋需要的 ${covered}%。`}
      </p>
      <div className="retire-meter" aria-hidden="true">
        <span style={{ width: `${covered}%` }} />
      </div>
      <dl>
        <div>
          <dt>退休第一年每月開支</dt>
          <dd className="num">{formatMoney(result.monthlyAtRetirement, 'HKD')}</dd>
        </div>
        <div>
          <dt>退休時需要準備</dt>
          <dd className="num">{formatMoney(result.capitalNeeded, 'HKD')}</dd>
        </div>
        <div>
          <dt>預計強積金</dt>
          <dd className="num">{formatMoney(result.mpfFuture, 'HKD')}</dd>
        </div>
        <div>
          <dt>預計現金及投資</dt>
          <dd className="num">{formatMoney(result.otherFuture, 'HKD')}</dd>
        </div>
      </dl>
      {!enough && result.monthlyTopUp != null ? (
        <p className="retire-topup">
          若每月再儲 <strong className="num">{formatMoney(result.monthlyTopUp, 'HKD')}</strong>，按退休前回報滾存，可以補上缺口。
        </p>
      ) : null}
      {!enough && result.monthlyTopUp == null ? <p className="retire-topup">已經到退休年齡，這筆缺口要現在準備。</p> : null}
      <p className="retire-hint">
        開支按通脹 {inflation}% 計到退休，之後繼續上升，直到 {untilAge} 歲。強積金同現有投資按退休前 {returnBefore}% 滾存，退休後用 {returnAfter}% 支付開支。退休開支是現時基本開支的 {ratio}%。保單現金價值未自動計入，要計的話請加進現有現金／投資儲備。
      </p>
    </section>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  minLabel,
  maxLabel,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  minLabel: string
  maxLabel: string
  onChange: (value: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="retire-slider">
      <div className="retire-slider-head">
        <span>{label}</span>
        <strong className="num">{display}</strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={display}
        style={{ ['--pct' as string]: `${pct}%` }}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="retire-scale">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  )
}

function MoneyField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  prefix?: string
  suffix?: string
  hint?: string
}) {
  function onInput(event: ChangeEvent<HTMLInputElement>) {
    const formatted = formatAmountInput(event.target.value)
    const caret = amountCaret(event.target.value, formatted, event.target.selectionStart ?? formatted.length)
    const input = event.target
    onChange(formatted)
    requestAnimationFrame(() => input.setSelectionRange(caret, caret))
  }

  return (
    <label className="retire-money">
      <span>{label}</span>
      <span className="retire-box">
        {prefix ? <span className="retire-affix">{prefix}</span> : null}
        <input inputMode="decimal" value={value} onChange={onInput} />
        {suffix ? <span className="retire-affix">{suffix}</span> : null}
      </span>
      {hint ? <small>{hint}</small> : null}
    </label>
  )
}

function readWan(raw: string) {
  const value = parseOptionalNumber(raw)
  if (value === 'invalid') return null
  return (value ?? 0) * 10000
}

function readNumber(raw: string, integer: boolean) {
  const value = parseOptionalNumber(raw, integer)
  if (value == null || value === 'invalid') return null
  return value
}

function LeafIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4 13.5C8.5 13 13.2 9.2 14.2 3.2 8.4 4.2 4.6 8.4 4 13.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M4 13.5c2.2-2.4 4.6-4 7.2-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function FormIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="3" y="2.2" width="12" height="13.6" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 6.2h6M6 9h6M6 11.8h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

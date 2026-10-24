import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { formatMoney } from '../lib/format'
import { amountCaret, formatAmountInput, parseOptionalNumber } from '../lib/parse'
import { assetSeries, calculateRetirement, retirementError, type RetirementInput, type RetirementResult } from '../lib/retirement'

const RATE_PRESETS = ['0', '1', '2', '3']

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

  const parsed = useMemo(
    () =>
      readInput({
        currentAge,
        retireAge,
        monthlyExpense,
        mpfWan,
        mpfMonthly,
        otherWan,
        untilAge,
        inflation,
        returnBefore,
        returnAfter,
        ratio,
      }),
    [currentAge, retireAge, monthlyExpense, mpfWan, mpfMonthly, otherWan, untilAge, inflation, returnBefore, returnAfter, ratio],
  )
  const held = useRef<Snapshot | null>(null)
  if (parsed.input) held.current = snapshot(parsed.input)
  const view = held.current

  return (
    <div className="retire">
      <div className="retire-frame">
        <header className="retire-intro">
          <div>
            <p className="retire-eyebrow">退休計算器</p>
            <h1>缺口會跟住資料走</h1>
          </div>
          <p>拖動年齡、開支同資產，左邊嘅數字同曲線會即時郁。保單現金價值未自動計入。</p>
        </header>
        <div className="retire-studio">
          {view ? <Stage view={view} /> : <section className="retire-stage" />}
          <section className="retire-controls">
            <div className="retire-block">
              <h2>時間</h2>
              <Slider label="現時年齡" value={currentAge} min={20} max={70} step={1} display={`${currentAge}歲`} onChange={setCurrentAge} />
              <Slider label="目標退休年齡" value={retireAge} min={50} max={75} step={1} display={`${retireAge}歲`} onChange={setRetireAge} />
            </div>
            <div className="retire-block">
              <h2>生活</h2>
              <Slider
                label="每月基本開支"
                hint="住屋、飲食、交通、娛樂"
                value={monthlyExpense}
                min={5000}
                max={80000}
                step={1000}
                display={formatMoney(monthlyExpense, 'HKD')}
                onChange={setMonthlyExpense}
              />
            </div>
            <div className="retire-block">
              <h2>已經有的錢</h2>
              <div className="retire-funds">
                <MoneyField label="強積金結餘" value={mpfWan} suffix="萬" onChange={setMpfWan} />
                <MoneyField label="每月供款" value={mpfMonthly} prefix="$" hint="自己及公司" onChange={setMpfMonthly} />
                <MoneyField label="現金及投資" value={otherWan} suffix="萬" hint="股票、基金、定存" onChange={setOtherWan} />
              </div>
            </div>
            <details className="retire-block retire-advanced">
              <summary>假設</summary>
              <div className="retire-rates" role="group" aria-label="每年通脹">
                {RATE_PRESETS.map((rate) => (
                  <button key={rate} type="button" className={Number(inflation || '0') === Number(rate) ? 'is-on' : ''} onClick={() => setInflation(rate)}>
                    通脹 {rate}%
                  </button>
                ))}
              </div>
              <div className="retire-advanced-grid">
                <label>
                  計算至幾歲
                  <input inputMode="numeric" value={untilAge} onChange={(event) => setUntilAge(event.target.value.replace(/[^\d]/g, '').slice(0, 3))} />
                </label>
                <label>
                  通脹 %
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
                  開支比例 %
                  <input inputMode="decimal" value={ratio} onChange={(event) => setRatio(event.target.value)} />
                </label>
              </div>
              <p className="retire-note">100% 表示退休後維持現時開支。供完樓可以調低。預設計到 90 歲，退休前 5%，退休後 3%。</p>
            </details>
            {parsed.error ? <p className="retire-error">{parsed.error}</p> : null}
            {view ? <Explain view={view} /> : null}
          </section>
        </div>
        <footer className="retire-sign">
          <strong>Alvis Yau</strong>
          <span>資深保險經紀 · 認可退休顧問 (QRA)</span>
          <span>牌照 IE8956</span>
          <a href="tel:+85292259485">9225 9485</a>
        </footer>
      </div>
    </div>
  )
}

function Stage({ view }: { view: Snapshot }) {
  const { result, series, input } = view
  const enough = result.gap <= 0
  const shown = useAnimatedAmount(enough ? result.surplus : result.gap)
  const covered = result.capitalNeeded > 0 ? Math.min(100, Math.round((result.assetsFuture / result.capitalNeeded) * 100)) : 100
  const topUp = !enough && result.monthlyTopUp != null ? formatMoney(result.monthlyTopUp, 'HKD') : enough ? '不用再儲' : '現在準備'
  return (
    <section className={enough ? 'retire-stage is-enough' : 'retire-stage'} aria-live="polite">
      <div className="retire-stage-top">
        <div>
          <p className="retire-eyebrow">{enough ? '預計仍有餘額' : '尚欠退休資金'}</p>
          <p className="retire-figure num">{formatMoney(shown, 'HKD')}</p>
          <p className="retire-lead">
            {enough
              ? `滾存到 ${input.retireAge} 歲後仍然多出這筆錢，並計至 ${input.untilAge} 歲。`
              : `還有 ${result.yearsToRetire} 年。現有資金覆蓋需要的 ${covered}%。`}
          </p>
        </div>
        <Ring percent={covered} />
      </div>
      <GrowthChart series={series} target={result.capitalNeeded} />
      <div className="retire-journey" aria-hidden="true">
        <span>
          <b>{input.currentAge}</b>
          現在
        </span>
        <i />
        <span>
          <b>{input.retireAge}</b>
          退休
        </span>
        <i />
        <span>
          <b>{input.untilAge}</b>
          規劃至
        </span>
      </div>
      <div className="retire-metrics">
        <Metric label="退休時需要" value={formatMoney(result.capitalNeeded, 'HKD')} />
        <Metric label="預計可動用" value={formatMoney(result.assetsFuture, 'HKD')} />
        <Metric label="每月再準備" value={topUp} />
      </div>
    </section>
  )
}

function Explain({ view }: { view: Snapshot }) {
  const { input, result } = view
  const money = (amount: number) => formatMoney(amount, 'HKD')
  const ratioNote = input.expenseRatio === 100 ? '' : `退休後只計現時開支嘅 ${input.expenseRatio}%。`
  const spending =
    result.yearsToRetire <= 0
      ? `已經到目標退休年齡，每月開支大約係 ${money(result.monthlyAtRetirement)}。${ratioNote}`
      : input.inflationRate <= 0
        ? `而家每月開支 ${money(input.monthlyExpense)}。未計通脹，去到 ${input.retireAge} 歲，第一年每月仍然大約係 ${money(result.monthlyAtRetirement)}。${ratioNote}`
        : `而家每月開支 ${money(input.monthlyExpense)}。未來 ${result.yearsToRetire} 年，物價每年上升 ${input.inflationRate}%，去到 ${input.retireAge} 歲，第一年每月大約要 ${money(result.monthlyAtRetirement)}。${ratioNote}`
  const nest =
    input.inflationRate <= 0 && input.returnAfter <= 0
      ? `由 ${input.retireAge} 歲用到 ${input.untilAge} 歲，一共 ${result.yearsInRetirement} 年。開支冇再上升，亦未計退休後回報，所以退休當日要準備 ${money(result.capitalNeeded)}。`
      : input.inflationRate <= 0
        ? `由 ${input.retireAge} 歲用到 ${input.untilAge} 歲，一共 ${result.yearsInRetirement} 年。開支冇再上升，呢筆錢假設仲有每年 ${input.returnAfter}% 回報，所以退休當日要準備 ${money(result.capitalNeeded)}。`
        : `由 ${input.retireAge} 歲用到 ${input.untilAge} 歲，一共 ${result.yearsInRetirement} 年。每年開支會再跟隨通脹上升，呢筆錢假設仲有每年 ${input.returnAfter}% 回報，所以退休當日要準備 ${money(result.capitalNeeded)}。`
  const saved =
    result.yearsToRetire <= 0
      ? `已經到退休年齡，而家可動用大約 ${money(result.assetsFuture)}。`
      : `強積金同現金投資，由而家滾到 ${input.retireAge} 歲，每年 ${input.returnBefore}%。到退休大約有 ${money(result.assetsFuture)}。金線就係呢段滾存，虛線就係要準備嘅數。`
  const answer =
    result.gap > 0 && result.monthlyTopUp != null
      ? `${money(result.capitalNeeded)} 減去 ${money(result.assetsFuture)}，尚欠 ${money(result.gap)}。如果由而家開始每月再儲 ${money(result.monthlyTopUp)}，用同一個回報滾存，就可以補上。`
      : result.gap > 0
        ? `${money(result.capitalNeeded)} 減去 ${money(result.assetsFuture)}，尚欠 ${money(result.gap)}。已經到退休年齡，呢筆錢要而家準備。`
        : `滾存後嘅錢多過需要，所以仲有 ${money(result.surplus)}，唔使再額外儲。`
  const steps = [
    ['開支會升', spending],
    ['要用到幾多歲', nest],
    ['而家嘅錢會變多', saved],
    ['一減就係缺口', answer],
  ]
  return (
    <section className="retire-explain">
      <h2>點樣計出嚟</h2>
      <ol>
        {steps.map(([title, text], index) => (
          <li key={title}>
            <span>{index + 1}</span>
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="retire-note">保單現金價值未計入。想計埋，加落「現金及投資」。</p>
    </section>
  )
}

function Ring({ percent }: { percent: number }) {
  const radius = 46
  const girth = 2 * Math.PI * radius
  return (
    <div className="retire-ring" aria-hidden="true">
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} className="retire-ring-track" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          className="retire-ring-value"
          strokeDasharray={girth}
          strokeDashoffset={girth * (1 - percent / 100)}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div>
        <strong className="num">{percent}%</strong>
        <span>已覆蓋</span>
      </div>
    </div>
  )
}

function GrowthChart({ series, target }: { series: number[]; target: number }) {
  const width = 640
  const height = 168
  const pad = 10
  const max = Math.max(target, ...series, 1)
  const plot = width - pad * 2
  const step = series.length > 1 ? plot / (series.length - 1) : 0
  const yOf = (value: number) => height - 16 - (value / max) * (height - 32)
  const coords = series.map((value, index) => [pad + index * step, yOf(value)] as const)
  const line = coords.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const last = coords[coords.length - 1] ?? [pad, yOf(0)]
  const area = `${line} L${last[0].toFixed(1)} ${height} L${pad} ${height} Z`
  return (
    <figure className="retire-chart">
      <figcaption>
        <span>預計資產</span>
        <span>退休時需要</span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="由現在滾存到退休的資產曲線">
        <line x1={pad} y1={yOf(target)} x2={width - pad} y2={yOf(target)} className="retire-target" />
        <path d={area} className="retire-area" />
        <path d={line} className="retire-line" />
        <circle cx={last[0]} cy={last[1]} r="6" className="retire-dot" />
      </svg>
    </figure>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong className="num">{value}</strong>
    </div>
  )
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (value: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <label className="retire-slider">
      <span className="retire-slider-head">
        <span>
          {label}
          {hint ? <small>{hint}</small> : null}
        </span>
        <strong className="num">{display}</strong>
      </span>
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
    </label>
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
        {prefix ? <em>{prefix}</em> : null}
        <input inputMode="decimal" value={value} onChange={onInput} />
        {suffix ? <em>{suffix}</em> : null}
      </span>
      {hint ? <small>{hint}</small> : <small />}
    </label>
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
      const progress = Math.min(1, (now - began) / 720)
      const eased = 1 - (1 - progress) ** 3
      const next = Math.round(start + (value - start) * eased)
      setShown(next)
      if (progress < 1) frame = requestAnimationFrame(tick)
      else from.current = value
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return shown
}

type Snapshot = { input: RetirementInput; result: RetirementResult; series: number[] }

function snapshot(input: RetirementInput): Snapshot {
  return { input, result: calculateRetirement(input), series: assetSeries(input) }
}

function readInput(fields: {
  currentAge: number
  retireAge: number
  monthlyExpense: number
  mpfWan: string
  mpfMonthly: string
  otherWan: string
  untilAge: string
  inflation: string
  returnBefore: string
  returnAfter: string
  ratio: string
}): { input: RetirementInput | null; error: string } {
  const mpfBalance = readWan(fields.mpfWan)
  const monthly = parseOptionalNumber(fields.mpfMonthly)
  const other = readWan(fields.otherWan)
  const until = readLoose(fields.untilAge, true)
  const inflationRate = readLoose(fields.inflation, false)
  const before = readLoose(fields.returnBefore, false)
  const after = readLoose(fields.returnAfter, false)
  const expenseRatio = readLoose(fields.ratio, false)
  if (mpfBalance == null || monthly === 'invalid' || other == null || until == null || inflationRate == null || before == null || after == null || expenseRatio == null) {
    return { input: null, error: '請檢查金額同假設。' }
  }
  const input: RetirementInput = {
    currentAge: fields.currentAge,
    retireAge: fields.retireAge,
    monthlyExpense: fields.monthlyExpense,
    mpfBalance,
    mpfMonthly: monthly ?? 0,
    otherAssets: other,
    untilAge: until,
    inflationRate,
    returnBefore: before,
    returnAfter: after,
    expenseRatio,
  }
  return { input: retirementError(input) ? null : input, error: retirementError(input) ?? '' }
}

function readWan(raw: string) {
  const value = parseOptionalNumber(raw.replace(/\.$/, ''))
  if (value === 'invalid') return null
  return (value ?? 0) * 10000
}

function readLoose(raw: string, integer: boolean) {
  const value = parseOptionalNumber(raw.trim().replace(/\.$/, ''), integer)
  if (value == null || value === 'invalid') return null
  return value
}

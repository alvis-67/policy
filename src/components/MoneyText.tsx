import { moneyParts, type MoneyBag } from '../lib/format'

export function MoneyText({ bag, empty = '—' }: { bag: MoneyBag; empty?: string }) {
  const parts = moneyParts(bag)
  if (parts.length === 0) return <span className="muted">{empty}</span>
  return <span className="num">{parts.join(' · ')}</span>
}

import type { ReactNode } from 'react'

export function Stat({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card stat">
      <h2 className="dt">{label}</h2>
      <div className="stat-value num">{children}</div>
      {hint ? <p className="hint block">{hint}</p> : null}
    </section>
  )
}

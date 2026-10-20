import type { ReactNode } from 'react'

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card dashed empty">
      <h2 className="section-title">{title}</h2>
      <p className="lede">{body}</p>
      {action ? <div className="action">{action}</div> : null}
    </div>
  )
}

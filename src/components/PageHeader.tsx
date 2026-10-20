import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="header-row">
      <div>
        <h1 className="page-title">{title}</h1>
        {description ? <p className="lede">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

import { useEffect, useRef, type ReactNode } from 'react'

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="drawer-root">
      <button type="button" className="backdrop" aria-label="關閉" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header>
          <h2 id="drawer-title" className="section-title">
            {title}
          </h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            關閉
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  )
}

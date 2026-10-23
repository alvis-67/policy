import { NavLink, Outlet } from 'react-router-dom'
import { api } from '../api'
import { supabase } from '../lib/supabase'
import { todayISO } from '../lib/format'
import { APP_VERSION } from '../version'

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'nav-link active' : 'nav-link'
}

export function Layout() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brass-bar" />
        <NavLink to="/" className="brand" end>
          <span className="brand-mark">保</span>
          <span>
            <span className="brand-name">保冊</span>
            <span className="brand-sub">保單管理 · {APP_VERSION}</span>
          </span>
        </NavLink>
        <nav className="nav" aria-label="主要">
          <NavLink to="/" end className={navClass}>
            <GridIcon />
            總覽
          </NavLink>
          <NavLink to="/clients" className={navClass}>
            <PersonIcon />
            客戶
          </NavLink>
          <NavLink to="/catalog" className={navClass}>
            <ListIcon />
            名稱
          </NavLink>
          <NavLink to="/analysis" className={navClass}>
            <ScaleIcon />
            保障分析
          </NavLink>
          <NavLink to="/finance" className={navClass}>
            <PlanIcon />
            專業理財分析
          </NavLink>
          <NavLink to="/retirement" className={navClass}>
            <RetireIcon />
            退休計算器
          </NavLink>
        </nav>
        <div className="sidebar-note">
          <p>只有已登入的帳號可以查看資料，資料存放在 Supabase。</p>
          <p className="block sidebar-actions">
            <button type="button" onClick={() => void downloadBackup()}>
              下載備份
            </button>
            <button type="button" onClick={() => void supabase.auth.signOut()}>
              登出
            </button>
          </p>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}

async function downloadBackup() {
  try {
    const book = await api.backup()
    const blob = new Blob([JSON.stringify(book, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `policy-backup-${todayISO()}.json`
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '下載備份失敗')
  }
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5 3.5h8.5M5 8h8.5M5 12.5h8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="2.4" cy="3.5" r="0.8" fill="currentColor" />
      <circle cx="2.4" cy="8" r="0.8" fill="currentColor" />
      <circle cx="2.4" cy="12.5" r="0.8" fill="currentColor" />
    </svg>
  )
}

function PlanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.2" y="1.6" width="11.6" height="12.8" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.6 5h6.8M4.6 8h6.8M4.6 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function ScaleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.2v11.2M3.2 13.4h9.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 3.6 3.4 6.2M8 3.6l4.6 2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2.2 6.2h2.4l-1.2 2.6-1.2-2.6ZM11.4 6.2h2.4L12.6 8.8l-1.2-2.6Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

function RetireIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.8V8l2.1 1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3.2 13.2c.7-2.2 2.4-3.3 4.8-3.3s4.1 1.1 4.8 3.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

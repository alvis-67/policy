import { NavLink, Outlet } from 'react-router-dom'
import { api } from '../api'
import { supabase } from '../lib/supabase'
import { todayISO } from '../lib/format'

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
            <span className="brand-sub">保單管理</span>
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
          <div className="soon" title="即將推出，會使用同一套客戶及保單資料">
            <span>保障分析</span>
            <span className="tag">即將推出</span>
          </div>
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

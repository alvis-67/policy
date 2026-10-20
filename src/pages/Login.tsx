import { type FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('請填寫有效的電郵')
      return
    }
    if (password.length < 6) {
      setError('密碼至少要 6 個字元')
      return
    }
    setBusy(true)
    try {
      if (mode === 'sign-up') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (signUpError) throw signUpError
        if (!data.session) {
          setNotice('帳號已建立。請到電郵按確認連結，然後再登入。')
          setMode('sign-in')
        }
        return
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) throw signInError
    } catch (reason) {
      setError(reason instanceof Error ? loginError(reason.message) : '登入失敗，請再試一次。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card stack" onSubmit={onSubmit}>
        <div className="row">
          <span className="brand-mark">保</span>
          <span>
            <span className="brand-name pine">保冊</span>
            <span className="subline">保單管理</span>
          </span>
        </div>
        <div>
          <h1 className="page-title">{mode === 'sign-in' ? '登入' : '建立帳號'}</h1>
          <p className="lede">只有已登入的帳號可以查看同編輯客戶保單。</p>
        </div>
        {error ? (
          <div className="error-banner" role="alert">
            {error}
          </div>
        ) : null}
        {notice ? <div className="notice">{notice}</div> : null}
        <div className="field">
          <label htmlFor="email">電郵</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="password">密碼</label>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? '處理中…' : mode === 'sign-in' ? '登入' : '建立帳號'}
        </button>
        <button
          className="linkish"
          type="button"
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
            setError(null)
            setNotice(null)
          }}
        >
          {mode === 'sign-in' ? '第一次使用，建立帳號' : '已有帳號，返回登入'}
        </button>
      </form>
    </div>
  )
}

function loginError(message: string) {
  const text = message.toLowerCase()
  if (text.includes('invalid login')) return '電郵或密碼不正確。'
  if (text.includes('email not confirmed')) return '請先到電郵按確認連結，然後再登入。'
  if (text.includes('already registered') || text.includes('already been registered')) return '這個電郵已經有帳號，請直接登入。'
  return '登入失敗，請再試一次。'
}

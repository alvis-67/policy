import { type FormEvent, useEffect, useState } from 'react'
import { errorMessage } from '../api'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PageHeader } from '../components/PageHeader'
import { Toast } from '../components/Toast'
import {
  createInsurer,
  createProduct,
  deleteInsurer,
  deleteProduct,
  loadCatalog,
  moveInsurer,
  moveProduct,
  renameInsurer,
  renameProduct,
  type CatalogBook,
  type CatalogInsurer,
  type CatalogProduct,
} from '../lib/catalog'
import { POLICY_TYPES, labelOf, type PolicyType } from '../lib/labels'

type Pending =
  | { kind: 'insurer'; row: CatalogInsurer }
  | { kind: 'product'; row: CatalogProduct }

export function Catalog() {
  const [book, setBook] = useState<CatalogBook | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [policyType, setPolicyType] = useState<PolicyType>('life')
  const [insurerName, setInsurerName] = useState('')
  const [productName, setProductName] = useState('')
  const [editing, setEditing] = useState<{ kind: 'insurer' | 'product'; id: string; value: string } | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = '名稱 · 保冊'
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function reload(preferId?: string) {
    const next = await loadCatalog()
    setBook(next)
    setSelectedKey((current) => {
      const wanted = preferId ?? current
      if (wanted && next.insurers.some((item) => (item.id || item.name) === wanted)) return wanted
      return next.insurers[0] ? next.insurers[0].id || next.insurers[0].name : null
    })
    return next
  }

  useEffect(() => {
    let active = true
    loadCatalog()
      .then((next) => {
        if (!active) return
        setBook(next)
        setSelectedKey(next.insurers[0] ? next.insurers[0].id || next.insurers[0].name : null)
      })
      .catch((reason) => {
        if (!active) return
        setError(errorMessage(reason))
      })
    return () => {
      active = false
    }
  }, [])

  const selected = book?.insurers.find((item) => (item.id || item.name) === selectedKey) ?? null
  const products = book?.products.filter((item) => item.insurerName === selected?.name && item.policyType === policyType) ?? []

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await reload()
      setToast(message)
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  async function onAddInsurer(event: FormEvent) {
    event.preventDefault()
    const name = insurerName
    await run(async () => {
      await createInsurer(name)
      setInsurerName('')
    }, '已新增保險公司')
  }

  async function onAddProduct(event: FormEvent) {
    event.preventDefault()
    if (!selected?.id) return
    const name = productName
    const type = policyType
    await run(async () => {
      await createProduct(selected.id, type, name)
      setProductName('')
    }, '已新增保單名稱')
  }

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    const current = editing
    await run(async () => {
      if (current.kind === 'insurer') await renameInsurer(current.id, current.value)
      else await renameProduct(current.id, current.value)
      setEditing(null)
    }, '已更新名稱')
  }

  async function onConfirmDelete() {
    if (!pending) return
    const current = pending
    setBusy(true)
    setError(null)
    try {
      if (current.kind === 'insurer') await deleteInsurer(current.row.id)
      else await deleteProduct(current.row.id)
      setPending(null)
      await reload(current.kind === 'insurer' ? undefined : selectedKey ?? undefined)
      setToast(current.kind === 'insurer' ? '已從選單移除保險公司' : '已從選單移除保單名稱')
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack-lg">
      <PageHeader title="名稱管理" description="管理新增保單時可選的保險公司同保單名稱。改名會一併更新已儲存的保單；刪除只會從選單移除。" />
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
      {book && !book.ready ? (
        <div className="notice">
          名稱清單尚未存入資料庫，所以這裡暫時不能修改。請打開 Supabase SQL Editor，貼上並執行 <strong>supabase/catalog.sql</strong>，然後重新整理。
        </div>
      ) : null}
      {!book ? <p className="muted">載入中…</p> : null}
      {book ? (
        <div className="catalog-grid">
          <section className="card">
            <div className="catalog-head">
              <h2 className="section-title">保險公司</h2>
            </div>
            <div className="catalog-list">
              {book.insurers.map((insurer, index) => (
                <div key={insurer.id || insurer.name} className={(insurer.id || insurer.name) === selectedKey ? 'list-row selected' : 'list-row'}>
                  {editing?.kind === 'insurer' && editing.id === insurer.id ? (
                    <form className="add-row inline" onSubmit={(event) => void onSaveEdit(event)}>
                      <input value={editing.value} onChange={(event) => setEditing({ ...editing, value: event.target.value })} aria-label="保險公司名稱" />
                      <button type="submit" className="btn btn-primary" disabled={busy}>
                        儲存
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)} disabled={busy}>
                        取消
                      </button>
                    </form>
                  ) : (
                    <>
                      <button type="button" className="catalog-pick" onClick={() => setSelectedKey(insurer.id || insurer.name)}>
                        {insurer.name}
                      </button>
                      {book.ready ? (
                        <span className="row-actions">
                          <button type="button" className="linkish" disabled={busy || index === 0} onClick={() => void run(() => moveInsurer(insurer.id, -1), '已調整次序')}>
                            上移
                          </button>
                          <button
                            type="button"
                            className="linkish"
                            disabled={busy || index === book.insurers.length - 1}
                            onClick={() => void run(() => moveInsurer(insurer.id, 1), '已調整次序')}
                          >
                            下移
                          </button>
                          <button type="button" className="linkish" disabled={busy} onClick={() => setEditing({ kind: 'insurer', id: insurer.id, value: insurer.name })}>
                            改名
                          </button>
                          <button type="button" className="linkish danger" disabled={busy} onClick={() => setPending({ kind: 'insurer', row: insurer })}>
                            刪除
                          </button>
                        </span>
                      ) : null}
                    </>
                  )}
                </div>
              ))}
            </div>
            {book.ready ? (
              <form className="add-row" onSubmit={(event) => void onAddInsurer(event)}>
                <input value={insurerName} onChange={(event) => setInsurerName(event.target.value)} placeholder="新增保險公司" aria-label="新增保險公司" />
                <button type="submit" className="btn btn-primary" disabled={busy || !insurerName.trim()}>
                  新增
                </button>
              </form>
            ) : null}
          </section>
          <section className="card">
            <div className="catalog-head">
              <h2 className="section-title">{selected ? selected.name : '保單名稱'}</h2>
              <label className="catalog-type">
                <span className="hint">保障類別</span>
                <select value={policyType} onChange={(event) => setPolicyType(event.target.value as PolicyType)} aria-label="保障類別">
                  {POLICY_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!selected ? <p className="catalog-empty muted">請先選擇保險公司。</p> : null}
            {selected && products.length === 0 ? <p className="catalog-empty muted">此類別尚未有保單名稱。</p> : null}
            <div className="catalog-list">
              {products.map((product, index) => (
                <div key={product.id || product.name} className="list-row">
                  {editing?.kind === 'product' && editing.id === product.id ? (
                    <form className="add-row inline" onSubmit={(event) => void onSaveEdit(event)}>
                      <input value={editing.value} onChange={(event) => setEditing({ ...editing, value: event.target.value })} aria-label="保單名稱" />
                      <button type="submit" className="btn btn-primary" disabled={busy}>
                        儲存
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)} disabled={busy}>
                        取消
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="catalog-pick">{product.name}</span>
                      {book.ready ? (
                        <span className="row-actions">
                          <button type="button" className="linkish" disabled={busy || index === 0} onClick={() => void run(() => moveProduct(product.id, -1), '已調整次序')}>
                            上移
                          </button>
                          <button
                            type="button"
                            className="linkish"
                            disabled={busy || index === products.length - 1}
                            onClick={() => void run(() => moveProduct(product.id, 1), '已調整次序')}
                          >
                            下移
                          </button>
                          <button type="button" className="linkish" disabled={busy} onClick={() => setEditing({ kind: 'product', id: product.id, value: product.name })}>
                            改名
                          </button>
                          <button type="button" className="linkish danger" disabled={busy} onClick={() => setPending({ kind: 'product', row: product })}>
                            刪除
                          </button>
                        </span>
                      ) : null}
                    </>
                  )}
                </div>
              ))}
            </div>
            {book.ready && selected ? (
              <form className="add-row" onSubmit={(event) => void onAddProduct(event)}>
                <input
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                  placeholder={`新增${labelOf(POLICY_TYPES, policyType)}保單名稱`}
                  aria-label="新增保單名稱"
                />
                <button type="submit" className="btn btn-primary" disabled={busy || !productName.trim()}>
                  新增
                </button>
              </form>
            ) : null}
          </section>
        </div>
      ) : null}
      {pending ? (
        <ConfirmDialog
          title={pending.kind === 'insurer' ? '從選單移除保險公司' : '從選單移除保單名稱'}
          body={
            pending.kind === 'insurer'
              ? `「${pending.row.name}」同旗下保單名稱會從選單移除。已儲存的客戶保單不會刪除。`
              : `「${pending.row.name}」會從選單移除。已儲存的客戶保單不會刪除。`
          }
          confirmLabel="移除"
          busy={busy}
          onConfirm={() => void onConfirmDelete()}
          onCancel={() => !busy && setPending(null)}
        />
      ) : null}
      <Toast message={toast} />
    </div>
  )
}

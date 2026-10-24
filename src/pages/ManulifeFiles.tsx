import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Field } from '../components/Field'
import { PageHeader } from '../components/PageHeader'
import { formatMoney } from '../lib/format'
import { labelOf, POLICY_TYPES, type PolicyType } from '../lib/labels'
import {
  deleteManulifeDocument,
  FILE_KINDS,
  listManulifeDocuments,
  MANULIFE_INSURER,
  openManulifeDocument,
  uploadManulifeDocument,
  type FileKind,
  type ManulifeDocument,
} from '../lib/manulifeFiles'
import { amountCaret, formatAmountInput } from '../lib/parse'
import { catalogProducts } from '../lib/products'

export function ManulifeFiles() {
  const [documents, setDocuments] = useState<ManulifeDocument[]>([])
  const [ready, setReady] = useState(true)
  const [productName, setProductName] = useState('')
  const [policyType, setPolicyType] = useState<PolicyType>('life')
  const [fileKind, setFileKind] = useState<FileKind>('brochure')
  const [premiumAmount, setPremiumAmount] = useState('')
  const [premiumNote, setPremiumNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<ManulifeDocument | null>(null)
  const names = useMemo(() => catalogProducts(MANULIFE_INSURER, policyType), [policyType])

  useEffect(() => {
    document.title = '宏利產品 · 保冊'
    void load()
  }, [])

  async function load() {
    try {
      const book = await listManulifeDocuments()
      setReady(book.ready)
      setDocuments(book.documents)
      if (!book.ready) setError('請到 Supabase SQL Editor 執行 supabase/manulife.sql，然後重新整理。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '讀取失敗，請再試一次。')
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!file) {
      setError('請選擇檔案')
      return
    }
    setBusy(true)
    setError('')
    try {
      const saved = await uploadManulifeDocument({ productName, policyType, fileKind, premiumAmount, premiumNote, file })
      setDocuments((current) => [saved, ...current])
      setProductName('')
      setPremiumAmount('')
      setPremiumNote('')
      setFile(null)
      const input = document.getElementById('manulife-file') as HTMLInputElement | null
      if (input) input.value = ''
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '上傳失敗，請再試一次。')
    } finally {
      setBusy(false)
    }
  }

  async function remove(document: ManulifeDocument) {
    setBusy(true)
    setError('')
    try {
      await deleteManulifeDocument(document)
      setDocuments((current) => current.filter((item) => item.id !== document.id))
      setPending(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '刪除失敗，請再試一次。')
    } finally {
      setBusy(false)
    }
  }

  function onPremium(event: ChangeEvent<HTMLInputElement>) {
    const formatted = formatAmountInput(event.target.value)
    const caret = amountCaret(event.target.value, formatted, event.target.selectionStart ?? formatted.length)
    const input = event.target
    setPremiumAmount(formatted)
    requestAnimationFrame(() => input.setSelectionRange(caret, caret))
  }

  return (
    <div className="stack-lg">
      <PageHeader title="宏利產品" description="上傳宏利的小冊子同保費檔。檔案只供你之後推薦時使用，系統暫時不會自動閱讀內容。" />
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
      <form className="card manulife-form" onSubmit={(event) => void onSubmit(event)}>
        <div className="form-grid">
          <Field label="產品名稱" htmlFor="productName" required hint="可以選現有名稱，或自行輸入。">
            <input id="productName" list="manulife-names" value={productName} onChange={(event) => setProductName(event.target.value)} required />
            <datalist id="manulife-names">
              {names.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </Field>
          <Field label="類別" htmlFor="policyType" required>
            <select id="policyType" value={policyType} onChange={(event) => setPolicyType(event.target.value as PolicyType)}>
              {POLICY_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="檔案種類" htmlFor="fileKind" required>
            <select id="fileKind" value={fileKind} onChange={(event) => setFileKind(event.target.value as FileKind)}>
              {FILE_KINDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="檔案" htmlFor="manulife-file" required hint="PDF、圖片或試算表，上限 20MB。">
            <input
              id="manulife-file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xls,.xlsx,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Field>
          {fileKind === 'premium' ? (
            <Field label="參考保費" htmlFor="premiumAmount" hint="選填。例如這份保費表入面一個代表性保費。">
              <input id="premiumAmount" inputMode="decimal" value={premiumAmount} placeholder="12,000" onChange={onPremium} />
            </Field>
          ) : null}
          <Field label="備註" htmlFor="premiumNote" hint="選填。例如 35歲非吸煙男性，每10萬保額。">
            <input id="premiumNote" value={premiumNote} onChange={(event) => setPremiumNote(event.target.value)} />
          </Field>
        </div>
        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={busy || !ready}>
            {busy ? '處理中…' : '上傳'}
          </button>
        </div>
      </form>
      {documents.length === 0 ? <p className="muted">尚未上傳檔案。</p> : null}
      <div className="manulife-list">
        {documents.map((item) => (
          <article key={item.id} className="card manulife-row">
            <div>
              <strong>{item.productName}</strong>
              <p className="muted">
                {labelOf(POLICY_TYPES, item.policyType)} · {labelOf(FILE_KINDS, item.fileKind)} · {item.fileName}
                {item.premiumAmount != null ? ` · ${formatMoney(item.premiumAmount, 'HKD')}` : ''}
              </p>
              {item.premiumNote ? <p className="hint">{item.premiumNote}</p> : null}
            </div>
            <div className="inline-actions">
              <button type="button" className="linkish" onClick={() => void openManulifeDocument(item.storagePath).catch((cause) => setError(cause instanceof Error ? cause.message : '開啟失敗'))}>
                開啟
              </button>
              <button type="button" className="linkish danger" onClick={() => setPending(item)}>
                刪除
              </button>
            </div>
          </article>
        ))}
      </div>
      {pending ? (
        <ConfirmDialog
          title="刪除檔案"
          body={`刪除「${pending.productName}」的${labelOf(FILE_KINDS, pending.fileKind)}。`}
          confirmLabel="刪除"
          busy={busy}
          onCancel={() => !busy && setPending(null)}
          onConfirm={() => void remove(pending)}
        />
      ) : null}
    </div>
  )
}

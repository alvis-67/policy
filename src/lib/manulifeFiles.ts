import { supabase } from './supabase'
import type { PolicyType } from './labels'
import { manulifeFileError, storageFileName } from './manulifeFileRules'
import { parseOptionalNumber } from './parse'

export const MANULIFE_INSURER = '宏利 Manulife'
export { manulifeFileError, storageFileName }

export const FILE_KINDS = [
  { value: 'brochure', label: '小冊子' },
  { value: 'premium', label: '保費' },
] as const

export type FileKind = (typeof FILE_KINDS)[number]['value']

export interface ManulifeDocument {
  id: string
  productName: string
  policyType: PolicyType
  fileKind: FileKind
  fileName: string
  storagePath: string
  premiumAmount: number | null
  premiumNote: string
  createdAt: string
}

export async function listManulifeDocuments() {
  const result = await supabase.from('manulife_documents').select('*').order('created_at', { ascending: false })
  if (result.error) {
    if (missingStore(result.error)) return { ready: false as const, documents: [] as ManulifeDocument[] }
    throw new Error(storeMessage(result.error))
  }
  return { ready: true as const, documents: (result.data ?? []).map(mapDocument) }
}

export async function uploadManulifeDocument(input: {
  productName: string
  policyType: PolicyType
  fileKind: FileKind
  premiumAmount: string
  premiumNote: string
  file: File
}) {
  const productName = input.productName.replace(/\s+/g, ' ').trim()
  if (!productName) throw new Error('請輸入產品名稱')
  if (productName.length > 80) throw new Error('產品名稱太長')
  const fileError = manulifeFileError(input.file.name, input.file.size)
  if (fileError) throw new Error(fileError)
  const premium = input.fileKind === 'premium' ? parseOptionalNumber(input.premiumAmount) : null
  if (premium === 'invalid') throw new Error('請輸入有效的參考保費')
  const note = input.premiumNote.replace(/\s+/g, ' ').trim()
  if (note.length > 200) throw new Error('備註太長')
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('請先登入')
  const id = crypto.randomUUID()
  const storagePath = `${userData.user.id}/${id}/${storageFileName(input.file.name)}`
  const uploaded = await supabase.storage.from('product-files').upload(storagePath, input.file, { upsert: false })
  if (uploaded.error) throw new Error(storeMessage(uploaded.error))
  const inserted = await supabase
    .from('manulife_documents')
    .insert({
      id,
      product_name: productName,
      policy_type: input.policyType,
      file_kind: input.fileKind,
      file_name: input.file.name.slice(0, 180),
      storage_path: storagePath,
      premium_amount: premium,
      premium_note: note,
    })
    .select('*')
    .single()
  if (inserted.error) {
    await supabase.storage.from('product-files').remove([storagePath])
    throw new Error(storeMessage(inserted.error))
  }
  return mapDocument(inserted.data)
}

export async function openManulifeDocument(path: string) {
  const result = await supabase.storage.from('product-files').createSignedUrl(path, 120)
  if (result.error || !result.data?.signedUrl) throw new Error('開啟檔案失敗，請再試一次。')
  window.open(result.data.signedUrl, '_blank', 'noopener')
}

export async function deleteManulifeDocument(document: ManulifeDocument) {
  const removed = await supabase.from('manulife_documents').delete().eq('id', document.id)
  if (removed.error) throw new Error(storeMessage(removed.error))
  await supabase.storage.from('product-files').remove([document.storagePath])
}

function mapDocument(row: {
  id: string
  product_name: string
  policy_type: string
  file_kind: string
  file_name: string
  storage_path: string
  premium_amount: number | string | null
  premium_note: string
  created_at: string
}): ManulifeDocument {
  return {
    id: row.id,
    productName: row.product_name,
    policyType: row.policy_type as PolicyType,
    fileKind: row.file_kind as FileKind,
    fileName: row.file_name,
    storagePath: row.storage_path,
    premiumAmount: row.premium_amount == null ? null : Number(row.premium_amount),
    premiumNote: row.premium_note,
    createdAt: row.created_at,
  }
}

function missingStore(error: { code?: string; message?: string }) {
  const message = (error.message ?? '').toLowerCase()
  return error.code === 'PGRST205' || error.code === '42P01' || message.includes('manulife_documents') || message.includes('does not exist') || message.includes('could not find the table')
}

function storeMessage(error: { message?: string; code?: string }) {
  if (missingStore(error) || /bucket|product-files/i.test(error.message ?? '')) {
    return '請到 Supabase SQL Editor 執行 supabase/manulife.sql，然後重新整理。'
  }
  return error.message || '操作失敗，請再試一次。'
}

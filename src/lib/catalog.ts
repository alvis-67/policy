import { supabase } from './supabase'
import { INSURERS, POLICY_TYPES, type PolicyType } from './labels'
import { catalogProducts } from './products'

export interface CatalogInsurer {
  id: string
  name: string
  sortOrder: number
}

export interface CatalogProduct {
  id: string
  insurerId: string
  insurerName: string
  policyType: PolicyType
  name: string
  sortOrder: number
}

export interface CatalogBook {
  ready: boolean
  insurers: CatalogInsurer[]
  products: CatalogProduct[]
}

interface InsurerRow {
  id: string
  name: string
  sort_order: number
}

interface ProductRow {
  id: string
  insurer_id: string
  policy_type: string
  name: string
  sort_order: number
}

function cleanName(value: string, max: number, label: string) {
  const text = value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) throw new Error(`請輸入${label}`)
  if (text.length > max) throw new Error(`${label}太長`)
  return text
}

function missingTable(error: { code?: string; message?: string } | null) {
  if (!error) return false
  const message = (error.message ?? '').toLowerCase()
  return error.code === 'PGRST205' || error.code === '42P01' || message.includes('does not exist') || message.includes('could not find the table')
}

function asPolicyType(value: string): PolicyType | null {
  return POLICY_TYPES.find((option) => option.value === value)?.value ?? null
}

function builtinBook(extraPolicies: Array<{ insurer: string; policy_type: string; policy_name: string }> = []): CatalogBook {
  const insurers: CatalogInsurer[] = INSURERS.map((name, sortOrder) => ({ id: '', name, sortOrder }))
  const products: CatalogProduct[] = []
  const seenInsurers = new Set<string>(INSURERS)
  const seenProducts = new Set<string>()
  for (const insurer of INSURERS) {
    for (const option of POLICY_TYPES) {
      catalogProducts(insurer, option.value).forEach((name, sortOrder) => {
        seenProducts.add(`${insurer}\0${option.value}\0${name}`)
        products.push({ id: '', insurerId: '', insurerName: insurer, policyType: option.value, name, sortOrder })
      })
    }
  }
  for (const policy of extraPolicies) {
    const policyType = asPolicyType(policy.policy_type)
    const insurer = policy.insurer.trim()
    const name = policy.policy_name.trim()
    if (!policyType || !insurer || !name) continue
    if (!seenInsurers.has(insurer)) {
      seenInsurers.add(insurer)
      insurers.push({ id: '', name: insurer, sortOrder: insurers.length })
    }
    const key = `${insurer}\0${policyType}\0${name}`
    if (seenProducts.has(key)) continue
    seenProducts.add(key)
    products.push({ id: '', insurerId: '', insurerName: insurer, policyType, name, sortOrder: products.length })
  }
  return { ready: false, insurers, products }
}

async function readPolicies() {
  const result = await supabase.from('policies').select('insurer,policy_type,policy_name,updated_at').order('updated_at', { ascending: false })
  if (result.error) return []
  return (result.data ?? []) as Array<{ insurer: string; policy_type: string; policy_name: string }>
}

function mapBook(insurerRows: InsurerRow[], productRows: ProductRow[]): CatalogBook {
  const insurers = insurerRows.map((row) => ({ id: row.id, name: row.name, sortOrder: row.sort_order }))
  const names = new Map(insurers.map((row) => [row.id, row.name]))
  const products: CatalogProduct[] = []
  for (const row of productRows) {
    const policyType = asPolicyType(row.policy_type)
    const insurerName = names.get(row.insurer_id)
    if (!policyType || !insurerName) continue
    products.push({
      id: row.id,
      insurerId: row.insurer_id,
      insurerName,
      policyType,
      name: row.name,
      sortOrder: row.sort_order,
    })
  }
  return { ready: true, insurers, products }
}

async function fetchRows(): Promise<{ missing: boolean; insurers: InsurerRow[]; products: ProductRow[] }> {
  const insurersResult = await supabase.from('insurers').select('id,name,sort_order').order('sort_order').order('name')
  if (missingTable(insurersResult.error)) return { missing: true, insurers: [], products: [] }
  if (insurersResult.error) throw new Error('讀取保險公司失敗，請再試一次。')
  const productsResult = await supabase.from('policy_products').select('id,insurer_id,policy_type,name,sort_order').order('sort_order').order('name')
  if (productsResult.error) throw new Error('讀取保單名稱失敗，請再試一次。')
  return {
    missing: false,
    insurers: (insurersResult.data ?? []) as InsurerRow[],
    products: (productsResult.data ?? []) as ProductRow[],
  }
}

async function seedCatalog() {
  const insurerRows = INSURERS.map((name, sortOrder) => ({ name, sort_order: sortOrder }))
  const inserted = await supabase.from('insurers').insert(insurerRows).select('id,name')
  if (inserted.error?.code === '23505') return
  if (inserted.error || !inserted.data?.length) throw new Error('建立保險公司清單失敗，請再試一次。')
  const idByName = new Map((inserted.data as Array<{ id: string; name: string }>).map((row) => [row.name, row.id]))
  const productRows: Array<{ insurer_id: string; policy_type: PolicyType; name: string; sort_order: number }> = []
  const seen = new Set<string>()
  for (const insurer of INSURERS) {
    const insurerId = idByName.get(insurer)
    if (!insurerId) continue
    for (const option of POLICY_TYPES) {
      catalogProducts(insurer, option.value).forEach((name, sortOrder) => {
        seen.add(`${insurer}\0${option.value}\0${name}`)
        productRows.push({ insurer_id: insurerId, policy_type: option.value, name, sort_order: sortOrder })
      })
    }
  }
  let nextInsurerSort = INSURERS.length
  const savedPolicies = await readPolicies()
  for (const policy of savedPolicies) {
    const policyType = asPolicyType(policy.policy_type)
    const insurer = policy.insurer.trim()
    const name = policy.policy_name.trim()
    if (!policyType || !insurer || !name) continue
    if (!idByName.has(insurer)) {
      const created = await supabase.from('insurers').insert({ name: insurer, sort_order: nextInsurerSort }).select('id,name').single()
      if (created.error || !created.data) continue
      idByName.set(insurer, (created.data as { id: string }).id)
      nextInsurerSort += 1
    }
    const key = `${insurer}\0${policyType}\0${name}`
    if (seen.has(key)) continue
    seen.add(key)
    const insurerId = idByName.get(insurer)
    if (!insurerId) continue
    productRows.push({ insurer_id: insurerId, policy_type: policyType, name, sort_order: productRows.length })
  }
  if (!productRows.length) return
  const products = await supabase.from('policy_products').insert(productRows)
  if (products.error && products.error.code !== '23505') throw new Error('建立保單名稱清單失敗，請再試一次。')
}

export async function loadCatalog(): Promise<CatalogBook> {
  const first = await fetchRows()
  if (first.missing) return builtinBook(await readPolicies())
  if (first.insurers.length === 0) {
    await seedCatalog()
    const second = await fetchRows()
    if (second.missing || second.insurers.length === 0) return builtinBook(await readPolicies())
    return mapBook(second.insurers, second.products)
  }
  return mapBook(first.insurers, first.products)
}

export async function rememberChoice(insurer: string, policyType: PolicyType, policyName: string) {
  const book = await loadCatalog()
  if (!book.ready) return
  const insurerName = cleanName(insurer, 60, '保險公司名稱')
  const name = cleanName(policyName, 80, '保單名稱')
  let insurerRow = book.insurers.find((item) => item.name === insurerName)
  if (!insurerRow) {
    const created = await supabase
      .from('insurers')
      .insert({ name: insurerName, sort_order: book.insurers.length })
      .select('id,name,sort_order')
      .single()
    if (created.error || !created.data) return
    const row = created.data as InsurerRow
    insurerRow = { id: row.id, name: row.name, sortOrder: row.sort_order }
  }
  const exists = book.products.some((item) => item.insurerId === insurerRow.id && item.policyType === policyType && item.name === name)
  if (exists) return
  const sortOrder = book.products.filter((item) => item.insurerId === insurerRow.id && item.policyType === policyType).length
  await supabase.from('policy_products').insert({
    insurer_id: insurerRow.id,
    policy_type: policyType,
    name,
    sort_order: sortOrder,
  })
}

export async function createInsurer(name: string) {
  const book = await loadCatalog()
  if (!book.ready) throw new Error('名稱清單尚未建立。')
  const trimmed = cleanName(name, 60, '保險公司名稱')
  if (book.insurers.some((item) => item.name === trimmed)) throw new Error('已有相同的保險公司名稱')
  const result = await supabase.from('insurers').insert({ name: trimmed, sort_order: book.insurers.length })
  if (result.error) throw new Error('新增保險公司失敗，請再試一次。')
}

export async function renameInsurer(id: string, name: string) {
  const trimmed = cleanName(name, 60, '保險公司名稱')
  const current = await supabase.from('insurers').select('name').eq('id', id).single()
  if (current.error || !current.data) throw new Error('找不到這間保險公司')
  const previous = (current.data as { name: string }).name
  if (previous === trimmed) return
  const clash = await supabase.from('insurers').select('id').eq('name', trimmed).maybeSingle()
  if (clash.data) throw new Error('已有相同的保險公司名稱')
  const policies = await supabase.from('policies').update({ insurer: trimmed }).eq('insurer', previous)
  if (policies.error) throw new Error('更新已儲存保單失敗，請再試一次。')
  const updated = await supabase.from('insurers').update({ name: trimmed }).eq('id', id)
  if (updated.error) throw new Error('更改保險公司名稱失敗，請再試一次。')
}

export async function deleteInsurer(id: string) {
  const result = await supabase.from('insurers').delete().eq('id', id)
  if (result.error) throw new Error('刪除保險公司失敗，請再試一次。')
}

export async function moveInsurer(id: string, direction: -1 | 1) {
  const book = await loadCatalog()
  const index = book.insurers.findIndex((item) => item.id === id)
  const target = index + direction
  if (!book.ready || index < 0 || target < 0 || target >= book.insurers.length) return
  const order = book.insurers.slice()
  const [item] = order.splice(index, 1)
  order.splice(target, 0, item)
  const results = await Promise.all(order.map((row, sortOrder) => supabase.from('insurers').update({ sort_order: sortOrder }).eq('id', row.id)))
  if (results.some((result) => result.error)) throw new Error('調整次序失敗，請再試一次。')
}

export async function createProduct(insurerId: string, policyType: PolicyType, name: string) {
  const book = await loadCatalog()
  if (!book.ready) throw new Error('名稱清單尚未建立。')
  const trimmed = cleanName(name, 80, '保單名稱')
  if (book.products.some((item) => item.insurerId === insurerId && item.policyType === policyType && item.name === trimmed)) {
    throw new Error('此類別已有相同的保單名稱')
  }
  const sortOrder = book.products.filter((item) => item.insurerId === insurerId && item.policyType === policyType).length
  const result = await supabase.from('policy_products').insert({
    insurer_id: insurerId,
    policy_type: policyType,
    name: trimmed,
    sort_order: sortOrder,
  })
  if (result.error) throw new Error('新增保單名稱失敗，請再試一次。')
}

export async function renameProduct(id: string, name: string) {
  const trimmed = cleanName(name, 80, '保單名稱')
  const current = await supabase.from('policy_products').select('name,policy_type,insurer_id').eq('id', id).single()
  if (current.error || !current.data) throw new Error('找不到這個保單名稱')
  const row = current.data as { name: string; policy_type: string; insurer_id: string }
  if (row.name === trimmed) return
  const insurer = await supabase.from('insurers').select('name').eq('id', row.insurer_id).single()
  if (insurer.error || !insurer.data) throw new Error('找不到這間保險公司')
  const insurerName = (insurer.data as { name: string }).name
  const policies = await supabase
    .from('policies')
    .update({ policy_name: trimmed })
    .eq('insurer', insurerName)
    .eq('policy_type', row.policy_type)
    .eq('policy_name', row.name)
  if (policies.error) throw new Error('更新已儲存保單失敗，請再試一次。')
  const updated = await supabase.from('policy_products').update({ name: trimmed }).eq('id', id)
  if (updated.error) throw new Error('更改保單名稱失敗，請再試一次。')
}

export async function deleteProduct(id: string) {
  const result = await supabase.from('policy_products').delete().eq('id', id)
  if (result.error) throw new Error('刪除保單名稱失敗，請再試一次。')
}

export async function moveProduct(id: string, direction: -1 | 1) {
  const book = await loadCatalog()
  const product = book.products.find((item) => item.id === id)
  if (!book.ready || !product) return
  const group = book.products.filter((item) => item.insurerId === product.insurerId && item.policyType === product.policyType)
  const index = group.findIndex((item) => item.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= group.length) return
  const order = group.slice()
  const [item] = order.splice(index, 1)
  order.splice(target, 0, item)
  const results = await Promise.all(order.map((row, sortOrder) => supabase.from('policy_products').update({ sort_order: sortOrder }).eq('id', row.id)))
  if (results.some((result) => result.error)) throw new Error('調整次序失敗，請再試一次。')
}

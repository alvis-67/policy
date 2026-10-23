export function formatAmountInput(raw: string) {
  const cleaned = raw.replace(/,/g, '').replace(/[^\d.]/g, '')
  if (!cleaned) return ''
  const dot = cleaned.indexOf('.')
  const wholeRaw = (dot === -1 ? cleaned : cleaned.slice(0, dot)).replace(/^0+(?=\d)/, '')
  const fraction = dot === -1 ? '' : cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2)
  const grouped = wholeRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (dot === -1) return grouped
  return `${grouped || '0'}.${fraction}`
}

export function amountCaret(raw: string, formatted: string, selection: number) {
  const passed = raw.slice(0, selection).replace(/,/g, '').length
  let index = 0
  let seen = 0
  while (index < formatted.length && seen < passed) {
    if (formatted[index] !== ',') seen += 1
    index += 1
  }
  return index
}

export function parseOptionalNumber(raw: string, integer = false): number | null | 'invalid' {
  const text = raw.trim().replace(/,/g, '')
  if (!text) return null
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return 'invalid'
  const value = Number(text)
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000_000) return 'invalid'
  if (integer && !/^\d+$/.test(text)) return 'invalid'
  return value
}

export function parseRequiredNumber(raw: string): number | 'invalid' {
  const value = parseOptionalNumber(raw)
  if (value == null || value === 'invalid') return 'invalid'
  return value
}

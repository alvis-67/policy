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

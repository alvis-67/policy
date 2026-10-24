export const FILE_LIMIT = 20 * 1024 * 1024

const ALLOWED = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'csv', 'xls', 'xlsx'])

export function manulifeFileError(name: string, size: number) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED.has(ext)) return '只可以上傳 PDF、圖片或試算表。'
  if (size <= 0) return '檔案是空的。'
  if (size > FILE_LIMIT) return '檔案太大，上限 20MB。'
  return null
}

export function storageFileName(name: string) {
  const base = name.split(/[/\\]/).pop() ?? ''
  const ext = base.split('.').pop()?.toLowerCase() ?? ''
  return ALLOWED.has(ext) ? `file.${ext}` : 'file'
}

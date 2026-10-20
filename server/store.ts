import fs from 'node:fs'
import path from 'node:path'
import type { Client, Policy } from '../src/types'

export interface Database {
  version: 1
  clients: Client[]
  policies: Policy[]
}

const file = path.join(process.cwd(), 'data', 'db.json')

function emptyDb(): Database {
  return { version: 1, clients: [], policies: [] }
}

export function readDb(): Database {
  try {
    const raw = fs.readFileSync(file, 'utf8')
    if (!raw.trim()) return emptyDb()
    const data = JSON.parse(raw) as Database
    if (!data || data.version !== 1 || !Array.isArray(data.clients) || !Array.isArray(data.policies)) {
      throw new Error('保單資料檔格式不正確，已停止讀取以免覆蓋原檔。')
    }
    return data
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyDb()
    throw error
  }
}

function writeDb(db: Database) {
  const dir = path.dirname(file)
  fs.mkdirSync(dir, { recursive: true })
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`)
  const tmp = path.join(dir, `db.${process.pid}.tmp`)
  fs.writeFileSync(tmp, `${JSON.stringify(db, null, 2)}\n`, 'utf8')
  try {
    fs.renameSync(tmp, file)
  } catch {
    fs.copyFileSync(tmp, file)
    fs.rmSync(tmp, { force: true })
  }
}

let chain: Promise<void> = Promise.resolve()

export function update<T>(fn: (db: Database) => T): Promise<T> {
  const run = chain.then(() => {
    const db = readDb()
    const result = fn(db)
    writeDb(db)
    return result
  })
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

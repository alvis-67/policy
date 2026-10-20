import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { summarizePolicies } from './stats'
import { readDb, update, type Database } from './store'
import { HttpError, validateClient, validatePolicy } from './validate'
import type { Client, ClientListItem, Policy } from '../src/types'

const PORT = 3789
const app = express()

app.disable('x-powered-by')
app.use(cors({ origin: ['http://127.0.0.1:5173', 'http://localhost:5173'] }))
app.use(express.json({ limit: '1mb' }))
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  next()
})

const wrap = (fn: (req: Request, res: Response) => unknown) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve()
      .then(() => fn(req, res))
      .catch(next)
  }
}

function routeId(value: string | string[] | undefined) {
  const id = Array.isArray(value) ? value[0] : value
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new HttpError(400, '資料不正確')
  }
  return id
}

function queryString(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim()
  return ''
}

function policiesFor(db: Database, clientId: string) {
  return db.policies
    .filter((policy) => policy.clientId === clientId)
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.createdAt.localeCompare(a.createdAt))
}

function toListItem(client: Client, policies: Policy[]): ClientListItem {
  const totals = summarizePolicies(policies)
  return {
    id: client.id,
    chineseName: client.chineseName,
    englishName: client.englishName,
    phone: client.phone,
    dateOfBirth: client.dateOfBirth,
    gender: client.gender,
    updatedAt: client.updatedAt,
    policyCount: totals.policyCount,
    activeCount: totals.activeCount,
    annualPremium: totals.annualPremium,
  }
}

function matchesQuery(client: Client, policies: Policy[], query: string) {
  const haystack = [
    client.chineseName,
    client.englishName,
    client.phone,
    client.email,
    client.hkid,
    client.occupation,
    client.notes,
    ...policies.flatMap((policy) => [policy.insurer, policy.policyName, policy.policyNumber, policy.notes]),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query.toLowerCase())
}

app.get(
  '/api/summary',
  wrap((_req, res) => {
    const db = readDb()
    const totals = summarizePolicies(db.policies)
    const recentClients = db.clients
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6)
      .map((client) => toListItem(client, policiesFor(db, client.id)))
    res.json({
      clientCount: db.clients.length,
      policyCount: totals.policyCount,
      activePolicyCount: totals.activeCount,
      annualPremium: totals.annualPremium,
      byType: totals.byType,
      recentClients,
    })
  }),
)

app.get('/api/export', (_req, res) => {
  const stamp = new Date().toISOString().slice(0, 10)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="policy-backup-${stamp}.json"`)
  res.send(JSON.stringify(readDb(), null, 2))
})

app.get(
  '/api/clients',
  wrap((req, res) => {
    const db = readDb()
    const query = queryString(req.query.q)
    const clients = db.clients
      .filter((client) => {
        const policies = policiesFor(db, client.id)
        return !query || matchesQuery(client, policies, query)
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((client) => toListItem(client, policiesFor(db, client.id)))
    res.json(clients)
  }),
)

app.post(
  '/api/clients',
  wrap(async (req, res) => {
    const input = validateClient(req.body)
    const now = new Date().toISOString()
    const client = await update((db) => {
      const created: Client = { id: randomUUID(), ...input, createdAt: now, updatedAt: now }
      db.clients.push(created)
      return created
    })
    res.status(201).json(client)
  }),
)

app.get(
  '/api/clients/:id',
  wrap((req, res) => {
    const id = routeId(req.params.id)
    const db = readDb()
    const client = db.clients.find((item) => item.id === id)
    if (!client) throw new HttpError(404, '找不到這位客戶')
    const policies = policiesFor(db, id)
    res.json({ client, policies, totals: summarizePolicies(policies) })
  }),
)

app.put(
  '/api/clients/:id',
  wrap(async (req, res) => {
    const id = routeId(req.params.id)
    const input = validateClient(req.body)
    const client = await update((db) => {
      const current = db.clients.find((item) => item.id === id)
      if (!current) throw new HttpError(404, '找不到這位客戶')
      Object.assign(current, input, { updatedAt: new Date().toISOString() })
      return current
    })
    res.json(client)
  }),
)

app.delete(
  '/api/clients/:id',
  wrap(async (req, res) => {
    const id = routeId(req.params.id)
    await update((db) => {
      const current = db.clients.find((item) => item.id === id)
      if (!current) throw new HttpError(404, '找不到這位客戶')
      db.clients = db.clients.filter((item) => item.id !== id)
      db.policies = db.policies.filter((policy) => policy.clientId !== id)
    })
    res.json({ ok: true })
  }),
)

app.post(
  '/api/clients/:id/policies',
  wrap(async (req, res) => {
    const clientId = routeId(req.params.id)
    const input = validatePolicy(req.body)
    const now = new Date().toISOString()
    const policy = await update((db) => {
      const client = db.clients.find((item) => item.id === clientId)
      if (!client) throw new HttpError(404, '找不到這位客戶')
      const created: Policy = { id: randomUUID(), clientId, ...input, createdAt: now, updatedAt: now }
      db.policies.push(created)
      client.updatedAt = now
      return created
    })
    res.status(201).json(policy)
  }),
)

app.put(
  '/api/policies/:id',
  wrap(async (req, res) => {
    const id = routeId(req.params.id)
    const input = validatePolicy(req.body)
    const policy = await update((db) => {
      const current = db.policies.find((item) => item.id === id)
      if (!current) throw new HttpError(404, '找不到這張保單')
      Object.assign(current, input, { updatedAt: new Date().toISOString() })
      const client = db.clients.find((item) => item.id === current.clientId)
      if (client) client.updatedAt = current.updatedAt
      return current
    })
    res.json(policy)
  }),
)

app.delete(
  '/api/policies/:id',
  wrap(async (req, res) => {
    const id = routeId(req.params.id)
    await update((db) => {
      const current = db.policies.find((item) => item.id === id)
      if (!current) throw new HttpError(404, '找不到這張保單')
      db.policies = db.policies.filter((item) => item.id !== id)
      const client = db.clients.find((item) => item.id === current.clientId)
      if (client) client.updatedAt = new Date().toISOString()
    })
    res.json({ ok: true })
  }),
)

app.use('/api', (_req, res) => {
  res.status(404).json({ error: '找不到這項功能' })
})

if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve('dist')
  app.use(express.static(dist))
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(dist, 'index.html'), (error) => {
      if (error) next()
    })
  })
}

app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(error)
    return
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: '資料格式不正確' })
    return
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message })
    return
  }
  console.error(error)
  res.status(500).json({ error: '系統出現問題，請再試一次。' })
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`保冊 API http://127.0.0.1:${PORT}`)
})

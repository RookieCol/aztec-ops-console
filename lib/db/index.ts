import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { DB_PATH } from '@/lib/config'
import { schema } from './schema'

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  const sqlite = new Database(DB_PATH)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  return drizzle(sqlite, { schema })
}

declare global {
  var __aztecDb: ReturnType<typeof open> | undefined
}

// Next recarga los módulos en dev; una sola conexión evita bloqueos sobre el archivo.
export const db = globalThis.__aztecDb ?? open()
if (process.env.NODE_ENV !== 'production') globalThis.__aztecDb = db

export * from './schema'

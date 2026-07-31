import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'drizzle-kit'
import { DB_PATH } from './lib/config'

// drizzle-kit no crea el directorio del archivo, y en un clon en frío `data/` no existe.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

export default defineConfig({
  dialect: 'sqlite',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: DB_PATH },
  strict: false,
  verbose: false,
})

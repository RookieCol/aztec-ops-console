import { COP_PER_USD } from '@/lib/config'

/**
 * Normalizadores puros. Todos devuelven el valor y, cuando tuvieron que hacer algo no obvio,
 * un `issue` para la bitácora de calidad de datos. Regla: no se corrige nada en silencio y
 * nada se imputa — lo desconocido queda como null, nunca como cero.
 */

export type Issue = {
  severity: 'info' | 'warn' | 'error'
  code: string
  message: string
  rawValue?: string
}

export type Normalized<T> = { value: T; issues: Issue[] }

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/
const DMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

const pad = (n: number) => String(n).padStart(2, '0')

function valid(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const probe = new Date(Date.UTC(y, m - 1, d))
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d
}

/**
 * Fechas del dataset: casi todas ISO en texto, una en dd/mm/yyyy (PRJ-17: "02/03/2026") y
 * potencialmente seriales de Excel si el archivo se re-guarda.
 *
 * El formato ambiguo se resuelve como dd/mm porque el resto del portafolio ubica ese proyecto
 * en marzo de 2026 (PRJ-03 y PRJ-04 arrancan el 2026-03-02) — pero queda registrado que se
 * interpretó, no se asume correcto en silencio.
 */
export function normalizeDate(raw: unknown): Normalized<string | null> {
  if (raw === null || raw === undefined || raw === '') return { value: null, issues: [] }

  if (raw instanceof Date) {
    const iso = `${raw.getUTCFullYear()}-${pad(raw.getUTCMonth() + 1)}-${pad(raw.getUTCDate())}`
    return { value: iso, issues: [] }
  }

  if (typeof raw === 'number') {
    // Serial de Excel (base 1899-12-30).
    const ms = Math.round((raw - 25569) * 86_400_000)
    const d = new Date(ms)
    const iso = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    return {
      value: iso,
      issues: [
        {
          severity: 'info',
          code: 'date_from_excel_serial',
          message: `Fecha venía como serial de Excel y se normalizó a ${iso}`,
          rawValue: String(raw),
        },
      ],
    }
  }

  const text = String(raw).trim()

  const iso = ISO.exec(text)
  if (iso) {
    const [, y, m, d] = iso.map(Number) as unknown as [string, number, number, number]
    if (!valid(y, m, d)) {
      return {
        value: null,
        issues: [
          { severity: 'error', code: 'date_invalid', message: 'Fecha ISO inválida', rawValue: text },
        ],
      }
    }
    return { value: text, issues: [] }
  }

  const dmy = DMY.exec(text)
  if (dmy) {
    const d = Number(dmy[1])
    const m = Number(dmy[2])
    const y = Number(dmy[3])
    if (!valid(y, m, d)) {
      return {
        value: null,
        issues: [
          {
            severity: 'error',
            code: 'date_invalid',
            message: 'Fecha dd/mm/yyyy inválida',
            rawValue: text,
          },
        ],
      }
    }
    const value = `${y}-${pad(m)}-${pad(d)}`
    return {
      value,
      issues: [
        {
          severity: 'warn',
          code: 'date_format_mixed',
          message: `Formato dd/mm/yyyy mezclado con ISO en la misma columna; se interpretó como ${value}`,
          rawValue: text,
        },
      ],
    }
  }

  return {
    value: null,
    issues: [
      {
        severity: 'error',
        code: 'date_unparseable',
        message: 'No se pudo interpretar la fecha; queda vacía',
        rawValue: text,
      },
    ],
  }
}

/** Valor de negocio a USD. Desconocido es null, jamás cero. */
export function normalizeValue(
  raw: unknown,
  currency: unknown,
): Normalized<{ value: number | null; currency: string | null; usd: number | null }> {
  const cur = raw === '' || currency === '' || currency == null ? null : String(currency).trim()
  if (raw === null || raw === undefined || raw === '') {
    return {
      value: { value: null, currency: cur, usd: null },
      issues: [
        {
          severity: 'warn',
          code: 'value_missing',
          message: 'Proyecto sin valor de negocio; queda desconocido (no cero)',
        },
      ],
    }
  }

  const num = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(num)) {
    return {
      value: { value: null, currency: cur, usd: null },
      issues: [
        {
          severity: 'error',
          code: 'value_unparseable',
          message: 'Valor de negocio ilegible',
          rawValue: String(raw),
        },
      ],
    }
  }

  if (cur === 'COP') {
    return {
      value: { value: num, currency: cur, usd: num / COP_PER_USD },
      issues: [
        {
          severity: 'info',
          code: 'value_converted',
          message: `COP ${num.toLocaleString('es-CO')} → USD ${Math.round(num / COP_PER_USD).toLocaleString('en-US')} a tasa fija ${COP_PER_USD}`,
          rawValue: String(num),
        },
      ],
    }
  }

  return { value: { value: num, currency: cur ?? 'USD', usd: num }, issues: [] }
}

export function normalizeText(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'object') {
    // exceljs puede devolver { richText: [...] } o { text, hyperlink }
    const o = raw as Record<string, unknown>
    if (Array.isArray(o.richText)) {
      return (o.richText as { text: string }[]).map((r) => r.text).join('') || null
    }
    if (typeof o.text === 'string') return o.text.trim() || null
    if (typeof o.result === 'string') return o.result.trim() || null
    return null
  }
  const s = String(raw).trim()
  return s === '' ? null : s
}

export function normalizeBool(raw: unknown): boolean | null {
  const s = normalizeText(raw)?.toLowerCase()
  if (!s) return null
  if (['si', 'sí', 'yes', 'true', '1'].includes(s)) return true
  if (['no', 'false', '0'].includes(s)) return false
  return null
}

/**
 * La pestaña Notas arranca con filas de prueba (`test | ok`, `x | y`) antes del contenido real.
 * Se descartan por forma, no por posición: cualquier fila cuya primera celda sea un token corto
 * sin espacios y cuya segunda celda sea igual de corta no es una nota.
 */
export function isJunkNotesRow(a: unknown, b: unknown): boolean {
  const first = normalizeText(a)
  const second = normalizeText(b)
  if (!first) return true
  if (first.length <= 4 && !first.includes(' ') && (second?.length ?? 0) <= 4) return true
  return false
}

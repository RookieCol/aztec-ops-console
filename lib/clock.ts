/**
 * Reloj único e inyectable del sistema.
 *
 * Todo cálculo derivado (vencimientos, riesgo, score) pasa por acá. Dos razones:
 *
 * 1. Determinismo: los tests congelan la fecha y los números del video son reproducibles.
 * 2. Es la tesis del sistema hecha código. El dataset trae `is_overdue` precalculado y
 *    contradictorio (ver DATASET-HALLAZGOS.md §2). Nada derivado se persiste: se recalcula
 *    contra este reloj en cada lectura.
 *
 * `DEFAULT_TODAY` está fijado a propósito para que el prototipo coincida con lo que se
 * explica en el video. Se puede mover con APP_TODAY=YYYY-MM-DD.
 */

export const DEFAULT_TODAY = '2026-07-31'

export function today(): string {
  const raw = process.env.APP_TODAY?.trim()
  if (!raw) return DEFAULT_TODAY
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`APP_TODAY debe ser YYYY-MM-DD, llegó: ${raw}`)
  }
  return raw
}

export const isFrozen = () => !process.env.APP_TODAY

/** Fecha ISO (YYYY-MM-DD) → epoch day en UTC. Evita zonas horarias por completo. */
export function toDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

/** Días de `from` a `to`. Positivo si `to` es posterior. */
export function daysBetween(from: string, to: string): number {
  return toDay(to) - toDay(from)
}

/** Días de atraso contra hoy. Positivo = vencido. 0 si no hay fecha. */
export function daysOverdue(due: string | null, now = today()): number {
  if (!due) return 0
  return Math.max(0, daysBetween(due, now))
}

/** Días que faltan para la fecha. Negativo = ya venció. null si no hay fecha. */
export function daysUntil(due: string | null, now = today()): number | null {
  if (!due) return null
  return daysBetween(now, due)
}

export function isOverdue(due: string | null, now = today()): boolean {
  return due !== null && toDay(due) < toDay(now)
}
